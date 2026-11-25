import type { Tx } from "@/lib/db";
import { ErreurMetier } from "./resultat";

export type Mouvement = {
  formatId: string;
  quantite: number; // signée
  type: "ENTREE" | "SORTIE_VENTE" | "AJUSTEMENT" | "RETOUR" | "CORRECTION" | "IMPORT" | "SHOPIFY";
  origine: "CRM" | "VENDEUR" | "IMPORT" | "SHOPIFY";
  auteur?: { id: string; nom: string } | null;
  motif?: string | null;
  venteId?: string | null;
  cleUnique?: string | null;
  /** D03 : BLOQUER refuse une sortie au-delà du stock disponible. */
  politique?: "BLOQUER" | "AUTORISER";
};

/**
 * Applique un mouvement de stock tracé (STK-02). La décrémentation est
 * conditionnelle et atomique : deux ventes concurrentes sur le dernier article
 * ne peuvent pas toutes deux passer (STK-03, R05). La clé `cleUnique` garantit
 * qu'une même sortie n'est jamais appliquée deux fois.
 */
export async function appliquerMouvement(tx: Tx, m: Mouvement) {
  if (!Number.isInteger(m.quantite) || m.quantite === 0) throw new ErreurMetier("La quantité du mouvement doit être un entier non nul.");
  if (m.cleUnique) {
    const deja = await tx.mouvementStock.findUnique({ where: { cleUnique: m.cleUnique } });
    if (deja) return deja;
  }
  const bloquer = m.quantite < 0 && (m.politique ?? "BLOQUER") === "BLOQUER";
  const maj = await tx.format.updateMany({
    where: { id: m.formatId, ...(bloquer ? { quantite: { gte: -m.quantite } } : {}) },
    data: { quantite: { increment: m.quantite }, stockMajLe: new Date() },
  });
  if (maj.count === 0) {
    const f = await tx.format.findUnique({ where: { id: m.formatId }, include: { reference: true } });
    if (!f) throw new ErreurMetier("Format introuvable.");
    throw new ErreurMetier(
      `Stock insuffisant pour ${f.reference.libelle} ${f.libelle} : ${f.quantite} disponible(s), ${-m.quantite} demandé(s).`,
    );
  }
  const f = await tx.format.findUniqueOrThrow({ where: { id: m.formatId } });
  return tx.mouvementStock.create({
    data: {
      formatId: m.formatId,
      type: m.type,
      quantite: m.quantite,
      stockApres: f.quantite,
      origine: m.origine,
      auteurId: m.auteur?.id ?? null,
      auteurNom: m.auteur?.nom ?? (m.origine === "SHOPIFY" ? "Shopify" : "Système"),
      motif: m.motif ?? null,
      venteId: m.venteId ?? null,
      cleUnique: m.cleUnique ?? null,
    },
  });
}

/** Met en file un ajustement Shopify pour un format lié (SHP-03). */
export async function planifierAjustementShopify(
  tx: Tx,
  p: { formatId: string; delta: number; cle: string; venteId?: string | null },
): Promise<boolean> {
  const f = await tx.format.findUnique({ where: { id: p.formatId } });
  if (!f || f.lienStatut !== "LIE" || !f.shopifyInventoryItemId) return false;
  const boutique = await tx.boutique.findFirst({ where: { activiteId: f.activiteId } });
  const existe = await tx.operationSync.findUnique({ where: { cle: p.cle } });
  if (existe) return true;
  await tx.operationSync.create({
    data: { formatId: p.formatId, delta: p.delta, cle: p.cle, venteId: p.venteId ?? null, boutiqueId: boutique?.id ?? null },
  });
  return true;
}
