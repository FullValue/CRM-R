"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { BoutonEnvoi, Formulaire } from "@/components/formulaire";
import type { Resultat } from "@/lib/services/resultat";

/** Dialogue contenant un formulaire d'action serveur ; se ferme après succès. */
export function DialogueFormulaire<T>({
  declencheur,
  titre,
  description,
  action,
  children,
  libelleEnvoi = "Enregistrer",
  varianteEnvoi,
  redirection,
  large,
}: {
  declencheur: React.ReactNode;
  titre: string;
  description?: React.ReactNode;
  action: (fd: FormData) => Promise<Resultat<T>>;
  children: React.ReactNode;
  libelleEnvoi?: string;
  varianteEnvoi?: React.ComponentProps<typeof Button>["variant"];
  redirection?: (r: Resultat<T>) => string | null;
  large?: boolean;
}) {
  const [ouvert, setOuvert] = useState(false);
  const router = useRouter();
  return (
    <Dialog open={ouvert} onOpenChange={setOuvert}>
      <DialogTrigger asChild>{declencheur}</DialogTrigger>
      <DialogContent className={large ? "sm:max-w-2xl" : "sm:max-w-lg"} {...(!description && { "aria-describedby": undefined })}>
        <DialogHeader>
          <DialogTitle>{titre}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <Formulaire
          action={action}
          className="space-y-4"
          surSucces={(r) => {
            setOuvert(false);
            const cible = redirection?.(r);
            if (cible) router.push(cible);
            else router.refresh();
          }}
        >
          <div className="max-h-[65vh] space-y-4 overflow-y-auto px-0.5">{children}</div>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Annuler
              </Button>
            </DialogClose>
            <BoutonEnvoi variant={varianteEnvoi}>{libelleEnvoi}</BoutonEnvoi>
          </DialogFooter>
        </Formulaire>
      </DialogContent>
    </Dialog>
  );
}
