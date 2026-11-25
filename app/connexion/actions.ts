"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { verifierMotDePasse } from "@/lib/auth/motdepasse";
import { ouvrirSession, fermerSession } from "@/lib/auth/session";
import { journaliser } from "@/lib/audit";

const MAX_ECHECS = 5;
const FENETRE_MS = 15 * 60 * 1000;

export type EtatConnexion = { erreur?: string; email?: string } | null;

export async function seConnecter(_p: EtatConnexion, fd: FormData): Promise<EtatConnexion> {
  const email = String(fd.get("email") ?? "").trim().toLowerCase();
  const mdp = String(fd.get("motDePasse") ?? "");
  if (!email || !mdp) return { erreur: "Saisissez votre adresse e-mail et votre mot de passe.", email };

  const depuis = new Date(Date.now() - FENETRE_MS);
  const echecs = await prisma.tentativeConnexion.count({ where: { email, reussie: false, createdAt: { gte: depuis } } });
  if (echecs >= MAX_ECHECS) {
    return { erreur: "Trop de tentatives échouées. Réessayez dans 15 minutes ou contactez l'administrateur.", email };
  }

  const u = await prisma.utilisateur.findUnique({ where: { email } });
  const valide = u ? await verifierMotDePasse(mdp, u.motDePasseHash) : false;
  if (!u || !valide || !u.actif) {
    await prisma.tentativeConnexion.create({ data: { email, reussie: false } });
    await journaliser({
      action: "connexion.echec",
      entite: "Utilisateur",
      entiteId: u?.id ?? null,
      // Pas de mot de passe ni d'adresse complète dans le journal (SEC-01).
      resume: `Échec de connexion (${email.replace(/^(.).*(@.*)$/, "$1…$2")})${u && !u.actif ? " : compte désactivé" : ""}`,
    });
    return { erreur: u && !u.actif && valide ? "Ce compte est désactivé." : "Adresse e-mail ou mot de passe incorrect.", email };
  }
  await prisma.tentativeConnexion.create({ data: { email, reussie: true } });
  await ouvrirSession(u.id);
  await journaliser({ action: "connexion.succes", entite: "Utilisateur", entiteId: u.id, auteur: { id: u.id, nom: u.nom }, resume: "Connexion" });
  redirect(u.role === "VENDEUR" ? "/vendeur" : "/tableau-de-bord");
}

export async function seDeconnecter() {
  await fermerSession();
  redirect("/connexion");
}
