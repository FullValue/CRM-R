"use client";

import { PlusIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DialogueFormulaire } from "@/components/dialogue-formulaire";
import { ChampCase, ChampSelect, ChampTexte } from "@/components/champs";
import { ajouterValeurMaya } from "@/app/actions/maya";

type Genre = "taux_perte" | "composant" | "faconnage" | "prix_liquide";

const TITRES: Record<Genre, string> = {
  taux_perte: "Nouveau taux de perte",
  composant: "Nouveau coût de composant",
  faconnage: "Nouveau façonnage",
  prix_liquide: "Nouveau prix du liquide",
};

export function NouvelleValeur({ genre, aujourdhui, parfums = [], defaut }: { genre: Genre; aujourdhui: string; parfums?: { id: string; libelle: string }[]; defaut?: Record<string, string> }) {
  return (
    <DialogueFormulaire
      declencheur={
        <Button variant="outline" size="sm">
          <PlusIcon /> {genre === "prix_liquide" ? "Prix du liquide" : genre === "composant" ? "Composant" : genre === "faconnage" ? "Façonnage" : "Taux de perte"}
        </Button>
      }
      titre={TITRES[genre]}
      description="Valeur historisée : la précédente reste appliquée avant la date d'effet. Montants HT."
      action={ajouterValeurMaya}
    >
      <input type="hidden" name="genre" value={genre} />
      <ChampTexte nom="dateEffet" libelle="Date d'effet" type="date" defaultValue={aujourdhui} required />
      {genre === "taux_perte" && <ChampTexte nom="valeur" libelle="Taux de perte (décimal)" inputMode="decimal" placeholder="0,111" defaultValue={defaut?.valeur} required />}
      {genre === "prix_liquide" && (
        <>
          <ChampSelect nom="referenceId" libelle="Parfum" options={parfums.map((p) => ({ valeur: p.id, libelle: p.libelle }))} />
          <ChampTexte nom="valeur" libelle="Prix HT par litre (€)" inputMode="decimal" required />
        </>
      )}
      {genre === "composant" && (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <ChampTexte nom="libelle" libelle="Composant" placeholder="Flacon + boîte" defaultValue={defaut?.libelle} required />
            <ChampTexte nom="contenanceMl" libelle="Contenance (ml)" inputMode="numeric" defaultValue={defaut?.contenanceMl} required />
          </div>
          <ChampTexte nom="valeur" libelle="Coût unitaire HT (€)" inputMode="decimal" required />
          <ChampCase nom="optionnel" libelle="Optionnel (non compté dans le coût de base, ex. sac)" defaut={defaut?.optionnel === "1"} />
        </>
      )}
      {genre === "faconnage" && (
        <div className="grid gap-4 sm:grid-cols-2">
          <ChampTexte nom="contenanceMl" libelle="Contenance (ml)" inputMode="numeric" defaultValue={defaut?.contenanceMl} required />
          <ChampTexte nom="coutFixeSerie" libelle="Coût fixe de série (€)" inputMode="decimal" required />
          <ChampTexte nom="valeur" libelle="Coût variable par flacon (€)" inputMode="decimal" defaultValue="0" />
          <ChampTexte nom="qteLotRef" libelle="Quantité de lot de référence" inputMode="numeric" defaultValue="140" required />
        </div>
      )}
    </DialogueFormulaire>
  );
}
