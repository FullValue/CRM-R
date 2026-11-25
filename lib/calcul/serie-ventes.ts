import { ajouterJours, type Periode } from "@/lib/dates";

type Vente = { dateVente: string; montantCents: number; statut: string };

export function serieChiffreAffaires(ventes: Vente[], periode: Periode & { cle: string }) {
  const eligibles = ventes.filter((v) => v.statut !== "ANNULEE" && v.dateVente >= periode.debut && v.dateVente <= periode.fin);
  const dates = periode.cle === "tout" ? [...new Set(eligibles.map((v) => v.dateVente))].sort() : [];
  const debut = periode.cle === "tout" ? dates[0] : periode.debut;
  const fin = periode.cle === "tout" ? dates.at(-1) : periode.fin;
  if (!debut || !fin) return { granularite: "jour", donnees: [] } as const;

  const parMois = ajouterJours(debut, 399) < fin;
  const granularite = parMois ? "mois" : "jour";
  const montants = new Map<string, number>();
  const cle = (date: string) => parMois ? `${date.slice(0, 7)}-01` : date;
  for (const vente of eligibles) {
    const date = cle(vente.dateVente);
    montants.set(date, (montants.get(date) ?? 0) + vente.montantCents);
  }

  const donnees: { date: string; ca: number }[] = [];
  if (parMois) {
    // Une période longue conserve les mois ayant des ventes sans générer de colonnes vides.
    for (const [date, cents] of [...montants.entries()].sort(([a], [b]) => a.localeCompare(b))) {
      donnees.push({ date, ca: cents / 100 });
    }
  } else {
    for (let date = debut; date <= fin; date = ajouterJours(date, 1)) {
      donnees.push({ date, ca: (montants.get(date) ?? 0) / 100 });
    }
  }
  return { granularite, donnees };
}
