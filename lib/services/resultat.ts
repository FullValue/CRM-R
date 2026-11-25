import { AccesRefuse } from "@/lib/auth/acces";

/** Erreur métier affichable telle quelle à l'utilisateur. */
export class ErreurMetier extends Error {
  constructor(
    message: string,
    public champs: Record<string, string> = {},
  ) {
    super(message);
    this.name = "ErreurMetier";
  }
}

export type Resultat<T = undefined> =
  | { ok: true; message?: string; donnees?: T }
  | { ok: false; message: string; champs?: Record<string, string> };

/** Exécute une action serveur et convertit les erreurs connues en résultat lisible. */
export async function executer<T>(fn: () => Promise<Resultat<T> | void>): Promise<Resultat<T>> {
  try {
    return (await fn()) ?? { ok: true };
  } catch (e) {
    if (e instanceof ErreurMetier) return { ok: false, message: e.message, champs: e.champs };
    if (e instanceof AccesRefuse) return { ok: false, message: e.message };
    // Les redirections Next.js doivent continuer leur chemin.
    if (typeof e === "object" && e !== null && "digest" in e && String((e as { digest: unknown }).digest).startsWith("NEXT_")) throw e;
    console.error("[action]", e instanceof Error ? e.message : e);
    return { ok: false, message: "L'opération n'a pas abouti. Réessayez ; si le problème persiste, contactez l'administrateur." };
  }
}

/** Lecture d'un champ texte de formulaire. */
export function champ(fd: FormData, nom: string): string {
  const v = fd.get(nom);
  return typeof v === "string" ? v.trim() : "";
}
