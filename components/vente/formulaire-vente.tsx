"use client";

import { useEffect, useMemo, useState, useSyncExternalStore, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BanknoteIcon, CheckCircle2Icon, CreditCardIcon, FileTextIcon, LandmarkIcon, LocateFixedIcon, MapPinIcon, MinusIcon, PlusIcon, RotateCwIcon, SmartphoneIcon, Trash2Icon, TriangleAlertIcon, WifiOffIcon, type LucideIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel, FieldSeparator } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { declarerVente } from "@/app/actions/ventes";
import type { DonneesFormulaireVente } from "@/lib/requetes/pm";
import { centsVersSaisie, euros, saisieVersCents } from "@/lib/argent";
import { suggererZone } from "@/lib/calcul/geo";
import { CANAUX, MOYENS_PAIEMENT, type MoyenPaiement } from "@/lib/domaine";
import type { IssueVente } from "@/lib/services/ventes";
import { SelecteurReference } from "@/components/vente/selecteur-reference";

const ICONES_PAIEMENT: Record<MoyenPaiement, LucideIcon> = { ESPECES: BanknoteIcon, CARTE: CreditCardIcon, VIREMENT: LandmarkIcon, LYDIA: SmartphoneIcon, CHEQUE: FileTextIcon };
const COURTS_PAIEMENT: Record<MoyenPaiement, string> = { ESPECES: "Espèces", CARTE: "Carte", VIREMENT: "Virement", LYDIA: "Lydia", CHEQUE: "Chèque" };
const CLE_DEPART = "crm_dernier_depart";

function lireDernierDepart() {
  try { return localStorage.getItem(CLE_DEPART) ?? ""; } catch { return ""; }
}
const sansAbonnement = () => () => {};

type Ligne = { cle: string; referenceId: string; formatId: string; quantite: string; prix: string };
type Provenance = "PROPOSEE" | "SAISIE" | "NON_RENSEIGNEE";

function nouvelleCle() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
// Clés de lignes déterministes (identiques au rendu serveur et à l'hydratation).
let compteurLignes = 0;
const ligneVide = (cle = `ligne-${++compteurLignes}`): Ligne => ({ cle, referenceId: "", formatId: "", quantite: "1", prix: "" });

/**
 * Formulaire de vente (PM-02, VEN-01, VEN-02, GEO-01). Partagé par le parcours
 * vendeur (téléphone) et par l'administrateur habilité (champs supplémentaires).
 */
export function FormulaireVente({
  donnees,
  aujourdhui,
  mode,
  prixModifiable,
  lienJournal,
}: {
  donnees: DonneesFormulaireVente;
  aujourdhui: string;
  mode: "vendeur" | "admin";
  prixModifiable: boolean;
  lienJournal: string;
}) {
  const router = useRouter();
  const admin = mode === "admin";
  const [cle, setCle] = useState(nouvelleCle);
  const [lignes, setLignes] = useState<Ligne[]>(() => [ligneVide("ligne-0")]);
  const [client, setClient] = useState("");
  const [commentaire, setCommentaire] = useState("");
  const [dateVente, setDateVente] = useState(aujourdhui);
  const [zoneId, setZoneId] = useState<string>("");
  const [provenance, setProvenance] = useState<Provenance>("NON_RENSEIGNEE");
  const [suggestion, setSuggestion] = useState<string | null>(null);
  const [geoEtat, setGeoEtat] = useState<"inactif" | "recherche" | "refus" | "indisponible" | "imprecise" | "ok">("inactif");
  const [reglee, setReglee] = useState(true);
  const [moyenPaiement, setMoyenPaiement] = useState<MoyenPaiement>("CARTE");
  // Le point de départ change rarement d'une vente à l'autre : on reprend le dernier utilisé sur l'appareil.
  const dernierDepart = useSyncExternalStore(sansAbonnement, lireDernierDepart, () => "");
  const [departSaisi, setLieuDepart] = useState<string | null>(null);
  const lieuDepart = departSaisi ?? dernierDepart;
  const [lieuArrivee, setLieuArrivee] = useState("");
  const [vendeurId, setVendeurId] = useState("");
  const [canal, setCanal] = useState("TERRAIN");
  const [coutCommande, setCoutCommande] = useState("");
  const [livraisonDate, setLivraisonDate] = useState("");
  const [livraisonCreneau, setLivraisonCreneau] = useState("");
  const [livraisonVille, setLivraisonVille] = useState("");
  const [erreurs, setErreurs] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [incertain, setIncertain] = useState(false);
  const [succes, setSucces] = useState<IssueVente | null>(null);
  const [enCours, demarrer] = useTransition();

  const formats = useMemo(() => new Map(donnees.catalogue.flatMap((r) => r.formats.map((f) => [f.id, { ...f, reference: r }] as const))), [donnees.catalogue]);
  const bloquer = donnees.politiqueStock === "BLOQUER";
  const peutModifierPrix = admin || prixModifiable;

  const total = lignes.reduce((acc, l) => {
    const f = formats.get(l.formatId);
    if (!f) return acc;
    const q = Number(l.quantite);
    const pu = peutModifierPrix && l.prix !== "" ? saisieVersCents(l.prix) : f.prixVenteCents;
    return Number.isInteger(q) && q > 0 && pu !== null ? acc + q * pu : acc;
  }, 0);

  const nbArticles = lignes.reduce((a, l) => (formats.has(l.formatId) ? a + (Number(l.quantite) || 0) : a), 0);

  // Avertit avant de quitter la page avec une saisie en cours (changement d'espace, VEN-02).
  useEffect(() => {
    const sale = !succes && (client !== "" || lignes.some((l) => l.formatId));
    if (!sale) return;
    const h = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [client, lignes, succes]);

  const majLigne = (cleLigne: string, p: Partial<Ligne>) => setLignes((ls) => ls.map((l) => (l.cle === cleLigne ? { ...l, ...p } : l)));

  const localiser = () => {
    if (!("geolocation" in navigator)) {
      setGeoEtat("indisponible");
      return;
    }
    setGeoEtat("recherche");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        // La position reste dans le navigateur : seule la zone est transmise (GEO-02).
        const s = suggererZone({ lat: pos.coords.latitude, lng: pos.coords.longitude, precisionM: pos.coords.accuracy }, donnees.zones);
        if (!s) {
          setGeoEtat(pos.coords.accuracy > 5000 ? "imprecise" : "indisponible");
          return;
        }
        setSuggestion(s.zone.id);
        setZoneId(s.zone.id);
        setProvenance("PROPOSEE");
        setGeoEtat("ok");
      },
      (err) => setGeoEtat(err.code === err.PERMISSION_DENIED ? "refus" : "indisponible"),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    );
  };

  const choisirZone = (v: string) => {
    if (v === "aucune") {
      setZoneId("");
      setProvenance("NON_RENSEIGNEE");
    } else {
      setZoneId(v);
      setProvenance(v === suggestion ? "PROPOSEE" : "SAISIE");
    }
  };

  const validerLocal = () => {
    const e: Record<string, string> = {};
    if (client.trim().length < 2) e.client = "Indiquez le nom ou le libellé du client.";
    if (!dateVente) e.dateVente = "Date obligatoire.";
    else if (dateVente > aujourdhui) e.dateVente = "La date de vente ne peut pas être dans le futur.";
    lignes.forEach((l, i) => {
      const f = formats.get(l.formatId);
      if (!f) e[`ligne-${i}-format`] = "Choisissez une référence et un format.";
      const q = Number(l.quantite);
      if (!Number.isInteger(q) || q < 1) e[`ligne-${i}-quantite`] = "Quantité entière positive.";
      else if (f && bloquer && q > f.quantite) e[`ligne-${i}-quantite`] = `Stock insuffisant : ${f.quantite} disponible(s).`;
      if (peutModifierPrix && l.prix !== "" && (saisieVersCents(l.prix) === null || (saisieVersCents(l.prix) ?? 0) < 0)) e[`ligne-${i}-prix`] = "Prix invalide.";
    });
    if (donnees.zoneObligatoire && !zoneId) e.zone = "La zone de vente est obligatoire.";
    if (admin && coutCommande !== "" && saisieVersCents(coutCommande) === null) e.coutCommande = "Montant invalide.";
    return e;
  };

  const envoyer = () => {
    const e = validerLocal();
    setErreurs(e);
    setMessage(null);
    if (Object.keys(e).length) {
      toast.error("Certains champs sont à corriger.");
      return;
    }
    const payload = {
      cleIdempotence: cle,
      client: client.trim(),
      commentaire: commentaire.trim() || undefined,
      dateVente,
      canal,
      vendeurId: admin && vendeurId ? vendeurId : undefined,
      zoneId: zoneId || null,
      zoneProvenance: zoneId ? provenance : "NON_RENSEIGNEE",
      lignes: lignes.map((l) => ({ formatId: l.formatId, quantite: Number(l.quantite), prixUnitaireCents: peutModifierPrix && l.prix !== "" ? saisieVersCents(l.prix) : null })),
      coutCommandeCents: admin && coutCommande !== "" ? saisieVersCents(coutCommande) : null,
      regleeLe: reglee ? dateVente : null,
      moyenPaiement,
      lieuDepart: lieuDepart.trim() || null,
      lieuArrivee: lieuArrivee.trim() || null,
      livraison: livraisonDate ? { etat: admin ? "CONFIRMEE" : "PREFERENCE", date: livraisonDate, creneau: livraisonCreneau || null, ville: livraisonVille || null } : null,
    };
    demarrer(async () => {
      try {
        const r = await declarerVente(payload);
        setIncertain(false);
        if (r.ok && r.donnees) {
          try { if (lieuDepart.trim()) localStorage.setItem(CLE_DEPART, lieuDepart.trim()); } catch {}
          setSucces(r.donnees);
          router.refresh();
        } else if (!r.ok) {
          setErreurs(r.champs ?? {});
          setMessage(r.message);
          toast.error(r.message);
        }
      } catch {
        // Réponse perdue : la vente a pu être enregistrée. On garde la clé pour relancer sans doublon.
        setIncertain(true);
      }
    });
  };

  const recommencer = () => {
    setSucces(null);
    setCle(nouvelleCle());
    setLignes([ligneVide()]);
    setClient("");
    setCommentaire("");
    setCoutCommande("");
    setLivraisonDate("");
    setLivraisonCreneau("");
    setLivraisonVille("");
    setLieuArrivee("");
    setErreurs({});
    setMessage(null);
    setIncertain(false);
    if (provenance === "NON_RENSEIGNEE") setZoneId("");
  };

  if (succes) {
    return (
      <Card className="mx-auto w-full max-w-xl animate-in fade-in-0 slide-in-from-bottom-3 duration-500">
        <CardHeader className="justify-items-center text-center">
          <span className="mx-auto grid size-16 place-items-center rounded-full bg-emerald-50 animate-in zoom-in-50 duration-500"><CheckCircle2Icon className="size-10 text-emerald-600" /></span>
          <CardTitle className="text-xl">{succes.statut === "deja" ? "Vente déjà enregistrée" : "Vente enregistrée"}</CardTitle>
          <CardDescription>
            Référence de la vente <span className="font-mono font-semibold text-foreground">{succes.numero}</span> · total {euros(succes.montantCents)}
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center text-sm text-muted-foreground">
          {succes.statut === "deja" ? "La relance a retrouvé la vente existante : aucun doublon, aucun mouvement de stock supplémentaire." : "Le journal, le stock et les indicateurs sont à jour."}
        </CardContent>
        <CardFooter className="flex-col gap-2 sm:flex-row sm:justify-center">
          <Button size="lg" className="w-full sm:w-auto" onClick={recommencer}>
            <PlusIcon /> Déclarer une nouvelle vente
          </Button>
          <Button size="lg" variant="outline" className="w-full sm:w-auto" asChild>
            <Link href={lienJournal}>Voir mes ventes</Link>
          </Button>
        </CardFooter>
      </Card>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px] items-start">
      <FieldGroup>
        {incertain && (
          <Alert variant="destructive">
            <WifiOffIcon />
            <AlertTitle>Vente à vérifier</AlertTitle>
            <AlertDescription>
              La réponse du serveur n&apos;est pas parvenue : la vente n&apos;est peut-être pas enregistrée. Votre saisie est conservée. Relancez quand le réseau revient : la même tentative est réutilisée, sans risque de doublon.
              <Button size="sm" variant="outline" className="mt-2" onClick={envoyer} disabled={enCours}>
                <RotateCwIcon /> Relancer l&apos;enregistrement
              </Button>
            </AlertDescription>
          </Alert>
        )}
        {message && !incertain && (
          <Alert variant="destructive">
            <TriangleAlertIcon />
            <AlertTitle>Vente non enregistrée</AlertTitle>
            <AlertDescription>{message}</AlertDescription>
          </Alert>
        )}

        <div className="space-y-4">
          {lignes.map((l, i) => {
            const ref = donnees.catalogue.find((r) => r.id === l.referenceId);
            const f = formats.get(l.formatId);
            const q = Number(l.quantite) || 0;
            return (
              <Card key={l.cle} className="gap-4 py-4">
                <CardContent className="space-y-4 px-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Article {lignes.length > 1 ? i + 1 : ""}</span>
                    {lignes.length > 1 && (
                      <Button variant="ghost" size="icon-sm" aria-label="Retirer l'article" onClick={() => setLignes((ls) => ls.filter((x) => x.cle !== l.cle))}>
                        <Trash2Icon />
                      </Button>
                    )}
                  </div>
                  <Field data-invalid={!!erreurs[`ligne-${i}-format`] || undefined}>
                    <FieldLabel htmlFor={`ref-${l.cle}`}>Parfum</FieldLabel>
                    <SelecteurReference
                      id={`ref-${l.cle}`}
                      catalogue={donnees.catalogue}
                      valeur={l.referenceId}
                      bloquer={bloquer}
                      invalide={!!erreurs[`ligne-${i}-format`]}
                      onChoisir={(v) => {
                        const r = donnees.catalogue.find((x) => x.id === v);
                        const disponibles = r?.formats.filter((x) => !bloquer || x.quantite > 0) ?? [];
                        majLigne(l.cle, { referenceId: v, formatId: disponibles.length === 1 ? disponibles[0].id : "", prix: "" });
                      }}
                    />
                  </Field>
                  {ref && (
                    <Field data-invalid={!!erreurs[`ligne-${i}-format`] || undefined}>
                      <FieldLabel>Format</FieldLabel>
                      <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Format">
                        {ref.formats.map((x) => {
                          const indispo = bloquer && x.quantite <= 0;
                          const choisi = l.formatId === x.id;
                          return (
                            <button
                              key={x.id}
                              type="button"
                              role="radio"
                              aria-checked={choisi}
                              aria-label={`${x.libelle}, ${euros(x.prixVenteCents)}, ${x.quantite > 0 ? `${x.quantite} en stock` : "rupture"}`}
                              disabled={indispo}
                              onClick={() => majLigne(l.cle, { formatId: x.id, prix: "" })}
                              className={`crm-choix min-h-16 rounded-2xl p-2.5 text-left text-sm disabled:opacity-40 ${choisi ? "bg-primary text-primary-foreground" : "bg-[var(--crm-fill)] hover:bg-[var(--crm-fill-fort)]"}`}
                            >
                              <div className="font-medium">{x.libelle}</div>
                              <div className="tabular-nums">{euros(x.prixVenteCents)}</div>
                              <div className={`text-xs ${choisi ? "opacity-80" : "text-muted-foreground"}`}>{x.quantite > 0 ? `${x.quantite} en stock` : "Rupture"}</div>
                            </button>
                          );
                        })}
                      </div>
                      {erreurs[`ligne-${i}-format`] && <FieldError>{erreurs[`ligne-${i}-format`]}</FieldError>}
                    </Field>
                  )}
                  <div className="grid grid-cols-1 gap-3 min-[390px]:grid-cols-2">
                    <Field data-invalid={!!erreurs[`ligne-${i}-quantite`] || undefined}>
                      <FieldLabel htmlFor={`q-${l.cle}`}>Quantité</FieldLabel>
                      <div className="flex items-center gap-1">
                        <Button type="button" variant="outline" size="icon-lg" className="size-11 shrink-0 rounded-xl" aria-label="Diminuer" onClick={() => majLigne(l.cle, { quantite: String(Math.max(1, q - 1)) })}>
                          <MinusIcon />
                        </Button>
                        <Input id={`q-${l.cle}`} inputMode="numeric" className="h-11 min-w-0 text-center text-base font-semibold tabular-nums" value={l.quantite} onChange={(e) => majLigne(l.cle, { quantite: e.target.value.replace(/[^\d]/g, "") })} />
                        <Button type="button" variant="outline" size="icon-lg" className="size-11 shrink-0 rounded-xl" aria-label="Augmenter" onClick={() => majLigne(l.cle, { quantite: String(q + 1) })}>
                          <PlusIcon />
                        </Button>
                      </div>
                      {erreurs[`ligne-${i}-quantite`] && <FieldError>{erreurs[`ligne-${i}-quantite`]}</FieldError>}
                    </Field>
                    <Field data-invalid={!!erreurs[`ligne-${i}-prix`] || undefined}>
                      <FieldLabel htmlFor={`p-${l.cle}`}>Prix unitaire</FieldLabel>
                      {peutModifierPrix ? (
                        <Input id={`p-${l.cle}`} inputMode="decimal" className="h-11 tabular-nums" placeholder={f ? centsVersSaisie(f.prixVenteCents) : "—"} value={l.prix} onChange={(e) => majLigne(l.cle, { prix: e.target.value })} disabled={!f} />
                      ) : (
                        <div className="flex h-11 items-center rounded-xl bg-[var(--crm-fill)] px-3 tabular-nums text-sm font-medium">{f ? euros(f.prixVenteCents) : "—"}</div>
                      )}
                      {erreurs[`ligne-${i}-prix`] && <FieldError>{erreurs[`ligne-${i}-prix`]}</FieldError>}
                    </Field>
                  </div>
                </CardContent>
              </Card>
            );
          })}
          {erreurs.lignes && <p className="text-sm text-destructive">{erreurs.lignes}</p>}
          <Button type="button" variant="outline" onClick={() => setLignes((ls) => [...ls, ligneVide()])} disabled={lignes.length >= 10}>
            <PlusIcon /> Ajouter un article
          </Button>
        </div>

        <FieldSeparator />

        <Field data-invalid={!!erreurs.client || undefined}>
          <FieldLabel htmlFor="client">Client</FieldLabel>
          <Input id="client" className="h-11" value={client} onChange={(e) => setClient(e.target.value)} placeholder="Ex. Mme Martin, client de passage" maxLength={120} autoComplete="off" />
          {erreurs.client && <FieldError>{erreurs.client}</FieldError>}
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field data-invalid={!!erreurs.dateVente || undefined}>
            <FieldLabel htmlFor="dateVente">Date de vente</FieldLabel>
            <Input id="dateVente" type="date" className="h-11" value={dateVente} max={aujourdhui} onChange={(e) => setDateVente(e.target.value)} />
            <FieldDescription>Distincte de l&apos;heure de saisie, enregistrée automatiquement.</FieldDescription>
            {erreurs.dateVente && <FieldError>{erreurs.dateVente}</FieldError>}
          </Field>
          <Field data-invalid={!!erreurs.zone || undefined}>
            <FieldLabel htmlFor="vente-zone">Zone de vente</FieldLabel>
            <div className="flex gap-2">
              <Select value={zoneId || (donnees.zoneObligatoire ? "" : "aucune")} onValueChange={choisirZone}>
                <SelectTrigger id="vente-zone" className="min-w-0 flex-1 h-11">
                  <SelectValue placeholder="Choisir une zone" />
                </SelectTrigger>
                <SelectContent>
                  {!donnees.zoneObligatoire && <SelectItem value="aucune">Zone non renseignée</SelectItem>}
                  {donnees.zones.map((z) => (
                    <SelectItem key={z.id} value={z.id}>
                      {z.libelle}
                      {z.id === suggestion ? " (proposée)" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button type="button" variant="outline" size="icon-lg" className="size-11" onClick={localiser} aria-label="Proposer une zone à partir de ma position" disabled={geoEtat === "recherche"}>
                {geoEtat === "recherche" ? <Spinner /> : <LocateFixedIcon />}
              </Button>
            </div>
            <FieldDescription>
              {geoEtat === "ok" && "Zone proposée d'après votre position. Vous pouvez la remplacer."}
              {geoEtat === "refus" && "Localisation refusée : choisissez la zone dans la liste."}
              {geoEtat === "indisponible" && "Aucune zone plausible à proximité : choisissez dans la liste."}
              {geoEtat === "imprecise" && "Position trop imprécise : choisissez dans la liste."}
              {geoEtat === "inactif" && "Le bouton propose une zone ; la position précise n'est pas conservée."}
              {geoEtat === "recherche" && "Recherche de la position…"}
            </FieldDescription>
            {zoneId && (
              <Badge variant="outline" className="w-fit">
                {provenance === "PROPOSEE" ? "Provenance : proposée" : "Provenance : choisie"}
              </Badge>
            )}
            {erreurs.zone && <FieldError>{erreurs.zone}</FieldError>}
          </Field>
        </div>
        <Field data-invalid={!!erreurs.moyenPaiement || undefined}>
          <FieldLabel>Moyen de paiement</FieldLabel>
          <div className="crm-paiements" role="radiogroup" aria-label="Moyen de paiement">
            {(Object.keys(MOYENS_PAIEMENT) as MoyenPaiement[]).map((m) => {
              const Icone = ICONES_PAIEMENT[m];
              return (
                <button key={m} type="button" role="radio" aria-checked={moyenPaiement === m} aria-label={MOYENS_PAIEMENT[m]} className="crm-paiement" onClick={() => setMoyenPaiement(m)}>
                  <span><Icone aria-hidden="true" /></span>
                  {COURTS_PAIEMENT[m]}
                </button>
              );
            })}
          </div>
          {erreurs.moyenPaiement && <FieldError>{erreurs.moyenPaiement}</FieldError>}
        </Field>
        <Field orientation="horizontal" className="min-h-12 rounded-2xl bg-[var(--crm-fill)] px-3 py-2">
          <Checkbox id="reglee" className="size-5" checked={reglee} onCheckedChange={(v) => setReglee(v === true)} />
          <FieldLabel htmlFor="reglee" className="flex-1 py-1 font-normal">
            Paiement reçu à la date de vente
          </FieldLabel>
        </Field>

        <Field>
          <FieldLabel>Trajet</FieldLabel>
          <div className="crm-trajet">
            <label className="crm-trajet-etape" data-type="depart">
              <i aria-hidden="true" />
              <span>
                <small>Départ</small>
                <input value={lieuDepart} onChange={(e) => setLieuDepart(e.target.value)} placeholder="Dépôt, marché, adresse…" list="crm-lieux" maxLength={160} autoComplete="off" />
              </span>
            </label>
            <label className="crm-trajet-etape" data-type="arrivee">
              <MapPinIcon aria-hidden="true" />
              <span>
                <small>Arrivée</small>
                <input value={lieuArrivee} onChange={(e) => setLieuArrivee(e.target.value)} placeholder="Adresse ou lieu de remise au client" list="crm-lieux" maxLength={160} autoComplete="off" />
              </span>
            </label>
            <datalist id="crm-lieux">
              <option value="Dépôt Lyon 7e" />
              {donnees.zones.map((z) => <option key={z.id} value={z.libelle} />)}
            </datalist>
          </div>
          <FieldDescription>Facultatif. Le départ est retenu sur ce téléphone pour la vente suivante.</FieldDescription>
        </Field>
        <Field>
          <FieldLabel htmlFor="commentaire">Commentaire (facultatif)</FieldLabel>
          <Textarea id="commentaire" rows={2} maxLength={500} value={commentaire} onChange={(e) => setCommentaire(e.target.value)} placeholder="Informations utiles uniquement" />
        </Field>

        <details className="rounded-2xl bg-white p-4 text-sm shadow-[var(--crm-ombre)]">
          <summary className="cursor-pointer font-medium">Livraison {admin ? "" : "souhaitée"} (facultatif)</summary>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <Field>
              <FieldLabel htmlFor="livDate">Date</FieldLabel>
              <Input id="livDate" type="date" value={livraisonDate} min={dateVente} onChange={(e) => setLivraisonDate(e.target.value)} />
            </Field>
            <Field>
              <FieldLabel htmlFor="livCreneau">Créneau</FieldLabel>
              <Input id="livCreneau" value={livraisonCreneau} onChange={(e) => setLivraisonCreneau(e.target.value)} placeholder="15:00-17:00" />
            </Field>
            <Field>
              <FieldLabel htmlFor="livVille">Ville</FieldLabel>
              <Input id="livVille" value={livraisonVille} onChange={(e) => setLivraisonVille(e.target.value)} />
            </Field>
          </div>
          <p className="mt-2 text-muted-foreground">{admin ? "Saisie par l'administration : enregistrée comme livraison confirmée." : "Enregistrée comme préférence du client ; l'équipe confirme le créneau."}</p>
        </details>

        {admin && (
          <div className="grid gap-4 sm:grid-cols-3 rounded-2xl bg-white p-4 shadow-[var(--crm-ombre)]">
            <Field>
              <FieldLabel>Vendeur</FieldLabel>
              <Select value={vendeurId || "moi"} onValueChange={(v) => setVendeurId(v === "moi" ? "" : v)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="moi">Moi-même</SelectItem>
                  {donnees.vendeurs.map((v) => (
                    <SelectItem key={v.id} value={v.id}>
                      {v.nom}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field>
              <FieldLabel>Canal</FieldLabel>
              <Select value={canal} onValueChange={setCanal}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(CANAUX).map(([v, lib]) => (
                    <SelectItem key={v} value={v}>
                      {lib}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field data-invalid={!!erreurs.coutCommande || undefined}>
              <FieldLabel htmlFor="coutCommande">Prix de touche commande</FieldLabel>
              <Input id="coutCommande" inputMode="decimal" value={coutCommande} onChange={(e) => setCoutCommande(e.target.value)} placeholder="Facultatif" />
              <FieldDescription>Prioritaire sur les coûts unitaires.</FieldDescription>
              {erreurs.coutCommande && <FieldError>{erreurs.coutCommande}</FieldError>}
            </Field>
          </div>
        )}
        <div className="crm-barre-action lg:hidden">
          <div>
            <small>{nbArticles > 0 ? `${nbArticles} article${nbArticles > 1 ? "s" : ""} · ${donnees.base}` : "Aucun article choisi"}</small>
            <strong key={total} data-anime>{euros(total)}</strong>
          </div>
          <Button size="lg" className="h-12 rounded-xl px-5 text-base" onClick={envoyer} disabled={enCours}>
            {enCours ? <Spinner /> : <CheckCircle2Icon />}
            Confirmer
          </Button>
        </div>
      </FieldGroup>

      <Card className="lg:sticky lg:top-24">
        <CardHeader>
          <CardTitle>Récapitulatif</CardTitle>
          <CardDescription>Vérifiez avant de confirmer · montants {donnees.base}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {lignes.map((l) => {
            const f = formats.get(l.formatId);
            if (!f) return null;
            const pu = peutModifierPrix && l.prix !== "" ? saisieVersCents(l.prix) : f.prixVenteCents;
            return (
              <div key={l.cle} className="flex justify-between gap-2">
                <span>
                  {Number(l.quantite) || 0} × {f.reference.libelle} {f.libelle}
                </span>
                <span className="tabular-nums">{euros((Number(l.quantite) || 0) * (pu ?? 0))}</span>
              </div>
            );
          })}
          <div className="flex justify-between border-t pt-2 text-base font-semibold">
            <span>Total</span>
            <span className="tabular-nums">{euros(total)}</span>
          </div>
          <div className="flex justify-between gap-2 text-muted-foreground">
            <span>Paiement</span>
            <span>{MOYENS_PAIEMENT[moyenPaiement]}{reglee ? "" : " · à encaisser"}</span>
          </div>
          {(lieuDepart || lieuArrivee) && (
            <div className="flex justify-between gap-2 text-muted-foreground">
              <span>Trajet</span>
              <span className="text-right">{lieuDepart || "—"} → {lieuArrivee || "—"}</span>
            </div>
          )}
          <div className="text-muted-foreground">
            {dateVente ? `Vente du ${dateVente.split("-").reverse().join("/")}` : ""} · {zoneId ? donnees.zones.find((z) => z.id === zoneId)?.libelle : "Zone non renseignée"}
          </div>
        </CardContent>
        <CardFooter>
          <Button size="lg" className="w-full h-12 text-base" onClick={envoyer} disabled={enCours}>
            {enCours && <Spinner />}
            Confirmer la vente
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
