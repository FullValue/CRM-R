/**
 * Dates métier (PIL-03) : un fuseau unique, Europe/Paris. Les dates de vente,
 * de livraison, de règlement et de dépense sont des chaînes « AAAA-MM-JJ ».
 */

export const FUSEAU = "Europe/Paris";

const fmtIso = new Intl.DateTimeFormat("en-CA", {
  timeZone: FUSEAU,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** Date métier (Paris) d'un instant. */
export function dateParis(instant: Date = new Date()): string {
  return fmtIso.format(instant);
}

export function aujourdhui(): string {
  return dateParis(new Date());
}

export function estDateIso(s: string | null | undefined): s is string {
  if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [a, m, j] = s.split("-").map(Number);
  const d = new Date(Date.UTC(a, m - 1, j));
  return d.getUTCFullYear() === a && d.getUTCMonth() === m - 1 && d.getUTCDate() === j;
}

/** Ajoute n jours à une date AAAA-MM-JJ (arithmétique calendaire, sans fuseau). */
export function ajouterJours(iso: string, n: number): string {
  const [a, m, j] = iso.split("-").map(Number);
  const d = new Date(Date.UTC(a, m - 1, j + n));
  return d.toISOString().slice(0, 10);
}

/** Jour ISO de la semaine : 1 = lundi … 7 = dimanche. */
export function jourSemaine(iso: string): number {
  const [a, m, j] = iso.split("-").map(Number);
  const js = new Date(Date.UTC(a, m - 1, j)).getUTCDay();
  return js === 0 ? 7 : js;
}

export const JOURS = ["", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche"];

const fmtLong = new Intl.DateTimeFormat("fr-FR", {
  timeZone: "UTC",
  weekday: "long",
  day: "numeric",
  month: "long",
});
const fmtCourt = new Intl.DateTimeFormat("fr-FR", {
  timeZone: "UTC",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});
const fmtJourMois = new Intl.DateTimeFormat("fr-FR", {
  timeZone: "UTC",
  day: "numeric",
  month: "long",
});

function versUtc(iso: string): Date {
  const [a, m, j] = iso.split("-").map(Number);
  return new Date(Date.UTC(a, m - 1, j));
}

/** « 2026-12-03 » → « 03/12/2026 ». */
export function dateCourte(iso: string | null | undefined): string {
  if (!iso) return "—";
  return fmtCourt.format(versUtc(iso));
}

/** « 2026-12-03 » → « jeudi 3 décembre ». */
export function dateLongue(iso: string): string {
  return fmtLong.format(versUtc(iso));
}

/** « 2026-12-03 » → « 3 décembre ». */
export function jourMois(iso: string): string {
  return fmtJourMois.format(versUtc(iso));
}

const fmtHorodatage = new Intl.DateTimeFormat("fr-FR", {
  timeZone: FUSEAU,
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

/** Horodatage technique en heure de Paris. */
export function horodatage(d: Date | null | undefined): string {
  if (!d) return "—";
  return fmtHorodatage.format(d);
}

export type Periode = { debut: string; fin: string };

/** Périodes prédéfinies pour les filtres. */
export function periodePredefinie(cle: string | undefined, ref = aujourdhui()): Periode {
  const [a, m] = ref.split("-").map(Number);
  switch (cle) {
    case "7j":
      return { debut: ajouterJours(ref, -6), fin: ref };
    case "30j":
      return { debut: ajouterJours(ref, -29), fin: ref };
    case "mois-precedent": {
      const debut = new Date(Date.UTC(a, m - 2, 1)).toISOString().slice(0, 10);
      const fin = new Date(Date.UTC(a, m - 1, 0)).toISOString().slice(0, 10);
      return { debut, fin };
    }
    case "annee":
      return { debut: `${a}-01-01`, fin: ref };
    case "tout":
      return { debut: "2000-01-01", fin: "2999-12-31" };
    case "mois":
    default:
      return { debut: `${a}-${String(m).padStart(2, "0")}-01`, fin: ref };
  }
}

export const PERIODES = [
  { cle: "7j", libelle: "7 derniers jours" },
  { cle: "30j", libelle: "30 derniers jours" },
  { cle: "mois", libelle: "Mois en cours" },
  { cle: "mois-precedent", libelle: "Mois précédent" },
  { cle: "annee", libelle: "Année en cours" },
  { cle: "tout", libelle: "Tout l'historique" },
] as const;

/** Résout la période d'une page à partir des paramètres d'URL. */
export function resoudrePeriode(sp: { periode?: string; du?: string; au?: string }): Periode & { cle: string } {
  if (estDateIso(sp.du) && estDateIso(sp.au) && sp.du <= sp.au) {
    return { debut: sp.du, fin: sp.au, cle: "perso" };
  }
  const cle = sp.periode ?? "mois";
  return { ...periodePredefinie(cle), cle };
}
