import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db";

export const COOKIE_SESSION = "crm_session";
const DUREE_MS = 12 * 60 * 60 * 1000; // 12 h

function empreinte(jeton: string) {
  return createHash("sha256").update(jeton).digest("hex");
}

export async function ouvrirSession(utilisateurId: string) {
  const jeton = randomBytes(32).toString("base64url");
  const expireLe = new Date(Date.now() + DUREE_MS);
  await prisma.session.create({ data: { jetonHash: empreinte(jeton), utilisateurId, expireLe } });
  const jar = await cookies();
  jar.set(COOKIE_SESSION, jeton, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expireLe,
  });
}

export async function fermerSession() {
  const jar = await cookies();
  const jeton = jar.get(COOKIE_SESSION)?.value;
  if (jeton) {
    await prisma.session.updateMany({
      where: { jetonHash: empreinte(jeton), revoqueLe: null },
      data: { revoqueLe: new Date() },
    });
  }
  jar.delete(COOKIE_SESSION);
}

/**
 * Session valide courante : non expirée, non révoquée, compte actif. Vérifiée
 * à chaque requête côté serveur : un compte désactivé perd l'accès
 * immédiatement, y compris sur une session ouverte (ACC-02, R02).
 */
export async function lireSession() {
  const jar = await cookies();
  const jeton = jar.get(COOKIE_SESSION)?.value;
  if (!jeton) return null;
  const session = await prisma.session.findUnique({
    where: { jetonHash: empreinte(jeton) },
    include: { utilisateur: { include: { habilitations: true } } },
  });
  if (!session || session.revoqueLe || session.expireLe < new Date() || !session.utilisateur.actif) return null;
  return session;
}

export async function revoquerSessions(utilisateurId: string) {
  await prisma.session.updateMany({ where: { utilisateurId, revoqueLe: null }, data: { revoqueLe: new Date() } });
}
