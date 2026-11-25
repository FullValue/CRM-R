import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { exigerEspaceAdmin } from "@/lib/auth/acces";
import { prisma } from "@/lib/db";
import { euros } from "@/lib/argent";
import { dateCourte } from "@/lib/dates";
import { PERIODICITES } from "@/lib/domaine";
import { EntetePage } from "@/components/entete-page";
import { EditerCoutFixe } from "@/components/amari/parametres";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

export const metadata: Metadata = { title: "Coûts fixes" };

export default async function CoutsFixes({ params }: { params: Promise<{ espace: string }> }) {
  const { espace } = await params;
  if (espace !== "amari") notFound();
  await exigerEspaceAdmin(espace);
  const [couts, postes] = await Promise.all([
    prisma.coutFixe.findMany({ where: { activiteId: "amari" }, include: { poste: true, depenses: { where: { statut: "ACTIVE" }, orderBy: { date: "desc" }, take: 1 } }, orderBy: [{ actif: "desc" }, { libelle: "asc" }] }),
    prisma.poste.findMany({ where: { activiteId: "amari", actif: true }, orderBy: { libelle: "asc" } }),
  ]);
  return (
    <div className="space-y-6">
      <EntetePage
        titre="Coûts fixes"
        description="Listing des coûts fixes de référence : libellé, poste, montant et périodicité. Les périodes suivies se fondent sur les dépenses effectivement enregistrées ; la génération automatique d'échéances n'est pas activée."
        actions={<EditerCoutFixe postes={postes} />}
      />
      <Card className="p-0 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Libellé</TableHead>
              <TableHead>Poste</TableHead>
              <TableHead>Périodicité</TableHead>
              <TableHead className="text-right">Montant</TableHead>
              <TableHead>Dernière saisie</TableHead>
              <TableHead>État</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {couts.map((c) => (
              <TableRow key={c.id}>
                <TableCell className="font-medium">{c.libelle}</TableCell>
                <TableCell>{c.poste.libelle}</TableCell>
                <TableCell>{PERIODICITES[c.periodicite as keyof typeof PERIODICITES]}</TableCell>
                <TableCell className="text-right tabular-nums">{euros(c.montantCents)}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{c.depenses[0] ? dateCourte(c.depenses[0].date) : "Jamais saisi"}</TableCell>
                <TableCell>{c.actif ? <Badge variant="secondary">Actif</Badge> : <Badge variant="outline">Inactif</Badge>}</TableCell>
                <TableCell>
                  <EditerCoutFixe cout={c} postes={postes} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
