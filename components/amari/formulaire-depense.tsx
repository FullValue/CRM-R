"use client";

import { useState } from "react";
import { PencilIcon, PlusIcon, Trash2Icon, BanIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FieldDescription, FieldLabel, FieldSeparator } from "@/components/ui/field";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { DialogueFormulaire } from "@/components/dialogue-formulaire";
import { ChampSelect, ChampTexte, ChampZoneTexte } from "@/components/champs";
import { ErreurChamp } from "@/components/formulaire";
import { centsVersSaisie, euros, saisieVersBp, saisieVersCents } from "@/lib/argent";
import { repartirMontants, repartirPourcentages } from "@/lib/calcul/repartition";
import { annulerDepenseAction, creerDepenseAction, modifierDepenseAction } from "@/app/actions/amari";

export type RefsDepense = {
  postes: { id: string; libelle: string; actif: boolean }[];
  participants: { id: string; nom: string; partDefautBp: number | null; actif: boolean }[];
  coutsFixes: { id: string; libelle: string; posteId: string; montantCents: number }[];
};

export type DepenseEditable = {
  id: string;
  date: string;
  libelle: string;
  montantCents: number;
  posteId: string;
  type: string;
  coutFixeId: string | null;
  tiers: string | null;
  note: string | null;
  dateReglement: string | null;
  modeRepartition: string;
  parts: { participantId: string; pourcentageBp: number | null; montantCents: number }[];
};

type Ligne = { participantId: string; valeur: string };

/** Champs d'une dépense avec aperçu des parts calculées avant validation (AMA-03). */
function ChampsDepense({ refs, d, aujourdhui }: { refs: RefsDepense; d?: DepenseEditable; aujourdhui: string }) {
  const [montant, setMontant] = useState(d ? centsVersSaisie(d.montantCents) : "");
  const [libelle, setLibelle] = useState(d?.libelle ?? "");
  const [posteId, setPosteId] = useState(d?.posteId ?? "");
  const [type, setType] = useState(d?.type ?? "PONCTUELLE");
  const [coutFixeId, setCoutFixeId] = useState(d?.coutFixeId ?? "aucun");
  const [mode, setMode] = useState(d?.modeRepartition ?? "AUCUNE");
  const actifs = refs.participants.filter((p) => p.actif || d?.parts.some((x) => x.participantId === p.id));
  const [lignes, setLignes] = useState<Ligne[]>(() =>
    d && d.parts.length
      ? d.parts.map((p) => ({ participantId: p.participantId, valeur: d.modeRepartition === "POURCENTAGE" ? String((p.pourcentageBp ?? 0) / 100).replace(".", ",") : centsVersSaisie(p.montantCents) }))
      : actifs.map((p) => ({ participantId: p.id, valeur: p.partDefautBp !== null ? String(p.partDefautBp / 100).replace(".", ",") : "" })),
  );

  const montantCents = saisieVersCents(montant);
  const entrees = lignes.filter((l) => l.participantId).map((l) => ({ participantId: l.participantId, valeur: (mode === "POURCENTAGE" ? saisieVersBp(l.valeur) : saisieVersCents(l.valeur)) ?? -1 }));
  const apercu = mode === "AUCUNE" || montantCents === null || montantCents <= 0 ? null : mode === "POURCENTAGE" ? repartirPourcentages(montantCents, entrees) : repartirMontants(montantCents, entrees);
  const nom = (id: string) => refs.participants.find((p) => p.id === id)?.nom ?? "?";

  const appliquerCoutFixe = (id: string) => {
    setCoutFixeId(id);
    const cf = refs.coutsFixes.find((c) => c.id === id);
    if (cf) {
      setType("FIXE");
      setLibelle(cf.libelle);
      setPosteId(cf.posteId);
      setMontant(centsVersSaisie(cf.montantCents));
    }
  };

  return (
    <>
      {refs.coutsFixes.length > 0 && (
        <ChampSelect
          nom="coutFixeId"
          libelle="Partir d'un coût fixe de référence (facultatif)"
          valeur={coutFixeId}
          surChangement={appliquerCoutFixe}
          options={[{ valeur: "aucun", libelle: "Aucun" }, ...refs.coutsFixes.map((c) => ({ valeur: c.id, libelle: `${c.libelle} · ${euros(c.montantCents)}` }))]}
          aide="Le coût fixe paramétré sert de modèle ; seule la dépense enregistrée est comptée."
        />
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <ChampTexte nom="date" libelle="Date de rattachement" type="date" defaultValue={d?.date ?? aujourdhui} required />
        <ChampTexte nom="montant" libelle="Montant (€)" inputMode="decimal" value={montant} onChange={(e) => setMontant(e.target.value)} required />
      </div>
      <ChampTexte nom="libelle" libelle="Libellé" value={libelle} onChange={(e) => setLibelle(e.target.value)} required />
      <div className="grid gap-4 sm:grid-cols-2">
        <ChampSelect
          nom="posteId"
          libelle="Poste"
          valeur={posteId}
          surChangement={setPosteId}
          options={refs.postes.filter((p) => p.actif || p.id === d?.posteId).map((p) => ({ valeur: p.id, libelle: p.libelle + (p.actif ? "" : " (désactivé)") }))}
        />
        <ChampSelect
          nom="type"
          libelle="Type"
          valeur={type}
          surChangement={setType}
          options={[
            { valeur: "PONCTUELLE", libelle: "Ponctuelle" },
            { valeur: "FIXE", libelle: "Charge fixe" },
          ]}
        />
        <ChampTexte nom="tiers" libelle="Tiers (facultatif)" defaultValue={d?.tiers ?? ""} />
        <ChampTexte nom="dateReglement" libelle="Date de règlement (facultatif)" type="date" defaultValue={d?.dateReglement ?? ""} />
      </div>
      <ChampZoneTexte nom="note" libelle="Note (facultatif)" defaultValue={d?.note ?? ""} rows={2} />

      <FieldSeparator>Répartition entre participants</FieldSeparator>
      <input type="hidden" name="modeRepartition" value={mode} />
      <ToggleGroup type="single" variant="outline" size="sm" value={mode} onValueChange={(v) => v && setMode(v)} aria-label="Mode de répartition">
        <ToggleGroupItem value="AUCUNE" className="px-3">Aucune</ToggleGroupItem>
        <ToggleGroupItem value="POURCENTAGE" className="px-3">Pourcentages</ToggleGroupItem>
        <ToggleGroupItem value="MONTANT" className="px-3">Montants</ToggleGroupItem>
      </ToggleGroup>
      {mode !== "AUCUNE" && (
        <div className="space-y-2">
          {lignes.map((l, i) => (
            <div key={i} className="grid grid-cols-[1fr_120px_32px] items-center gap-2">
              <input type="hidden" name="partParticipant" value={l.participantId} />
              <input type="hidden" name="partValeur" value={l.valeur} />
              <Select value={l.participantId} onValueChange={(v) => setLignes((ls) => ls.map((x, j) => (j === i ? { ...x, participantId: v } : x)))}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Participant" />
                </SelectTrigger>
                <SelectContent>
                  {actifs.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.nom}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                inputMode="decimal"
                aria-label={`Part de ${nom(l.participantId)}`}
                value={l.valeur}
                placeholder={mode === "POURCENTAGE" ? "%" : "€"}
                onChange={(e) => setLignes((ls) => ls.map((x, j) => (j === i ? { ...x, valeur: e.target.value } : x)))}
              />
              <Button type="button" variant="ghost" size="icon-sm" aria-label="Retirer" onClick={() => setLignes((ls) => ls.filter((_, j) => j !== i))}>
                <Trash2Icon />
              </Button>
            </div>
          ))}
          <Button type="button" variant="outline" size="sm" onClick={() => setLignes((ls) => [...ls, { participantId: "", valeur: "" }])}>
            <PlusIcon /> Participant
          </Button>
          {apercu &&
            (apercu.ok ? (
              <Alert>
                <AlertDescription>
                  <span className="font-medium text-foreground">Montants calculés : </span>
                  {apercu.parts.map((p) => `${nom(p.participantId)} ${euros(p.montantCents)}`).join(" · ")}
                  <span className="block text-xs">Somme = {euros(apercu.parts.reduce((a, p) => a + p.montantCents, 0))}. Arrondi au centime par la méthode du plus fort reste.</span>
                </AlertDescription>
              </Alert>
            ) : (
              <Alert variant="destructive">
                <AlertDescription>{apercu.erreur}</AlertDescription>
              </Alert>
            ))}
          <ErreurChamp nom="parts" />
        </div>
      )}
      {d && <ChampTexte nom="motif" libelle="Motif de la modification" required />}
      <Field>
        <FieldLabel className="sr-only">Information</FieldLabel>
        <FieldDescription>La clé appliquée est conservée sur la dépense, même si les participants ou leurs parts par défaut changent ensuite.</FieldDescription>
      </Field>
    </>
  );
}

export function NouvelleDepense({ refs, aujourdhui }: { refs: RefsDepense; aujourdhui: string }) {
  return (
    <DialogueFormulaire
      large
      declencheur={
        <Button>
          <PlusIcon /> Nouvelle dépense
        </Button>
      }
      titre="Nouvelle dépense"
      action={creerDepenseAction}
    >
      <ChampsDepense refs={refs} aujourdhui={aujourdhui} />
    </DialogueFormulaire>
  );
}

export function ModifierDepense({ refs, depense, aujourdhui }: { refs: RefsDepense; depense: DepenseEditable; aujourdhui: string }) {
  return (
    <DialogueFormulaire
      large
      declencheur={
        <Button variant="ghost" size="icon-sm" aria-label={`Modifier ${depense.libelle}`}>
          <PencilIcon />
        </Button>
      }
      titre="Modifier la dépense"
      description="La modification est tracée dans le journal avec l'état précédent et votre motif."
      action={(fd) => modifierDepenseAction(depense.id, fd)}
    >
      <ChampsDepense refs={refs} d={depense} aujourdhui={aujourdhui} />
    </DialogueFormulaire>
  );
}

export function AnnulerDepense({ id, libelle }: { id: string; libelle: string }) {
  return (
    <DialogueFormulaire
      declencheur={
        <Button variant="ghost" size="icon-sm" aria-label={`Annuler ${libelle}`}>
          <BanIcon />
        </Button>
      }
      titre="Annuler la dépense"
      description={`« ${libelle} » restera identifiable mais sortira des totaux actifs.`}
      action={(fd) => annulerDepenseAction(id, fd)}
      varianteEnvoi="destructive"
      libelleEnvoi="Annuler la dépense"
    >
      <ChampTexte nom="motif" libelle="Motif" required />
    </DialogueFormulaire>
  );
}
