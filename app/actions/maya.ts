"use server";

import { revalidatePath } from "next/cache";
import { prisma, estDoublon } from "@/lib/db";
import { verifierEspaceAdmin } from "@/lib/auth/acces";
import { journaliser } from "@/lib/audit";
import { estDateIso } from "@/lib/dates";
import { analyserImport, type AnalyseImport } from "@/lib/import";
import { champ, ErreurMetier, executer, type Resultat } from "@/lib/services/resultat";

const E = "maya";

/** Décimal exact saisi (« 1,06 », « 0.111 ») → chaîne normalisée, ou null. */
function decimal(s: string, max = 4): string | null {
  const t = s.replace(/\s/g, "").replace(",", ".");
  return new RegExp(`^\\d+(\\.\\d{1,${max}})?$`).test(t) ? t : null;
}

function dateEffet(fd: FormData): Date {
  const d = champ(fd, "dateEffet");
  if (!estDateIso(d)) throw new ErreurMetier("Date d'effet invalide.", { dateEffet: "Date invalide." });
  return new Date(`${d}T00:00:00.000Z`);
}

/** Nouvelle valeur historisée : on n'écrase jamais, on insère avec une date d'effet. */
export async function ajouterValeurMaya(fd: FormData): Promise<Resultat> {
  return executer(async () => {
    const u = await verifierEspaceAdmin(E);
    const genre = champ(fd, "genre");
    const de = dateEffet(fd);
    let resume = "";
    try {
      if (genre === "taux_perte") {
        const v = decimal(champ(fd, "valeur"), 5);
        if (!v || Number(v) >= 1) throw new ErreurMetier("Taux de perte décimal entre 0 et 1 (ex. 0,111).", { valeur: "Invalide." });
        await prisma.parametreMaya.create({ data: { cle: "taux_perte", valeur: v, dateEffet: de } });
        resume = `Taux de perte ${v}`;
      } else if (genre === "composant") {
        const libelle = champ(fd, "libelle");
        const cont = Number(champ(fd, "contenanceMl"));
        const v = decimal(champ(fd, "valeur"));
        if (libelle.length < 2) throw new ErreurMetier("Libellé obligatoire.", { libelle: "Obligatoire." });
        if (!Number.isInteger(cont) || cont <= 0) throw new ErreurMetier("Contenance invalide.", { contenanceMl: "Invalide." });
        if (!v) throw new ErreurMetier("Coût unitaire HT invalide.", { valeur: "Invalide." });
        await prisma.composantMaya.create({ data: { libelle, contenanceMl: cont, coutUnitHT: v, optionnel: fd.get("optionnel") === "on", dateEffet: de } });
        resume = `Composant ${libelle} ${cont} ml : ${v} €`;
      } else if (genre === "faconnage") {
        const cont = Number(champ(fd, "contenanceMl"));
        const fixe = decimal(champ(fd, "coutFixeSerie"), 2);
        const varU = decimal(champ(fd, "valeur") || "0");
        const lot = Number(champ(fd, "qteLotRef"));
        if (!Number.isInteger(cont) || cont <= 0) throw new ErreurMetier("Contenance invalide.", { contenanceMl: "Invalide." });
        if (!fixe) throw new ErreurMetier("Coût fixe de série invalide.", { coutFixeSerie: "Invalide." });
        if (!varU) throw new ErreurMetier("Coût variable invalide.", { valeur: "Invalide." });
        if (!Number.isInteger(lot) || lot <= 0) throw new ErreurMetier("Quantité de lot invalide.", { qteLotRef: "Entier positif." });
        await prisma.faconnageMaya.create({ data: { contenanceMl: cont, coutFixeSerie: fixe, coutVarUnitHT: varU, qteLotRef: lot, dateEffet: de } });
        resume = `Façonnage ${cont} ml : ${fixe} € / ${lot}`;
      } else if (genre === "prix_liquide") {
        const referenceId = champ(fd, "referenceId");
        const v = decimal(champ(fd, "valeur"), 2);
        const ref = await prisma.reference.findFirst({ where: { id: referenceId, activiteId: E } });
        if (!ref) throw new ErreurMetier("Parfum inconnu.", { referenceId: "Inconnu." });
        if (!v) throw new ErreurMetier("Prix au litre invalide.", { valeur: "Invalide." });
        await prisma.prixLiquide.create({ data: { referenceId, prixLitreHT: v, dateEffet: de } });
        resume = `Prix du liquide ${ref.libelle} : ${v} €/L`;
      } else throw new ErreurMetier("Type de valeur inconnu.");
    } catch (e) {
      if (estDoublon(e)) throw new ErreurMetier("Une valeur existe déjà à cette date d'effet : choisissez une autre date.", { dateEffet: "Date déjà utilisée." });
      throw e;
    }
    await journaliser({ activiteId: E, auteur: u, action: "maya.cout", entite: "RegistreMaya", resume: `${resume} (effet ${de.toISOString().slice(0, 10)})` });
    revalidatePath("/maya", "layout");
    return { ok: true, message: "Valeur enregistrée. Les coûts sont recalculés à partir de sa date d'effet." };
  });
}

export type ResultatEssai = AnalyseImport & { nomFichier: string };

/** Import d'essai (MAY-02) : analyse sans écriture, avec relevé des rejets. */
export async function essaiImport(fd: FormData): Promise<Resultat<ResultatEssai>> {
  return executer(async () => {
    const u = await verifierEspaceAdmin(E);
    const { texte, nom } = await lireFichier(fd);
    const existants = new Set((await prisma.format.findMany({ where: { activiteId: E }, select: { sku: true } })).map((f) => f.sku));
    const a = analyserImport(texte, existants);
    await prisma.importLot.create({
      data: { activiteId: E, nomFichier: nom, statut: "ESSAI", lignesOk: a.aCreer.length, lignesRejet: a.rejets.length, doublons: a.doublons.length, releve: JSON.stringify([...a.rejets, ...a.doublons]), auteurNom: u.nom },
    });
    revalidatePath("/maya/import");
    return { ok: true, message: `Essai : ${a.aCreer.length} ligne(s) prêtes, ${a.doublons.length} doublon(s), ${a.rejets.length} rejet(s).`, donnees: { ...a, nomFichier: nom } };
  });
}

/** Application de l'import : mêmes règles que l'essai, dans une seule transaction. */
export async function appliquerImport(fd: FormData): Promise<Resultat> {
  return executer(async () => {
    const u = await verifierEspaceAdmin(E);
    const { texte, nom } = await lireFichier(fd);
    const existants = new Set((await prisma.format.findMany({ where: { activiteId: E }, select: { sku: true } })).map((f) => f.sku));
    const a = analyserImport(texte, existants);
    if (a.aCreer.length === 0) throw new ErreurMetier("Aucune ligne à importer.");
    await prisma.$transaction(async (tx) => {
      const refs = new Map<string, string>();
      for (const l of a.aCreer) {
        let refId = refs.get(l.codeReference);
        if (!refId) {
          const existante = await tx.reference.findUnique({ where: { activiteId_code: { activiteId: E, code: l.codeReference } } });
          refId = existante?.id ?? (await tx.reference.create({ data: { activiteId: E, code: l.codeReference, libelle: l.libelle } })).id;
          refs.set(l.codeReference, refId);
        }
        const f = await tx.format.create({ data: { activiteId: E, referenceId: refId, sku: l.sku, libelle: l.format, contenanceMl: l.contenanceMl, prixVenteCents: l.prixCents, quantite: l.quantite } });
        if (l.quantite !== 0) {
          await tx.mouvementStock.create({ data: { formatId: f.id, type: "IMPORT", quantite: l.quantite, stockApres: l.quantite, origine: "IMPORT", auteurId: u.id, auteurNom: u.nom, motif: `Import ${nom} ligne ${l.numero}` } });
        }
      }
      await tx.importLot.create({
        data: { activiteId: E, nomFichier: nom, statut: "APPLIQUE", lignesOk: a.aCreer.length, lignesRejet: a.rejets.length, doublons: a.doublons.length, releve: JSON.stringify([...a.rejets, ...a.doublons]), auteurNom: u.nom },
      });
      await journaliser({ activiteId: E, auteur: u, action: "import.application", entite: "ImportLot", resume: `Import ${nom} : ${a.aCreer.length} format(s) créés, ${a.rejets.length + a.doublons.length} écarté(s)` }, tx);
    });
    revalidatePath("/maya", "layout");
    return { ok: true, message: `${a.aCreer.length} format(s) importé(s). Les lignes écartées figurent dans le relevé.` };
  });
}

async function lireFichier(fd: FormData) {
  const fichier = fd.get("fichier");
  const colle = champ(fd, "contenu");
  if (fichier instanceof File && fichier.size > 0) {
    if (fichier.size > 2_000_000) throw new ErreurMetier("Fichier trop volumineux (2 Mo maximum).");
    return { texte: await fichier.text(), nom: fichier.name };
  }
  if (colle) return { texte: colle, nom: "contenu collé" };
  throw new ErreurMetier("Choisissez un fichier CSV ou collez son contenu.", { fichier: "Fichier requis." });
}
