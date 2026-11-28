/**
 * Mode livraison (téléphone) : l'interface bascule sur la tournée du jour.
 * Mémorisé dans un cookie pour que la bascule survive à un rechargement.
 */
export const COOKIE_MODE = "crm_mode";
export const ROUTE_LIVRAISON = "/tournee";
export const ROUTE_ACCUEIL = "/tableau-de-bord";

export type ModeApp = "gestion" | "livraison";

export function estModeLivraison(valeur: string | undefined): boolean {
  return valeur === "livraison";
}
