import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { exigerEspaceAdmin } from "@/lib/auth/acces";
import { prisma } from "@/lib/db";
import { euros, nombre, pourcent } from "@/lib/argent";
import { dateCourte, dateLongue, resoudrePeriode } from "@/lib/dates";
import { agregerVentes } from "@/lib/calcul/vente";
import { meilleuresJournees, meilleuresVentes } from "@/lib/calcul/classement";
import { filtreVentes, serieParJour, ventesDetaillees } from "@/lib/requetes/pm";
import { lireReglages } from "@/lib/reglages";
import { EntetePage, Section } from "@/components/entete-page";
import { BarreFiltres } from "@/components/filtres";
import { Indicateur } from "@/components/indicateur";
import { GraphiqueCAJour } from "@/components/graphiques";
import { BasculeUrl } from "@/components/bascule-url";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Tableau de bord Parfumerie Mobile" };

export default async function TableauPM({
  params,
  searchParams,
}: {
  params: Promise<{ espace: string }>;
  searchParams: Promise<{ periode?: string; du?: string; au?: string; tri?: string; groupe?: string }>;
}) {
  const { espace } = await params;
  if (espace !== "pm") notFound();
  await exigerEspaceAdmin(espace);
  const sp = await searchParams;
  const periode = resoudrePeriode(sp);
  const ventes = await ventesDetaillees(filtreVentes(periode));
  const reglages = await lireReglages();
  const ag = agregerVentes(ventes);
  const eligibles = ventes.filter((v) => v.statut !== "ANNULEE");
  const lignes = eligibles.flatMap((v) => v.lignes.map((l) => ({ ...l, venteStatut: v.statut, dateVente: v.dateVente })));
  const unites = lignes.reduce((a, l) => a + l.quantite, 0);
  const tri = sp.tri === "ca" ? "ca" : "unites";
  const groupe = sp.groupe === "format" ? "format" : "reference";
  const top = meilleuresVentes(lignes, groupe, tri).slice(0, 8);
  const journees = meilleuresJournees(ventes).slice(0, 5);
  const avecLivraison = eligibles.filter((v) => v.livraisonEtat !== "AUCUNE").length;
  const nonReglees = eligibles.filter((v) => !v.regleeLe);
  const aCompleter = eligibles.filter((v) => v.coutSource === "A_COMPLETER").length;
  const sansZone = eligibles.filter((v) => !v.zoneId).length;
  const canaux = [...new Set(eligibles.map((v) => v.canal))];
  const serie = serieParJour(ventes, periode);
  const livraisonsParDate = new Map<string, { numero: string; date: string | null; etat: string }[]>();
  for (const v of eligibles) {
    if (v.livraisonDate) livraisonsParDate.set(v.dateVente, [...(livraisonsParDate.get(v.dateVente) ?? []), { numero: v.numero, date: v.livraisonDate, etat: v.livraisonEtat }]);
  }
  const extrait = ventes.slice(0, 8);
  const plafond = top[0] ? (tri === "ca" ? top[0].caCents : top[0].unites) : 1;
  const nbRefsActives = await prisma.reference.count({ where: { activiteId: "pm", etat: "ACTIF" } });

  return (
    <div className="space-y-8">
      <EntetePage
        titre="Parfumerie Mobile"
        description={`Performances de la période · date de référence : date de vente · montants ${reglages["vente.base_montants"]} · canaux couverts : ${canaux.length ? canaux.join(", ").toLowerCase() : "aucun"}.`}
        actions={
          <Button asChild>
            <Link href="/pm/ventes/nouvelle">Nouvelle vente</Link>
          </Button>
        }
      />
      <BarreFiltres periode />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Indicateur titre="Chiffre d'affaires suivi" valeur={euros(ag.caCents)} detail={`${ag.nbVentes} vente(s) · ${nombre(unites)} unité(s)`} definition="Somme des montants des ventes non annulées de la période, corrections comprises." lien="/pm/ventes" />
        <Indicateur
          titre="Marge brute estimée"
          valeur={ag.nbCoutConnu === 0 ? null : euros(ag.margeCents)}
          detail={`Taux ${pourcent(ag.tauxMarge)} sur ventes à coût connu`}
          definition="Somme des marges des ventes à coût connu. Le taux = marge ÷ CA de ces seules ventes."
          lien="/pm/rentabilite"
        />
        <Indicateur
          titre="Couverture des coûts"
          valeur={ag.couverture === null ? null : pourcent(ag.couverture, 0)}
          detail={`${ag.nbCoutConnu}/${ag.nbVentes} ventes · CA couvert ${euros(ag.caCouvertCents)}${aCompleter ? ` · ${aCompleter} à compléter` : ""}`}
          definition="Ventes éligibles à coût connu ÷ ventes éligibles."
          ton={ag.couverture !== null && ag.couverture < 0.8 ? "alerte" : undefined}
          lien="/pm/ventes?etat=A_COMPLETER"
        />
        <Indicateur titre="Panier moyen" valeur={ag.nbVentes ? euros(Math.round(ag.caCents / ag.nbVentes)) : null} detail={`${nbRefsActives} références actives`} />
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <Indicateur titre="Ventes avec livraison renseignée" valeur={avecLivraison} detail="Date planifiée distincte de la date de vente" lien="/pm/livraisons" />
        <Indicateur titre="Ventes non réglées" valeur={nonReglees.length} detail={`${euros(nonReglees.reduce((a, v) => a + v.montantCents, 0))} hors fonds de roulement`} lien="/pm/tresorerie" />
        <Indicateur titre="Ventes sans zone" valeur={sansZone} detail="Comptées dans la ligne « Zone non renseignée »" lien="/pm/zones" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Chiffre d&apos;affaires par jour de vente</CardTitle>
          <CardDescription>
            {dateCourte(periode.debut < "2001-01-01" ? (serie[0]?.date ?? periode.debut) : periode.debut)} → {dateCourte(periode.fin > "2900-01-01" ? (serie.at(-1)?.date ?? periode.fin) : periode.fin)}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <GraphiqueCAJour donnees={serie} />
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-2">
        <Section
          titre="Meilleures ventes"
          description={`Classement par ${tri === "ca" ? "chiffre d'affaires" : "unités nettes vendues"}, regroupé par ${groupe === "format" ? "format" : "référence"}.`}
          actions={
            <div className="flex flex-wrap gap-2">
              <BasculeUrl nom="tri" libelle="Mode de classement" defaut="unites" options={[{ valeur: "unites", libelle: "Unités" }, { valeur: "ca", libelle: "CA" }]} />
              <BasculeUrl nom="groupe" libelle="Regroupement" defaut="reference" options={[{ valeur: "reference", libelle: "Référence" }, { valeur: "format", libelle: "Format" }]} />
            </div>
          }
        >
          <Card className="p-0 overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8">#</TableHead>
                  <TableHead>Article</TableHead>
                  <TableHead className="w-1/3" />
                  <TableHead className="text-right">Unités</TableHead>
                  <TableHead className="text-right">CA</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {top.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-muted-foreground">
                      Aucune vente sur la période.
                    </TableCell>
                  </TableRow>
                )}
                {top.map((e, i) => (
                  <TableRow key={e.cle}>
                    <TableCell className="text-muted-foreground tabular-nums">{i + 1}</TableCell>
                    <TableCell>
                      <div className="font-medium">{e.libelle}</div>
                      <div className="text-xs text-muted-foreground">{e.detail}</div>
                    </TableCell>
                    <TableCell>
                      <div className="h-2 rounded-full bg-muted">
                        <div className="h-2 rounded-full bg-chart-1" style={{ width: `${Math.max(4, ((tri === "ca" ? e.caCents : e.unites) / plafond) * 100)}%` }} />
                      </div>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{e.unites}</TableCell>
                    <TableCell className="text-right tabular-nums">{euros(e.caCents)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </Section>
        <Section titre="Meilleures journées" description="Classement par CA suivi, regroupé par date de vente. Les livraisons associées sont rappelées.">
          <Card className="p-0 overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date de vente</TableHead>
                  <TableHead className="text-right">Ventes</TableHead>
                  <TableHead className="text-right">CA</TableHead>
                  <TableHead>Livraisons associées</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {journees.map((j) => (
                  <TableRow key={j.date}>
                    <TableCell className="capitalize">
                      <Link className="hover:underline" href={`/pm/ventes?du=${j.date}&au=${j.date}`}>
                        {dateLongue(j.date)}
                      </Link>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{j.nbVentes}</TableCell>
                    <TableCell className="text-right tabular-nums font-medium">{euros(j.caCents)}</TableCell>
                    <TableCell className="text-sm">
                      {(livraisonsParDate.get(j.date) ?? []).map((l) => (
                        <div key={l.numero} className="text-muted-foreground">
                          {l.numero} → {dateCourte(l.date)}
                        </div>
                      ))}
                      {!livraisonsParDate.get(j.date) && <span className="text-muted-foreground">—</span>}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </Section>
      </div>

      <Section titre="Extrait du journal" actions={<Button variant="outline" size="sm" asChild><Link href="/pm/ventes">Tout le journal</Link></Button>}>
        <Card className="p-0 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>N°</TableHead>
                <TableHead>Articles</TableHead>
                <TableHead>Zone</TableHead>
                <TableHead>Vendeur</TableHead>
                <TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {extrait.map((v) => (
                <TableRow key={v.id} className={v.statut === "ANNULEE" ? "opacity-60" : ""}>
                  <TableCell>{dateCourte(v.dateVente)}</TableCell>
                  <TableCell>
                    <Link href={`/pm/ventes/${v.id}`} className="font-mono text-xs hover:underline">
                      {v.numero}
                    </Link>
                    {v.statut === "ANNULEE" && <Badge variant="destructive" className="ml-2">Annulée</Badge>}
                  </TableCell>
                  <TableCell className="text-sm">{v.lignes.map((l) => `${l.quantite} × ${l.referenceLibelle} ${l.formatLibelle}`).join(", ")}</TableCell>
                  <TableCell className="text-sm">{v.zoneLibelle ?? "—"}</TableCell>
                  <TableCell className="text-sm">{v.vendeur.nom}</TableCell>
                  <TableCell className="text-right tabular-nums">{euros(v.montantCents)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
        <p className="text-xs text-muted-foreground">Le nom des clients n&apos;apparaît que dans le journal détaillé et la fiche de vente.</p>
      </Section>
    </div>
  );
}
