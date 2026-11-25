import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { exigerEspaceAdmin } from "@/lib/auth/acces";
import { prisma } from "@/lib/db";
import { bpVersPourcent, euros } from "@/lib/argent";
import { aujourdhui, dateCourte, resoudrePeriode } from "@/lib/dates";
import { filtreDepenses, refsDepense, type FiltresDepenses } from "@/lib/requetes/amari";
import { EntetePage } from "@/components/entete-page";
import { BarreFiltres } from "@/components/filtres";
import { AnnulerDepense, ModifierDepense, NouvelleDepense } from "@/components/amari/formulaire-depense";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

export const metadata: Metadata = { title: "Dépenses" };

export default async function Depenses({ params, searchParams }: { params: Promise<{ espace: string }>; searchParams: Promise<FiltresDepenses & { periode?: string; du?: string; au?: string }> }) {
  const { espace } = await params;
  if (espace !== "amari") notFound();
  await exigerEspaceAdmin(espace);
  const sp = await searchParams;
  const periode = resoudrePeriode(sp);
  const [depenses, refs] = await Promise.all([
    prisma.depense.findMany({ where: filtreDepenses(periode, sp), include: { poste: true, parts: true }, orderBy: [{ date: "desc" }, { createdAt: "desc" }] }),
    refsDepense(),
  ]);
  const actives = depenses.filter((d) => d.statut === "ACTIVE");
  const total = actives.reduce((a, d) => a + d.montantCents, 0);
  const auj = aujourdhui();

  return (
    <div className="space-y-6">
      <EntetePage
        titre="Dépenses · Atelier Amari"
        description="Dépenses enregistrées, fixes ou ponctuelles, avec leur répartition. Une dépense corrigée garde la trace de la modification ; une dépense annulée reste identifiable et sort des totaux actifs."
        actions={<NouvelleDepense refs={refs} aujourdhui={auj} />}
      />
      <BarreFiltres
        periode
        selects={[
          { nom: "poste", libelle: "Poste", options: [{ valeur: "tous", libelle: "Tous les postes" }, ...refs.postes.map((p) => ({ valeur: p.id, libelle: p.libelle }))] },
          { nom: "type", libelle: "Type", options: [{ valeur: "tous", libelle: "Fixes et ponctuelles" }, { valeur: "FIXE", libelle: "Charges fixes" }, { valeur: "PONCTUELLE", libelle: "Ponctuelles" }] },
          { nom: "participant", libelle: "Participant", options: [{ valeur: "tous", libelle: "Tous les participants" }, ...refs.participants.map((p) => ({ valeur: p.id, libelle: p.nom }))] },
          { nom: "statut", libelle: "Statut", defaut: "ACTIVE", options: [{ valeur: "ACTIVE", libelle: "Actives" }, { valeur: "ANNULEE", libelle: "Annulées" }, { valeur: "toutes", libelle: "Toutes" }] },
        ]}
      />
      <Card className="p-0 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Libellé</TableHead>
              <TableHead>Poste</TableHead>
              <TableHead>Type</TableHead>
              <TableHead className="text-right">Montant</TableHead>
              <TableHead>Parts</TableHead>
              <TableHead>Règlement</TableHead>
              <TableHead className="w-20" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {depenses.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="py-8 text-center text-muted-foreground">
                  Aucune dépense avec ces filtres.
                </TableCell>
              </TableRow>
            )}
            {depenses.map((d) => (
              <TableRow key={d.id} className={d.statut === "ANNULEE" ? "opacity-60" : ""}>
                <TableCell className="whitespace-nowrap">{dateCourte(d.date)}</TableCell>
                <TableCell>
                  <span className={d.statut === "ANNULEE" ? "line-through" : "font-medium"}>{d.libelle}</span>
                  {d.tiers && <div className="text-xs text-muted-foreground">{d.tiers}</div>}
                  {d.statut === "ANNULEE" && <div className="text-xs text-destructive">Annulée : {d.motifAnnulation}</div>}
                </TableCell>
                <TableCell className="text-sm">{d.poste.libelle}</TableCell>
                <TableCell>{d.type === "FIXE" ? <Badge variant="secondary">Fixe</Badge> : <Badge variant="outline">Ponctuelle</Badge>}</TableCell>
                <TableCell className="text-right tabular-nums">{euros(d.montantCents)}</TableCell>
                <TableCell className="text-sm">
                  {d.parts.length === 0 ? (
                    <span className="text-muted-foreground">—</span>
                  ) : (
                    d.parts.map((p) => (
                      <div key={p.id} className="whitespace-nowrap">
                        {p.participantNom} {euros(p.montantCents)}
                        {p.pourcentageBp !== null && <span className="text-muted-foreground"> ({bpVersPourcent(p.pourcentageBp)})</span>}
                      </div>
                    ))
                  )}
                </TableCell>
                <TableCell className="text-sm">{d.dateReglement ? dateCourte(d.dateReglement) : <span className="text-muted-foreground">—</span>}</TableCell>
                <TableCell>
                  {d.statut === "ACTIVE" && (
                    <div className="flex justify-end">
                      <ModifierDepense refs={refs} depense={d} aujourdhui={auj} />
                      <AnnulerDepense id={d.id} libelle={d.libelle} />
                    </div>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
          {actives.length > 0 && (
            <TableFooter>
              <TableRow>
                <TableCell colSpan={4}>Total actif ({actives.length} dépense(s))</TableCell>
                <TableCell className="text-right tabular-nums">{euros(total)}</TableCell>
                <TableCell colSpan={3} />
              </TableRow>
            </TableFooter>
          )}
        </Table>
      </Card>
    </div>
  );
}
