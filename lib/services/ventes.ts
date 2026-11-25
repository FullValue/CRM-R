import { prisma, estDoublon, type Tx } from "@/lib/db";
import { journaliser } from "@/lib/audit";
import { lireReglages } from "@/lib/reglages";
import { rentabiliteVente } from "@/lib/calcul/vente";
import { valeurAuJour } from "@/lib/calcul/valeurAuJour";
import { aujourdhui, estDateIso } from "@/lib/dates";
import type { UtilisateurCourant } from "@/lib/auth/acces";
import { appliquerMouvement, planifierAjustementShopify } from "./stock";
import { ErreurMetier } from "./resultat";

export const ESPACE_VENTES = "pm";

export type LigneSaisie = { formatId: string; quantite: number; prixUnitaireCents: number | null };

export type SaisieVente = {
  cleIdempotence: string;
  client: string;
  commentaire?: string;
  dateVente: string;
  canal: string;
  vendeurId?: string;
  zoneId: string | null;
  zoneProvenance: "PROPOSEE" | "SAISIE" | "NON_RENSEIGNEE";
  lignes: LigneSaisie[];
  coutCommandeCents?: number | null;
  regleeLe?: string | null;
  livraison?: { etat: string; date?: string | null; creneau?: string | null; ville?: string | null } | null;
};

/** Coût unitaire applicable maintenant : prix de touche du format, sinon de la référence (FIN-01). */
export async function coutApplicable(tx: Tx, referenceId: string, formatId: string, instant = new Date()) {
  const lignes = await tx.prixTouche.findMany({ where: { referenceId } });
  const duFormat = valeurAuJour(lignes.filter((l) => l.formatId === formatId), instant);
  if (duFormat) return { coutUnitaireCents: duFormat.coutCents, coutSource: "FORMAT" as const };
  const deRef = valeurAuJour(lignes.filter((l) => l.formatId === null), instant);
  if (deRef) return { coutUnitaireCents: deRef.coutCents, coutSource: "REFERENCE" as const };
  return { coutUnitaireCents: null, coutSource: "ABSENT" as const };
}

async function prochainNumero(tx: Tx, dateVente: string) {
  const annee = dateVente.slice(0, 4);
  const cle = `vente-pm-${annee}`;
  const c = await tx.compteur.upsert({ where: { cle }, create: { cle, valeur: 1 }, update: { valeur: { increment: 1 } } });
  return `V${annee.slice(2)}-${String(c.valeur).padStart(5, "0")}`;
}

function valider(s: SaisieVente, reglages: Awaited<ReturnType<typeof lireReglages>>) {
  const champs: Record<string, string> = {};
  if (!s.cleIdempotence || s.cleIdempotence.length < 8) champs.cle = "Identifiant de tentative manquant.";
  if (!s.client || s.client.length < 2) champs.client = "Indiquez le nom ou le libellé du client.";
  if (s.client.length > 120) champs.client = "120 caractères au maximum.";
  if ((s.commentaire ?? "").length > 500) champs.commentaire = "500 caractères au maximum.";
  if (!estDateIso(s.dateVente)) champs.dateVente = "Date de vente invalide.";
  else if (s.dateVente > aujourdhui()) champs.dateVente = "La date de vente ne peut pas être dans le futur.";
  if (s.lignes.length === 0) champs.lignes = "Ajoutez au moins un article.";
  s.lignes.forEach((l, i) => {
    if (!l.formatId) champs[`ligne-${i}-format`] = "Choisissez une référence et un format.";
    if (!Number.isInteger(l.quantite) || l.quantite < 1 || l.quantite > 999) champs[`ligne-${i}-quantite`] = "Quantité entière positive.";
    if (l.prixUnitaireCents !== null && (!Number.isInteger(l.prixUnitaireCents) || l.prixUnitaireCents < 0))
      champs[`ligne-${i}-prix`] = "Prix invalide.";
  });
  if (new Set(s.lignes.map((l) => l.formatId)).size !== s.lignes.length) champs.lignes = "Un même format figure deux fois : regroupez les quantités.";
  if (s.zoneProvenance === "NON_RENSEIGNEE" && s.zoneId) champs.zone = "Zone incohérente.";
  if (s.zoneProvenance !== "NON_RENSEIGNEE" && !s.zoneId) champs.zone = "Choisissez une zone.";
  if (!s.zoneId && reglages["vente.zone_obligatoire"] === "OUI") champs.zone = "La zone de vente est obligatoire.";
  if (s.coutCommandeCents !== undefined && s.coutCommandeCents !== null && (s.coutCommandeCents < 0 || !Number.isInteger(s.coutCommandeCents)))
    champs.coutCommande = "Prix de touche de commande invalide.";
  if (s.regleeLe && !estDateIso(s.regleeLe)) champs.regleeLe = "Date de règlement invalide.";
  if (s.livraison?.date && !estDateIso(s.livraison.date)) champs.livraisonDate = "Date de livraison invalide.";
  if (Object.keys(champs).length > 0) throw new ErreurMetier("Certains champs sont à corriger.", champs);
}

export type IssueVente = { statut: "creee" | "deja"; venteId: string; numero: string; montantCents: number };

/**
 * Enregistre une vente (PM-02, VEN-01). Idempotente : une relance avec la même
 * clé renvoie la vente déjà enregistrée, sans second mouvement (VEN-02, R12).
 */
export async function enregistrerVente(s: SaisieVente, auteur: UtilisateurCourant): Promise<IssueVente> {
  const existante = await prisma.vente.findUnique({ where: { cleIdempotence: s.cleIdempotence } });
  if (existante) return { statut: "deja", venteId: existante.id, numero: existante.numero, montantCents: existante.montantCents };

  const reglages = await lireReglages();
  valider(s, reglages);
  const politique = reglages["stock.politique"] === "AUTORISER" ? "AUTORISER" : "BLOQUER";
  const vendeurId = auteur.role === "ADMIN" && s.vendeurId ? s.vendeurId : auteur.id;

  try {
    return await prisma.$transaction(async (tx) => {
      const formats = await tx.format.findMany({
        where: { id: { in: s.lignes.map((l) => l.formatId) }, activiteId: ESPACE_VENTES },
        include: { reference: true },
      });
      const parId = new Map(formats.map((f) => [f.id, f]));
      const lignes = [];
      for (const [i, l] of s.lignes.entries()) {
        const f = parId.get(l.formatId);
        if (!f) throw new ErreurMetier("Article introuvable dans le catalogue de la Parfumerie Mobile.", { [`ligne-${i}-format`]: "Article introuvable." });
        if (f.etat !== "ACTIF" || f.reference.etat !== "ACTIF")
          throw new ErreurMetier(`${f.reference.libelle} ${f.libelle} est archivé : il ne peut plus être vendu.`, { [`ligne-${i}-format`]: "Article archivé." });
        const prix = auteur.role === "ADMIN" || auteur.prixModifiable ? (l.prixUnitaireCents ?? f.prixVenteCents) : f.prixVenteCents;
        const cout = await coutApplicable(tx, f.referenceId, f.id);
        lignes.push({
          formatId: f.id,
          referenceId: f.referenceId,
          referenceCode: f.reference.code,
          referenceLibelle: f.reference.libelle,
          formatLibelle: f.libelle,
          quantite: l.quantite,
          prixUnitaireCents: prix,
          coutUnitaireCents: cout.coutUnitaireCents,
          coutSource: cout.coutSource,
        });
      }
      const r = rentabiliteVente(lignes, s.coutCommandeCents ?? null);
      const zone = s.zoneId ? await tx.zone.findFirst({ where: { id: s.zoneId, activiteId: ESPACE_VENTES, active: true } }) : null;
      if (s.zoneId && !zone) throw new ErreurMetier("Zone inconnue ou désactivée.", { zone: "Zone inconnue." });

      const numero = await prochainNumero(tx, s.dateVente);
      const vente = await tx.vente.create({
        data: {
          activiteId: ESPACE_VENTES,
          numero,
          cleIdempotence: s.cleIdempotence,
          client: s.client,
          commentaire: s.commentaire || null,
          dateVente: s.dateVente,
          vendeurId,
          auteurId: auteur.id,
          canal: s.canal in { TERRAIN: 1, WHATSAPP: 1, BOUTIQUE: 1, AUTRE: 1 } ? s.canal : "TERRAIN",
          zoneId: zone?.id ?? null,
          zoneLibelle: zone?.libelle ?? null,
          zoneProvenance: zone ? s.zoneProvenance : "NON_RENSEIGNEE",
          coutCommandeCents: s.coutCommandeCents ?? null,
          montantCents: r.montantCents,
          coutCents: r.coutCents,
          coutSource: r.coutSource,
          regleeLe: s.regleeLe ?? null,
          livraisonEtat: s.livraison?.etat ?? "AUCUNE",
          livraisonDate: s.livraison?.date ?? null,
          livraisonCreneau: s.livraison?.creneau ?? null,
          livraisonVille: s.livraison?.ville ?? null,
          lignes: { create: lignes },
        },
        include: { lignes: true },
      });

      let aSynchroniser = false;
      for (const l of vente.lignes) {
        await appliquerMouvement(tx, {
          formatId: l.formatId,
          quantite: -l.quantite,
          type: "SORTIE_VENTE",
          origine: auteur.role === "VENDEUR" ? "VENDEUR" : "CRM",
          auteur,
          venteId: vente.id,
          motif: `Vente ${numero}`,
          cleUnique: `vente:${l.id}:sortie`,
          politique,
        });
        if (await planifierAjustementShopify(tx, { formatId: l.formatId, delta: -l.quantite, cle: `vente:${l.id}`, venteId: vente.id }))
          aSynchroniser = true;
      }
      if (aSynchroniser) await tx.vente.update({ where: { id: vente.id }, data: { stockSync: "A_SYNCHRONISER" } });

      if (s.regleeLe) {
        await tx.mouvementTresorerie.create({
          data: {
            activiteId: ESPACE_VENTES,
            dateReglement: s.regleeLe,
            type: "ENCAISSEMENT",
            montantCents: r.montantCents,
            libelle: `Vente ${numero}`,
            origine: "VENTE",
            venteId: vente.id,
            auteurNom: auteur.nom,
          },
        });
      }
      await journaliser(
        {
          activiteId: ESPACE_VENTES,
          auteur,
          action: "vente.creation",
          entite: "Vente",
          entiteId: vente.id,
          resume: `Vente ${numero} enregistrée (${lignes.length} ligne(s))`,
          details: { montantCents: r.montantCents, canal: vente.canal, zone: vente.zoneLibelle, provenance: vente.zoneProvenance },
        },
        tx,
      );
      return { statut: "creee" as const, venteId: vente.id, numero, montantCents: r.montantCents };
    });
  } catch (e) {
    if (estDoublon(e)) {
      const deja = await prisma.vente.findUnique({ where: { cleIdempotence: s.cleIdempotence } });
      if (deja) return { statut: "deja", venteId: deja.id, numero: deja.numero, montantCents: deja.montantCents };
    }
    throw e;
  }
}

function photo(v: { client: string; dateVente: string; zoneLibelle: string | null; coutCommandeCents: number | null; montantCents: number; coutCents: number | null; commentaire: string | null }, lignes: { id: string; quantite: number; prixUnitaireCents: number; coutUnitaireCents: number | null }[]) {
  return {
    client: v.client,
    dateVente: v.dateVente,
    zone: v.zoneLibelle,
    commentaire: v.commentaire,
    coutCommandeCents: v.coutCommandeCents,
    montantCents: v.montantCents,
    coutCents: v.coutCents,
    lignes: lignes.map((l) => ({ id: l.id, quantite: l.quantite, prixUnitaireCents: l.prixUnitaireCents, coutUnitaireCents: l.coutUnitaireCents })),
  };
}

export type SaisieCorrection = {
  motif: string;
  client: string;
  commentaire: string | null;
  dateVente: string;
  zoneId: string | null;
  coutCommandeCents: number | null;
  repercuterStock: boolean;
  lignes: { id: string; quantite: number; prixUnitaireCents: number; coutUnitaireCents: number | null }[];
};

/** Correction administrateur avec motif (PM-03, R09). */
export async function corrigerVente(venteId: string, c: SaisieCorrection, auteur: UtilisateurCourant) {
  if (c.motif.length < 3) throw new ErreurMetier("Le motif de correction est obligatoire.", { motif: "Motif obligatoire." });
  if (!c.client) throw new ErreurMetier("Le client est obligatoire.", { client: "Obligatoire." });
  if (!estDateIso(c.dateVente) || c.dateVente > aujourdhui()) throw new ErreurMetier("Date de vente invalide.", { dateVente: "Date invalide." });
  for (const l of c.lignes) {
    if (!Number.isInteger(l.quantite) || l.quantite < 1) throw new ErreurMetier("Chaque quantité doit être un entier positif.");
    if (l.prixUnitaireCents < 0 || (l.coutUnitaireCents !== null && l.coutUnitaireCents < 0)) throw new ErreurMetier("Montants négatifs refusés.");
  }
  const { politique } = { politique: (await lireReglages())["stock.politique"] === "AUTORISER" ? ("AUTORISER" as const) : ("BLOQUER" as const) };

  await prisma.$transaction(async (tx) => {
    const v = await tx.vente.findFirst({ where: { id: venteId, activiteId: ESPACE_VENTES }, include: { lignes: true } });
    if (!v) throw new ErreurMetier("Vente introuvable.");
    if (v.statut === "ANNULEE") throw new ErreurMetier("Une vente annulée ne peut plus être corrigée.");
    const avant = photo(v, v.lignes);
    const zone = c.zoneId ? await tx.zone.findFirst({ where: { id: c.zoneId, activiteId: ESPACE_VENTES } }) : null;

    const correction = await tx.correctionVente.create({
      data: { venteId, type: "CORRECTION", motif: c.motif, avant: "{}", apres: "{}", effetStock: c.repercuterStock, auteurNom: auteur.nom },
    });
    let stockModifie = false;
    for (const l of v.lignes) {
      const n = c.lignes.find((x) => x.id === l.id);
      if (!n) continue;
      const ecart = l.quantite - n.quantite; // > 0 : moins vendu → retour en stock
      if (ecart !== 0 && c.repercuterStock) {
        await appliquerMouvement(tx, {
          formatId: l.formatId,
          quantite: ecart,
          type: "CORRECTION",
          origine: "CRM",
          auteur,
          venteId,
          motif: `Correction ${v.numero} : ${c.motif}`,
          cleUnique: `correction:${correction.id}:${l.id}`,
          politique,
        });
        if (await planifierAjustementShopify(tx, { formatId: l.formatId, delta: ecart, cle: `correction:${correction.id}:${l.id}`, venteId }))
          stockModifie = true;
      }
      const coutSource = n.coutUnitaireCents === l.coutUnitaireCents ? l.coutSource : n.coutUnitaireCents === null ? "ABSENT" : "MANUEL";
      await tx.ligneVente.update({
        where: { id: l.id },
        data: { quantite: n.quantite, prixUnitaireCents: n.prixUnitaireCents, coutUnitaireCents: n.coutUnitaireCents, coutSource },
      });
    }
    const lignes = await tx.ligneVente.findMany({ where: { venteId } });
    const r = rentabiliteVente(lignes, c.coutCommandeCents);
    const maj = await tx.vente.update({
      where: { id: venteId },
      data: {
        client: c.client,
        commentaire: c.commentaire,
        dateVente: c.dateVente,
        zoneId: zone?.id ?? null,
        zoneLibelle: zone?.libelle ?? null,
        zoneProvenance: zone ? (zone.id === v.zoneId ? v.zoneProvenance : "SAISIE") : "NON_RENSEIGNEE",
        coutCommandeCents: c.coutCommandeCents,
        montantCents: r.montantCents,
        coutCents: r.coutCents,
        coutSource: r.coutSource,
        corrigee: true,
        ...(stockModifie ? { stockSync: "A_SYNCHRONISER" } : {}),
      },
    });
    // Le flux d'encaissement suit le montant corrigé : un flux n'est compté qu'une fois.
    await tx.mouvementTresorerie.updateMany({ where: { venteId, annule: false }, data: { montantCents: r.montantCents } });
    const apres = photo(maj, lignes);
    await tx.correctionVente.update({ where: { id: correction.id }, data: { avant: JSON.stringify(avant), apres: JSON.stringify(apres) } });
    await journaliser(
      { activiteId: ESPACE_VENTES, auteur, action: "vente.correction", entite: "Vente", entiteId: venteId, resume: `Vente ${v.numero} corrigée`, details: { avant, apres }, motif: c.motif },
      tx,
    );
  });
}

/**
 * Annulation (PM-03) : la remise en stock n'a lieu que si l'article a été
 * restitué ou n'est jamais sorti. Un encaissement déjà réglé donne lieu à un
 * décaissement de remboursement si celui-ci est effectué.
 */
export async function annulerVente(
  venteId: string,
  p: { motif: string; retourStock: boolean; rembourse: boolean },
  auteur: UtilisateurCourant,
) {
  if (p.motif.length < 3) throw new ErreurMetier("Le motif d'annulation est obligatoire.", { motif: "Motif obligatoire." });
  await prisma.$transaction(async (tx) => {
    const v = await tx.vente.findFirst({ where: { id: venteId, activiteId: ESPACE_VENTES }, include: { lignes: true } });
    if (!v) throw new ErreurMetier("Vente introuvable.");
    if (v.statut === "ANNULEE") throw new ErreurMetier("Cette vente est déjà annulée.");
    let sync = false;
    if (p.retourStock) {
      for (const l of v.lignes) {
        await appliquerMouvement(tx, {
          formatId: l.formatId,
          quantite: l.quantite,
          type: "RETOUR",
          origine: "CRM",
          auteur,
          venteId,
          motif: `Annulation ${v.numero} : ${p.motif}`,
          cleUnique: `annulation:${l.id}`,
        });
        if (await planifierAjustementShopify(tx, { formatId: l.formatId, delta: l.quantite, cle: `annulation:${l.id}`, venteId })) sync = true;
      }
    }
    const encaissement = await tx.mouvementTresorerie.findUnique({ where: { venteId } });
    if (encaissement && !encaissement.annule && p.rembourse) {
      await tx.mouvementTresorerie.create({
        data: {
          activiteId: ESPACE_VENTES,
          dateReglement: aujourdhui(),
          type: "DECAISSEMENT",
          montantCents: encaissement.montantCents,
          libelle: `Remboursement ${v.numero}`,
          origine: "REMBOURSEMENT",
          motif: p.motif,
          auteurNom: auteur.nom,
        },
      });
    }
    await tx.vente.update({
      where: { id: venteId },
      data: { statut: "ANNULEE", annuleeLe: new Date(), motifAnnulation: p.motif, ...(sync ? { stockSync: "A_SYNCHRONISER" } : {}) },
    });
    await tx.correctionVente.create({
      data: {
        venteId,
        type: "ANNULATION",
        motif: p.motif,
        avant: JSON.stringify({ statut: v.statut }),
        apres: JSON.stringify({ statut: "ANNULEE", retourStock: p.retourStock, rembourse: p.rembourse }),
        effetStock: p.retourStock,
        auteurNom: auteur.nom,
      },
    });
    await journaliser(
      { activiteId: ESPACE_VENTES, auteur, action: "vente.annulation", entite: "Vente", entiteId: venteId, resume: `Vente ${v.numero} annulée${p.retourStock ? " avec remise en stock" : " sans remise en stock"}`, motif: p.motif },
      tx,
    );
  });
}

/** Enregistre le règlement d'une vente : crée l'encaissement à sa date (FIN-03). */
export async function reglerVente(venteId: string, date: string, auteur: UtilisateurCourant) {
  if (!estDateIso(date)) throw new ErreurMetier("Date de règlement invalide.");
  await prisma.$transaction(async (tx) => {
    const v = await tx.vente.findFirst({ where: { id: venteId, activiteId: ESPACE_VENTES } });
    if (!v) throw new ErreurMetier("Vente introuvable.");
    if (v.statut === "ANNULEE") throw new ErreurMetier("Vente annulée.");
    if (v.regleeLe) throw new ErreurMetier("Cette vente est déjà réglée.");
    await tx.vente.update({ where: { id: venteId }, data: { regleeLe: date } });
    await tx.mouvementTresorerie.upsert({
      where: { venteId },
      create: { activiteId: ESPACE_VENTES, dateReglement: date, type: "ENCAISSEMENT", montantCents: v.montantCents, libelle: `Vente ${v.numero}`, origine: "VENTE", venteId, auteurNom: auteur.nom },
      update: { dateReglement: date, montantCents: v.montantCents, annule: false },
    });
    await journaliser({ activiteId: ESPACE_VENTES, auteur, action: "vente.reglement", entite: "Vente", entiteId: venteId, resume: `Règlement de ${v.numero} au ${date}` }, tx);
  });
}

/** Rattache une livraison (LIV-03) : préférence, confirmée ou livrée, distincte de la date de vente. */
export async function majLivraison(
  venteId: string,
  l: { etat: string; date: string | null; creneau: string | null; ville: string | null; effective: string | null },
  auteur: UtilisateurCourant,
) {
  if (!["AUCUNE", "PREFERENCE", "CONFIRMEE", "LIVREE"].includes(l.etat)) throw new ErreurMetier("État de livraison inconnu.");
  if (l.etat !== "AUCUNE" && !estDateIso(l.date)) throw new ErreurMetier("Indiquez la date de livraison.", { livraisonDate: "Date requise." });
  if (l.effective && !estDateIso(l.effective)) throw new ErreurMetier("Date effective invalide.");
  const v = await prisma.vente.findFirst({ where: { id: venteId, activiteId: ESPACE_VENTES } });
  if (!v) throw new ErreurMetier("Vente introuvable.");
  const data =
    l.etat === "AUCUNE"
      ? { livraisonEtat: "AUCUNE", livraisonDate: null, livraisonCreneau: null, livraisonVille: null, livraisonEffective: null }
      : { livraisonEtat: l.etat, livraisonDate: l.date, livraisonCreneau: l.creneau, livraisonVille: l.ville, livraisonEffective: l.etat === "LIVREE" ? l.effective ?? l.date : null };
  await prisma.$transaction(async (tx) => {
    await tx.vente.update({ where: { id: venteId }, data });
    await tx.correctionVente.create({
      data: {
        venteId,
        type: "LIVRAISON",
        motif: "Mise à jour de la livraison",
        avant: JSON.stringify({ etat: v.livraisonEtat, date: v.livraisonDate, creneau: v.livraisonCreneau, ville: v.livraisonVille }),
        apres: JSON.stringify(data),
        auteurNom: auteur.nom,
      },
    });
    await journaliser({ activiteId: ESPACE_VENTES, auteur, action: "vente.livraison", entite: "Vente", entiteId: venteId, resume: `Livraison de ${v.numero} : ${l.etat}` }, tx);
  });
}
