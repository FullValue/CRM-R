import type { Metadata } from "next";
import { exigerUtilisateur } from "@/lib/auth/acces";
import { prisma } from "@/lib/db";
import { euros } from "@/lib/argent";
import { ajouterJours, aujourdhui, dateCourte, horodatage } from "@/lib/dates";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Button } from "@/components/ui/button";
import { EntetePage } from "@/components/entete-page";
import { Indicateur } from "@/components/indicateur";
import Link from "next/link";
import { ArrowRightIcon, MapPinIcon, PlusIcon } from "lucide-react";
import { MOYENS_PAIEMENT, estMoyenPaiement } from "@/lib/domaine";

export const metadata: Metadata = { title: "Mes ventes" };

/** Le vendeur consulte la confirmation de ses propres saisies, sans coûts ni données d'autrui (ACC-02). */
export default async function MesVentes() {
  const u = await exigerUtilisateur();
  const depuis = ajouterJours(aujourdhui(), -6);
  const ventes = await prisma.vente.findMany({
    where: { activiteId: "pm", auteurId: u.id, dateVente: { gte: depuis } },
    include: { lignes: true },
    orderBy: { saisieLe: "desc" },
  });
  const duJour = ventes.filter((v) => v.statut !== "ANNULEE" && v.dateVente === aujourdhui());
  const totalJour = duJour.reduce((a, v) => a + v.montantCents, 0);
  const totalSemaine = ventes.filter((v) => v.statut !== "ANNULEE").reduce((a, v) => a + v.montantCents, 0);
  return (
    <div className="space-y-4">
      <EntetePage
        titre="Mes ventes"
        description="Vos saisies des 7 derniers jours."
        actions={<Button asChild size="lg"><Link href="/vendeur"><PlusIcon /> Nouvelle vente</Link></Button>}
      />
      <div className="crm-kpi-grid !grid-cols-2">
        <Indicateur titre="Aujourd’hui" vedette valeur={euros(totalJour)} detail={`${duJour.length} vente${duJour.length > 1 ? "s" : ""}`} />
        <Indicateur titre="7 derniers jours" valeur={euros(totalSemaine)} detail={`${ventes.filter((v) => v.statut !== "ANNULEE").length} vente(s) confirmée(s)`} />
      </div>
      {ventes.length === 0 ? (
        <Empty className="border bg-background">
          <EmptyHeader>
            <EmptyTitle>Aucune vente récente</EmptyTitle>
            <EmptyDescription>Vos ventes apparaîtront ici après confirmation.</EmptyDescription>
          </EmptyHeader>
          <EmptyContent><Button asChild><Link href="/vendeur"><PlusIcon /> Déclarer une vente</Link></Button></EmptyContent>
        </Empty>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {ventes.map((v) => (
            <Card key={v.id} className="gap-2 py-4">
              <CardHeader className="px-4">
                <div className="flex items-center justify-between gap-2">
                  <CardTitle className="font-mono text-base">{v.numero}</CardTitle>
                  {v.statut === "ANNULEE" ? <Badge variant="destructive">Annulée</Badge> : v.corrigee ? <Badge variant="outline">Corrigée</Badge> : <Badge variant="secondary">Confirmée</Badge>}
                </div>
                <CardDescription>
                  {dateCourte(v.dateVente)} · {v.client} · {v.zoneLibelle ?? "Zone non renseignée"}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-1 px-4 text-sm">
                {v.lignes.map((l) => (
                  <div key={l.id} className="flex justify-between">
                    <span>
                      {l.quantite} × {l.referenceLibelle} {l.formatLibelle}
                    </span>
                    <span className="tabular-nums">{euros(l.quantite * l.prixUnitaireCents)}</span>
                  </div>
                ))}
                <div className="flex justify-between border-t pt-1 font-medium">
                  <span>Total</span>
                  <span className="tabular-nums">{euros(v.montantCents)}</span>
                </div>
                {(v.moyenPaiement || v.lieuDepart || v.lieuArrivee) && (
                  <div className="flex flex-wrap items-center gap-1.5 pt-1 text-xs text-muted-foreground">
                    {estMoyenPaiement(v.moyenPaiement) && <Badge variant="outline">{MOYENS_PAIEMENT[v.moyenPaiement]}</Badge>}
                    {(v.lieuDepart || v.lieuArrivee) && (
                      <span className="inline-flex min-w-0 items-center gap-1">
                        <MapPinIcon className="size-3 shrink-0" /> <span className="truncate">{v.lieuDepart ?? "—"}</span> <ArrowRightIcon className="size-3 shrink-0" /> <span className="truncate">{v.lieuArrivee ?? "—"}</span>
                      </span>
                    )}
                  </div>
                )}
                <p className="text-xs text-muted-foreground">Saisie le {horodatage(v.saisieLe)}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
