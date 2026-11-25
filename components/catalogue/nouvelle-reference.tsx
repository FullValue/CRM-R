"use client";

import { PlusIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DialogueFormulaire } from "@/components/dialogue-formulaire";
import { ChampCase, ChampTexte } from "@/components/champs";
import { FieldSeparator } from "@/components/ui/field";
import { creerReference } from "@/app/actions/catalogue";

export function NouvelleReference({ espace, prefixe }: { espace: string; prefixe: string }) {
  return (
    <DialogueFormulaire
      declencheur={
        <Button>
          <PlusIcon /> Nouvelle référence
        </Button>
      }
      titre="Nouvelle référence"
      description="Une référence déjà présente (même code ou libellé proche) est signalée avant création."
      action={(fd) => creerReference(espace, fd)}
      redirection={(r) => (r.ok && r.donnees ? `/${espace}/catalogue/${r.donnees.id}` : null)}
      libelleEnvoi="Créer la référence"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <ChampTexte nom="code" libelle="Code de référence" placeholder={`${prefixe}-015`} required autoFocus />
        <ChampTexte nom="famille" libelle="Famille (facultatif)" placeholder="Boisé, floral…" />
      </div>
      <ChampTexte nom="libelle" libelle="Libellé" required />
      <ChampCase nom="confirmerSimilaire" libelle="Créer quand même si un libellé proche existe" />
      <FieldSeparator>Premier format</FieldSeparator>
      <div className="grid gap-4 sm:grid-cols-2">
        <ChampTexte nom="libelleFormat" libelle="Format" placeholder="50 ml" required />
        <ChampTexte nom="sku" libelle="Code de format (SKU)" placeholder={`${prefixe}-015-50`} required />
        <ChampTexte nom="prix" libelle="Prix de vente (€)" inputMode="decimal" placeholder="45,00" required />
        <ChampTexte nom="contenanceMl" libelle="Contenance (ml)" inputMode="numeric" placeholder="50" />
      </div>
    </DialogueFormulaire>
  );
}
