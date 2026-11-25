"use client";

import { PencilIcon, PlusIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DialogueFormulaire } from "@/components/dialogue-formulaire";
import { ChampCase, ChampSelect, ChampTexte } from "@/components/champs";
import { centsVersSaisie } from "@/lib/argent";
import { enregistrerCoutFixe, enregistrerParticipant, enregistrerPoste } from "@/app/actions/amari";

function Declencheur({ edition, libelle }: { edition: boolean; libelle: string }) {
  return edition ? (
    <Button variant="ghost" size="icon-sm" aria-label={`Modifier ${libelle}`}>
      <PencilIcon />
    </Button>
  ) : (
    <Button variant="outline" size="sm">
      <PlusIcon /> {libelle}
    </Button>
  );
}

export function EditerPoste({ poste }: { poste?: { id: string; libelle: string; actif: boolean } }) {
  return (
    <DialogueFormulaire declencheur={<Declencheur edition={!!poste} libelle={poste?.libelle ?? "Poste"} />} titre={poste ? "Modifier le poste" : "Nouveau poste"} action={(fd) => enregistrerPoste(poste?.id ?? null, fd)}>
      <ChampTexte nom="libelle" libelle="Libellé" defaultValue={poste?.libelle} required />
      {poste && <ChampCase nom="actif" libelle="Actif pour les nouvelles saisies" defaut={poste.actif} aide="Un poste désactivé reste visible sur les dépenses existantes." />}
    </DialogueFormulaire>
  );
}

export function EditerParticipant({ participant }: { participant?: { id: string; nom: string; partDefautBp: number | null; actif: boolean } }) {
  return (
    <DialogueFormulaire
      declencheur={<Declencheur edition={!!participant} libelle={participant?.nom ?? "Participant"} />}
      titre={participant ? "Modifier le participant" : "Nouveau participant"}
      description="La part par défaut pré-remplit la répartition ; la clé réellement appliquée reste figée sur chaque dépense."
      action={(fd) => enregistrerParticipant(participant?.id ?? null, fd)}
    >
      <ChampTexte nom="nom" libelle="Nom" defaultValue={participant?.nom} required />
      <ChampTexte nom="partDefaut" libelle="Part par défaut (%)" inputMode="decimal" defaultValue={participant?.partDefautBp != null ? String(participant.partDefautBp / 100).replace(".", ",") : ""} />
      {participant && <ChampCase nom="actif" libelle="Actif" defaut={participant.actif} />}
    </DialogueFormulaire>
  );
}

export function EditerCoutFixe({ cout, postes }: { cout?: { id: string; libelle: string; posteId: string; montantCents: number; periodicite: string; actif: boolean }; postes: { id: string; libelle: string }[] }) {
  return (
    <DialogueFormulaire
      declencheur={<Declencheur edition={!!cout} libelle={cout?.libelle ?? "Coût fixe"} />}
      titre={cout ? "Modifier le coût fixe" : "Nouveau coût fixe"}
      description="Modèle de référence : il sert de base à la saisie d'une dépense et n'est jamais compté tel quel."
      action={(fd) => enregistrerCoutFixe(cout?.id ?? null, fd)}
    >
      <ChampTexte nom="libelle" libelle="Libellé" defaultValue={cout?.libelle} required />
      <div className="grid gap-4 sm:grid-cols-2">
        <ChampSelect nom="posteId" libelle="Poste" defaut={cout?.posteId} options={postes.map((p) => ({ valeur: p.id, libelle: p.libelle }))} />
        <ChampTexte nom="montant" libelle="Montant (€)" inputMode="decimal" defaultValue={centsVersSaisie(cout?.montantCents)} required />
        <ChampSelect
          nom="periodicite"
          libelle="Périodicité"
          defaut={cout?.periodicite ?? "MENSUELLE"}
          options={[
            { valeur: "MENSUELLE", libelle: "Mensuelle" },
            { valeur: "TRIMESTRIELLE", libelle: "Trimestrielle" },
            { valeur: "ANNUELLE", libelle: "Annuelle" },
          ]}
        />
      </div>
      {cout && <ChampCase nom="actif" libelle="Actif" defaut={cout.actif} />}
    </DialogueFormulaire>
  );
}
