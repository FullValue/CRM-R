import { randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto";

function scrypt(mdp: string, sel: Buffer, longueur: number): Promise<Buffer> {
  return new Promise((ok, ko) => scryptCb(mdp, sel, longueur, (err, cle) => (err ? ko(err) : ok(cle))));
}

/** Hachage scrypt : « scrypt$sel$hash » (base64). */
export async function hacherMotDePasse(mdp: string): Promise<string> {
  const sel = randomBytes(16);
  const hash = await scrypt(mdp, sel, 64);
  return `scrypt$${sel.toString("base64")}$${hash.toString("base64")}`;
}

export async function verifierMotDePasse(mdp: string, stocke: string): Promise<boolean> {
  const [algo, selB64, hashB64] = stocke.split("$");
  if (algo !== "scrypt" || !selB64 || !hashB64) return false;
  const attendu = Buffer.from(hashB64, "base64");
  const calcule = await scrypt(mdp, Buffer.from(selB64, "base64"), attendu.length);
  return calcule.length === attendu.length && timingSafeEqual(calcule, attendu);
}

export function motDePasseInvalide(mdp: string): string | null {
  if (mdp.length < 10) return "Le mot de passe doit contenir au moins 10 caractères.";
  return null;
}
