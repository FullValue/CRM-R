"use client";

import Link from "next/link";
import { useContext, useDeferredValue, useMemo, useState } from "react";
import { ArrowUpRightIcon, BoxesIcon, ChevronDownIcon, SearchIcon, XIcon } from "lucide-react";
import { euros, nombre } from "@/lib/argent";
import { ESPACES, type EspaceId } from "@/lib/domaine";
import { PalettesContext } from "@/components/palette-espace";
import { ControleSegmente } from "@/components/mobile/controle-segmente";

export type VarianteStock = { id: string; libelle: string; sku: string; quantite: number; prixCents: number };
export type ProduitStock = { id: string; espace: EspaceId; code: string; libelle: string; famille: string | null; variantes: VarianteStock[] };

type Filtre = "tous" | "faible" | "rupture";
const SEUIL_FAIBLE = 5;
const PAR_PAGE = 8;

function niveau(q: number): "rupture" | "faible" | "ok" {
  return q <= 0 ? "rupture" : q <= SEUIL_FAIBLE ? "faible" : "ok";
}

function normaliser(s: string) {
  return s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
}

/** Met en évidence le passage recherché, sans tenir compte des accents. */
function Surligne({ texte, recherche }: { texte: string; recherche: string }) {
  if (!recherche) return <>{texte}</>;
  const i = normaliser(texte).indexOf(recherche);
  if (i < 0) return <>{texte}</>;
  return <>{texte.slice(0, i)}<mark>{texte.slice(i, i + recherche.length)}</mark>{texte.slice(i + recherche.length)}</>;
}

/**
 * Suivi de stock : un projet à la fois, recherche instantanée sur le nom, le
 * code, le SKU ou la variante ; chaque produit se déplie sur ses variantes.
 */
export function WidgetStock({ espaces, produits }: { espaces: EspaceId[]; produits: ProduitStock[] }) {
  const palettes = useContext(PalettesContext);
  const [espace, setEspace] = useState<EspaceId>(espaces.includes("pm") ? "pm" : espaces[0]);
  const [saisie, setSaisie] = useState("");
  const [filtre, setFiltre] = useState<Filtre>("tous");
  const [ouverts, setOuverts] = useState<Set<string>>(new Set());
  const [limite, setLimite] = useState(PAR_PAGE);
  const recherche = normaliser(useDeferredValue(saisie).trim());

  const duProjet = useMemo(() => produits.filter((p) => p.espace === espace), [produits, espace]);
  const stats = useMemo(() => {
    const variantes = duProjet.flatMap((p) => p.variantes);
    return {
      unites: variantes.reduce((a, v) => a + Math.max(0, v.quantite), 0),
      valeur: variantes.reduce((a, v) => a + Math.max(0, v.quantite) * v.prixCents, 0),
      faible: variantes.filter((v) => niveau(v.quantite) === "faible").length,
      rupture: variantes.filter((v) => niveau(v.quantite) === "rupture").length,
    };
  }, [duProjet]);

  const resultats = useMemo(() => {
    return duProjet
      .map((p) => {
        const produitTrouve = !recherche || normaliser(`${p.libelle} ${p.code} ${p.famille ?? ""}`).includes(recherche);
        const variantes = p.variantes.filter(
          (v) =>
            (filtre === "tous" || niveau(v.quantite) === filtre) &&
            (produitTrouve || normaliser(`${v.libelle} ${v.sku}`).includes(recherche)),
        );
        return { ...p, visibles: variantes, viaVariante: !produitTrouve };
      })
      .filter((p) => p.visibles.length > 0);
  }, [duProjet, recherche, filtre]);

  const affiches = resultats.slice(0, limite);
  const lienStock = `/${espace}/stock`;

  function basculer(id: string) {
    setOuverts((o) => {
      const n = new Set(o);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  return (
    <section className="crm-widget crm-widget-stock" data-palette={palettes[espace]} aria-labelledby="titre-stock">
      <header className="crm-widget-tete">
        <span className="crm-widget-icone"><BoxesIcon aria-hidden="true" /></span>
        <div>
          <h2 id="titre-stock">Suivi de stock</h2>
          <p>{nombre(stats.unites)} unités · {euros(stats.valeur)} au prix de vente</p>
        </div>
        <Link href={lienStock} className="crm-widget-lien" aria-label={`Ouvrir le stock ${ESPACES[espace].nom}`}>
          <ArrowUpRightIcon />
        </Link>
      </header>

      {espaces.length > 1 && (
        <ControleSegmente
          libelle="Projet"
          valeur={espace}
          onChange={(v) => { setEspace(v as EspaceId); setLimite(PAR_PAGE); setOuverts(new Set()); }}
          options={espaces.map((e) => ({ valeur: e, libelle: ESPACES[e].court, palette: palettes[e] }))}
        />
      )}

      <div className="crm-filtres-stock" role="radiogroup" aria-label="Disponibilité">
        {([
          ["tous", "Tout", duProjet.reduce((a, p) => a + p.variantes.length, 0)],
          ["faible", "Stock faible", stats.faible],
          ["rupture", "Rupture", stats.rupture],
        ] as const).map(([v, l, n]) => (
          <button key={v} type="button" role="radio" aria-checked={filtre === v} data-niveau={v} onClick={() => { setFiltre(v); setLimite(PAR_PAGE); }}>
            {l} <span>{n}</span>
          </button>
        ))}
      </div>

      <label className="crm-recherche-app">
        <SearchIcon aria-hidden="true" />
        <input
          type="search"
          value={saisie}
          onChange={(e) => { setSaisie(e.target.value); setLimite(PAR_PAGE); }}
          placeholder="Produit, SKU, variante…"
          aria-label="Rechercher dans le stock"
          enterKeyHint="search"
          autoComplete="off"
        />
        {saisie && (
          <button type="button" onClick={() => setSaisie("")} aria-label="Effacer la recherche"><XIcon /></button>
        )}
      </label>

      {resultats.length === 0 ? (
        <div className="crm-vide-app crm-vide-compact">
          <strong>{duProjet.length === 0 ? "Aucun produit actif" : "Aucun résultat"}</strong>
          <p>{duProjet.length === 0 ? `Le catalogue ${ESPACES[espace].nom} est vide.` : saisie ? `Rien ne correspond à « ${saisie} ».` : "Aucune variante dans cet état."}</p>
        </div>
      ) : (
        <ul className="crm-liste-stock" key={`${espace}-${filtre}`}>
          {affiches.map((p, i) => {
            const total = p.variantes.reduce((a, v) => a + Math.max(0, v.quantite), 0);
            const pire = p.variantes.some((v) => v.quantite <= 0) ? "rupture" : p.variantes.some((v) => v.quantite <= SEUIL_FAIBLE) ? "faible" : "ok";
            const ouvert = ouverts.has(p.id) || (recherche.length > 1 && i < 3);
            return (
              <li key={p.id} data-ouvert={ouvert || undefined} style={{ "--rang": Math.min(i, 8) } as React.CSSProperties}>
                <button type="button" className="crm-produit" aria-expanded={ouvert} onClick={() => basculer(p.id)}>
                  <span className="crm-produit-pastille" data-niveau={pire} aria-hidden="true" />
                  <span className="crm-produit-nom">
                    <strong><Surligne texte={p.libelle} recherche={recherche} /></strong>
                    <small>
                      <Surligne texte={p.code} recherche={recherche} /> · {p.variantes.length} variante{p.variantes.length > 1 ? "s" : ""}
                    </small>
                  </span>
                  <span className="crm-produit-barres" aria-hidden="true">
                    {p.variantes.slice(0, 6).map((v) => <i key={v.id} data-niveau={niveau(v.quantite)} />)}
                  </span>
                  <span className="crm-produit-total"><b>{nombre(total)}</b><small>en stock</small></span>
                  <ChevronDownIcon className="crm-produit-chevron" aria-hidden="true" />
                </button>
                <div className="crm-depliant" aria-hidden={!ouvert}>
                  <div>
                    <table className="crm-variantes">
                      <thead>
                        <tr><th>Variante</th><th>SKU</th><th>Stock</th></tr>
                      </thead>
                      <tbody>
                        {p.visibles.map((v) => (
                          <tr key={v.id} data-niveau={niveau(v.quantite)}>
                            <td><Surligne texte={v.libelle} recherche={p.viaVariante ? recherche : ""} /><small>{euros(v.prixCents)}</small></td>
                            <td><Surligne texte={v.sku} recherche={p.viaVariante ? recherche : ""} /></td>
                            <td><span className="crm-quantite" data-niveau={niveau(v.quantite)}>{v.quantite}</span></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {resultats.length > limite && (
        <button type="button" className="crm-plus-app" onClick={() => setLimite((l) => l + PAR_PAGE * 2)}>
          Afficher {Math.min(resultats.length - limite, PAR_PAGE * 2)} produit(s) de plus
        </button>
      )}
    </section>
  );
}
