"use server";

import { revalidatePath } from "next/cache";
import { prisma, estDoublon } from "@/lib/db";
import { verifierEspaceAdmin } from "@/lib/auth/acces";
import { journaliser } from "@/lib/audit";
import { saisieVersCents } from "@/lib/argent";
import { appliquerMouvement, planifierAjustementShopify } from "@/lib/services/stock";
import { champ, ErreurMetier, executer, type Resultat } from "@/lib/services/resultat";
import { lireReglages } from "@/lib/reglages";

function normaliser(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

function lireFormat(fd: FormData, prefixe = "") {
  const libelle = champ(fd, `${prefixe}libelleFormat`);
  const sku = champ(fd, `${prefixe}sku`).toUpperCase();
  const prix = saisieVersCents(champ(fd, `${prefixe}prix`));
  const contTxt = champ(fd, `${prefixe}contenanceMl`);
  const contenanceMl = contTxt ? Number(contTxt) : null;
  const champs: Record<string, string> = {};
  if (!libelle) champs[`${prefixe}libelleFormat`] = "Libellé du format obligatoire (ex. 50 ml).";
  if (!/^[A-Z0-9][A-Z0-9._-]{1,40}$/.test(sku)) champs[`${prefixe}sku`] = "Code de format (SKU) : lettres, chiffres, tirets.";
  if (prix === null || prix < 0) champs[`${prefixe}prix`] = "Prix de vente invalide (ex. 45,00).";
  if (contenanceMl !== null && (!Number.isInteger(contenanceMl) || contenanceMl <= 0 || contenanceMl > 5000)) champs[`${prefixe}contenanceMl`] = "Contenance en ml, entier positif.";
  return { libelle, sku, prixVenteCents: prix ?? 0, contenanceMl, champs };
}

export async function creerReference(espace: string, fd: FormData): Promise<Resultat<{ id: string }>> {
  return executer(async () => {
    const u = await verifierEspaceAdmin(espace);
    const code = champ(fd, "code").toUpperCase();
    const libelle = champ(fd, "libelle");
    const famille = champ(fd, "famille") || null;
    const confirmer = fd.get("confirmerSimilaire") === "on";
    const f = lireFormat(fd);
    const champs: Record<string, string> = { ...f.champs };
    if (!/^[A-Z0-9][A-Z0-9._-]{1,30}$/.test(code)) champs.code = "Code de référence : lettres, chiffres, tirets (ex. PM-015).";
    if (libelle.length < 2) champs.libelle = "Libellé obligatoire.";
    if (Object.keys(champs).length) throw new ErreurMetier("Certains champs sont à corriger.", champs);

    const existantes = await prisma.reference.findMany({ where: { activiteId: espace }, select: { code: true, libelle: true } });
    if (existantes.some((r) => r.code === code)) throw new ErreurMetier(`La référence ${code} existe déjà dans cet espace.`, { code: "Code déjà utilisé." });
    const similaire = existantes.find((r) => normaliser(r.libelle) === normaliser(libelle));
    if (similaire && !confirmer) {
      throw new ErreurMetier(`Une référence au libellé proche existe déjà (${similaire.code} · ${similaire.libelle}). Cochez « Créer quand même » si ce n'est pas un doublon.`, {
        confirmerSimilaire: "Doublon possible.",
      });
    }
    if (await prisma.format.findUnique({ where: { activiteId_sku: { activiteId: espace, sku: f.sku } } }))
      throw new ErreurMetier(`Le code de format ${f.sku} est déjà utilisé.`, { sku: "SKU déjà utilisé." });

    const ref = await prisma.$transaction(async (tx) => {
      const r = await tx.reference.create({ data: { activiteId: espace, code, libelle, famille } });
      await tx.format.create({ data: { activiteId: espace, referenceId: r.id, sku: f.sku, libelle: f.libelle, prixVenteCents: f.prixVenteCents, contenanceMl: f.contenanceMl } });
      await journaliser({ activiteId: espace, auteur: u, action: "reference.creation", entite: "Reference", entiteId: r.id, resume: `Référence ${code} · ${libelle} créée` }, tx);
      return r;
    });
    revalidatePath(`/${espace}/catalogue`);
    return { ok: true, message: `Référence ${code} créée.`, donnees: { id: ref.id } };
  });
}

export async function modifierReference(espace: string, id: string, fd: FormData): Promise<Resultat> {
  return executer(async () => {
    const u = await verifierEspaceAdmin(espace);
    const ref = await prisma.reference.findFirst({ where: { id, activiteId: espace } });
    if (!ref) throw new ErreurMetier("Référence introuvable dans cet espace.");
    const libelle = champ(fd, "libelle");
    if (libelle.length < 2) throw new ErreurMetier("Libellé obligatoire.", { libelle: "Obligatoire." });
    const data = { libelle, famille: champ(fd, "famille") || null, description: champ(fd, "description") || null };
    await prisma.reference.update({ where: { id }, data });
    await journaliser({ activiteId: espace, auteur: u, action: "reference.modification", entite: "Reference", entiteId: id, resume: `Référence ${ref.code} modifiée`, details: { avant: { libelle: ref.libelle, famille: ref.famille }, apres: data } });
    revalidatePath(`/${espace}/catalogue`);
    return { ok: true, message: "Référence mise à jour." };
  });
}

/** Archivage (STK-01) : retire de la saisie courante, conserve l'historique. */
export async function basculerArchivageReference(espace: string, id: string): Promise<Resultat> {
  return executer(async () => {
    const u = await verifierEspaceAdmin(espace);
    const ref = await prisma.reference.findFirst({ where: { id, activiteId: espace } });
    if (!ref) throw new ErreurMetier("Référence introuvable.");
    const etat = ref.etat === "ACTIF" ? "ARCHIVE" : "ACTIF";
    await prisma.reference.update({ where: { id }, data: { etat } });
    await journaliser({ activiteId: espace, auteur: u, action: etat === "ARCHIVE" ? "reference.archivage" : "reference.reactivation", entite: "Reference", entiteId: id, resume: `Référence ${ref.code} ${etat === "ARCHIVE" ? "archivée" : "réactivée"}` });
    revalidatePath(`/${espace}/catalogue`);
    return { ok: true, message: etat === "ARCHIVE" ? "Référence archivée : elle n'est plus proposée à la saisie." : "Référence réactivée." };
  });
}

export async function ajouterFormat(espace: string, referenceId: string, fd: FormData): Promise<Resultat> {
  return executer(async () => {
    const u = await verifierEspaceAdmin(espace);
    const ref = await prisma.reference.findFirst({ where: { id: referenceId, activiteId: espace } });
    if (!ref) throw new ErreurMetier("Référence introuvable.");
    const f = lireFormat(fd);
    if (Object.keys(f.champs).length) throw new ErreurMetier("Certains champs sont à corriger.", f.champs);
    try {
      const cree = await prisma.format.create({ data: { activiteId: espace, referenceId, sku: f.sku, libelle: f.libelle, prixVenteCents: f.prixVenteCents, contenanceMl: f.contenanceMl } });
      await journaliser({ activiteId: espace, auteur: u, action: "format.creation", entite: "Format", entiteId: cree.id, resume: `Format ${f.sku} ajouté à ${ref.code}` });
    } catch (e) {
      if (estDoublon(e)) throw new ErreurMetier(`Le code de format ${f.sku} est déjà utilisé.`, { sku: "SKU déjà utilisé." });
      throw e;
    }
    revalidatePath(`/${espace}/catalogue/${referenceId}`);
    return { ok: true, message: "Format ajouté." };
  });
}

export async function modifierFormat(espace: string, formatId: string, fd: FormData): Promise<Resultat> {
  return executer(async () => {
    const u = await verifierEspaceAdmin(espace);
    const avant = await prisma.format.findFirst({ where: { id: formatId, activiteId: espace } });
    if (!avant) throw new ErreurMetier("Format introuvable.");
    const f = lireFormat(fd);
    if (Object.keys(f.champs).length) throw new ErreurMetier("Certains champs sont à corriger.", f.champs);
    const etat = champ(fd, "etat") === "ARCHIVE" ? "ARCHIVE" : "ACTIF";
    try {
      await prisma.format.update({ where: { id: formatId }, data: { sku: f.sku, libelle: f.libelle, prixVenteCents: f.prixVenteCents, contenanceMl: f.contenanceMl, etat } });
    } catch (e) {
      if (estDoublon(e)) throw new ErreurMetier(`Le code de format ${f.sku} est déjà utilisé.`, { sku: "SKU déjà utilisé." });
      throw e;
    }
    await journaliser({
      activiteId: espace,
      auteur: u,
      action: "format.modification",
      entite: "Format",
      entiteId: formatId,
      resume: `Format ${f.sku} modifié${avant.prixVenteCents !== f.prixVenteCents ? " (prix)" : ""}${avant.etat !== etat ? ` (${etat === "ARCHIVE" ? "archivé" : "réactivé"})` : ""}`,
      details: { avant: { sku: avant.sku, libelle: avant.libelle, prixVenteCents: avant.prixVenteCents, etat: avant.etat }, apres: { sku: f.sku, libelle: f.libelle, prixVenteCents: f.prixVenteCents, etat } },
    });
    revalidatePath(`/${espace}/catalogue/${avant.referenceId}`);
    return { ok: true, message: "Format mis à jour. Les ventes passées gardent leur prix d'origine." };
  });
}

/** Mouvement de stock manuel (STK-02) : entrée, ajustement signé ou inventaire. */
export async function mouvementStockManuel(espace: string, formatId: string, fd: FormData): Promise<Resultat> {
  return executer(async () => {
    const u = await verifierEspaceAdmin(espace);
    const f = await prisma.format.findFirst({ where: { id: formatId, activiteId: espace } });
    if (!f) throw new ErreurMetier("Format introuvable.");
    const mode = champ(fd, "mode");
    const valeur = Number(champ(fd, "quantite"));
    const motif = champ(fd, "motif");
    if (!Number.isInteger(valeur)) throw new ErreurMetier("Quantité entière attendue.", { quantite: "Entier attendu." });
    if (motif.length < 3) throw new ErreurMetier("Le motif est obligatoire.", { motif: "Motif obligatoire." });
    let delta: number;
    let type: "ENTREE" | "AJUSTEMENT";
    if (mode === "ENTREE") {
      if (valeur <= 0) throw new ErreurMetier("Une entrée doit être positive.", { quantite: "Positif." });
      delta = valeur;
      type = "ENTREE";
    } else if (mode === "INVENTAIRE") {
      if (valeur < 0) throw new ErreurMetier("Le stock compté ne peut pas être négatif.", { quantite: "Positif ou nul." });
      delta = valeur - f.quantite; // mouvement différentiel tracé
      type = "AJUSTEMENT";
      if (delta === 0) return { ok: true, message: "Stock déjà conforme au comptage : aucun mouvement." };
    } else {
      if (valeur === 0) throw new ErreurMetier("Ajustement nul.", { quantite: "Non nul." });
      delta = valeur;
      type = "AJUSTEMENT";
    }
    const politique = (await lireReglages())["stock.politique"] === "AUTORISER" ? "AUTORISER" : "BLOQUER";
    await prisma.$transaction(async (tx) => {
      const m = await appliquerMouvement(tx, { formatId, quantite: delta, type, origine: "CRM", auteur: u, motif, politique: mode === "INVENTAIRE" ? "AUTORISER" : politique });
      await planifierAjustementShopify(tx, { formatId, delta, cle: `mouvement:${m.id}` });
      await journaliser({ activiteId: espace, auteur: u, action: "stock.mouvement", entite: "Format", entiteId: formatId, resume: `${type === "ENTREE" ? "Entrée" : "Ajustement"} de ${delta > 0 ? "+" : ""}${delta} sur ${f.sku}`, motif }, tx);
    });
    revalidatePath(`/${espace}/stock`);
    revalidatePath(`/${espace}/catalogue/${f.referenceId}`);
    return { ok: true, message: `Mouvement enregistré (${delta > 0 ? "+" : ""}${delta}).` };
  });
}

/** Prix de touche (FIN-01) : nouvelle valeur datée ; les ventes passées gardent leur coût. */
export async function ajouterPrixTouche(espace: string, referenceId: string, fd: FormData): Promise<Resultat> {
  return executer(async () => {
    const u = await verifierEspaceAdmin(espace);
    const ref = await prisma.reference.findFirst({ where: { id: referenceId, activiteId: espace }, include: { formats: true } });
    if (!ref) throw new ErreurMetier("Référence introuvable.");
    const cout = saisieVersCents(champ(fd, "cout"));
    if (cout === null || cout < 0) throw new ErreurMetier("Coût invalide (0 € est accepté).", { cout: "Montant invalide." });
    const formatId = champ(fd, "formatId");
    const f = formatId && formatId !== "REFERENCE" ? ref.formats.find((x) => x.id === formatId) : null;
    if (formatId && formatId !== "REFERENCE" && !f) throw new ErreurMetier("Format inconnu.");
    await prisma.prixTouche.create({ data: { referenceId, formatId: f?.id ?? null, coutCents: cout, dateEffet: new Date(), auteurNom: u.nom } });
    await journaliser({ activiteId: espace, auteur: u, action: "prix_touche.ajout", entite: "Reference", entiteId: referenceId, resume: `Prix de touche ${f ? f.libelle : "de la référence"} ${ref.code} : ${(cout / 100).toFixed(2)} €` });
    revalidatePath(`/${espace}/catalogue/${referenceId}`);
    revalidatePath(`/${espace}/rentabilite`);
    return { ok: true, message: "Prix de touche enregistré : il s'applique aux prochaines ventes." };
  });
}
