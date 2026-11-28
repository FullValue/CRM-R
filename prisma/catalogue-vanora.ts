/**
 * Catalogue Parfumerie Mobile importé du fichier fournisseur
 * prisma/donnees/vanora-parfums.csv (séparateur « ; », une ligne par parfum).
 *
 * Chaque ligne donne une référence (code PM-001, PM-002… dans l'ordre du
 * fichier) et un format par contenance trouvée dans la colonne « prix »
 * (« 100 ml : 189 € | 50 ml : 120 € »). La marque sert de famille, les notes
 * olfactives complètent la description. Le fichier ne contient ni stock ni
 * coût : ils sont fictifs et générés par l'appelant.
 */
import { readFileSync } from "node:fs";

export type FormatVanora = { libelle: string; contenanceMl: number; prixVenteCents: number; suffixe: string };
export type ParfumVanora = { code: string; libelle: string; marque: string; description: string; formats: FormatVanora[] };

const FICHIER = new URL("./donnees/vanora-parfums.csv", import.meta.url);

/** Graphies de marque harmonisées (le fichier mélange plusieurs casses). */
const MARQUES: Record<string, string> = {
  "ph fragrances": "pH Fragrances",
  "giardini di toscana": "Giardini Di Toscana",
  "frederic malle": "Frédéric Malle",
  "maison magistral": "Maison Magistral",
};

function nettoyer(s: string | undefined) {
  return (s ?? "").replace(/\s+/g, " ").replace(/\s+([,.])/g, "$1").trim();
}

/** Découpe une ligne CSV « ; » en tenant compte des guillemets. */
function decouper(ligne: string): string[] {
  const champs: string[] = [];
  let courant = "";
  let guillemets = false;
  for (let i = 0; i < ligne.length; i++) {
    const c = ligne[i];
    if (c === '"') {
      if (guillemets && ligne[i + 1] === '"') { courant += '"'; i++; }
      else guillemets = !guillemets;
    } else if (c === ";" && !guillemets) {
      champs.push(courant);
      courant = "";
    } else courant += c;
  }
  champs.push(courant);
  return champs;
}

function formats(prix: string): FormatVanora[] {
  const vus = new Set<string>();
  const res: FormatVanora[] = [];
  for (const morceau of prix.split("|")) {
    const m = morceau.match(/^\s*(?:([^/\d]+?)\s*\/\s*)?(\d+)\s*ml\s*:\s*(\d+(?:[.,]\d+)?)\s*€/i);
    if (!m) continue;
    const variante = m[1] ? nettoyer(m[1]) : "";
    const ml = Number(m[2]);
    const prixVenteCents = Math.round(Number(m[3].replace(",", ".")) * 100);
    let suffixe = variante ? `${variante.slice(0, 3).toUpperCase()}${ml}` : String(ml);
    while (vus.has(suffixe)) suffixe += "B";
    vus.add(suffixe);
    res.push({ libelle: variante ? `${variante} ${ml} ml` : `${ml} ml`, contenanceMl: ml, prixVenteCents, suffixe });
  }
  return res;
}

export function chargerVanora(): ParfumVanora[] {
  const lignes = readFileSync(FICHIER, "utf8").replace(/^﻿/, "").split(/\r?\n/).filter((l) => l.trim());
  const entete = decouper(lignes[0]).map((c) => c.trim().toLowerCase());
  const col = (nom: string) => entete.indexOf(nom);
  const parfums: ParfumVanora[] = [];
  for (const ligne of lignes.slice(1)) {
    const c = decouper(ligne);
    const libelle = nettoyer(c[col("nom")]);
    const fmts = formats(c[col("prix")] ?? "");
    if (!libelle || fmts.length === 0) continue;
    const brute = nettoyer(c[col("marque")]);
    const marque = MARQUES[brute.toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "")] ?? brute;
    const notes = [
      ["Tête", c[col("notes de tête")]],
      ["Cœur", c[col("notes de cœur")]],
      ["Fond", c[col("notes de fond")]],
      ["Accords", c[col("accords")]],
    ]
      .map(([titre, v]) => [titre, nettoyer(v)])
      .filter(([, v]) => v)
      .map(([titre, v]) => `${titre} : ${v}`)
      .join(" · ");
    const description = [marque, notes, nettoyer(c[col("description")])].filter(Boolean).join("\n");
    parfums.push({ code: `PM-${String(parfums.length + 1).padStart(3, "0")}`, libelle, marque, description, formats: fmts });
  }
  return parfums;
}
