"use client";

import { useId } from "react";
import { Field, FieldContent, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ErreurChamp, useFormulaire } from "@/components/formulaire";

type Base = { nom: string; libelle: string; aide?: React.ReactNode; className?: string };

export function ChampTexte({
  nom,
  libelle,
  aide,
  className,
  ...props
}: Base & Omit<React.ComponentProps<typeof Input>, "name">) {
  const id = useId();
  const { champs } = useFormulaire();
  return (
    <Field className={className} data-invalid={!!champs[nom] || undefined}>
      <FieldLabel htmlFor={id}>{libelle}</FieldLabel>
      <Input id={id} name={nom} aria-invalid={!!champs[nom] || undefined} {...props} />
      {aide && <FieldDescription>{aide}</FieldDescription>}
      <ErreurChamp nom={nom} />
    </Field>
  );
}

export function ChampZoneTexte({ nom, libelle, aide, className, ...props }: Base & Omit<React.ComponentProps<typeof Textarea>, "name">) {
  const id = useId();
  const { champs } = useFormulaire();
  return (
    <Field className={className} data-invalid={!!champs[nom] || undefined}>
      <FieldLabel htmlFor={id}>{libelle}</FieldLabel>
      <Textarea id={id} name={nom} aria-invalid={!!champs[nom] || undefined} {...props} />
      {aide && <FieldDescription>{aide}</FieldDescription>}
      <ErreurChamp nom={nom} />
    </Field>
  );
}

export function ChampSelect({
  nom,
  libelle,
  aide,
  className,
  options,
  defaut,
  valeur,
  surChangement,
  placeholder,
  disabled,
}: Base & {
  options: { valeur: string; libelle: string; desactive?: boolean }[];
  defaut?: string;
  valeur?: string;
  surChangement?: (v: string) => void;
  placeholder?: string;
  disabled?: boolean;
}) {
  const id = useId();
  const { champs } = useFormulaire();
  return (
    <Field className={className} data-invalid={!!champs[nom] || undefined}>
      <FieldLabel htmlFor={id}>{libelle}</FieldLabel>
      <Select name={nom} defaultValue={defaut} value={valeur} onValueChange={surChangement} disabled={disabled}>
        <SelectTrigger id={id} className="w-full" aria-invalid={!!champs[nom] || undefined}>
          <SelectValue placeholder={placeholder ?? "Choisir…"} />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o.valeur} value={o.valeur} disabled={o.desactive}>
              {o.libelle}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {aide && <FieldDescription>{aide}</FieldDescription>}
      <ErreurChamp nom={nom} />
    </Field>
  );
}

export function ChampCase({ nom, libelle, aide, defaut, className }: Base & { defaut?: boolean }) {
  const id = useId();
  return (
    <Field orientation="horizontal" className={className}>
      <Checkbox id={id} name={nom} defaultChecked={defaut} />
      <FieldContent>
        <FieldLabel htmlFor={id} className="font-normal">
          {libelle}
        </FieldLabel>
        {aide && <FieldDescription>{aide}</FieldDescription>}
        <ErreurChamp nom={nom} />
      </FieldContent>
    </Field>
  );
}
