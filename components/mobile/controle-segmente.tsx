"use client";

/**
 * Contrôle segmenté façon iOS : le curseur blanc glisse d'une option à l'autre.
 * Les options partagent la largeur à parts égales.
 */
export function ControleSegmente({ libelle, valeur, options, onChange }: {
  libelle: string;
  valeur: string;
  options: { valeur: string; libelle: React.ReactNode; palette?: string }[];
  onChange: (valeur: string) => void;
}) {
  const index = Math.max(0, options.findIndex((o) => o.valeur === valeur));
  return (
    <div className="crm-segmente" role="radiogroup" aria-label={libelle} style={{ "--n": options.length, "--i": index } as React.CSSProperties}>
      <span className="crm-segmente-curseur" aria-hidden="true" />
      {options.map((o) => (
        <button
          key={o.valeur}
          type="button"
          role="radio"
          aria-checked={o.valeur === valeur}
          data-palette={o.palette}
          onClick={() => {
            if (o.valeur !== valeur) navigator.vibrate?.(5);
            onChange(o.valeur);
          }}
        >
          {o.palette && <i aria-hidden="true" />}
          <span>{o.libelle}</span>
        </button>
      ))}
    </div>
  );
}
