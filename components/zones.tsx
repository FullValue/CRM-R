"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { PencilIcon, PlusIcon, XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DialogueFormulaire } from "@/components/dialogue-formulaire";
import { ChampCase, ChampSelect, ChampTexte } from "@/components/champs";
import { ajouterCreneau, ajouterFermeture, enregistrerZone, supprimerCreneau, supprimerFermeture } from "@/app/actions/zones";
import { JOURS_SEMAINE } from "@/lib/domaine";

type Z = { id: string; libelle: string; ville: string; lat: number; lng: number; rayonKm: number; livraison: boolean; active: boolean };

export function EditerZone({ zone }: { zone?: Z }) {
  return (
    <DialogueFormulaire
      declencheur={
        zone ? (
          <Button variant="ghost" size="icon-sm" aria-label={`Modifier ${zone.libelle}`}>
            <PencilIcon />
          </Button>
        ) : (
          <Button variant="outline">
            <PlusIcon /> Nouvelle zone
          </Button>
        )
      }
      titre={zone ? `Modifier ${zone.libelle}` : "Nouvelle zone"}
      description="Les limites sont indicatives : un centre et un rayon servent à proposer la zone au vendeur et à placer la zone sur la carte."
      action={(fd) => enregistrerZone(zone?.id ?? null, fd)}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <ChampTexte nom="libelle" libelle="Libellé" defaultValue={zone?.libelle} required />
        <ChampTexte nom="ville" libelle="Ville" defaultValue={zone?.ville} required />
        <ChampTexte nom="lat" libelle="Latitude du centre" inputMode="decimal" defaultValue={zone?.lat} placeholder="45,7597" required />
        <ChampTexte nom="lng" libelle="Longitude du centre" inputMode="decimal" defaultValue={zone?.lng} placeholder="4,8357" required />
        <ChampTexte nom="rayonKm" libelle="Rayon (km)" inputMode="decimal" defaultValue={zone?.rayonKm ?? 2} />
      </div>
      <ChampCase nom="livraison" libelle="Ouverte aux demandes de livraison WhatsApp" defaut={zone?.livraison ?? true} />
      {zone && <ChampCase nom="active" libelle="Zone active (proposée à la saisie)" defaut={zone.active} />}
    </DialogueFormulaire>
  );
}

export function NouveauCreneau({ zones }: { zones: { id: string; libelle: string }[] }) {
  return (
    <DialogueFormulaire
      declencheur={
        <Button variant="outline">
          <PlusIcon /> Créneau
        </Button>
      }
      titre="Nouveau créneau hebdomadaire"
      action={ajouterCreneau}
    >
      <ChampSelect nom="zoneId" libelle="Zone" options={zones.map((z) => ({ valeur: z.id, libelle: z.libelle }))} />
      <ChampSelect nom="jour" libelle="Jour" defaut="4" options={JOURS_SEMAINE.map((j) => ({ valeur: String(j.v), libelle: j.l }))} />
      <div className="grid gap-4 sm:grid-cols-2">
        <ChampTexte nom="heureDebut" libelle="Début" type="time" defaultValue="15:00" required />
        <ChampTexte nom="heureFin" libelle="Fin" type="time" defaultValue="17:00" required />
      </div>
    </DialogueFormulaire>
  );
}

export function NouvelleFermeture({ zones, aujourdhui }: { zones: { id: string; libelle: string }[]; aujourdhui: string }) {
  return (
    <DialogueFormulaire
      declencheur={
        <Button variant="outline">
          <PlusIcon /> Exception
        </Button>
      }
      titre="Exception de calendrier"
      description="Aucun créneau ne sera proposé pour cette zone à cette date."
      action={ajouterFermeture}
    >
      <ChampSelect nom="zoneId" libelle="Zone" options={zones.map((z) => ({ valeur: z.id, libelle: z.libelle }))} />
      <ChampTexte nom="date" libelle="Date" type="date" min={aujourdhui} required />
      <ChampTexte nom="motif" libelle="Motif" placeholder="Camion indisponible, jour férié…" />
    </DialogueFormulaire>
  );
}

export function BoutonRetirer({ id, type, libelle }: { id: string; type: "creneau" | "fermeture"; libelle: string }) {
  const router = useRouter();
  const [enCours, demarrer] = useTransition();
  return (
    <Button
      variant="ghost"
      size="icon-xs"
      aria-label={`Retirer ${libelle}`}
      disabled={enCours}
      onClick={() =>
        demarrer(async () => {
          const r = type === "creneau" ? await supprimerCreneau(id) : await supprimerFermeture(id);
          if (r.ok) toast.success(r.message);
          else toast.error(r.message);
          router.refresh();
        })
      }
    >
      <XIcon />
    </Button>
  );
}
