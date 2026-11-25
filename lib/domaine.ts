/** Vocabulaire métier partagé : états, libellés, espaces. */

export const ESPACES = {
  maya: { id: "maya", nom: "Maison Maya", court: "Maya" },
  amari: { id: "amari", nom: "Atelier Amari", court: "Amari" },
  pm: { id: "pm", nom: "Parfumerie Mobile", court: "Parfumerie" },
} as const;

export type EspaceId = keyof typeof ESPACES;
export const LISTE_ESPACES = Object.keys(ESPACES) as EspaceId[];

export function estEspace(x: string): x is EspaceId {
  return Object.hasOwn(ESPACES, x);
}

export type Role = "ADMIN" | "VENDEUR";

export const CANAUX = {
  TERRAIN: "Terrain",
  WHATSAPP: "WhatsApp",
  BOUTIQUE: "Boutique",
  AUTRE: "Autre",
} as const;
export type Canal = keyof typeof CANAUX;

export const PROVENANCES_ZONE = {
  PROPOSEE: "Proposée (localisation)",
  SAISIE: "Choisie dans la liste",
  NON_RENSEIGNEE: "Non renseignée",
} as const;
export type ProvenanceZone = keyof typeof PROVENANCES_ZONE;

export const ETATS_LIVRAISON = {
  AUCUNE: "Aucune",
  PREFERENCE: "Préférence client",
  CONFIRMEE: "Confirmée",
  LIVREE: "Livrée",
} as const;
export type EtatLivraison = keyof typeof ETATS_LIVRAISON;

export const TYPES_MOUVEMENT = {
  ENTREE: "Entrée",
  SORTIE_VENTE: "Sortie (vente)",
  AJUSTEMENT: "Ajustement",
  RETOUR: "Retour",
  CORRECTION: "Correction",
  IMPORT: "Import",
  SHOPIFY: "Shopify",
} as const;

export const LIENS_SHOPIFY = {
  NON_LIE: "Non lié",
  LIE: "Lié",
  AMBIGU: "Ambigu",
  ERREUR: "Erreur",
} as const;

export const STOCK_SYNC = {
  NON_LIE: "Stock local",
  A_SYNCHRONISER: "Stock à synchroniser",
  SYNCHRONISE: "Synchronisé",
  ERREUR: "Erreur de synchronisation",
} as const;

export const SOURCES_COUT = {
  COMMANDE: "Prix de touche de commande",
  LIGNES: "Prix de touche par ligne",
  A_COMPLETER: "Coût à compléter",
} as const;

export const PERIODICITES = {
  MENSUELLE: "Mensuelle",
  TRIMESTRIELLE: "Trimestrielle",
  ANNUELLE: "Annuelle",
} as const;

export const TYPES_TRESORERIE = {
  OUVERTURE: "Solde d'ouverture",
  ENCAISSEMENT: "Encaissement",
  DECAISSEMENT: "Décaissement",
  AJUSTEMENT: "Ajustement",
} as const;

export const JOURS_SEMAINE = [
  { v: 1, l: "Lundi" },
  { v: 2, l: "Mardi" },
  { v: 3, l: "Mercredi" },
  { v: 4, l: "Jeudi" },
  { v: 5, l: "Vendredi" },
  { v: 6, l: "Samedi" },
  { v: 7, l: "Dimanche" },
];
