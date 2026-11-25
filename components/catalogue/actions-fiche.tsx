"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArchiveIcon, ArchiveRestoreIcon, PencilIcon, PlusIcon, ArrowDownUpIcon, TagIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { DialogueFormulaire } from "@/components/dialogue-formulaire";
import { ChampSelect, ChampTexte, ChampZoneTexte } from "@/components/champs";
import { centsVersSaisie } from "@/lib/argent";
import {
  ajouterFormat,
  ajouterPrixTouche,
  basculerArchivageReference,
  modifierFormat,
  modifierReference,
  mouvementStockManuel,
} from "@/app/actions/catalogue";

export function ModifierReference({ espace, reference }: { espace: string; reference: { id: string; libelle: string; famille: string | null; description: string | null } }) {
  return (
    <DialogueFormulaire
      declencheur={
        <Button variant="outline">
          <PencilIcon /> Modifier
        </Button>
      }
      titre="Modifier la référence"
      action={(fd) => modifierReference(espace, reference.id, fd)}
    >
      <ChampTexte nom="libelle" libelle="Libellé" defaultValue={reference.libelle} required />
      <ChampTexte nom="famille" libelle="Famille" defaultValue={reference.famille ?? ""} />
      <ChampZoneTexte nom="description" libelle="Description" defaultValue={reference.description ?? ""} rows={3} />
    </DialogueFormulaire>
  );
}

export function ArchiverReference({ espace, id, etat, nbVentes }: { espace: string; id: string; etat: string; nbVentes: number }) {
  const router = useRouter();
  const [enCours, demarrer] = useTransition();
  const archiver = etat === "ACTIF";
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="outline" disabled={enCours}>
          {archiver ? <ArchiveIcon /> : <ArchiveRestoreIcon />}
          {archiver ? "Archiver" : "Réactiver"}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{archiver ? "Archiver cette référence ?" : "Réactiver cette référence ?"}</AlertDialogTitle>
          <AlertDialogDescription>
            {archiver
              ? `Elle ne sera plus proposée à la saisie. Son historique (${nbVentes} ligne(s) de vente, mouvements de stock) reste consultable et compté dans les classements de sa période.`
              : "Elle sera de nouveau proposée à la saisie."}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Annuler</AlertDialogCancel>
          <AlertDialogAction
            onClick={() =>
              demarrer(async () => {
                const r = await basculerArchivageReference(espace, id);
                if (r.ok) toast.success(r.message);
                else toast.error(r.message);
                router.refresh();
              })
            }
          >
            Confirmer
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function ChampsFormat({ f }: { f?: { libelle: string; sku: string; prixVenteCents: number; contenanceMl: number | null } }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <ChampTexte nom="libelleFormat" libelle="Format" defaultValue={f?.libelle} placeholder="50 ml" required />
      <ChampTexte nom="sku" libelle="Code de format (SKU)" defaultValue={f?.sku} required />
      <ChampTexte nom="prix" libelle="Prix de vente (€)" inputMode="decimal" defaultValue={centsVersSaisie(f?.prixVenteCents)} required />
      <ChampTexte nom="contenanceMl" libelle="Contenance (ml)" inputMode="numeric" defaultValue={f?.contenanceMl ?? ""} />
    </div>
  );
}

export function AjouterFormat({ espace, referenceId }: { espace: string; referenceId: string }) {
  return (
    <DialogueFormulaire
      declencheur={
        <Button size="sm" variant="outline">
          <PlusIcon /> Ajouter un format
        </Button>
      }
      titre="Nouveau format"
      action={(fd) => ajouterFormat(espace, referenceId, fd)}
    >
      <ChampsFormat />
    </DialogueFormulaire>
  );
}

export function ModifierFormat({ espace, format }: { espace: string; format: { id: string; libelle: string; sku: string; prixVenteCents: number; contenanceMl: number | null; etat: string; lienStatut: string } }) {
  return (
    <DialogueFormulaire
      declencheur={
        <Button size="icon-sm" variant="ghost" aria-label={`Modifier le format ${format.libelle}`}>
          <PencilIcon />
        </Button>
      }
      titre={`Modifier le format ${format.libelle}`}
      description={format.lienStatut === "LIE" ? "Format lié à Shopify : le libellé et le prix publiés proviennent de Shopify et seront réalignés au prochain échange." : "Le nouveau prix s'applique aux prochaines ventes ; les ventes passées conservent leur prix."}
      action={(fd) => modifierFormat(espace, format.id, fd)}
    >
      <ChampsFormat f={format} />
      <ChampSelect
        nom="etat"
        libelle="État"
        defaut={format.etat}
        options={[
          { valeur: "ACTIF", libelle: "Actif" },
          { valeur: "ARCHIVE", libelle: "Archivé (retiré de la saisie)" },
        ]}
      />
    </DialogueFormulaire>
  );
}

export function MouvementStock({ espace, format }: { espace: string; format: { id: string; libelle: string; quantite: number } }) {
  return (
    <DialogueFormulaire
      declencheur={
        <Button size="icon-sm" variant="ghost" aria-label={`Mouvement de stock ${format.libelle}`}>
          <ArrowDownUpIcon />
        </Button>
      }
      titre={`Mouvement de stock · ${format.libelle}`}
      description={`Stock actuel : ${format.quantite}. Chaque mouvement est tracé avec son auteur et son motif.`}
      action={(fd) => mouvementStockManuel(espace, format.id, fd)}
    >
      <ChampSelect
        nom="mode"
        libelle="Type de mouvement"
        defaut="ENTREE"
        options={[
          { valeur: "ENTREE", libelle: "Entrée (réception)" },
          { valeur: "AJUSTEMENT", libelle: "Ajustement (+/−)" },
          { valeur: "INVENTAIRE", libelle: "Inventaire (stock compté)" },
        ]}
      />
      <ChampTexte nom="quantite" libelle="Quantité" inputMode="numeric" required aide="Ajustement : valeur signée (ex. −2). Inventaire : quantité comptée, le CRM calcule l'écart." />
      <ChampTexte nom="motif" libelle="Motif" required placeholder="Réception fournisseur, casse, inventaire…" />
    </DialogueFormulaire>
  );
}

export function NouveauPrixTouche({ espace, referenceId, formats }: { espace: string; referenceId: string; formats: { id: string; libelle: string }[] }) {
  return (
    <DialogueFormulaire
      declencheur={
        <Button size="sm" variant="outline">
          <TagIcon /> Nouveau prix de touche
        </Button>
      }
      titre="Nouveau prix de touche"
      description="Coût d'achat unitaire. Il s'applique aux ventes validées à partir de maintenant ; les ventes passées gardent le coût figé à leur validation. 0 € est une valeur connue."
      action={(fd) => ajouterPrixTouche(espace, referenceId, fd)}
    >
      <ChampSelect
        nom="formatId"
        libelle="Niveau"
        defaut="REFERENCE"
        options={[{ valeur: "REFERENCE", libelle: "Toute la référence (tous formats)" }, ...formats.map((f) => ({ valeur: f.id, libelle: `Format ${f.libelle} (prioritaire)` }))]}
      />
      <ChampTexte nom="cout" libelle="Coût unitaire (€)" inputMode="decimal" required placeholder="13,00" />
    </DialogueFormulaire>
  );
}
