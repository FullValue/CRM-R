/**
 * Classements Parfumerie Mobile (PIL-02) : meilleures ventes et meilleures journées.
 * Les ventes annulées sont exclues. Les libellés historiques des lignes sont
 * utilisés : une référence archivée reste classée sur sa période.
 */

export type LigneClassable = {
  venteStatut: string;
  dateVente: string;
  referenceId: string;
  referenceCode: string;
  referenceLibelle: string;
  formatId: string;
  formatLibelle: string;
  quantite: number;
  prixUnitaireCents: number;
};

export type EntreeClassement = {
  cle: string;
  libelle: string;
  detail: string;
  unites: number;
  caCents: number;
};

export function meilleuresVentes(
  lignes: readonly LigneClassable[],
  regroupement: "reference" | "format",
  tri: "unites" | "ca",
): EntreeClassement[] {
  const map = new Map<string, EntreeClassement>();
  for (const l of lignes) {
    if (l.venteStatut === "ANNULEE") continue;
    const cle = regroupement === "reference" ? l.referenceId : l.formatId;
    const e = map.get(cle) ?? {
      cle,
      libelle: l.referenceLibelle,
      detail: regroupement === "reference" ? l.referenceCode : `${l.referenceCode} · ${l.formatLibelle}`,
      unites: 0,
      caCents: 0,
    };
    e.unites += l.quantite;
    e.caCents += l.quantite * l.prixUnitaireCents;
    map.set(cle, e);
  }
  return [...map.values()].sort((a, b) =>
    tri === "unites"
      ? b.unites - a.unites || b.caCents - a.caCents || a.libelle.localeCompare(b.libelle)
      : b.caCents - a.caCents || b.unites - a.unites || a.libelle.localeCompare(b.libelle),
  );
}

export type VenteJournee = { statut: string; dateVente: string; montantCents: number };
export type Journee = { date: string; caCents: number; nbVentes: number };

/** Classement des journées par CA suivi, regroupé par DATE DE VENTE (PIL-02, R20). */
export function meilleuresJournees(ventes: readonly VenteJournee[]): Journee[] {
  const map = new Map<string, Journee>();
  for (const v of ventes) {
    if (v.statut === "ANNULEE") continue;
    const j = map.get(v.dateVente) ?? { date: v.dateVente, caCents: 0, nbVentes: 0 };
    j.caCents += v.montantCents;
    j.nbVentes += 1;
    map.set(v.dateVente, j);
  }
  return [...map.values()].sort((a, b) => b.caCents - a.caCents || b.date.localeCompare(a.date));
}
