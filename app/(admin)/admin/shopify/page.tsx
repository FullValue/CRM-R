import type { Metadata } from "next";
import { exigerGestionnaire } from "@/lib/auth/acces";
import { prisma } from "@/lib/db";
import { horodatage } from "@/lib/dates";
import { ESPACES, LIENS_SHOPIFY, estEspace } from "@/lib/domaine";
import { EntetePage, Section } from "@/components/entete-page";
import { ActionsBoutique, ConfigurerBoutique, LierFormat, ResoudreOperation } from "@/components/admin";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export const metadata: Metadata = { title: "Liaisons Shopify" };

const STATUTS: Record<string, string> = { NON_CONFIGUREE: "Non configurée", ACTIVE: "Active", ERREUR: "En erreur" };

export default async function Shopify() {
  await exigerGestionnaire();
  const [boutiques, aSurveiller, ops, webhooks] = await Promise.all([
    prisma.boutique.findMany({ include: { activite: true }, orderBy: { activite: { ordre: "asc" } } }),
    prisma.format.findMany({ where: { OR: [{ lienStatut: { in: ["AMBIGU", "ERREUR", "LIE"] } }] }, include: { reference: true }, orderBy: [{ lienStatut: "asc" }, { sku: "asc" }] }),
    prisma.operationSync.findMany({ where: { statut: { not: "OK" } }, include: { format: true }, orderBy: { createdAt: "desc" }, take: 50 }),
    prisma.webhookRecu.findMany({ orderBy: { recuLe: "desc" }, take: 15 }),
  ]);
  const secretWebhook = !!process.env.SHOPIFY_WEBHOOK_SECRET;

  return (
    <div className="space-y-8">
      <EntetePage
        titre="Liaisons Shopify"
        description="Contrat par boutique et par donnée (SHP-01 à SHP-04) : libellé, format et prix publiés de Shopify vers le CRM pour les variantes liées ; stock par emplacement validé ; coûts, parts et informations financières restent dans le CRM."
      />
      {!secretWebhook && (
        <Alert>
          <AlertTitle>Notifications désactivées</AlertTitle>
          <AlertDescription>La variable SHOPIFY_WEBHOOK_SECRET n&apos;est pas définie : les notifications reçues sur /api/shopify/webhook sont refusées (signature invérifiable).</AlertDescription>
        </Alert>
      )}
      <div className="grid gap-4 lg:grid-cols-3">
        {boutiques.map((b) => (
          <Card key={b.id}>
            <CardHeader>
              <CardTitle className="text-base">{b.nom}</CardTitle>
              <CardDescription>{estEspace(b.activiteId) ? ESPACES[b.activiteId].nom : b.activiteId}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">État</span>
                <Badge variant={b.statut === "ACTIVE" ? "secondary" : b.statut === "ERREUR" ? "destructive" : "outline"}>{STATUTS[b.statut] ?? b.statut}</Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Domaine</span>
                <span>{b.domaine ?? "—"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Jeton</span>
                <span>{b.jetonChiffre ? "Enregistré (chiffré)" : "Absent"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Écriture du stock</span>
                <span>{b.droitEcriture ? "Autorisée" : "Non autorisée"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Dernière synchro réussie</span>
                <span>{horodatage(b.derniereSyncOk)}</span>
              </div>
              {b.derniereErreur && <p className="text-destructive">{b.derniereErreur}</p>}
            </CardContent>
            <CardFooter className="flex-col items-start gap-2">
              <ConfigurerBoutique b={{ id: b.id, nom: b.nom, domaine: b.domaine, emplacementId: b.emplacementId, droitEcriture: b.droitEcriture, aJeton: !!b.jetonChiffre }} />
              <ActionsBoutique id={b.id} />
            </CardFooter>
          </Card>
        ))}
      </div>

      <Section titre="Ajustements de stock à synchroniser" description="Chaque sortie terrain sur un format lié produit un seul ajustement distant (clé d'idempotence). Une réponse incertaine n'est jamais rejouée sans vérification.">
        <Card className="p-0 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Créé le</TableHead>
                <TableHead>Format</TableHead>
                <TableHead className="text-right">Delta</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead>Erreur</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {ops.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-muted-foreground">
                    Aucun ajustement en attente.
                  </TableCell>
                </TableRow>
              )}
              {ops.map((o) => (
                <TableRow key={o.id}>
                  <TableCell className="text-sm">{horodatage(o.createdAt)}</TableCell>
                  <TableCell className="font-mono text-xs">{o.format.sku}</TableCell>
                  <TableCell className="text-right tabular-nums">{o.delta > 0 ? `+${o.delta}` : o.delta}</TableCell>
                  <TableCell>
                    <Badge variant={o.statut === "EN_ATTENTE" ? "outline" : "destructive"}>{{ EN_ATTENTE: "Stock à synchroniser", ERREUR: "Erreur", INCERTAIN: "Incertain" }[o.statut] ?? o.statut}</Badge>
                  </TableCell>
                  <TableCell className="max-w-64 text-sm text-muted-foreground">{o.erreur ?? "—"}</TableCell>
                  <TableCell>{o.statut !== "EN_ATTENTE" && <ResoudreOperation id={o.id} />}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      </Section>

      <Section titre="Correspondances référence × format" description="Formats liés, ambigus ou en erreur. Les correspondances ambiguës restent hors synchronisation jusqu'à validation.">
        <Card className="p-0 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Format</TableHead>
                <TableHead>Espace</TableHead>
                <TableHead>Lien</TableHead>
                <TableHead>Variante</TableHead>
                <TableHead>Dernier échange</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {aSurveiller.map((f) => (
                <TableRow key={f.id}>
                  <TableCell>
                    {f.reference.libelle} {f.libelle}
                    <div className="font-mono text-xs text-muted-foreground">{f.sku}</div>
                  </TableCell>
                  <TableCell>{estEspace(f.activiteId) ? ESPACES[f.activiteId].court : f.activiteId}</TableCell>
                  <TableCell>
                    <Badge variant={f.lienStatut === "LIE" ? "secondary" : "destructive"}>{LIENS_SHOPIFY[f.lienStatut as keyof typeof LIENS_SHOPIFY]}</Badge>
                    {f.lienMessage && <div className="mt-1 text-xs text-muted-foreground">{f.lienMessage}</div>}
                  </TableCell>
                  <TableCell className="font-mono text-xs">{f.shopifyVariantId ?? "—"}</TableCell>
                  <TableCell className="text-sm">{horodatage(f.dernierEchangeLe)}</TableCell>
                  <TableCell>
                    <LierFormat f={f} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      </Section>

      <Section titre="Dernières notifications reçues" description="Dédupliquées par identifiant de notification ; une notification rejouée n'est appliquée qu'une fois.">
        <Card className="p-0 overflow-hidden">
          <Table>
            <TableBody>
              {webhooks.length === 0 && (
                <TableRow>
                  <TableCell className="text-muted-foreground">Aucune notification reçue.</TableCell>
                </TableRow>
              )}
              {webhooks.map((w) => (
                <TableRow key={w.id}>
                  <TableCell className="text-sm">{horodatage(w.recuLe)}</TableCell>
                  <TableCell className="font-mono text-xs">{w.topic}</TableCell>
                  <TableCell className="text-sm">{w.domaine}</TableCell>
                  <TableCell>
                    <Badge variant={w.statut === "TRAITE" ? "secondary" : w.statut === "ERREUR" ? "destructive" : "outline"}>{w.statut}</Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{w.message}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      </Section>
    </div>
  );
}
