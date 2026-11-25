import { prisma } from "@/lib/db";
import type { Prisma } from "@prisma/client";
import type { Periode } from "@/lib/dates";
import { lireReglages } from "@/lib/reglages";

export type FiltresVentes = {
  reference?: string;
  vendeur?: string;
  zone?: string; // id | "aucune"
  etat?: string; // CONFIRMEE | ANNULEE | CORRIGEE | A_COMPLETER | NON_REGLEE
  q?: string; // recherche client (habilités)
  canal?: string;
  provenance?: string;
};

/**
 * Filtre unique des ventes : le journal, les totaux, la carte et les
 * classements d'une même page utilisent exactement ce filtre (PIL-03).
 * La date de référence est la DATE DE VENTE.
 */
export function filtreVentes(p: Periode, f: FiltresVentes = {}): Prisma.VenteWhereInput {
  const where: Prisma.VenteWhereInput = { activiteId: "pm", dateVente: { gte: p.debut, lte: p.fin } };
  if (f.reference && f.reference !== "tous") where.lignes = { some: { referenceId: f.reference } };
  if (f.vendeur && f.vendeur !== "tous") where.vendeurId = f.vendeur;
  if (f.zone && f.zone !== "tous") where.zoneId = f.zone === "aucune" ? null : f.zone;
  if (f.canal && f.canal !== "tous") where.canal = f.canal;
  if (f.provenance && f.provenance !== "tous") where.zoneProvenance = f.provenance;
  if (f.q) where.client = { contains: f.q };
  switch (f.etat) {
    case "CONFIRMEE":
      where.statut = "CONFIRMEE";
      break;
    case "ANNULEE":
      where.statut = "ANNULEE";
      break;
    case "CORRIGEE":
      where.corrigee = true;
      break;
    case "A_COMPLETER":
      where.coutSource = "A_COMPLETER";
      where.statut = "CONFIRMEE";
      break;
    case "NON_REGLEE":
      where.regleeLe = null;
      where.statut = "CONFIRMEE";
      break;
  }
  return where;
}

export async function ventesDetaillees(where: Prisma.VenteWhereInput, take?: number) {
  return prisma.vente.findMany({
    where,
    include: { lignes: true, vendeur: { select: { nom: true } } },
    orderBy: [{ dateVente: "desc" }, { saisieLe: "desc" }],
    take,
  });
}

export type VenteDetaillee = Awaited<ReturnType<typeof ventesDetaillees>>[number];

/** Données de référence pour le formulaire de vente. */
export async function donneesFormulaireVente() {
  const [refs, zones, vendeurs, reglages] = await Promise.all([
    prisma.reference.findMany({
      where: { activiteId: "pm", etat: "ACTIF" },
      include: { formats: { where: { etat: "ACTIF" }, orderBy: { contenanceMl: "asc" } } },
      orderBy: { code: "asc" },
    }),
    prisma.zone.findMany({ where: { activiteId: "pm", active: true }, orderBy: { libelle: "asc" } }),
    prisma.utilisateur.findMany({ where: { actif: true, habilitations: { some: { activiteId: "pm" } } }, select: { id: true, nom: true, role: true }, orderBy: { nom: "asc" } }),
    lireReglages(),
  ]);
  return {
    catalogue: refs
      .filter((r) => r.formats.length > 0)
      .map((r) => ({
        id: r.id,
        code: r.code,
        libelle: r.libelle,
        formats: r.formats.map((f) => ({ id: f.id, libelle: f.libelle, sku: f.sku, prixVenteCents: f.prixVenteCents, quantite: f.quantite })),
      })),
    zones: zones.map((z) => ({ id: z.id, libelle: z.libelle, ville: z.ville, lat: z.lat, lng: z.lng, rayonKm: z.rayonKm })),
    vendeurs,
    politiqueStock: reglages["stock.politique"],
    zoneObligatoire: reglages["vente.zone_obligatoire"] === "OUI",
    base: reglages["vente.base_montants"],
  };
}

export type DonneesFormulaireVente = Awaited<ReturnType<typeof donneesFormulaireVente>>;
