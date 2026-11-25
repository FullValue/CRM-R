/**
 * Fonds de roulement — modalité « trésorerie opérationnelle » (FIN-03).
 *
 * Solde de clôture = solde d'ouverture + encaissements − décaissements ± ajustements.
 * Le solde d'ouverture d'une période = mouvement OUVERTURE daté + tous les flux
 * réglés entre la date d'ouverture et la veille du début de période.
 * Les flux sont pris à leur DATE DE RÈGLEMENT ; un flux annulé est exclu.
 */

export type FluxTresorerie = {
  dateReglement: string;
  type: "OUVERTURE" | "ENCAISSEMENT" | "DECAISSEMENT" | "AJUSTEMENT" | string;
  montantCents: number;
  annule: boolean;
};

export type SyntheseTresorerie = {
  dateOuverture: string | null;
  soldeOuvertureCents: number;
  encaissementsCents: number;
  decaissementsCents: number;
  ajustementsCents: number;
  soldeClotureCents: number;
  debutEffectif: string;
};

/** Effet signé d'un flux sur le solde. */
export function effet(f: FluxTresorerie): number {
  switch (f.type) {
    case "DECAISSEMENT":
      return -Math.abs(f.montantCents);
    case "ENCAISSEMENT":
    case "OUVERTURE":
      return Math.abs(f.montantCents);
    default:
      return f.montantCents;
  }
}

export function syntheseTresorerie(
  flux: readonly FluxTresorerie[],
  debut: string,
  fin: string,
): SyntheseTresorerie {
  const actifs = flux.filter((f) => !f.annule);
  const ouvertures = actifs
    .filter((f) => f.type === "OUVERTURE")
    .sort((a, b) => a.dateReglement.localeCompare(b.dateReglement));
  // La dernière ouverture antérieure ou égale à la fin fait référence.
  const ouverture = [...ouvertures].reverse().find((o) => o.dateReglement <= fin) ?? null;
  const dateOuverture = ouverture?.dateReglement ?? null;
  const debutEffectif = dateOuverture && dateOuverture > debut ? dateOuverture : debut;

  const courants = actifs.filter((f) => f.type !== "OUVERTURE" && (!dateOuverture || f.dateReglement >= dateOuverture));
  const avant = courants.filter((f) => f.dateReglement < debutEffectif);
  const dans = courants.filter((f) => f.dateReglement >= debutEffectif && f.dateReglement <= fin);

  const soldeOuvertureCents = (ouverture ? Math.abs(ouverture.montantCents) : 0) + avant.reduce((a, f) => a + effet(f), 0);
  const encaissementsCents = dans.filter((f) => f.type === "ENCAISSEMENT").reduce((a, f) => a + Math.abs(f.montantCents), 0);
  const decaissementsCents = dans.filter((f) => f.type === "DECAISSEMENT").reduce((a, f) => a + Math.abs(f.montantCents), 0);
  const ajustementsCents = dans.filter((f) => f.type === "AJUSTEMENT").reduce((a, f) => a + f.montantCents, 0);
  return {
    dateOuverture,
    soldeOuvertureCents,
    encaissementsCents,
    decaissementsCents,
    ajustementsCents,
    soldeClotureCents: soldeOuvertureCents + encaissementsCents - decaissementsCents + ajustementsCents,
    debutEffectif,
  };
}
