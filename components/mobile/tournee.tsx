"use client";

import Link from "next/link";
import { useOptimistic, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CheckIcon, ChevronDownIcon, ClockIcon, MapPinIcon, PackageIcon, RotateCcwIcon, ThumbsUpIcon } from "lucide-react";
import { livraisonAction } from "@/app/actions/ventes";
import { euros } from "@/lib/argent";
import { ControleSegmente } from "@/components/mobile/controle-segmente";

export type ArretTournee = {
  id: string;
  numero: string;
  client: string;
  etat: "PREFERENCE" | "CONFIRMEE" | "LIVREE";
  date: string;
  jour: string;
  creneau: string | null;
  ville: string | null;
  effective: string | null;
  montantCents: number;
  reglee: boolean;
  paiement: string | null;
  depart: string | null;
  arrivee: string | null;
  commentaire: string | null;
  articles: { id: string; libelle: string; quantite: number }[];
};

type Vue = "afaire" | "livrees";

export function Tournee({ arrets, aujourdhui, demain }: { arrets: ArretTournee[]; aujourdhui: string; demain: string }) {
  const router = useRouter();
  const [vue, setVue] = useState<Vue>("afaire");
  const [ouvert, setOuvert] = useState<string | null>(null);
  const [enCours, demarrer] = useTransition();
  const [liste, appliquer] = useOptimistic(arrets, (etat, maj: { id: string; etat: ArretTournee["etat"] }) =>
    etat.map((a) => (a.id === maj.id ? { ...a, etat: maj.etat, effective: maj.etat === "LIVREE" ? aujourdhui : null } : a)),
  );

  const aFaire = liste.filter((a) => a.etat !== "LIVREE");
  const livrees = liste.filter((a) => a.etat === "LIVREE");
  const duJour = aFaire.filter((a) => a.date === aujourdhui);
  const aConfirmer = aFaire.filter((a) => a.etat === "PREFERENCE");
  const visibles = vue === "afaire" ? aFaire : [...livrees].reverse();

  const groupes = new Map<string, { titre: string; ton?: "alerte" | "jour"; arrets: ArretTournee[] }>();
  for (const a of visibles) {
    const cle = vue === "afaire" && a.date < aujourdhui ? "retard" : a.date;
    const titre = cle === "retard" ? "En retard" : a.date === aujourdhui ? "Aujourd’hui" : a.date === demain ? "Demain" : a.jour;
    if (!groupes.has(cle)) groupes.set(cle, { titre, ton: cle === "retard" ? "alerte" : a.date === aujourdhui ? "jour" : undefined, arrets: [] });
    groupes.get(cle)!.arrets.push(a);
  }

  function changer(a: ArretTournee, etat: ArretTournee["etat"]) {
    const fd = new FormData();
    fd.set("etat", etat);
    fd.set("date", a.date);
    if (a.creneau) fd.set("creneau", a.creneau);
    if (a.ville) fd.set("ville", a.ville);
    if (etat === "LIVREE") fd.set("effective", aujourdhui);
    demarrer(async () => {
      appliquer({ id: a.id, etat });
      const r = await livraisonAction(a.id, fd);
      if (r.ok) {
        navigator.vibrate?.(etat === "LIVREE" ? [10, 40, 10] : 8);
        toast.success(etat === "LIVREE" ? `${a.client} : livrée` : etat === "CONFIRMEE" ? `${a.client} : créneau confirmé` : "Livraison remise à faire");
        setOuvert(null);
        router.refresh();
      } else toast.error(r.message);
    });
  }

  return (
    <div className="space-y-5">
      <div className="crm-widgets-ligne">
        <div className="crm-mini-widget" data-ton="accent">
          <span>Aujourd’hui</span>
          <strong>{duJour.length}</strong>
          <small>{duJour.length > 1 ? "arrêts" : "arrêt"}</small>
        </div>
        <div className="crm-mini-widget" data-ton={aConfirmer.length ? "alerte" : undefined}>
          <span>À confirmer</span>
          <strong>{aConfirmer.length}</strong>
          <small>préférence{aConfirmer.length > 1 ? "s" : ""} client</small>
        </div>
        <div className="crm-mini-widget" data-ton="ok">
          <span>Livrées</span>
          <strong>{livrees.length}</strong>
          <small>sur 7 jours</small>
        </div>
      </div>

      <ControleSegmente
        libelle="Afficher"
        valeur={vue}
        onChange={(v) => { setVue(v as Vue); setOuvert(null); }}
        options={[
          { valeur: "afaire", libelle: `À livrer · ${aFaire.length}` },
          { valeur: "livrees", libelle: `Livrées · ${livrees.length}` },
        ]}
      />

      {visibles.length === 0 ? (
        <div className="crm-vide-app">
          <span><PackageIcon /></span>
          <strong>{vue === "afaire" ? "Tournée terminée" : "Aucune livraison effectuée"}</strong>
          <p>{vue === "afaire" ? "Aucune livraison à faire. Les demandes WhatsApp et les ventes avec livraison apparaîtront ici." : "Les livraisons marquées « livrée » des 7 derniers jours apparaîtront ici."}</p>
        </div>
      ) : (
        <div className="space-y-6" key={vue}>
          {[...groupes.entries()].map(([cle, g]) => (
            <section key={cle} className="crm-groupe-arrets">
              <h2 data-ton={g.ton}>
                {g.titre}
                <span>{g.arrets.length}</span>
              </h2>
              <ul className="crm-liste-app">
                {g.arrets.map((a, i) => {
                  const estOuvert = ouvert === a.id;
                  return (
                    <li key={a.id} className="crm-arret" data-etat={a.etat} data-ouvert={estOuvert || undefined} style={{ "--rang": i } as React.CSSProperties}>
                      <button type="button" className="crm-arret-tete" aria-expanded={estOuvert} onClick={() => setOuvert(estOuvert ? null : a.id)}>
                        <span className="crm-arret-heure">
                          {a.etat === "LIVREE" ? <CheckIcon /> : <ClockIcon />}
                          <b>{a.creneau ?? "Journée"}</b>
                        </span>
                        <span className="crm-arret-corps">
                          <strong>{a.client || "Client"}</strong>
                          <small>
                            <MapPinIcon aria-hidden="true" /> {a.arrivee ?? a.ville ?? "Ville à préciser"} · {a.articles.reduce((s, l) => s + l.quantite, 0)} article(s)
                          </small>
                        </span>
                        <span className="crm-arret-etat" data-etat={a.etat}>{a.etat === "PREFERENCE" ? "À confirmer" : a.etat === "CONFIRMEE" ? "Confirmée" : "Livrée"}</span>
                        <ChevronDownIcon className="crm-arret-chevron" aria-hidden="true" />
                      </button>
                      <div className="crm-depliant" aria-hidden={!estOuvert}>
                        <div>
                          <div className="crm-arret-detail">
                            <ul>
                              {a.articles.map((l) => (
                                <li key={l.id}><span>{l.quantite} ×</span> {l.libelle}</li>
                              ))}
                            </ul>
                            {(a.depart || a.arrivee) && (
                              <div className="crm-trajet crm-trajet-lecture">
                                <div className="crm-trajet-etape" data-type="depart"><i aria-hidden="true" /><span><small>Départ</small><b>{a.depart ?? "—"}</b></span></div>
                                <div className="crm-trajet-etape" data-type="arrivee"><MapPinIcon aria-hidden="true" /><span><small>Arrivée</small><b>{a.arrivee ?? "—"}</b></span></div>
                              </div>
                            )}
                            <div className="crm-arret-total">
                              <span>{a.reglee ? `Réglée${a.paiement ? ` · ${a.paiement}` : ""}` : `À encaisser${a.paiement ? ` · ${a.paiement}` : ""}`}</span>
                              <strong>{euros(a.montantCents)}</strong>
                            </div>
                            {a.commentaire && <p className="crm-arret-note">{a.commentaire}</p>}
                            <div className="crm-arret-actions">
                              {a.etat === "PREFERENCE" && (
                                <button type="button" className="crm-action-app" data-ton="doux" disabled={enCours} onClick={() => changer(a, "CONFIRMEE")} tabIndex={estOuvert ? 0 : -1}>
                                  <ThumbsUpIcon /> Confirmer
                                </button>
                              )}
                              {a.etat !== "LIVREE" ? (
                                <button type="button" className="crm-action-app" disabled={enCours} onClick={() => changer(a, "LIVREE")} tabIndex={estOuvert ? 0 : -1}>
                                  <CheckIcon /> Marquer livrée
                                </button>
                              ) : (
                                <button type="button" className="crm-action-app" data-ton="doux" disabled={enCours} onClick={() => changer(a, "CONFIRMEE")} tabIndex={estOuvert ? 0 : -1}>
                                  <RotateCcwIcon /> Remettre à livrer
                                </button>
                              )}
                            </div>
                            <Link href={`/pm/ventes/${a.id}`} className="crm-arret-lien" tabIndex={estOuvert ? 0 : -1}>Vente {a.numero}</Link>
                          </div>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
