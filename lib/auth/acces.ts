import { cache } from "react";
import { redirect, notFound } from "next/navigation";
import { lireSession } from "./session";
import { estEspace, type EspaceId, type Role } from "@/lib/domaine";

export type UtilisateurCourant = {
  id: string;
  nom: string;
  email: string;
  role: Role;
  gestionnaire: boolean;
  prixModifiable: boolean;
  espaces: EspaceId[];
};

/** Utilisateur de la requête, ou null (mémorisé pour la durée du rendu). */
export const utilisateurCourant = cache(async (): Promise<UtilisateurCourant | null> => {
  const s = await lireSession();
  if (!s) return null;
  const u = s.utilisateur;
  return {
    id: u.id,
    nom: u.nom,
    email: u.email,
    role: u.role as Role,
    gestionnaire: u.gestionnaire,
    prixModifiable: u.prixModifiable,
    espaces: u.habilitations.map((h) => h.activiteId).filter(estEspace),
  };
});

/** Exige une session ; sinon renvoie vers la connexion. */
export async function exigerUtilisateur(): Promise<UtilisateurCourant> {
  const u = await utilisateurCourant();
  if (!u) redirect("/connexion");
  return u;
}

/** Erreur d'autorisation lisible, levée par les actions serveur. */
export class AccesRefuse extends Error {
  constructor(message = "Accès refusé : cet espace ou cette action ne vous est pas attribué.") {
    super(message);
    this.name = "AccesRefuse";
  }
}

/** Page administrateur d'un espace : vérifie rôle et habilitation côté serveur (ACC-01, R01). */
export async function exigerEspaceAdmin(espace: string): Promise<UtilisateurCourant & { espace: EspaceId }> {
  const u = await exigerUtilisateur();
  if (!estEspace(espace)) notFound();
  if (u.role !== "ADMIN") redirect("/acces-refuse");
  if (!u.espaces.includes(espace)) redirect(`/acces-refuse?espace=${espace}`);
  return { ...u, espace };
}

/** Variante pour actions serveur : lève au lieu de rediriger. */
export async function verifierEspaceAdmin(espace: string): Promise<UtilisateurCourant & { espace: EspaceId }> {
  const u = await utilisateurCourant();
  if (!u) throw new AccesRefuse("Session expirée : reconnectez-vous.");
  if (!estEspace(espace) || u.role !== "ADMIN" || !u.espaces.includes(espace)) throw new AccesRefuse();
  return { ...u, espace };
}

export async function exigerAdmin() {
  const u = await exigerUtilisateur();
  if (u.role !== "ADMIN") redirect("/acces-refuse");
  return u;
}

/** Administrateur désigné : comptes, réglages et liaisons. */
export async function exigerGestionnaire() {
  const u = await exigerAdmin();
  if (!u.gestionnaire) redirect("/acces-refuse");
  return u;
}

export async function verifierGestionnaire() {
  const u = await utilisateurCourant();
  if (!u) throw new AccesRefuse("Session expirée : reconnectez-vous.");
  if (u.role !== "ADMIN" || !u.gestionnaire) throw new AccesRefuse();
  return u;
}

/** Saisie de vente : vendeur ou administrateur habilité à la Parfumerie Mobile. */
export async function verifierSaisieVente() {
  const u = await utilisateurCourant();
  if (!u) throw new AccesRefuse("Session expirée : reconnectez-vous. Votre saisie est conservée.");
  if (!u.espaces.includes("pm")) throw new AccesRefuse("Vous n'êtes pas affecté à la Parfumerie Mobile.");
  return u;
}
