import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ChevronLeftIcon } from "lucide-react";
import { exigerEspaceAdmin } from "@/lib/auth/acces";
import { prisma } from "@/lib/db";
import { euros, pourcent } from "@/lib/argent";
import { aujourdhui, dateCourte, horodatage } from "@/lib/dates";
import { CANAUX, ETATS_LIVRAISON, PROVENANCES_ZONE, SOURCES_COUT, STOCK_SYNC } from "@/lib/domaine";
import { rentabiliteVente } from "@/lib/calcul/vente";
import { EntetePage, Section } from "@/components/entete-page";
import { AnnulerVente, CorrigerVente, LivraisonVente, ReglerVente } from "@/components/vente/actions-vente";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export const metadata: Metadata = { title: "Détail de la vente" };

function Info({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-sm">{children}</dd>
    </div>
  );
}

export default async function DetailVente({ params }: { params: Promise<{ espace: string; id: string }> }) {
  const { espace, id } = await params;
  if (espace !== "pm") notFound();
  await exigerEspaceAdmin(espace);
  const v = await prisma.vente.findFirst({
    where: { id, activiteId: "pm" },
    include: { lignes: true, vendeur: true, auteur: true, corrections: { orderBy: { createdAt: "desc" } } },
  });
  if (!v) notFound();
  const [zones, flux, ops] = await Promise.all([
    prisma.zone.findMany({ where: { activiteId: "pm" }, orderBy: { libelle: "asc" } }),
    prisma.mouvementTresorerie.findMany({ where: { OR: [{ venteId: v.id }, { libelle: `Remboursement ${v.numero}` }] } }),
    prisma.operationSync.findMany({ where: { venteId: v.id } }),
  ]);
  const r = rentabiliteVente(v.lignes, v.coutCommandeCents);
  const annulee = v.statut === "ANNULEE";

  return (
    <div className="space-y-8">
      <div className="space-y-3">
        <Button variant="ghost" size="sm" asChild className="-ml-2">
          <Link href="/pm/ventes">
            <ChevronLeftIcon /> Journal des ventes
          </Link>
        </Button>
        <EntetePage
          titre={`Vente ${v.numero}`}
          description={
            <span className="flex flex-wrap items-center gap-2">
              {annulee ? <Badge variant="destructive">Annulée</Badge> : <Badge variant="secondary">Confirmée</Badge>}
              {v.corrigee && <Badge variant="outline">Corrigée</Badge>}
              <Badge variant="outline">{STOCK_SYNC[v.stockSync as keyof typeof STOCK_SYNC]}</Badge>
            </span>
          }
          actions={
            !annulee && (
              <>
                {!v.regleeLe && <ReglerVente venteId={v.id} dateVente={v.dateVente} aujourdhui={aujourdhui()} />}
                <LivraisonVente vente={v} />
                <CorrigerVente vente={v} zones={zones.map((z) => ({ id: z.id, libelle: z.libelle }))} aujourdhui={aujourdhui()} />
                <AnnulerVente venteId={v.id} reglee={!!v.regleeLe} montantCents={v.montantCents} />
              </>
            )
          }
        />
      </div>

      {annulee && (
        <Alert variant="destructive">
          <AlertTitle>Vente annulée le {horodatage(v.annuleeLe)}</AlertTitle>
          <AlertDescription>Motif : {v.motifAnnulation}. Elle reste traçable mais sort des totaux actifs.</AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Informations</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid gap-4 sm:grid-cols-3">
              <Info label="Client">{v.client}</Info>
              <Info label="Date de vente">{dateCourte(v.dateVente)}</Info>
              <Info label="Saisie le">{horodatage(v.saisieLe)}</Info>
              <Info label="Vendeur">{v.vendeur.nom}</Info>
              <Info label="Saisi par">{v.auteur.nom}</Info>
              <Info label="Canal">{CANAUX[v.canal as keyof typeof CANAUX] ?? v.canal}</Info>
              <Info label="Zone de vente">{v.zoneLibelle ?? "Zone non renseignée"}</Info>
              <Info label="Provenance de la zone">{PROVENANCES_ZONE[v.zoneProvenance as keyof typeof PROVENANCES_ZONE]}</Info>
              <Info label="Règlement">{v.regleeLe ? `Réglée le ${dateCourte(v.regleeLe)}` : "Non réglée"}</Info>
              <Info label="Livraison">
                {v.livraisonEtat === "AUCUNE"
                  ? "Aucune"
                  : `${ETATS_LIVRAISON[v.livraisonEtat as keyof typeof ETATS_LIVRAISON]} · ${dateCourte(v.livraisonDate)}${v.livraisonCreneau ? ` · ${v.livraisonCreneau}` : ""}${v.livraisonVille ? ` · ${v.livraisonVille}` : ""}`}
              </Info>
              {v.livraisonEffective && <Info label="Livrée effectivement le">{dateCourte(v.livraisonEffective)}</Info>}
              {v.commentaire && <Info label="Commentaire">{v.commentaire}</Info>}
            </dl>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Rentabilité</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="space-y-3">
              <Info label="Montant de vente">{euros(v.montantCents)}</Info>
              <Info label="Coût appliqué">{v.coutCents === null ? <Badge variant="outline" className="border-amber-300 text-amber-700">Coût à compléter</Badge> : euros(v.coutCents)}</Info>
              <Info label="Source du coût">{SOURCES_COUT[v.coutSource as keyof typeof SOURCES_COUT]}</Info>
              <Info label="Marge brute estimée">{r.margeCents === null ? "—" : `${euros(r.margeCents)} · ${pourcent(r.tauxMarge)}`}</Info>
            </dl>
            <p className="mt-3 text-xs text-muted-foreground">Coûts figés à la validation : une évolution du prix de touche ne modifie pas cette vente. Une correction explicite reste possible.</p>
          </CardContent>
        </Card>
      </div>

      <Section titre="Lignes">
        <Card className="p-0 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Référence</TableHead>
                <TableHead>Format</TableHead>
                <TableHead className="text-right">Quantité</TableHead>
                <TableHead className="text-right">Prix unitaire</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">Coût unitaire</TableHead>
                <TableHead>Source</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {v.lignes.map((l) => (
                <TableRow key={l.id}>
                  <TableCell>
                    {l.referenceLibelle} <span className="text-xs text-muted-foreground">{l.referenceCode}</span>
                  </TableCell>
                  <TableCell>{l.formatLibelle}</TableCell>
                  <TableCell className="text-right tabular-nums">{l.quantite}</TableCell>
                  <TableCell className="text-right tabular-nums">{euros(l.prixUnitaireCents)}</TableCell>
                  <TableCell className="text-right tabular-nums">{euros(l.quantite * l.prixUnitaireCents)}</TableCell>
                  <TableCell className="text-right tabular-nums">{euros(l.coutUnitaireCents)}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{{ FORMAT: "Format", REFERENCE: "Référence", MANUEL: "Correction manuelle", ABSENT: "Absent" }[l.coutSource] ?? l.coutSource}</TableCell>
                </TableRow>
              ))}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell colSpan={4}>Total</TableCell>
                <TableCell className="text-right tabular-nums">{euros(v.montantCents)}</TableCell>
                <TableCell colSpan={2} />
              </TableRow>
            </TableFooter>
          </Table>
        </Card>
      </Section>

      <div className="grid gap-6 lg:grid-cols-2">
        <Section titre="Flux de trésorerie liés">
          <Card className="p-0 overflow-hidden">
            <Table>
              <TableBody>
                {flux.length === 0 && (
                  <TableRow>
                    <TableCell className="text-muted-foreground">Aucun flux : vente non réglée, exclue du fonds de roulement jusqu&apos;à encaissement.</TableCell>
                  </TableRow>
                )}
                {flux.map((f) => (
                  <TableRow key={f.id}>
                    <TableCell>{dateCourte(f.dateReglement)}</TableCell>
                    <TableCell>{f.libelle}</TableCell>
                    <TableCell className={`text-right tabular-nums ${f.type === "DECAISSEMENT" ? "text-destructive" : ""}`}>
                      {f.type === "DECAISSEMENT" ? "−" : "+"}
                      {euros(f.montantCents)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
          {ops.length > 0 && (
            <p className="text-sm text-muted-foreground">
              Ajustements Shopify : {ops.map((o) => `${o.delta > 0 ? "+" : ""}${o.delta} (${o.statut.toLowerCase()})`).join(", ")}
            </p>
          )}
        </Section>
        <Section titre="Historique des corrections">
          <Card className="p-0 overflow-hidden">
            <Table>
              <TableBody>
                {v.corrections.length === 0 && (
                  <TableRow>
                    <TableCell className="text-muted-foreground">Aucune correction.</TableCell>
                  </TableRow>
                )}
                {v.corrections.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="whitespace-nowrap text-sm">{horodatage(c.createdAt)}</TableCell>
                    <TableCell className="text-sm">
                      <span className="font-medium">{{ CORRECTION: "Correction", ANNULATION: "Annulation", LIVRAISON: "Livraison", REGLEMENT: "Règlement" }[c.type] ?? c.type}</span> · {c.motif}
                      <div className="text-xs text-muted-foreground">
                        {c.auteurNom}
                        {c.type !== "LIVRAISON" && (c.effetStock ? " · stock modifié" : " · sans effet sur le stock")}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </Section>
      </div>
    </div>
  );
}
