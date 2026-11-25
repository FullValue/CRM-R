/**
 * Rentabilité d'une vente (FIN-01, FIN-02) — fonctions pures, centimes entiers.
 *
 * Montant      = Σ quantité × prix unitaire
 * Coût appliqué = coût total de commande s'il est renseigné (prioritaire),
 *                 sinon Σ quantité × coût unitaire si TOUS les coûts sont connus,
 *                 sinon « coût à compléter » (null).
 * Marge        = montant − coût appliqué
 * Taux         = marge ÷ montant (vide si montant nul)
 *
 * Un coût saisi à 0 € est une valeur connue ; seul `null` signifie « absent ».
 */

export type LigneRentabilite = {
  quantite: number;
  prixUnitaireCents: number;
  coutUnitaireCents: number | null;
};

export type SourceCout = "COMMANDE" | "LIGNES" | "A_COMPLETER";

export type Rentabilite = {
  montantCents: number;
  coutCents: number | null;
  coutSource: SourceCout;
  margeCents: number | null;
  tauxMarge: number | null;
};

export function montantLignes(lignes: readonly LigneRentabilite[]): number {
  return lignes.reduce((acc, l) => acc + l.quantite * l.prixUnitaireCents, 0);
}

export function rentabiliteVente(
  lignes: readonly LigneRentabilite[],
  coutCommandeCents: number | null = null,
): Rentabilite {
  const montantCents = montantLignes(lignes);
  let coutCents: number | null;
  let coutSource: SourceCout;
  if (coutCommandeCents !== null && coutCommandeCents !== undefined) {
    coutCents = coutCommandeCents;
    coutSource = "COMMANDE";
  } else if (lignes.length > 0 && lignes.every((l) => l.coutUnitaireCents !== null)) {
    coutCents = lignes.reduce((acc, l) => acc + l.quantite * (l.coutUnitaireCents ?? 0), 0);
    coutSource = "LIGNES";
  } else {
    coutCents = null;
    coutSource = "A_COMPLETER";
  }
  const margeCents = coutCents === null ? null : montantCents - coutCents;
  const tauxMarge = margeCents === null || montantCents === 0 ? null : margeCents / montantCents;
  return { montantCents, coutCents, coutSource, margeCents, tauxMarge };
}

export type VenteAgregable = {
  statut: string;
  montantCents: number;
  coutCents: number | null;
};

export type Agregats = {
  nbVentes: number;
  caCents: number;
  nbCoutConnu: number;
  caCouvertCents: number;
  coutCents: number;
  margeCents: number;
  /** Marge ÷ CA couvert, sur les seules ventes à coût connu. */
  tauxMarge: number | null;
  /** Ventes à coût connu ÷ ventes éligibles. */
  couverture: number | null;
};

/** Agrégats sur les ventes éligibles (non annulées). */
export function agregerVentes(ventes: readonly VenteAgregable[]): Agregats {
  const eligibles = ventes.filter((v) => v.statut !== "ANNULEE");
  const connues = eligibles.filter((v) => v.coutCents !== null);
  const caCents = eligibles.reduce((a, v) => a + v.montantCents, 0);
  const caCouvertCents = connues.reduce((a, v) => a + v.montantCents, 0);
  const coutCents = connues.reduce((a, v) => a + (v.coutCents ?? 0), 0);
  const margeCents = caCouvertCents - coutCents;
  return {
    nbVentes: eligibles.length,
    caCents,
    nbCoutConnu: connues.length,
    caCouvertCents,
    coutCents,
    margeCents,
    tauxMarge: caCouvertCents === 0 ? null : margeCents / caCouvertCents,
    couverture: eligibles.length === 0 ? null : connues.length / eligibles.length,
  };
}
