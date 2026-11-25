import { prisma } from "@/lib/db";
import { journaliser } from "@/lib/audit";
import { estDateIso } from "@/lib/dates";
import { repartirMontants, repartirPourcentages, type PartCalculee } from "@/lib/calcul/repartition";
import type { UtilisateurCourant } from "@/lib/auth/acces";
import { ErreurMetier } from "./resultat";

export const ESPACE_DEPENSES = "amari";

export type SaisieDepense = {
  date: string;
  libelle: string;
  montantCents: number | null;
  posteId: string;
  type: "FIXE" | "PONCTUELLE";
  coutFixeId: string | null;
  tiers: string | null;
  note: string | null;
  dateReglement: string | null;
  modeRepartition: "AUCUNE" | "POURCENTAGE" | "MONTANT";
  parts: { participantId: string; valeur: number | null }[];
  motif?: string | null;
};

async function valider(s: SaisieDepense, edition: boolean) {
  const champs: Record<string, string> = {};
  if (!estDateIso(s.date)) champs.date = "Date invalide.";
  if (s.libelle.length < 2) champs.libelle = "Libellé obligatoire.";
  if (s.montantCents === null) champs.montant = "Montant en euros invalide (ex. 120,00).";
  else if (s.montantCents <= 0) champs.montant = "Le montant doit être positif.";
  if (!s.posteId) champs.posteId = "Choisissez un poste.";
  if (s.dateReglement && !estDateIso(s.dateReglement)) champs.dateReglement = "Date invalide.";
  if (edition && (!s.motif || s.motif.length < 3)) champs.motif = "Le motif de modification est obligatoire.";
  if (Object.keys(champs).length) throw new ErreurMetier("Certains champs sont à corriger.", champs);

  const poste = await prisma.poste.findFirst({ where: { id: s.posteId, activiteId: ESPACE_DEPENSES } });
  if (!poste) throw new ErreurMetier("Poste inconnu.", { posteId: "Poste inconnu." });
  if (!poste.actif && !edition) throw new ErreurMetier("Ce poste est désactivé pour les nouvelles saisies.", { posteId: "Poste désactivé." });
  if (s.coutFixeId) {
    const cf = await prisma.coutFixe.findFirst({ where: { id: s.coutFixeId, activiteId: ESPACE_DEPENSES } });
    if (!cf) throw new ErreurMetier("Coût fixe de référence inconnu.");
  }
}

/** Calcule et valide les parts (AMA-03). Renvoie les parts figées avec les noms. */
async function calculerParts(s: SaisieDepense): Promise<{ parts: (PartCalculee & { participantNom: string })[]; cle: string | null }> {
  if (s.modeRepartition === "AUCUNE") return { parts: [], cle: null };
  const entrees = s.parts.filter((p) => p.participantId);
  if (entrees.some((p) => p.valeur === null)) throw new ErreurMetier("Une part est mal saisie.", { parts: "Valeur invalide." });
  if (new Set(entrees.map((e) => e.participantId)).size !== entrees.length)
    throw new ErreurMetier("Un participant figure deux fois.", { parts: "Participant en double." });
  const participants = await prisma.participant.findMany({ where: { id: { in: entrees.map((e) => e.participantId) }, activiteId: ESPACE_DEPENSES } });
  if (participants.length !== entrees.length) throw new ErreurMetier("Participant inconnu.", { parts: "Participant inconnu." });
  const vals = entrees.map((e) => ({ participantId: e.participantId, valeur: e.valeur ?? 0 }));
  const r = s.modeRepartition === "POURCENTAGE" ? repartirPourcentages(s.montantCents ?? 0, vals) : repartirMontants(s.montantCents ?? 0, vals);
  if (!r.ok) throw new ErreurMetier(r.erreur, { parts: r.erreur });
  const nom = new Map(participants.map((p) => [p.id, p.nom]));
  const parts = r.parts.map((p) => ({ ...p, participantNom: nom.get(p.participantId) ?? "?" }));
  return {
    parts,
    cle: JSON.stringify({ mode: s.modeRepartition, parts: parts.map((p) => ({ participant: p.participantNom, pourcentageBp: p.pourcentageBp, montantCents: p.montantCents })) }),
  };
}

export async function creerDepense(s: SaisieDepense, auteur: UtilisateurCourant) {
  await valider(s, false);
  const { parts, cle } = await calculerParts(s);
  return prisma.$transaction(async (tx) => {
    const d = await tx.depense.create({
      data: {
        activiteId: ESPACE_DEPENSES,
        date: s.date,
        libelle: s.libelle,
        montantCents: s.montantCents!,
        posteId: s.posteId,
        type: s.type,
        coutFixeId: s.coutFixeId,
        tiers: s.tiers,
        note: s.note,
        dateReglement: s.dateReglement,
        modeRepartition: s.modeRepartition,
        cleAppliquee: cle,
        auteurNom: auteur.nom,
        parts: { create: parts.map((p) => ({ participantId: p.participantId, participantNom: p.participantNom, pourcentageBp: p.pourcentageBp, montantCents: p.montantCents })) },
      },
    });
    await journaliser({ activiteId: ESPACE_DEPENSES, auteur, action: "depense.creation", entite: "Depense", entiteId: d.id, resume: `Dépense « ${s.libelle} » créée`, details: { montantCents: s.montantCents, type: s.type, cle } }, tx);
    return d;
  });
}

export async function modifierDepense(id: string, s: SaisieDepense, auteur: UtilisateurCourant) {
  await valider(s, true);
  const avant = await prisma.depense.findFirst({ where: { id, activiteId: ESPACE_DEPENSES }, include: { parts: true } });
  if (!avant) throw new ErreurMetier("Dépense introuvable.");
  if (avant.statut === "ANNULEE") throw new ErreurMetier("Une dépense annulée ne peut plus être modifiée.");
  const { parts, cle } = await calculerParts(s);
  await prisma.$transaction(async (tx) => {
    await tx.partDepense.deleteMany({ where: { depenseId: id } });
    await tx.depense.update({
      where: { id },
      data: {
        date: s.date,
        libelle: s.libelle,
        montantCents: s.montantCents!,
        posteId: s.posteId,
        type: s.type,
        coutFixeId: s.coutFixeId,
        tiers: s.tiers,
        note: s.note,
        dateReglement: s.dateReglement,
        modeRepartition: s.modeRepartition,
        cleAppliquee: cle,
        parts: { create: parts.map((p) => ({ participantId: p.participantId, participantNom: p.participantNom, pourcentageBp: p.pourcentageBp, montantCents: p.montantCents })) },
      },
    });
    await journaliser(
      {
        activiteId: ESPACE_DEPENSES,
        auteur,
        action: "depense.modification",
        entite: "Depense",
        entiteId: id,
        resume: `Dépense « ${s.libelle} » modifiée`,
        motif: s.motif,
        details: {
          avant: { date: avant.date, libelle: avant.libelle, montantCents: avant.montantCents, posteId: avant.posteId, type: avant.type, cle: avant.cleAppliquee },
          apres: { date: s.date, libelle: s.libelle, montantCents: s.montantCents, posteId: s.posteId, type: s.type, cle },
        },
      },
      tx,
    );
  });
}

export async function annulerDepense(id: string, motif: string, auteur: UtilisateurCourant) {
  if (motif.length < 3) throw new ErreurMetier("Le motif d'annulation est obligatoire.", { motif: "Motif obligatoire." });
  const d = await prisma.depense.findFirst({ where: { id, activiteId: ESPACE_DEPENSES } });
  if (!d) throw new ErreurMetier("Dépense introuvable.");
  if (d.statut === "ANNULEE") throw new ErreurMetier("Cette dépense est déjà annulée.");
  await prisma.$transaction(async (tx) => {
    await tx.depense.update({ where: { id }, data: { statut: "ANNULEE", annuleeLe: new Date(), motifAnnulation: motif } });
    await journaliser({ activiteId: ESPACE_DEPENSES, auteur, action: "depense.annulation", entite: "Depense", entiteId: id, resume: `Dépense « ${d.libelle} » annulée`, motif }, tx);
  });
}
