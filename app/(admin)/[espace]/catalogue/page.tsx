import Link from "next/link";
import type { Metadata } from "next";
import { ArrowUpRightIcon, PackageIcon } from "lucide-react";
import { exigerEspaceAdmin } from "@/lib/auth/acces";
import { prisma } from "@/lib/db";
import { LIENS_SHOPIFY } from "@/lib/domaine";
import { euros } from "@/lib/argent";
import { horodatage } from "@/lib/dates";
import { EntetePage } from "@/components/entete-page";
import { BarreFiltres } from "@/components/filtres";
import { NouvelleReference } from "@/components/catalogue/nouvelle-reference";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";

export const metadata: Metadata = { title: "Catalogue" };

const PREFIXES: Record<string, string> = { maya: "MM", amari: "AA", pm: "PM" };

export default async function PageCatalogue({ params, searchParams }: { params: Promise<{ espace: string }>; searchParams: Promise<{ q?: string; etat?: string; dispo?: string }> }) {
  const { espace } = await params;
  await exigerEspaceAdmin(espace);
  const sp = await searchParams;
  const etat = sp.etat === "tous" || sp.etat === "ARCHIVE" ? sp.etat : "ACTIF";
  const dispo = sp.dispo === "rupture" || sp.dispo === "disponible" ? sp.dispo : undefined;
  const q = typeof sp.q === "string" ? sp.q.trim().toLowerCase() : "";

  const refs = await prisma.reference.findMany({
    where: { activiteId: espace, ...(etat !== "tous" ? { etat } : {}) },
    include: { formats: { orderBy: { contenanceMl: "asc" } } },
    orderBy: { code: "asc" },
  });
  const filtrees = refs
    .filter((r) => !q || r.code.toLowerCase().includes(q) || r.libelle.toLowerCase().includes(q) || r.formats.some((f) => f.sku.toLowerCase().includes(q)))
    .map((r) => ({
      ...r,
      formats: r.formats.filter((f) => (dispo === "rupture" ? f.quantite <= 0 : dispo === "disponible" ? f.quantite > 0 : true) && (etat === "tous" || f.etat === etat || r.etat === "ARCHIVE")),
    }))
    .filter((r) => !dispo || r.formats.length > 0);

  return (
    <div className="space-y-6">
      <EntetePage
        titre="Catalogue"
        description="Consultez les formats, les prix, le stock et les liens Shopify. Ouvrez une référence pour la modifier. L’archivage retire un article de la saisie et conserve son historique."
        actions={<NouvelleReference espace={espace} prefixe={PREFIXES[espace] ?? "REF"} />}
      />
      <BarreFiltres
        recherche={{ placeholder: "Code, libellé ou SKU" }}
        selects={[
          { nom: "etat", libelle: "État", defaut: "ACTIF", options: [{ valeur: "ACTIF", libelle: "Actifs" }, { valeur: "ARCHIVE", libelle: "Archivés" }, { valeur: "tous", libelle: "Tous les états" }] },
          { nom: "dispo", libelle: "Disponibilité", options: [{ valeur: "tous", libelle: "Toute disponibilité" }, { valeur: "disponible", libelle: "En stock" }, { valeur: "rupture", libelle: "En rupture" }] },
        ]}
      />
      {filtrees.length === 0 ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyTitle>Aucune référence</EmptyTitle>
            <EmptyDescription>Aucune référence ne correspond à ces filtres.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <Card className="p-0 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Référence</TableHead>
                <TableHead>Formats</TableHead>
                <TableHead className="text-right">Stock total</TableHead>
                <TableHead>État</TableHead>
                <TableHead>Shopify</TableHead>
                <TableHead>Mise à jour du stock</TableHead>
                <TableHead><span className="sr-only">Ouvrir</span></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtrees.map((r) => {
                const total = r.formats.reduce((a, f) => a + f.quantite, 0);
                const lies = r.formats.filter((f) => f.lienStatut === "LIE").length;
                const alerte = r.formats.some((f) => f.lienStatut === "AMBIGU" || f.lienStatut === "ERREUR");
                const maj = r.formats.reduce<Date | null>((m, f) => (!m || f.stockMajLe > m ? f.stockMajLe : m), null);
                return (
                  <TableRow key={r.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <span className="crm-table-icon" aria-hidden="true"><PackageIcon /></span>
                        <div>
                          <Link href={`/${espace}/catalogue/${r.id}`} className="font-semibold hover:underline">{r.libelle}</Link>
                          <div className="text-xs text-muted-foreground">{r.code}{r.famille ? ` · ${r.famille}` : ""}</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {r.formats.map((f) => (
                          <Badge key={f.id} variant={f.quantite <= 0 ? "destructive" : "outline"} className="tabular-nums">
                            {f.libelle} · {euros(f.prixVenteCents)} · {f.quantite}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{total}</TableCell>
                    <TableCell>{r.etat === "ACTIF" ? <Badge variant="secondary">Actif</Badge> : <Badge variant="outline">Archivé</Badge>}</TableCell>
                    <TableCell className="text-sm">
                      {alerte ? (
                        <Badge variant="destructive">{LIENS_SHOPIFY.AMBIGU} / erreur</Badge>
                      ) : lies > 0 ? (
                        <Badge variant="secondary">
                          {lies}/{r.formats.length} lié(s)
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">Stock local</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{horodatage(maj)}</TableCell>
                    <TableCell className="text-right"><Link href={`/${espace}/catalogue/${r.id}`} className="crm-kpi-arrow inline-grid size-7" aria-label={`Ouvrir ${r.libelle}`}><ArrowUpRightIcon className="size-3.5" /></Link></TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
