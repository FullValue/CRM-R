import Link from "next/link";
import { ArrowUpRightIcon } from "lucide-react";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { exigerEspaceAdmin } from "@/lib/auth/acces";
import { prisma } from "@/lib/db";
import { euros } from "@/lib/argent";
import { resoudrePeriode } from "@/lib/dates";
import { PERIODICITES } from "@/lib/domaine";
import { filtreDepenses } from "@/lib/requetes/amari";
import { EntetePage, Section } from "@/components/entete-page";
import { BarreFiltres } from "@/components/filtres";
import { Indicateur } from "@/components/indicateur";
import { GraphiqueBarresHorizontales } from "@/components/graphiques";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Vue financière" };

export default async function Finances({ params, searchParams }: { params: Promise<{ espace: string }>; searchParams: Promise<{ periode?: string; du?: string; au?: string }> }) {
  const { espace } = await params;
  if (espace !== "amari") notFound();
  await exigerEspaceAdmin(espace);
  const sp = await searchParams;
  const periode = resoudrePeriode(sp);
  const q = new URLSearchParams(Object.entries(sp).filter(([, v]) => typeof v === "string") as [string, string][]).toString();
  const lien = (extra: Record<string, string>) => `/amari/depenses?${new URLSearchParams({ ...Object.fromEntries(new URLSearchParams(q)), ...extra })}`;

  const [depenses, coutsFixes, annulees] = await Promise.all([
    prisma.depense.findMany({ where: filtreDepenses(periode), include: { poste: true, parts: true } }),
    prisma.coutFixe.findMany({ where: { activiteId: "amari", actif: true }, include: { poste: true }, orderBy: { libelle: "asc" } }),
    prisma.depense.count({ where: filtreDepenses(periode, { statut: "ANNULEE" }) }),
  ]);
  const total = depenses.reduce((a, d) => a + d.montantCents, 0);
  const fixes = depenses.filter((d) => d.type === "FIXE").reduce((a, d) => a + d.montantCents, 0);
  const parPoste = new Map<string, { id: string; libelle: string; montant: number; nb: number }>();
  for (const d of depenses) {
    const p = parPoste.get(d.posteId) ?? { id: d.posteId, libelle: d.poste.libelle, montant: 0, nb: 0 };
    p.montant += d.montantCents;
    p.nb += 1;
    parPoste.set(d.posteId, p);
  }
  const parParticipant = new Map<string, { id: string; nom: string; montant: number; fixes: number }>();
  let nonReparti = 0;
  for (const d of depenses) {
    if (d.parts.length === 0) nonReparti += d.montantCents;
    for (const p of d.parts) {
      const x = parParticipant.get(p.participantId) ?? { id: p.participantId, nom: p.participantNom, montant: 0, fixes: 0 };
      x.montant += p.montantCents;
      if (d.type === "FIXE") x.fixes += p.montantCents;
      parParticipant.set(p.participantId, x);
    }
  }
  const postes = [...parPoste.values()].sort((a, b) => b.montant - a.montant);
  const participants = [...parParticipant.values()].sort((a, b) => b.montant - a.montant);
  const mensualise = coutsFixes.reduce((a, c) => a + (c.periodicite === "MENSUELLE" ? c.montantCents : c.periodicite === "TRIMESTRIELLE" ? c.montantCents / 3 : c.montantCents / 12), 0);

  return (
    <div className="space-y-8">
      <EntetePage
        titre="Vue financière"
        description="Suivez les dépenses enregistrées et leur répartition. La période s’applique à la date de rattachement."
        actions={<Button asChild><Link href={lien({})}>Voir les dépenses <ArrowUpRightIcon /></Link></Button>}
      />
      <BarreFiltres periode />
      <div className="crm-kpi-grid">
        <Indicateur titre="Total des dépenses" vedette valeur={euros(total)} detail={`${depenses.length} dépense(s) active(s)${annulees ? ` · ${annulees} annulée(s) exclue(s)` : ""}`} lien={lien({})} />
        <Indicateur titre="Dont charges fixes enregistrées" valeur={euros(fixes)} detail="Dépenses de type « fixe » saisies sur la période" lien={lien({ type: "FIXE" })} />
        <Indicateur titre="Dont ponctuelles" valeur={euros(total - fixes)} lien={lien({ type: "PONCTUELLE" })} />
        <Indicateur titre="Non réparti" valeur={euros(nonReparti)} detail="Dépenses sans clé de répartition" />
      </div>

      <div className="grid gap-4 min-[1180px]:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
        <Card>
          <CardHeader>
            <CardTitle>Montants par poste</CardTitle>
            <CardDescription>Chaque total ouvre les lignes correspondantes.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {postes.length > 0 && <GraphiqueBarresHorizontales donnees={postes.map((p) => ({ libelle: p.libelle, montant: p.montant / 100 }))} />}
            <Table>
              <TableBody>
                {postes.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>
                      <Link className="hover:underline" href={lien({ poste: p.id })}>
                        {p.libelle}
                      </Link>
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">{p.nb} ligne(s)</TableCell>
                    <TableCell className="text-right tabular-nums font-medium">{euros(p.montant)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell colSpan={2}>Total</TableCell>
                  <TableCell className="text-right tabular-nums">{euros(total)}</TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Part de chaque participant</CardTitle>
            <CardDescription>Somme des parts figées sur les dépenses de la période.</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Participant</TableHead>
                  <TableHead className="text-right">dont fixes</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {participants.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>
                      <Link className="hover:underline" href={lien({ participant: p.id })}>
                        {p.nom}
                      </Link>
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">{euros(p.fixes)}</TableCell>
                    <TableCell className="text-right tabular-nums font-medium">{euros(p.montant)}</TableCell>
                  </TableRow>
                ))}
                <TableRow>
                  <TableCell className="text-muted-foreground">Non réparti</TableCell>
                  <TableCell />
                  <TableCell className="text-right tabular-nums">{euros(nonReparti)}</TableCell>
                </TableRow>
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell colSpan={2}>Total (= total des dépenses)</TableCell>
                  <TableCell className="text-right tabular-nums">{euros(participants.reduce((a, p) => a + p.montant, 0) + nonReparti)}</TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          </CardContent>
        </Card>
      </div>

      <Section titre="Coûts fixes paramétrés" description="Référentiel servant de base à la saisie. Affiché à titre indicatif, jamais additionné aux dépenses enregistrées (pas de double comptage).">
        <Card className="p-0 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Libellé</TableHead>
                <TableHead>Poste</TableHead>
                <TableHead>Périodicité</TableHead>
                <TableHead className="text-right">Montant</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {coutsFixes.map((c) => (
                <TableRow key={c.id}>
                  <TableCell>
                    {c.libelle} <Badge variant="outline" className="ml-2">Paramétré</Badge>
                  </TableCell>
                  <TableCell>{c.poste.libelle}</TableCell>
                  <TableCell>{PERIODICITES[c.periodicite as keyof typeof PERIODICITES]}</TableCell>
                  <TableCell className="text-right tabular-nums">{euros(c.montantCents)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell colSpan={3}>Équivalent mensuel indicatif</TableCell>
                <TableCell className="text-right tabular-nums">{euros(Math.round(mensualise))}</TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </Card>
      </Section>
    </div>
  );
}
