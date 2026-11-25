"use client";

import { useActionState } from "react";
import { seConnecter, type EtatConnexion } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Spinner } from "@/components/ui/spinner";
import { AlertCircleIcon } from "lucide-react";

export function FormulaireConnexion() {
  const [etat, action, enCours] = useActionState<EtatConnexion, FormData>(seConnecter, null);
  return (
    <form action={action}>
      <FieldGroup>
        {etat?.erreur && (
          <Alert variant="destructive">
            <AlertCircleIcon />
            <AlertDescription>{etat.erreur}</AlertDescription>
          </Alert>
        )}
        <Field>
          <FieldLabel htmlFor="email">Adresse e-mail</FieldLabel>
          <Input id="email" name="email" type="email" autoComplete="username" required defaultValue={etat?.email} autoFocus />
        </Field>
        <Field>
          <FieldLabel htmlFor="motDePasse">Mot de passe</FieldLabel>
          <Input id="motDePasse" name="motDePasse" type="password" autoComplete="current-password" required />
        </Field>
        <Button type="submit" disabled={enCours} className="w-full">
          {enCours && <Spinner />}
          Se connecter
        </Button>
      </FieldGroup>
    </form>
  );
}
