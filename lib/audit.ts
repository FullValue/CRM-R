import { prisma, type Tx } from "@/lib/db";

type EntreeAudit = {
  activiteId?: string | null;
  auteur?: { id: string; nom: string } | null;
  action: string;
  entite: string;
  entiteId?: string | null;
  resume: string;
  details?: unknown;
  motif?: string | null;
};

/** Journalise un changement sensible (DAT-01). Ne jamais y passer de secret. */
export async function journaliser(e: EntreeAudit, tx: Tx = prisma) {
  await tx.journalAudit.create({
    data: {
      activiteId: e.activiteId ?? null,
      auteurId: e.auteur?.id ?? null,
      auteurNom: e.auteur?.nom ?? "Système",
      action: e.action,
      entite: e.entite,
      entiteId: e.entiteId ?? null,
      resume: e.resume,
      details: e.details === undefined ? null : JSON.stringify(e.details),
      motif: e.motif ?? null,
    },
  });
}
