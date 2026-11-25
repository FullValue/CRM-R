import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { exigerEspaceAdmin } from "@/lib/auth/acces";
import { prisma } from "@/lib/db";
import { euros } from "@/lib/argent";
import { resoudrePeriode } from "@/lib/dates";
import { filtreVentes } from "@/lib/requetes/pm";
import { EntetePage, Section } from "@/components/entete-page";
import { BarreFiltres } from "@/components/filtres";
import { CarteVentes } from "@/components/carte/carte";
import { EditerZone } from "@/components/zones";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

export const metadata: Metadata = { title: "Zones et carte" };

export default async function Zones({ params, searchParams }: { params: Promise<{ espace: string }>; searchParams: Promise<{ periode?: string; du?: string; au?: string; provenance?: string }> }) {
  const { espace } = await params;
  if (espace !== "pm") notFound();
  await exigerEspaceAdmin(espace);
  const sp = await searchParams;
  const periode = resoudrePeriode(sp);
  const where = { ...filtreVentes(periode, { provenance: sp.provenance }), statut: "CONFIRMEE" };
  const [zones, ventes] = await Promise.all([
    prisma.zone.findMany({ where: { activiteId: "pm" }, orderBy: { libelle: "asc" } }),
    prisma.vente.findMany({ where, select: { zoneId: true, zoneProvenance: true, montantCents: true } }),
  ]);
  const parZone = new Map<string, { ventes: number; caCents: number; estimees: number; renseignees: number }>();
  for (const v of ventes) {
    const k = v.zoneId ?? "aucune";
    const a = parZone.get(k) ?? { ventes: 0, caCents: 0, estimees: 0, renseignees: 0 };
    a.ventes += 1;
    a.caCents += v.montantCents;
    if (v.zoneProvenance === "PROPOSEE") a.estimees += 1;
    if (v.zoneProvenance === "SAISIE") a.renseignees += 1;
    parZone.set(k, a);
  }
  const sansZone = parZone.get("aucune") ?? { ventes: 0, caCents: 0, estimees: 0, renseignees: 0 };
  const total = { ventes: ventes.length, caCents: ventes.reduce((a, v) => a + v.montantCents, 0) };
  const points = zones.map((z) => ({ id: z.id, libelle: z.libelle, lat: z.lat, lng: z.lng, ...(parZone.get(z.id) ?? { ventes: 0, caCents: 0, estimees: 0 }) }));
  const lignes = zones.map((z) => ({ z, a: parZone.get(z.id) ?? { ventes: 0, caCents: 0, estimees: 0, renseignees: 0 } })).sort((x, y) => y.a.caCents - x.a.caCents);

  return (
    <div className="space-y-8">
      <EntetePage
        titre="Zones de vente et chalandise"
        description="Ventes confirmées par zone de vente observée (distincte de la zone de livraison). Les ventes sans zone restent comptées dans un total dédié et ne sont pas représentées sur la carte."
        actions={<EditerZone />}
      />
      <BarreFiltres
        periode
        selects={[
          {
            nom: "provenance",
            libelle: "Provenance",
            options: [
              { valeur: "tous", libelle: "Toutes provenances" },
              { valeur: "SAISIE", libelle: "Zones renseignées (choisies)" },
              { valeur: "PROPOSEE", libelle: "Zones estimées (localisation)" },
              { valeur: "NON_RENSEIGNEE", libelle: "Zone non renseignée" },
            ],
          },
        ]}
      />
      <Card className="p-2">
        <CardContent className="p-0">
          <CarteVentes points={points} />
        </CardContent>
      </Card>
      <Section titre="Récapitulatif par zone" description="Ce tableau se réconcilie avec le journal : la somme des lignes, zone non renseignée comprise, égale le total des ventes confirmées de la période.">
        <Card className="p-0 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Zone</TableHead>
                <TableHead>Ville</TableHead>
                <TableHead className="text-right">Ventes</TableHead>
                <TableHead className="text-right">dont renseignées</TableHead>
                <TableHead className="text-right">dont estimées</TableHead>
                <TableHead className="text-right">CA suivi</TableHead>
                <TableHead>État</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {lignes.map(({ z, a }) => (
                <TableRow key={z.id}>
                  <TableCell className="font-medium">
                    <Link className="hover:underline" href={`/pm/ventes?zone=${z.id}${sp.periode ? `&periode=${sp.periode}` : ""}`}>
                      {z.libelle}
                    </Link>
                  </TableCell>
                  <TableCell>{z.ville}</TableCell>
                  <TableCell className="text-right tabular-nums">{a.ventes}</TableCell>
                  <TableCell className="text-right tabular-nums">{a.renseignees}</TableCell>
                  <TableCell className="text-right tabular-nums">{a.estimees}</TableCell>
                  <TableCell className="text-right tabular-nums">{euros(a.caCents)}</TableCell>
                  <TableCell className="space-x-1">
                    {z.active ? <Badge variant="secondary">Active</Badge> : <Badge variant="outline">Inactive</Badge>}
                    {z.livraison && <Badge variant="outline">Livraison</Badge>}
                  </TableCell>
                  <TableCell>
                    <EditerZone zone={z} />
                  </TableCell>
                </TableRow>
              ))}
              <TableRow className="bg-muted/40">
                <TableCell className="font-medium">
                  <Link className="hover:underline" href={`/pm/ventes?zone=aucune${sp.periode ? `&periode=${sp.periode}` : ""}`}>
                    Zone non renseignée
                  </Link>
                </TableCell>
                <TableCell className="text-muted-foreground">Hors carte</TableCell>
                <TableCell className="text-right tabular-nums">{sansZone.ventes}</TableCell>
                <TableCell />
                <TableCell />
                <TableCell className="text-right tabular-nums">{euros(sansZone.caCents)}</TableCell>
                <TableCell colSpan={2} />
              </TableRow>
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell colSpan={2}>Total (= journal, ventes confirmées)</TableCell>
                <TableCell className="text-right tabular-nums">{total.ventes}</TableCell>
                <TableCell colSpan={2} />
                <TableCell className="text-right tabular-nums">{euros(total.caCents)}</TableCell>
                <TableCell colSpan={2} />
              </TableRow>
            </TableFooter>
          </Table>
        </Card>
      </Section>
    </div>
  );
}
