import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { exigerEspaceAdmin } from "@/lib/auth/acces";
import { prisma } from "@/lib/db";
import { horodatage } from "@/lib/dates";
import { EntetePage, Section } from "@/components/entete-page";
import { AssistantImport } from "@/components/maya/import";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

export const metadata: Metadata = { title: "Reprise Maison Maya" };

/** Inventaire de l'existant Maya OS (MAY-01) — base de la décision D01. */
const INVENTAIRE = [
  { ecran: "Catalogue (parfums × formats, SKU)", etat: "Repris", note: "Références, formats, prix, stock et lien Shopify." },
  { ecran: "Registre des coûts (liquide, composants, façonnage, taux de perte)", etat: "Repris", note: "Moteur de calcul et valeurs du classeur, historisés." },
  { ecran: "Fiche produit : coût de revient et marge", etat: "Repris", note: "Sur prix public ramené en HT." },
  { ecran: "Import Excel annulable", etat: "Repris", note: "Import d'essai, relevé des rejets, application transactionnelle." },
  { ecran: "Clients et grilles tarifaires par rôle", etat: "À arbitrer (D01)", note: "Données à reprendre si l'usage est confirmé." },
  { ecran: "Commandes B2B (gel des coûts, lignes offertes, charges)", etat: "À arbitrer (D01, D08)", note: "Source de CA Maison Maya à valider." },
  { ecran: "Synthèse de rentabilité", etat: "À arbitrer (D08)", note: "Dépend de la source de CA retenue." },
  { ecran: "Réglages Shopify (webhook commandes)", etat: "Remplacé", note: "Liaisons Shopify centralisées, par boutique." },
];

export default async function ImportMaya({ params }: { params: Promise<{ espace: string }> }) {
  const { espace } = await params;
  if (espace !== "maya") notFound();
  await exigerEspaceAdmin(espace);
  const lots = await prisma.importLot.findMany({ where: { activiteId: "maya" }, orderBy: { createdAt: "desc" }, take: 20 });
  return (
    <div className="space-y-8">
      <EntetePage
        titre="Reprise et import · Maison Maya"
        description="Migration contrôlée depuis une sauvegarde ou un export : mapping des références et formats, isolement des doublons et lignes non rapprochées, import d'essai, puis application. Les données importées restent rattachées à Maison Maya."
      />
      <AssistantImport />
      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Inventaire de l&apos;existant Maya OS</CardTitle>
            <CardDescription>Fonctions identifiées dans l&apos;outil actuel et leur sort dans le CRM (référence de recette, D01).</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableBody>
                {INVENTAIRE.map((i) => (
                  <TableRow key={i.ecran}>
                    <TableCell>
                      <div className="font-medium">{i.ecran}</div>
                      <div className="text-xs text-muted-foreground">{i.note}</div>
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge variant={i.etat === "Repris" ? "secondary" : i.etat === "Remplacé" ? "outline" : "destructive"}>{i.etat}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
        <Section titre="Historique des imports">
          <Card className="p-0 overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Fichier</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead className="text-right">OK</TableHead>
                  <TableHead className="text-right">Écartées</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lots.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-muted-foreground">
                      Aucun import pour le moment.
                    </TableCell>
                  </TableRow>
                )}
                {lots.map((l) => (
                  <TableRow key={l.id}>
                    <TableCell className="text-sm">{horodatage(l.createdAt)}</TableCell>
                    <TableCell className="text-sm">
                      {l.nomFichier}
                      <div className="text-xs text-muted-foreground">{l.auteurNom}</div>
                    </TableCell>
                    <TableCell>{l.statut === "APPLIQUE" ? <Badge variant="secondary">Appliqué</Badge> : <Badge variant="outline">Essai</Badge>}</TableCell>
                    <TableCell className="text-right tabular-nums">{l.lignesOk}</TableCell>
                    <TableCell className="text-right tabular-nums">{l.lignesRejet + l.doublons}</TableCell>
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
