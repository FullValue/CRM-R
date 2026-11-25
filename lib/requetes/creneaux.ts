import { prisma } from "@/lib/db";
import { aujourdhui } from "@/lib/dates";
import { datesDisponibles } from "@/lib/calcul/creneaux";
import { lireReglages } from "@/lib/reglages";

/** Villes ouvertes et créneaux proposés au visiteur (LIV-01) — données publiques minimales. */
export async function offreLivraison() {
  const reglages = await lireReglages();
  const delai = Number(reglages["whatsapp.delai_jours"]) || 1;
  const horizon = Number(reglages["whatsapp.horizon_jours"]) || 14;
  const zones = await prisma.zone.findMany({
    where: { activiteId: "pm", active: true, livraison: true },
    include: { creneaux: { where: { actif: true } }, fermetures: true },
    orderBy: { ville: "asc" },
  });
  const auj = aujourdhui();
  const villes = new Map<string, { ville: string; dates: Map<string, Set<string>> }>();
  for (const z of zones) {
    const dispo = datesDisponibles(z.creneaux, z.fermetures.map((f) => f.date), auj, horizon, delai);
    const v = villes.get(z.ville) ?? { ville: z.ville, dates: new Map<string, Set<string>>() };
    for (const d of dispo) {
      const s = v.dates.get(d.date) ?? new Set<string>();
      for (const c of d.creneaux) s.add(`${c.debut}-${c.fin}`);
      v.dates.set(d.date, s);
    }
    villes.set(z.ville, v);
  }
  return {
    numero: reglages["whatsapp.numero"],
    villes: [...villes.values()]
      .map((v) => ({
        ville: v.ville,
        dates: [...v.dates.entries()]
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([date, s]) => ({ date, creneaux: [...s].sort().map((c) => ({ debut: c.split("-")[0], fin: c.split("-")[1] })) })),
      }))
      .sort((a, b) => a.ville.localeCompare(b.ville)),
  };
}

export type OffreLivraison = Awaited<ReturnType<typeof offreLivraison>>;
