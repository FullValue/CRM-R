"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { LinkIcon, PencilIcon, PlusIcon, PowerIcon, RefreshCwIcon, PlugZapIcon, SendIcon, CheckIcon, RotateCcwIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldLabel, FieldSet, FieldLegend } from "@/components/ui/field";
import { Checkbox } from "@/components/ui/checkbox";
import { Spinner } from "@/components/ui/spinner";
import { DialogueFormulaire } from "@/components/dialogue-formulaire";
import { ChampCase, ChampSelect, ChampTexte } from "@/components/champs";
import { BoutonEnvoi, ErreurChamp, Formulaire } from "@/components/formulaire";
import { ESPACES, LISTE_ESPACES } from "@/lib/domaine";
import { actionShopify, basculerActivation, enregistrerBoutique, enregistrerReglages, enregistrerUtilisateur, lierFormat, resoudreOperation } from "@/app/actions/admin";
import type { Resultat } from "@/lib/services/resultat";

type U = { id: string; nom: string; email: string; role: string; gestionnaire: boolean; prixModifiable: boolean; espaces: string[] };

export function EditerUtilisateur({ u }: { u?: U }) {
  return (
    <DialogueFormulaire
      declencheur={
        u ? (
          <Button variant="ghost" size="icon-sm" aria-label={`Modifier ${u.nom}`}>
            <PencilIcon />
          </Button>
        ) : (
          <Button>
            <PlusIcon /> Nouveau compte
          </Button>
        )
      }
      titre={u ? `Modifier ${u.nom}` : "Nouveau compte nominatif"}
      description="Un vendeur n'accède qu'au formulaire de vente et à la confirmation de ses saisies. Toute modification ferme les sessions ouvertes du compte."
      action={(fd) => enregistrerUtilisateur(u?.id ?? null, fd)}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <ChampTexte nom="nom" libelle="Nom" defaultValue={u?.nom} required />
        <ChampTexte nom="email" libelle="Adresse e-mail" type="email" defaultValue={u?.email} required />
        <ChampSelect
          nom="role"
          libelle="Rôle"
          defaut={u?.role ?? "VENDEUR"}
          options={[
            { valeur: "VENDEUR", libelle: "Vendeur" },
            { valeur: "ADMIN", libelle: "Administrateur habilité" },
          ]}
        />
        <ChampTexte nom="motDePasse" libelle={u ? "Nouveau mot de passe (facultatif)" : "Mot de passe initial"} type="password" autoComplete="new-password" aide="10 caractères minimum." />
      </div>
      <FieldSet>
        <FieldLegend variant="label">Espaces attribués</FieldLegend>
        <div className="flex flex-wrap gap-4">
          {LISTE_ESPACES.map((e) => (
            <Field key={e} orientation="horizontal" className="w-auto">
              <Checkbox id={`espace-${e}`} name={`espace-${e}`} defaultChecked={u ? u.espaces.includes(e) : e === "pm"} />
              <FieldLabel htmlFor={`espace-${e}`} className="font-normal">
                {ESPACES[e].nom}
              </FieldLabel>
            </Field>
          ))}
        </div>
        <FieldDescription>Le vendeur est affecté à la Parfumerie Mobile par défaut (D05).</FieldDescription>
        <ErreurChamp nom="espaces" />
      </FieldSet>
      <ChampCase nom="gestionnaire" libelle="Administrateur désigné (comptes, réglages, liaisons Shopify)" defaut={u?.gestionnaire} />
      <ChampCase nom="prixModifiable" libelle="Peut modifier le prix unitaire à la saisie" defaut={u?.prixModifiable} />
    </DialogueFormulaire>
  );
}

function BoutonAction({ libelle, icone, executer, variante = "outline" }: { libelle: string; icone: React.ReactNode; executer: () => Promise<Resultat>; variante?: React.ComponentProps<typeof Button>["variant"] }) {
  const router = useRouter();
  const [enCours, demarrer] = useTransition();
  return (
    <Button
      variant={variante}
      size="sm"
      disabled={enCours}
      onClick={() =>
        demarrer(async () => {
          const r = await executer();
          if (r.ok) toast.success(r.message ?? "Fait.");
          else toast.error(r.message);
          router.refresh();
        })
      }
    >
      {enCours ? <Spinner /> : icone}
      {libelle}
    </Button>
  );
}

export function ActivationUtilisateur({ id, actif }: { id: string; actif: boolean }) {
  return <BoutonAction libelle={actif ? "Désactiver" : "Réactiver"} icone={<PowerIcon />} variante={actif ? "ghost" : "outline"} executer={() => basculerActivation(id)} />;
}

export function FormulaireReglages({ valeurs }: { valeurs: Record<string, string> }) {
  const router = useRouter();
  return (
    <Formulaire action={enregistrerReglages} className="space-y-6" surSucces={() => router.refresh()}>
      <div className="grid gap-6 md:grid-cols-2">
        <ChampSelect
          nom="stock.politique"
          libelle="Stock insuffisant (D03)"
          defaut={valeurs["stock.politique"]}
          options={[
            { valeur: "BLOQUER", libelle: "Bloquer la sortie (proposé)" },
            { valeur: "AUTORISER", libelle: "Autoriser un stock négatif" },
          ]}
          aide="Les ventes concurrentes sur le dernier article sont départagées côté serveur."
        />
        <ChampSelect
          nom="vente.base_montants"
          libelle="Base des montants (D06)"
          defaut={valeurs["vente.base_montants"]}
          options={[
            { valeur: "TTC", libelle: "TTC" },
            { valeur: "HT", libelle: "HT" },
          ]}
          aide="Même convention pour prix, prix de touche et marges ; affichée sur chaque vue."
        />
        <ChampSelect
          nom="vente.zone_obligatoire"
          libelle="Zone de vente (D09)"
          defaut={valeurs["vente.zone_obligatoire"]}
          options={[
            { valeur: "NON", libelle: "« Zone non renseignée » autorisée" },
            { valeur: "OUI", libelle: "Zone obligatoire" },
          ]}
        />
        <ChampTexte nom="whatsapp.numero" libelle="Numéro WhatsApp (D10)" defaultValue={valeurs["whatsapp.numero"]} placeholder="+33 6 12 34 56 78" />
        <ChampTexte nom="whatsapp.delai_jours" libelle="Délai minimal avant livraison (jours)" inputMode="numeric" defaultValue={valeurs["whatsapp.delai_jours"]} />
        <ChampTexte nom="whatsapp.horizon_jours" libelle="Horizon des créneaux proposés (jours)" inputMode="numeric" defaultValue={valeurs["whatsapp.horizon_jours"]} />
      </div>
      <BoutonEnvoi>Enregistrer les réglages</BoutonEnvoi>
    </Formulaire>
  );
}

export function ConfigurerBoutique({ b }: { b: { id: string; nom: string; domaine: string | null; emplacementId: string | null; droitEcriture: boolean; aJeton: boolean } }) {
  return (
    <DialogueFormulaire
      declencheur={
        <Button variant="outline" size="sm">
          <PlugZapIcon /> Configurer
        </Button>
      }
      titre={`Connexion · ${b.nom}`}
      description="Application privée Shopify, permissions minimales : read_products, read_inventory (et write_inventory si l'écriture est autorisée). Le jeton est chiffré côté serveur et jamais réaffiché."
      action={(fd) => enregistrerBoutique(b.id, fd)}
    >
      <ChampTexte nom="domaine" libelle="Domaine" defaultValue={b.domaine ?? ""} placeholder="boutique.myshopify.com" />
      <ChampTexte nom="jeton" libelle="Jeton d'accès Admin API" type="password" autoComplete="off" placeholder={b.aJeton ? "•••••••• (inchangé si vide)" : "shpat_…"} />
      <ChampTexte nom="emplacementId" libelle="Emplacement suivi" defaultValue={b.emplacementId ?? ""} placeholder="gid://shopify/Location/123456789" />
      <ChampCase nom="droitEcriture" libelle="Envoyer les ajustements de stock terrain à Shopify" defaut={b.droitEcriture} aide="Sans ce droit, les sorties restent « stock à synchroniser » et se rapprochent manuellement." />
    </DialogueFormulaire>
  );
}

export function ActionsBoutique({ id }: { id: string }) {
  return (
    <div className="flex flex-wrap gap-2">
      <BoutonAction libelle="Tester" icone={<PlugZapIcon />} executer={() => actionShopify(id, "tester")} />
      <BoutonAction libelle="Rapprocher par SKU" icone={<RefreshCwIcon />} executer={() => actionShopify(id, "rapprocher")} />
      <BoutonAction libelle="Envoyer la file" icone={<SendIcon />} executer={() => actionShopify(id, "file")} />
    </div>
  );
}

export function LierFormat({ f }: { f: { id: string; sku: string; shopifyVariantId: string | null; shopifyInventoryItemId: string | null } }) {
  return (
    <DialogueFormulaire
      declencheur={
        <Button variant="ghost" size="icon-sm" aria-label={`Lier ${f.sku}`}>
          <LinkIcon />
        </Button>
      }
      titre={`Liaison Shopify · ${f.sku}`}
      description="Choix manuel pour un SKU ambigu ou absent. Videz les deux champs pour dissocier : ventes et mouvements passés sont conservés."
      action={(fd) => lierFormat(f.id, fd)}
    >
      <ChampTexte nom="variantId" libelle="Variante" defaultValue={f.shopifyVariantId ?? ""} placeholder="gid://shopify/ProductVariant/…" />
      <ChampTexte nom="inventoryItemId" libelle="Article de stock" defaultValue={f.shopifyInventoryItemId ?? ""} placeholder="gid://shopify/InventoryItem/…" />
    </DialogueFormulaire>
  );
}

export function ResoudreOperation({ id }: { id: string }) {
  return (
    <div className="flex gap-1">
      <BoutonAction libelle="Appliquée" icone={<CheckIcon />} executer={() => resoudreOperation(id, "appliquee")} variante="ghost" />
      <BoutonAction libelle="Rejouer" icone={<RotateCcwIcon />} executer={() => resoudreOperation(id, "rejouer")} variante="ghost" />
    </div>
  );
}
