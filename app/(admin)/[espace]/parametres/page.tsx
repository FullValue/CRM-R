import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { exigerEspaceAdmin } from "@/lib/auth/acces";
import { prisma } from "@/lib/db";
import { bpVersPourcent } from "@/lib/argent";
import { EntetePage } from "@/components/entete-page";
import { EditerParticipant, EditerPoste } from "@/components/amari/parametres";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardAction } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

export const metadata: Metadata = { title: "Postes et participants" };

export default async function Parametres({ params }: { params: Promise<{ espace: string }> }) {
  const { espace } = await params;
  if (espace !== "amari") notFound();
  await exigerEspaceAdmin(espace);
  const [postes, participants] = await Promise.all([
    prisma.poste.findMany({ where: { activiteId: "amari" }, include: { _count: { select: { depenses: true } } }, orderBy: [{ actif: "desc" }, { libelle: "asc" }] }),
    prisma.participant.findMany({ where: { activiteId: "amari" }, orderBy: { nom: "asc" } }),
  ]);
  const sommeDefaut = participants.filter((p) => p.actif).reduce((a, p) => a + (p.partDefautBp ?? 0), 0);
  return (
    <div className="space-y-6">
      <EntetePage titre="Postes et participants" description="Paramétrage de l'Atelier Amari (décision D04 : sens des parts, participants, clés et postes)." />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Postes de dépense</CardTitle>
            <CardDescription>Un poste désactivé n&apos;est plus proposé à la saisie.</CardDescription>
            <CardAction>
              <EditerPoste />
            </CardAction>
          </CardHeader>
          <CardContent>
            <Table>
              <TableBody>
                {postes.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.libelle}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{p._count.depenses} dépense(s)</TableCell>
                    <TableCell>{p.actif ? <Badge variant="secondary">Actif</Badge> : <Badge variant="outline">Désactivé</Badge>}</TableCell>
                    <TableCell className="w-10">
                      <EditerPoste poste={p} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Participants</CardTitle>
            <CardDescription>Parts par défaut des participants actifs : {bpVersPourcent(sommeDefaut)}{sommeDefaut !== 10000 && " (≠ 100 % : à compléter lors de la saisie)"}</CardDescription>
            <CardAction>
              <EditerParticipant />
            </CardAction>
          </CardHeader>
          <CardContent>
            <Table>
              <TableBody>
                {participants.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.nom}</TableCell>
                    <TableCell className="text-sm">{p.partDefautBp !== null ? `Part par défaut ${bpVersPourcent(p.partDefautBp)}` : "Sans part par défaut"}</TableCell>
                    <TableCell>{p.actif ? <Badge variant="secondary">Actif</Badge> : <Badge variant="outline">Inactif</Badge>}</TableCell>
                    <TableCell className="w-10">
                      <EditerParticipant participant={p} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
