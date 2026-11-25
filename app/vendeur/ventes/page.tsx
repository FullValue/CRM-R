import type { Metadata } from "next";
import { exigerUtilisateur } from "@/lib/auth/acces";
import { prisma } from "@/lib/db";
import { euros } from "@/lib/argent";
import { ajouterJours, aujourdhui, dateCourte, horodatage } from "@/lib/dates";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";

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
  const totalJour = ventes.filter((v) => v.statut !== "ANNULEE" && v.dateVente === aujourdhui()).reduce((a, v) => a + v.montantCents, 0);
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Mes ventes</h1>
        <p className="text-sm text-muted-foreground">Vos saisies des 7 derniers jours · aujourd&apos;hui : {euros(totalJour)}</p>
      </div>
      {ventes.length === 0 ? (
        <Empty className="border bg-background">
          <EmptyHeader>
            <EmptyTitle>Aucune vente récente</EmptyTitle>
            <EmptyDescription>Vos ventes apparaîtront ici après confirmation.</EmptyDescription>
          </EmptyHeader>
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
                <p className="text-xs text-muted-foreground">Saisie le {horodatage(v.saisieLe)}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
