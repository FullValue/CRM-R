"use client";

import { useState } from "react";
import { ChevronLeftIcon, MessageCircleIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldLabel } from "@/components/ui/field";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Textarea } from "@/components/ui/textarea";
import { dateLongue } from "@/lib/dates";
import { heure } from "@/lib/calcul/creneaux";
import { lienWhatsApp, messageWhatsApp } from "@/lib/calcul/whatsapp";
import type { OffreLivraison } from "@/lib/requetes/creneaux";

/** Choix ville → date → créneau, puis message prérempli envoyé par le client lui-même (LIV-01, LIV-02). */
export function ParcoursWhatsApp({ offre, references, referenceInitiale }: { offre: OffreLivraison; references: { code: string; libelle: string }[]; referenceInitiale?: string }) {
  const [reference, setReference] = useState(references.find((r) => r.code === referenceInitiale)?.code ?? "");
  const [ville, setVille] = useState("");
  const [date, setDate] = useState("");
  const [creneau, setCreneau] = useState("");
  const offreVille = offre.villes.find((v) => v.ville === ville);
  const offreDate = offreVille?.dates.find((d) => d.date === date);
  const [debut, fin] = creneau.split("-");
  const complet = reference && ville && date && creneau && offreDate?.creneaux.some((c) => `${c.debut}-${c.fin}` === creneau);
  const message = complet ? messageWhatsApp({ reference, ville, date, debut, fin }) : "";

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>Être livré par le camion</CardTitle>
        <CardDescription>Choisissez votre ville, une date et un créneau. Le créneau reste une préférence : l&apos;équipe vous confirme sa disponibilité sur WhatsApp.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Field>
          <FieldLabel htmlFor="livraison-parfum">Parfum</FieldLabel>
          <Select value={reference} onValueChange={setReference}>
            <SelectTrigger id="livraison-parfum" className="w-full">
              <SelectValue placeholder="Choisir un parfum" />
            </SelectTrigger>
            <SelectContent>
              {references.map((r) => (
                <SelectItem key={r.code} value={r.code}>
                  {r.libelle} · {r.code}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field>
          <FieldLabel htmlFor="livraison-ville">Ville</FieldLabel>
          <Select
            value={ville}
            onValueChange={(v) => {
              setVille(v);
              setDate("");
              setCreneau("");
            }}
          >
            <SelectTrigger id="livraison-ville" className="w-full">
              <SelectValue placeholder="Choisir une ville" />
            </SelectTrigger>
            <SelectContent>
              {offre.villes.map((v) => (
                <SelectItem key={v.ville} value={v.ville} disabled={v.dates.length === 0}>
                  {v.ville}
                  {v.dates.length === 0 ? " (aucun créneau)" : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        {ville && offreVille && offreVille.dates.length === 0 && (
          <Alert>
            <AlertDescription>
              Aucun créneau n&apos;est proposé pour {ville} sur les prochains jours. Choisissez une autre ville.
              <Button variant="link" className="px-0" onClick={() => setVille("")}>
                <ChevronLeftIcon /> Revenir au choix de la ville
              </Button>
            </AlertDescription>
          </Alert>
        )}
        {offreVille && offreVille.dates.length > 0 && (
          <Field>
            <FieldLabel htmlFor="livraison-date">Date</FieldLabel>
            <Select
              value={date}
              onValueChange={(v) => {
                setDate(v);
                setCreneau("");
              }}
            >
              <SelectTrigger id="livraison-date" className="w-full capitalize">
                <SelectValue placeholder="Choisir une date" />
              </SelectTrigger>
              <SelectContent>
                {offreVille.dates.map((d) => (
                  <SelectItem key={d.date} value={d.date} className="capitalize">
                    {dateLongue(d.date)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        )}
        {offreDate && (
          <Field>
            <FieldLabel>Créneau</FieldLabel>
            <div className="grid grid-cols-2 gap-2">
              {offreDate.creneaux.map((c) => {
                const v = `${c.debut}-${c.fin}`;
                return (
                  <Button key={v} type="button" aria-pressed={creneau === v} variant={creneau === v ? "default" : "outline"} onClick={() => setCreneau(v)}>
                    {heure(c.debut)} – {heure(c.fin)}
                  </Button>
                );
              })}
            </div>
          </Field>
        )}
        {complet && (
          <Field>
            <FieldLabel htmlFor="livraison-message">Message qui sera ouvert dans WhatsApp</FieldLabel>
            <Textarea id="livraison-message" readOnly value={message} rows={4} className="text-sm" />
          </Field>
        )}
        {!offre.numero && (
          <Alert variant="destructive">
            <AlertDescription>Le numéro WhatsApp n&apos;est pas encore configuré.</AlertDescription>
          </Alert>
        )}
      </CardContent>
      <CardFooter>
        <Button className="w-full" size="lg" disabled={!complet || !offre.numero} asChild={!!complet && !!offre.numero}>
          {complet && offre.numero ? (
            <a href={lienWhatsApp(offre.numero, message)} target="_blank" rel="noopener noreferrer">
              <MessageCircleIcon /> Continuer sur WhatsApp
            </a>
          ) : (
            <><MessageCircleIcon /> Continuer sur WhatsApp</>
          )}
        </Button>
      </CardFooter>
    </Card>
  );
}
