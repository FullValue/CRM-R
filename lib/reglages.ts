import { prisma } from "@/lib/db";

/** Réglages métier (décisions D03, D05, D06, D09, D10) avec les valeurs proposées. */
export const REGLAGES_DEFAUT = {
  "stock.politique": "BLOQUER", // D03 : BLOQUER | AUTORISER
  "vente.zone_obligatoire": "NON", // D09 : OUI = « Zone non renseignée » refusée
  "vente.base_montants": "TTC", // D06 : HT | TTC, même convention pour toutes les composantes
  "whatsapp.numero": "", // D10
  "whatsapp.delai_jours": "1",
  "whatsapp.horizon_jours": "14",
} as const;

export type CleReglage = keyof typeof REGLAGES_DEFAUT;

export async function lireReglages(): Promise<Record<CleReglage, string>> {
  const lignes = await prisma.reglage.findMany();
  const res = { ...REGLAGES_DEFAUT } as Record<CleReglage, string>;
  for (const l of lignes) if (l.cle in res) res[l.cle as CleReglage] = l.valeur;
  return res;
}
