/**
 * Répartition d'une dépense entre participants (AMA-03).
 *
 * Mode POURCENTAGE : pourcentages en points de base (10000 = 100 %), somme
 * exigée = 100 %. Les centimes sont répartis par la méthode du plus fort reste,
 * départage stable par ordre de saisie : la somme des parts égale toujours la
 * dépense, et le même calcul donne toujours le même résultat.
 *
 * Mode MONTANT : montants en centimes, somme exigée = montant de la dépense.
 */

export type EntreePart = { participantId: string; valeur: number };
export type PartCalculee = { participantId: string; pourcentageBp: number | null; montantCents: number };

export type ResultatRepartition =
  | { ok: true; parts: PartCalculee[] }
  | { ok: false; erreur: string; ecart: number };

export const TOTAL_BP = 10000;

export function repartirPourcentages(montantCents: number, entrees: readonly EntreePart[]): ResultatRepartition {
  if (entrees.length === 0) return { ok: false, erreur: "Ajoutez au moins un participant.", ecart: TOTAL_BP };
  if (entrees.some((e) => !Number.isInteger(e.valeur) || e.valeur < 0)) {
    return { ok: false, erreur: "Chaque pourcentage doit être positif.", ecart: 0 };
  }
  const somme = entrees.reduce((a, e) => a + e.valeur, 0);
  if (somme !== TOTAL_BP) {
    const ecart = TOTAL_BP - somme;
    return {
      ok: false,
      ecart,
      erreur: `La somme des pourcentages vaut ${fmtBp(somme)} : écart de ${fmtBp(Math.abs(ecart))} à ${ecart > 0 ? "répartir" : "retirer"}.`,
    };
  }
  const signe = montantCents < 0 ? -1 : 1;
  const abs = Math.abs(montantCents);
  const bruts = entrees.map((e, i) => {
    const exact = abs * e.valeur;
    return { i, base: Math.floor(exact / TOTAL_BP), reste: exact % TOTAL_BP };
  });
  let restant = abs - bruts.reduce((a, b) => a + b.base, 0);
  const ordre = [...bruts].sort((a, b) => b.reste - a.reste || a.i - b.i);
  const bonus = new Array(entrees.length).fill(0);
  for (const b of ordre) {
    if (restant <= 0) break;
    bonus[b.i] += 1;
    restant -= 1;
  }
  return {
    ok: true,
    parts: entrees.map((e, i) => ({
      participantId: e.participantId,
      pourcentageBp: e.valeur,
      montantCents: signe * (bruts[i].base + bonus[i]),
    })),
  };
}

export function repartirMontants(montantCents: number, entrees: readonly EntreePart[]): ResultatRepartition {
  if (entrees.length === 0) return { ok: false, erreur: "Ajoutez au moins un participant.", ecart: montantCents };
  if (entrees.some((e) => !Number.isInteger(e.valeur) || e.valeur < 0)) {
    return { ok: false, erreur: "Chaque montant doit être positif.", ecart: 0 };
  }
  const somme = entrees.reduce((a, e) => a + e.valeur, 0);
  if (somme !== montantCents) {
    const ecart = montantCents - somme;
    return {
      ok: false,
      ecart,
      erreur: `La somme des parts vaut ${fmtCents(somme)} pour une dépense de ${fmtCents(montantCents)} : écart de ${fmtCents(Math.abs(ecart))}.`,
    };
  }
  return {
    ok: true,
    parts: entrees.map((e) => ({ participantId: e.participantId, pourcentageBp: null, montantCents: e.valeur })),
  };
}

function fmtBp(bp: number) {
  return `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 }).format(bp / 100)} %`;
}
function fmtCents(c: number) {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(c / 100);
}
