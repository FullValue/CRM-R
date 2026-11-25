"use client";

import { createContext, useActionState, useContext, useEffect, useRef, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import type { Resultat } from "@/lib/services/resultat";
import { cn } from "@/lib/utils";

type Ctx = { champs: Record<string, string>; enCours: boolean };
const ContexteFormulaire = createContext<Ctx>({ champs: {}, enCours: false });

/**
 * Formulaire relié à une action serveur. Les valeurs saisies sont conservées
 * en cas d'erreur (VEN-02) : le formulaire n'est vidé qu'après un succès, et
 * seulement si `viderApresSucces` est demandé.
 */
export function Formulaire<T>({
  action,
  children,
  className,
  viderApresSucces = false,
  surSucces,
  messageSucces,
}: {
  action: (fd: FormData) => Promise<Resultat<T>>;
  children: React.ReactNode;
  className?: string;
  viderApresSucces?: boolean;
  surSucces?: (r: Resultat<T>) => void;
  messageSucces?: string;
}) {
  const ref = useRef<HTMLFormElement>(null);
  const [etat, envoyer] = useActionState<Resultat<T> | null, FormData>(async (_p, fd) => action(fd), null);
  const [enCours, demarrer] = useTransition();
  const dernier = useRef<Resultat<T> | null>(null);

  useEffect(() => {
    if (!etat || etat === dernier.current) return;
    dernier.current = etat;
    if (etat.ok) {
      toast.success(etat.message ?? messageSucces ?? "Enregistré.");
      if (viderApresSucces) ref.current?.reset();
      surSucces?.(etat);
    } else {
      toast.error(etat.message);
    }
  }, [etat, viderApresSucces, surSucces, messageSucces]);

  return (
    <ContexteFormulaire value={{ champs: etat && !etat.ok ? (etat.champs ?? {}) : {}, enCours }}>
      <form
        ref={ref}
        className={className}
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          demarrer(() => envoyer(fd));
        }}
        noValidate
      >
        {children}
      </form>
    </ContexteFormulaire>
  );
}

export function useFormulaire() {
  return useContext(ContexteFormulaire);
}

/** Message d'erreur d'un champ, renvoyé par le serveur. */
export function ErreurChamp({ nom, className }: { nom: string; className?: string }) {
  const { champs } = useFormulaire();
  const msg = champs[nom];
  if (!msg) return null;
  return (
    <p role="alert" className={cn("text-destructive text-sm", className)}>
      {msg}
    </p>
  );
}

export function BoutonEnvoi({
  children,
  className,
  variant,
  size,
  disabled,
}: {
  children: React.ReactNode;
  className?: string;
  variant?: React.ComponentProps<typeof Button>["variant"];
  size?: React.ComponentProps<typeof Button>["size"];
  disabled?: boolean;
}) {
  const { enCours } = useFormulaire();
  return (
    <Button type="submit" className={className} variant={variant} size={size} disabled={enCours || disabled}>
      {enCours && <Spinner />}
      {children}
    </Button>
  );
}
