import type { EspaceId } from "@/lib/domaine";

export const PALETTES = {
  foret: "Vert forêt",
  encre: "Bleu encre",
  terre: "Terre cuite",
  prune: "Prune",
  paon: "Bleu paon",
  graphite: "Graphite",
} as const;

export type Palette = keyof typeof PALETTES;
export type PalettesEspaces = Record<EspaceId, Palette>;

export const PALETTES_DEFAUT: PalettesEspaces = { maya: "encre", amari: "terre", pm: "foret" };

export function estPalette(valeur: string | undefined): valeur is Palette {
  return valeur !== undefined && Object.hasOwn(PALETTES, valeur);
}

export function cookiePalette(espace: EspaceId) {
  return `crm_palette_${espace}`;
}
