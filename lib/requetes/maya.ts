import { prisma } from "@/lib/db";
import { decompositionMaya, margeMaya, versCents, type ContexteMaya } from "@/lib/calcul/coutMaya";
import { d } from "@/lib/calcul/decimal";

/** Charge le registre des coûts Maya une seule fois. */
export async function registreMaya() {
  const [parametres, composants, faconnages] = await Promise.all([
    prisma.parametreMaya.findMany({ orderBy: { dateEffet: "desc" } }),
    prisma.composantMaya.findMany({ orderBy: [{ contenanceMl: "desc" }, { libelle: "asc" }, { dateEffet: "desc" }] }),
    prisma.faconnageMaya.findMany({ orderBy: [{ contenanceMl: "desc" }, { dateEffet: "desc" }] }),
  ]);
  return { parametres, composants, faconnages };
}

export type LigneCoutMaya = {
  formatId: string;
  sku: string;
  libelle: string;
  contenanceMl: number | null;
  prixVenteCents: number;
  liquideCents: number;
  conditionnementCents: number;
  faconnageCents: number;
  completCents: number;
  /** Les prix publics Maya sont TTC : la marge se calcule sur le prix HT (TVA 20 %). */
  prixHTCents: number;
  margeCents: number;
  tauxMarque: number | null;
  coefficient: number | null;
  manquants: string[];
};

/** Coûts de revient de formats Maya à une date, avec marge sur prix de vente HT. */
export async function coutsFormatsMaya(referenceIds: string[] | null, date = new Date()): Promise<LigneCoutMaya[]> {
  const reg = await registreMaya();
  const refs = await prisma.reference.findMany({
    where: { activiteId: "maya", ...(referenceIds ? { id: { in: referenceIds } } : {}) },
    include: { formats: { orderBy: { contenanceMl: "desc" } }, prixLiquides: true },
    orderBy: { code: "asc" },
  });
  const res: LigneCoutMaya[] = [];
  for (const r of refs) {
    for (const f of r.formats) {
      if (!f.contenanceMl) {
        res.push({ formatId: f.id, sku: f.sku, libelle: `${r.libelle} ${f.libelle}`, contenanceMl: null, prixVenteCents: f.prixVenteCents, liquideCents: 0, conditionnementCents: 0, faconnageCents: 0, completCents: 0, prixHTCents: 0, margeCents: 0, tauxMarque: null, coefficient: null, manquants: ["contenance du format"] });
        continue;
      }
      const ctx: ContexteMaya = {
        contenanceMl: f.contenanceMl,
        prixLiquides: r.prixLiquides,
        parametres: reg.parametres,
        composants: reg.composants.filter((c) => c.contenanceMl === f.contenanceMl),
        faconnages: reg.faconnages.filter((c) => c.contenanceMl === f.contenanceMl),
      };
      const dec = decompositionMaya(ctx, date);
      const prixHT = d(f.prixVenteCents).div(100).div(1.2);
      const m = margeMaya(prixHT, dec.complet);
      res.push({
        formatId: f.id,
        sku: f.sku,
        libelle: `${r.libelle} ${f.libelle}`,
        contenanceMl: f.contenanceMl,
        prixVenteCents: f.prixVenteCents,
        liquideCents: versCents(dec.liquide),
        conditionnementCents: versCents(dec.conditionnement),
        faconnageCents: versCents(dec.faconnage),
        completCents: versCents(dec.complet),
        prixHTCents: versCents(prixHT),
        margeCents: versCents(m.marge),
        tauxMarque: m.tauxMarque?.toNumber() ?? null,
        coefficient: m.coefficient?.toNumber() ?? null,
        manquants: dec.manquants,
      });
    }
  }
  return res;
}
