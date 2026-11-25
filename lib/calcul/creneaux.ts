import { ajouterJours, jourSemaine } from "@/lib/dates";

/**
 * Créneaux de livraison proposés (LIV-01) : source unique = paramétrage CRM
 * (créneaux hebdomadaires par zone, moins les fermetures datées).
 */

export type CreneauHebdo = { jour: number; heureDebut: string; heureFin: string; actif: boolean };

export type DateDisponible = { date: string; creneaux: { debut: string; fin: string }[] };

export function datesDisponibles(
  creneaux: readonly CreneauHebdo[],
  fermetures: readonly string[],
  depuis: string,
  nbJours = 14,
  delaiJours = 1,
): DateDisponible[] {
  const fermees = new Set(fermetures);
  const res: DateDisponible[] = [];
  for (let i = delaiJours; i < delaiJours + nbJours; i++) {
    const date = ajouterJours(depuis, i);
    if (fermees.has(date)) continue;
    const j = jourSemaine(date);
    const du = creneaux
      .filter((c) => c.actif && c.jour === j)
      .sort((a, b) => a.heureDebut.localeCompare(b.heureDebut))
      .map((c) => ({ debut: c.heureDebut, fin: c.heureFin }));
    if (du.length > 0) res.push({ date, creneaux: du });
  }
  return res;
}

/** « 15:00 » → « 15 h », « 15:30 » → « 15 h 30 ». */
export function heure(h: string): string {
  const [hh, mm] = h.split(":");
  return mm === "00" ? `${Number(hh)} h` : `${Number(hh)} h ${mm}`;
}

export function libelleCreneau(debut: string, fin: string): string {
  return `de ${heure(debut)} à ${heure(fin)}`;
}
