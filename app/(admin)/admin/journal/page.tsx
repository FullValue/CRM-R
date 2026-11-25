import type { Metadata } from "next";
import { exigerGestionnaire } from "@/lib/auth/acces";
import { prisma } from "@/lib/db";
import { horodatage } from "@/lib/dates";
import { ESPACES, estEspace } from "@/lib/domaine";
import { EntetePage } from "@/components/entete-page";
import { BarreFiltres } from "@/components/filtres";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

export const metadata: Metadata = { title: "Journal d'audit" };

const FAMILLES = [
  { valeur: "vente", libelle: "Ventes" },
  { valeur: "depense", libelle: "Dépenses" },
  { valeur: "stock", libelle: "Stock" },
  { valeur: "reference", libelle: "Catalogue" },
  { valeur: "shopify", libelle: "Shopify" },
  { valeur: "utilisateur", libelle: "Comptes" },
  { valeur: "connexion", libelle: "Connexions" },
  { valeur: "reglages", libelle: "Réglages" },
];

export default async function Journal({ searchParams }: { searchParams: Promise<{ q?: string; famille?: string; activite?: string }> }) {
  await exigerGestionnaire();
  const sp = await searchParams;
  const lignes = await prisma.journalAudit.findMany({
    where: {
      ...(sp.famille && sp.famille !== "tous" ? { action: { startsWith: `${sp.famille}.` } } : {}),
      ...(sp.activite && sp.activite !== "tous" ? { activiteId: sp.activite } : {}),
      ...(sp.q ? { resume: { contains: sp.q } } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  return (
    <div className="space-y-6">
      <EntetePage titre="Journal d'audit" description="Changements sensibles, erreurs de connexion et opérations d'intégration, avec auteur, date et motif (DAT-01). Les secrets ne sont jamais journalisés." />
      <BarreFiltres
        recherche={{ placeholder: "Rechercher dans le journal" }}
        selects={[
          { nom: "famille", libelle: "Famille", options: [{ valeur: "tous", libelle: "Toutes les familles" }, ...FAMILLES] },
          { nom: "activite", libelle: "Activité", options: [{ valeur: "tous", libelle: "Toutes les activités" }, ...Object.values(ESPACES).map((e) => ({ valeur: e.id, libelle: e.nom }))] },
        ]}
      />
      <Card className="p-0 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Action</TableHead>
              <TableHead>Résumé</TableHead>
              <TableHead>Auteur</TableHead>
              <TableHead>Activité</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {lignes.map((l) => (
              <TableRow key={l.id}>
                <TableCell className="whitespace-nowrap text-sm">{horodatage(l.createdAt)}</TableCell>
                <TableCell className="font-mono text-xs">{l.action}</TableCell>
                <TableCell className="text-sm">
                  {l.resume}
                  {l.motif && <div className="text-xs text-muted-foreground">Motif : {l.motif}</div>}
                </TableCell>
                <TableCell className="text-sm">{l.auteurNom}</TableCell>
                <TableCell>{l.activiteId && estEspace(l.activiteId) ? <Badge variant="outline">{ESPACES[l.activiteId].court}</Badge> : <span className="text-muted-foreground">—</span>}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
