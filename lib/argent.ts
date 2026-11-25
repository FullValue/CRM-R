/**
 * Montants monétaires en centimes entiers (DAT-01). Aucune conversion ne passe
 * par un flottant : la saisie est analysée comme une chaîne.
 */

const fmtEuro = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" });

/** 1250 → « 12,50 € ». null/undefined → « — ». */
export function euros(cents: number | null | undefined): string {
  if (cents === null || cents === undefined) return "—";
  return fmtEuro.format(cents / 100);
}

/** 1250 → « 12,50 » (valeur d'un champ de saisie). */
export function centsVersSaisie(cents: number | null | undefined): string {
  if (cents === null || cents === undefined) return "";
  const signe = cents < 0 ? "-" : "";
  const abs = Math.abs(cents);
  return `${signe}${Math.floor(abs / 100)},${String(abs % 100).padStart(2, "0")}`;
}

/**
 * Analyse une saisie en euros (« 12,5 », « 12.50 », « 1 200 », « -3 ») et
 * renvoie des centimes, ou null si la saisie n'est pas un montant valide.
 * Plus de deux décimales : refusé (pas d'arrondi silencieux).
 */
export function saisieVersCents(texte: string | null | undefined): number | null {
  const propre = (texte ?? "")
    .replace(/[\s  €]/g, "")
    .replace(",", ".");
  if (!/^-?\d+(\.\d{1,2})?$/.test(propre)) return null;
  const negatif = propre.startsWith("-");
  const [ent, dec = ""] = propre.replace("-", "").split(".");
  const cents = Number(ent) * 100 + Number(dec.padEnd(2, "0"));
  if (!Number.isSafeInteger(cents)) return null;
  return negatif ? -cents : cents;
}

/** Pourcentage d'affichage : 0.55 → « 55,0 % ». null → « — ». */
export function pourcent(fraction: number | null | undefined, decimales = 1): string {
  if (fraction === null || fraction === undefined || !Number.isFinite(fraction)) return "—";
  return `${new Intl.NumberFormat("fr-FR", {
    minimumFractionDigits: decimales,
    maximumFractionDigits: decimales,
  }).format(fraction * 100)} %`;
}

/** Points de base → « 60 % » / « 33,33 % ». */
export function bpVersPourcent(bp: number): string {
  return `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 }).format(bp / 100)} %`;
}

/** Saisie de pourcentage (« 60 », « 33,33 ») → points de base, ou null. */
export function saisieVersBp(texte: string | null | undefined): number | null {
  const propre = (texte ?? "").replace(/[\s%]/g, "").replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(propre)) return null;
  const [ent, dec = ""] = propre.split(".");
  return Number(ent) * 100 + Number(dec.padEnd(2, "0"));
}

export function nombre(n: number): string {
  return new Intl.NumberFormat("fr-FR").format(n);
}
