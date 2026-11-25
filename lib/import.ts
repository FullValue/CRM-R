/**
 * Import contrôlé du catalogue (MAY-02) — analyse pure, sans écriture.
 *
 * Colonnes attendues (séparateur « ; » ou « , », en-tête obligatoire) :
 *   code_reference ; libelle ; format ; sku ; prix ; quantite ; contenance_ml (facultatif)
 *
 * Chaque ligne est classée : à créer, doublon (dans le fichier ou déjà présente)
 * ou rejetée avec son motif. Rien n'est écrit tant que l'import n'est pas appliqué.
 */
import { saisieVersCents } from "./argent";

export const COLONNES = ["code_reference", "libelle", "format", "sku", "prix", "quantite"] as const;

export type LigneImport = {
  numero: number;
  codeReference: string;
  libelle: string;
  format: string;
  sku: string;
  prixCents: number;
  quantite: number;
  contenanceMl: number | null;
};

export type Rejet = { numero: number; brut: string; motif: string; resolution: string };

export type AnalyseImport = {
  aCreer: LigneImport[];
  doublons: Rejet[];
  rejets: Rejet[];
  totalLignes: number;
  volumes: { references: number; formats: number; quantite: number; valeurCents: number };
};

function separer(ligne: string, sep: string): string[] {
  const res: string[] = [];
  let courant = "";
  let guillemets = false;
  for (let i = 0; i < ligne.length; i++) {
    const c = ligne[i];
    if (c === '"') {
      if (guillemets && ligne[i + 1] === '"') {
        courant += '"';
        i++;
      } else guillemets = !guillemets;
    } else if (c === sep && !guillemets) {
      res.push(courant.trim());
      courant = "";
    } else courant += c;
  }
  res.push(courant.trim());
  return res;
}

function normaliser(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[\s-]+/g, "_");
}

export function analyserImport(texte: string, skusExistants: ReadonlySet<string>): AnalyseImport {
  const lignes = texte.replace(/^﻿/, "").split(/\r?\n/).filter((l) => l.trim() !== "");
  const vide: AnalyseImport = { aCreer: [], doublons: [], rejets: [], totalLignes: 0, volumes: { references: 0, formats: 0, quantite: 0, valeurCents: 0 } };
  if (lignes.length === 0) return { ...vide, rejets: [{ numero: 0, brut: "", motif: "Fichier vide.", resolution: "Fournir un export avec en-tête." }] };

  const sep = (lignes[0].match(/;/g)?.length ?? 0) >= (lignes[0].match(/,/g)?.length ?? 0) ? ";" : ",";
  const entete = separer(lignes[0], sep).map(normaliser);
  const manquantes = COLONNES.filter((c) => !entete.includes(c));
  if (manquantes.length) {
    return { ...vide, totalLignes: lignes.length - 1, rejets: [{ numero: 1, brut: lignes[0], motif: `Colonnes manquantes : ${manquantes.join(", ")}.`, resolution: "Renommer les colonnes de l'export selon le modèle." }] };
  }
  const idx = (c: string) => entete.indexOf(c);
  const iContenance = idx("contenance_ml");

  const aCreer: LigneImport[] = [];
  const doublons: Rejet[] = [];
  const rejets: Rejet[] = [];
  const vusSku = new Set<string>();
  const libelleParCode = new Map<string, string>();

  lignes.slice(1).forEach((brut, i) => {
    const numero = i + 2;
    const v = separer(brut, sep);
    const get = (c: string) => v[idx(c)] ?? "";
    const codeReference = get("code_reference").toUpperCase();
    const libelle = get("libelle");
    const format = get("format");
    const sku = get("sku").toUpperCase();
    const prixCents = saisieVersCents(get("prix"));
    const qteTxt = get("quantite").replace(/\s/g, "");
    const quantite = /^-?\d+$/.test(qteTxt) ? Number(qteTxt) : NaN;
    const contTxt = iContenance >= 0 ? (v[iContenance] ?? "").replace(/\s/g, "") : "";
    const contenanceMl = contTxt === "" ? (/(\d+)\s*ml/i.exec(format) ? Number(/(\d+)\s*ml/i.exec(format)![1]) : null) : /^\d+$/.test(contTxt) ? Number(contTxt) : NaN;

    const motifs: string[] = [];
    if (!codeReference) motifs.push("code de référence manquant");
    if (!libelle) motifs.push("libellé manquant");
    if (!format) motifs.push("format manquant");
    if (!sku) motifs.push("SKU manquant");
    if (prixCents === null || prixCents < 0) motifs.push(`prix invalide « ${get("prix")} »`);
    if (!Number.isInteger(quantite) || quantite < 0) motifs.push(`quantité invalide « ${get("quantite")} »`);
    if (contenanceMl !== null && Number.isNaN(contenanceMl)) motifs.push("contenance invalide");
    if (codeReference && libelle && libelleParCode.has(codeReference) && libelleParCode.get(codeReference) !== libelle)
      motifs.push(`libellé différent pour le code ${codeReference} (« ${libelleParCode.get(codeReference)} » ligne précédente)`);
    if (motifs.length) {
      rejets.push({ numero, brut, motif: motifs.join(" ; "), resolution: "Corriger la ligne dans l'export puis relancer l'essai." });
      return;
    }
    if (vusSku.has(sku)) {
      doublons.push({ numero, brut, motif: `SKU ${sku} présent plusieurs fois dans le fichier.`, resolution: "Conserver une seule ligne par format." });
      return;
    }
    if (skusExistants.has(sku)) {
      doublons.push({ numero, brut, motif: `SKU ${sku} déjà présent dans le catalogue.`, resolution: "Mettre à jour la fiche existante ou retirer la ligne." });
      vusSku.add(sku);
      return;
    }
    vusSku.add(sku);
    libelleParCode.set(codeReference, libelle);
    aCreer.push({ numero, codeReference, libelle, format, sku, prixCents: prixCents!, quantite, contenanceMl: contenanceMl as number | null });
  });

  return {
    aCreer,
    doublons,
    rejets,
    totalLignes: lignes.length - 1,
    volumes: {
      references: new Set(aCreer.map((l) => l.codeReference)).size,
      formats: aCreer.length,
      quantite: aCreer.reduce((a, l) => a + l.quantite, 0),
      valeurCents: aCreer.reduce((a, l) => a + l.quantite * l.prixCents, 0),
    },
  };
}

export const MODELE_CSV = `code_reference;libelle;format;sku;prix;quantite;contenance_ml
MM-REV;Réveil en Lusitanie;50 ml;MM-REV-50;49,00;24;50
MM-REV;Réveil en Lusitanie;10 ml;MM-REV-10;18,00;40;10`;
