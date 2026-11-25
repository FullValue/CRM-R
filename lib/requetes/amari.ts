import { prisma } from "@/lib/db";
import type { Prisma } from "@prisma/client";
import type { Periode } from "@/lib/dates";

export async function refsDepense() {
  const [postes, participants, coutsFixes] = await Promise.all([
    prisma.poste.findMany({ where: { activiteId: "amari" }, orderBy: { libelle: "asc" } }),
    prisma.participant.findMany({ where: { activiteId: "amari" }, orderBy: { nom: "asc" } }),
    prisma.coutFixe.findMany({ where: { activiteId: "amari", actif: true }, orderBy: { libelle: "asc" } }),
  ]);
  return {
    postes: postes.map((p) => ({ id: p.id, libelle: p.libelle, actif: p.actif })),
    participants: participants.map((p) => ({ id: p.id, nom: p.nom, partDefautBp: p.partDefautBp, actif: p.actif })),
    coutsFixes: coutsFixes.map((c) => ({ id: c.id, libelle: c.libelle, posteId: c.posteId, montantCents: c.montantCents })),
  };
}

export type FiltresDepenses = { poste?: string; type?: string; statut?: string; participant?: string };

/** Filtre unique : la liste et les totaux d'une même vue utilisent les mêmes règles (AMA-04). */
export function filtreDepenses(p: Periode, f: FiltresDepenses = {}): Prisma.DepenseWhereInput {
  const where: Prisma.DepenseWhereInput = { activiteId: "amari", date: { gte: p.debut, lte: p.fin } };
  if (f.poste && f.poste !== "tous") where.posteId = f.poste;
  if (f.type && f.type !== "tous") where.type = f.type;
  if (f.participant && f.participant !== "tous") where.parts = { some: { participantId: f.participant } };
  where.statut = f.statut === "ANNULEE" ? "ANNULEE" : f.statut === "toutes" ? undefined : "ACTIVE";
  return where;
}
