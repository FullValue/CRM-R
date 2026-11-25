/**
 * Coût de revient Maison Maya — moteur repris de Maya OS (lib/calcul/cout.ts).
 * Fonctions pures en decimal.js, aucun arrondi intermédiaire ; l'arrondi à
 * 2 décimales n'intervient qu'à l'affichage.
 *
 * coûtLiquide         = volumeL × prixLitreHT × (1 + taux_perte)
 * coûtConditionnement = Σ composants non optionnels de la contenance à la date
 * coûtFaçonnage       = coutFixeSerie ÷ qteLot + coutVarUnitHT
 * coûtComplet         = liquide + conditionnement + façonnage
 */
import { Decimal, d, type Numeric } from "./decimal";
import { valeurAuJour, valeurAuJourParGroupe } from "./valeurAuJour";

export const CLE_TAUX_PERTE = "taux_perte";

export type ContexteMaya = {
  contenanceMl: number;
  prixLiquides: readonly { prixLitreHT: Numeric; dateEffet: Date }[];
  parametres: readonly { cle: string; valeur: Numeric; dateEffet: Date }[];
  composants: readonly { libelle: string; coutUnitHT: Numeric; optionnel: boolean; dateEffet: Date }[];
  faconnages: readonly { coutFixeSerie: Numeric; coutVarUnitHT: Numeric; qteLotRef: number; dateEffet: Date }[];
};

export type DecompositionMaya = {
  liquide: Decimal;
  conditionnement: Decimal;
  faconnage: Decimal;
  matiereEtCond: Decimal;
  complet: Decimal;
  qteLot: Decimal;
  /** Éléments manquants pour un coût fiable (affichés à l'écran). */
  manquants: string[];
};

export function tauxPerte(ctx: ContexteMaya, date: Date): Decimal {
  const row = valeurAuJour(ctx.parametres.filter((p) => p.cle === CLE_TAUX_PERTE), date);
  return row === null ? new Decimal(0) : d(row.valeur);
}

export function decompositionMaya(
  ctx: ContexteMaya,
  date: Date,
  options: { qteLot?: Numeric; avecOptionnels?: boolean } = {},
): DecompositionMaya {
  const manquants: string[] = [];
  const volumeL = d(ctx.contenanceMl).div(1000);

  const prix = valeurAuJour(ctx.prixLiquides, date);
  if (prix === null) manquants.push("prix du liquide");
  const liquide = prix === null ? new Decimal(0) : volumeL.mul(d(prix.prixLitreHT)).mul(tauxPerte(ctx, date).plus(1));

  const composants = valeurAuJourParGroupe(ctx.composants, date, (c) => c.libelle);
  if (composants.length === 0) manquants.push("composants");
  const conditionnement = composants.reduce<Decimal>(
    (acc, c) => (c.optionnel && !options.avecOptionnels ? acc : acc.plus(d(c.coutUnitHT))),
    new Decimal(0),
  );

  const fac = valeurAuJour(ctx.faconnages, date);
  const qteLot = options.qteLot !== undefined ? d(options.qteLot) : fac ? d(fac.qteLotRef) : new Decimal(0);
  let faconnage = new Decimal(0);
  if (fac === null) manquants.push("façonnage");
  else if (qteLot.gt(0)) faconnage = d(fac.coutFixeSerie).div(qteLot).plus(d(fac.coutVarUnitHT));

  const matiereEtCond = liquide.plus(conditionnement);
  return { liquide, conditionnement, faconnage, matiereEtCond, complet: matiereEtCond.plus(faconnage), qteLot, manquants };
}

/** Analyse de marge sur un prix de vente HT. */
export function margeMaya(prixVenteHT: Numeric, coutComplet: Numeric) {
  const prix = d(prixVenteHT);
  const cout = d(coutComplet);
  const marge = prix.minus(cout);
  return {
    marge,
    tauxMarque: prix.isZero() ? null : marge.div(prix),
    coefficient: cout.isZero() ? null : prix.div(cout),
  };
}

/** Decimal (euros) → centimes arrondis, pour l'affichage. */
export function versCents(x: Numeric): number {
  return d(x).mul(100).toDecimalPlaces(0).toNumber();
}
