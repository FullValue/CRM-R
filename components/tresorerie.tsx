"use client";

import { PlusIcon, XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DialogueFormulaire } from "@/components/dialogue-formulaire";
import { ChampSelect, ChampTexte } from "@/components/champs";
import { ajouterMouvementTresorerie, annulerMouvementTresorerie } from "@/app/actions/tresorerie";
import { ReglerVente } from "@/components/vente/actions-vente";

export function NouveauMouvement({ aujourdhui }: { aujourdhui: string }) {
  return (
    <DialogueFormulaire
      declencheur={
        <Button>
          <PlusIcon /> Nouveau mouvement
        </Button>
      }
      titre="Mouvement de trésorerie"
      description="Les flux sont comptés à leur date de règlement. Un encaissement de vente se crée automatiquement quand la vente est réglée : ne le saisissez pas ici."
      action={ajouterMouvementTresorerie}
    >
      <ChampSelect
        nom="type"
        libelle="Type"
        defaut="DECAISSEMENT"
        options={[
          { valeur: "DECAISSEMENT", libelle: "Décaissement (carburant, emplacement, achat…)" },
          { valeur: "ENCAISSEMENT", libelle: "Encaissement hors vente" },
          { valeur: "AJUSTEMENT", libelle: "Ajustement justifié (+/−)" },
          { valeur: "OUVERTURE", libelle: "Solde d'ouverture daté" },
        ]}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <ChampTexte nom="date" libelle="Date de règlement" type="date" defaultValue={aujourdhui} required />
        <ChampTexte nom="montant" libelle="Montant (€)" inputMode="decimal" required aide="Ajustement : valeur signée." />
      </div>
      <ChampTexte nom="libelle" libelle="Libellé" required />
      <ChampTexte nom="motif" libelle="Justification" aide="Obligatoire pour un ajustement." />
    </DialogueFormulaire>
  );
}

export function AnnulerMouvement({ id, libelle }: { id: string; libelle: string }) {
  return (
    <DialogueFormulaire
      declencheur={
        <Button variant="ghost" size="icon-sm" aria-label={`Annuler ${libelle}`}>
          <XIcon />
        </Button>
      }
      titre="Annuler le mouvement"
      description={`« ${libelle} » restera visible mais sortira du calcul.`}
      action={(fd) => annulerMouvementTresorerie(id, fd)}
      varianteEnvoi="destructive"
      libelleEnvoi="Annuler le mouvement"
    >
      <ChampTexte nom="motif" libelle="Motif" required />
    </DialogueFormulaire>
  );
}

export { ReglerVente };
