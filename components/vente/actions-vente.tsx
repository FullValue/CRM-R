"use client";

import { BanIcon, CalendarCheckIcon, PencilIcon, WalletIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DialogueFormulaire } from "@/components/dialogue-formulaire";
import { ChampCase, ChampSelect, ChampTexte, ChampZoneTexte } from "@/components/champs";
import { FieldSeparator } from "@/components/ui/field";
import { ErreurChamp } from "@/components/formulaire";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { centsVersSaisie, euros } from "@/lib/argent";
import { annulerVenteAction, corrigerVenteAction, livraisonAction, reglerVenteAction } from "@/app/actions/ventes";

type LigneV = { id: string; referenceLibelle: string; formatLibelle: string; quantite: number; prixUnitaireCents: number; coutUnitaireCents: number | null };

export function CorrigerVente({
  vente,
  zones,
  aujourdhui,
}: {
  vente: { id: string; client: string; commentaire: string | null; dateVente: string; zoneId: string | null; coutCommandeCents: number | null; lignes: LigneV[] };
  zones: { id: string; libelle: string }[];
  aujourdhui: string;
}) {
  return (
    <DialogueFormulaire
      large
      declencheur={
        <Button variant="outline">
          <PencilIcon /> Corriger
        </Button>
      }
      titre="Corriger la vente"
      description="La correction est réservée à l'administration, porte un motif et met à jour journal, indicateurs et stock selon l'effet physique réel."
      action={(fd) => corrigerVenteAction(vente.id, fd)}
      libelleEnvoi="Enregistrer la correction"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <ChampTexte nom="client" libelle="Client" defaultValue={vente.client} required />
        <ChampTexte nom="dateVente" libelle="Date de vente" type="date" max={aujourdhui} defaultValue={vente.dateVente} required />
        <ChampSelect nom="zoneId" libelle="Zone" defaut={vente.zoneId ?? "aucune"} options={[{ valeur: "aucune", libelle: "Zone non renseignée" }, ...zones.map((z) => ({ valeur: z.id, libelle: z.libelle }))]} />
        <ChampTexte nom="coutCommande" libelle="Prix de touche de commande (€)" inputMode="decimal" defaultValue={centsVersSaisie(vente.coutCommandeCents)} aide="Vide = coûts unitaires des lignes." />
      </div>
      <FieldSeparator>Lignes</FieldSeparator>
      <div className="space-y-3">
        {vente.lignes.map((l) => (
          <div key={l.id} className="grid grid-cols-[1fr_70px_90px_90px] items-end gap-2 text-sm">
            <input type="hidden" name="ligneId" value={l.id} />
            <div className="pb-2">
              {l.referenceLibelle} <span className="text-muted-foreground">{l.formatLibelle}</span>
            </div>
            <label className="space-y-1">
              <span className="text-xs text-muted-foreground">Qté</span>
              <Input name={`quantite-${l.id}`} inputMode="numeric" defaultValue={l.quantite} />
            </label>
            <label className="space-y-1">
              <span className="text-xs text-muted-foreground">Prix unit.</span>
              <Input name={`prix-${l.id}`} inputMode="decimal" defaultValue={centsVersSaisie(l.prixUnitaireCents)} />
              <ErreurChamp nom={`prix-${l.id}`} />
            </label>
            <label className="space-y-1">
              <span className="text-xs text-muted-foreground">Coût unit.</span>
              <Input name={`cout-${l.id}`} inputMode="decimal" defaultValue={centsVersSaisie(l.coutUnitaireCents)} placeholder="Absent" />
              <ErreurChamp nom={`cout-${l.id}`} />
            </label>
          </div>
        ))}
      </div>
      <ChampCase nom="repercuterStock" libelle="Répercuter les écarts de quantité sur le stock" aide="Décochez si l'écart ne correspond à aucun mouvement physique (erreur de saisie sans sortie réelle)." defaut />
      <ChampZoneTexte nom="commentaire" libelle="Commentaire" defaultValue={vente.commentaire ?? ""} rows={2} />
      <ChampTexte nom="motif" libelle="Motif de la correction" required placeholder="Ex. remise accordée, erreur de quantité" />
    </DialogueFormulaire>
  );
}

export function AnnulerVente({ venteId, reglee, montantCents }: { venteId: string; reglee: boolean; montantCents: number }) {
  return (
    <DialogueFormulaire
      declencheur={
        <Button variant="destructive">
          <BanIcon /> Annuler la vente
        </Button>
      }
      titre="Annuler la vente"
      description="La vente reste identifiable dans le journal et sort des totaux. Le stock n'est remis à jour que si l'article est restitué ou n'est jamais sorti."
      action={(fd) => annulerVenteAction(venteId, fd)}
      libelleEnvoi="Confirmer l'annulation"
      varianteEnvoi="destructive"
    >
      <ChampTexte nom="motif" libelle="Motif" required placeholder="Ex. article restitué, erreur de saisie" />
      <ChampCase nom="retourStock" libelle="Remettre les articles en stock" aide="Cochez seulement en cas de restitution physique ou si l'article n'est jamais sorti." />
      {reglee && (
        <>
          <ChampCase nom="rembourse" libelle={`Client remboursé (${euros(montantCents)})`} aide="Crée un décaissement daté d'aujourd'hui dans le fonds de roulement." defaut />
          <Alert>
            <AlertDescription>Cette vente était réglée : l&apos;encaissement d&apos;origine reste à sa date ; le remboursement est un flux distinct.</AlertDescription>
          </Alert>
        </>
      )}
    </DialogueFormulaire>
  );
}

export function ReglerVente({ venteId, dateVente, aujourdhui }: { venteId: string; dateVente: string; aujourdhui: string }) {
  return (
    <DialogueFormulaire
      declencheur={
        <Button variant="outline">
          <WalletIcon /> Enregistrer le règlement
        </Button>
      }
      titre="Règlement de la vente"
      description="L'encaissement entre dans le fonds de roulement à sa date de règlement."
      action={(fd) => reglerVenteAction(venteId, fd)}
    >
      <ChampTexte nom="date" libelle="Date de règlement" type="date" defaultValue={aujourdhui} min={dateVente} max={aujourdhui} required />
    </DialogueFormulaire>
  );
}

export function LivraisonVente({
  vente,
}: {
  vente: { id: string; livraisonEtat: string; livraisonDate: string | null; livraisonCreneau: string | null; livraisonVille: string | null; livraisonEffective: string | null };
}) {
  return (
    <DialogueFormulaire
      declencheur={
        <Button variant="outline">
          <CalendarCheckIcon /> Livraison
        </Button>
      }
      titre="Livraison associée"
      description="La date de livraison est distincte de la date de vente : les classements journaliers restent sur la date de vente."
      action={(fd) => livraisonAction(vente.id, fd)}
    >
      <ChampSelect
        nom="etat"
        libelle="État"
        defaut={vente.livraisonEtat}
        options={[
          { valeur: "AUCUNE", libelle: "Aucune livraison" },
          { valeur: "PREFERENCE", libelle: "Préférence du client (non confirmée)" },
          { valeur: "CONFIRMEE", libelle: "Créneau confirmé" },
          { valeur: "LIVREE", libelle: "Livrée" },
        ]}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <ChampTexte nom="date" libelle="Date planifiée" type="date" defaultValue={vente.livraisonDate ?? ""} />
        <ChampTexte nom="creneau" libelle="Créneau" defaultValue={vente.livraisonCreneau ?? ""} placeholder="15:00-17:00" />
        <ChampTexte nom="ville" libelle="Ville de livraison" defaultValue={vente.livraisonVille ?? ""} />
        <ChampTexte nom="effective" libelle="Date effective (si livrée)" type="date" defaultValue={vente.livraisonEffective ?? ""} />
      </div>
    </DialogueFormulaire>
  );
}
