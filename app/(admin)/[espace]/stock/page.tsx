import Link from "next/link";
import type { Metadata } from "next";
import { exigerEspaceAdmin } from "@/lib/auth/acces";
import { prisma } from "@/lib/db";
import { ESPACES, TYPES_MOUVEMENT, type EspaceId } from "@/lib/domaine";
import { euros, nombre } from "@/lib/argent";
import { horodatage } from "@/lib/dates";
import { EntetePage, Section } from "@/components/entete-page";
import { BarreFiltres } from "@/components/filtres";
import { Indicateur } from "@/components/indicateur";
import { MouvementStock } from "@/components/catalogue/actions-fiche";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

export const metadata: Metadata = { title: "Stock" };

export default async function PageStock({ params, searchParams }: { params: Promise<{ espace: string }>; searchParams: Promise<{ q?: string; dispo?: string; type?: string }> }) {
  const { espace } = await params;
  await exigerEspaceAdmin(espace);
  const sp = await searchParams;
  const q = (sp.q ?? "").toLowerCase();

  const formats = await prisma.format.findMany({
    where: { activiteId: espace, etat: "ACTIF", reference: { etat: "ACTIF" } },
    include: { reference: true },
    orderBy: [{ reference: { code: "asc" } }, { contenanceMl: "asc" }],
  });
  const visibles = formats.filter(
    (f) =>
      (!q || f.sku.toLowerCase().includes(q) || f.reference.libelle.toLowerCase().includes(q)) &&
      (sp.dispo === "rupture" ? f.quantite <= 0 : sp.dispo === "faible" ? f.quantite > 0 && f.quantite <= 5 : true),
  );
  const mouvements = await prisma.mouvementStock.findMany({
    where: { format: { activiteId: espace }, ...(sp.type && sp.type !== "tous" ? { type: sp.type } : {}) },
    include: { format: { include: { reference: true } } },
    orderBy: { createdAt: "desc" },
    take: 40,
  });
  const aSynchroniser = await prisma.operationSync.count({ where: { format: { activiteId: espace }, statut: { not: "OK" } } });
  const unites = formats.reduce((a, f) => a + f.quantite, 0);
  const valeur = formats.reduce((a, f) => a + Math.max(0, f.quantite) * f.prixVenteCents, 0);

  return (
    <div className="space-y-8">
      <EntetePage titre={`Stock · ${ESPACES[espace as EspaceId].nom}`} description="Quantités par format, dernière mise à jour et mouvements tracés. Une sortie au-delà du stock disponible est bloquée selon la règle D03." />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Indicateur titre="Unités en stock" valeur={nombre(unites)} detail={`${formats.length} formats actifs`} />
        <Indicateur titre="Valeur au prix de vente" valeur={euros(valeur)} definition="Σ quantité disponible × prix de vente courant, formats actifs." />
        <Indicateur titre="Formats en rupture" valeur={formats.filter((f) => f.quantite <= 0).length} ton={formats.some((f) => f.quantite <= 0) ? "alerte" : undefined} lien={`/${espace}/stock?dispo=rupture`} />
        <Indicateur titre="Ajustements Shopify en attente" valeur={aSynchroniser} detail="Stock à synchroniser" lien="/admin/shopify" />
      </div>
      <Section titre="Stock par format">
        <BarreFiltres
          recherche={{ placeholder: "Référence ou SKU" }}
          selects={[{ nom: "dispo", libelle: "Disponibilité", options: [{ valeur: "tous", libelle: "Tous" }, { valeur: "faible", libelle: "Stock faible (≤ 5)" }, { valeur: "rupture", libelle: "Rupture" }] }]}
        />
        <Card className="p-0 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Référence</TableHead>
                <TableHead>Format</TableHead>
                <TableHead>SKU</TableHead>
                <TableHead className="text-right">Disponible</TableHead>
                <TableHead>Dernière mise à jour</TableHead>
                <TableHead>Source</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {visibles.map((f) => (
                <TableRow key={f.id}>
                  <TableCell>
                    <Link className="hover:underline font-medium" href={`/${espace}/catalogue/${f.referenceId}`}>
                      {f.reference.libelle}
                    </Link>
                  </TableCell>
                  <TableCell>{f.libelle}</TableCell>
                  <TableCell className="font-mono text-xs">{f.sku}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {f.quantite <= 0 ? <Badge variant="destructive">{f.quantite}</Badge> : f.quantite <= 5 ? <Badge variant="outline">{f.quantite}</Badge> : f.quantite}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{horodatage(f.stockMajLe)}</TableCell>
                  <TableCell className="text-sm">{f.lienStatut === "LIE" ? "Shopify (emplacement validé)" : "CRM local"}</TableCell>
                  <TableCell>
                    <MouvementStock espace={espace} format={{ id: f.id, libelle: `${f.reference.libelle} ${f.libelle}`, quantite: f.quantite }} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      </Section>
      <Section
        titre="Derniers mouvements"
        actions={
          <BarreFiltres
            selects={[
              {
                nom: "type",
                libelle: "Type",
                options: [{ valeur: "tous", libelle: "Tous les types" }, ...Object.entries(TYPES_MOUVEMENT).map(([v, l]) => ({ valeur: v, libelle: l }))],
              },
            ]}
          />
        }
      >
        <Card className="p-0 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Article</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="text-right">Quantité</TableHead>
                <TableHead className="text-right">Stock après</TableHead>
                <TableHead>Auteur</TableHead>
                <TableHead>Motif</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {mouvements.map((m) => (
                <TableRow key={m.id}>
                  <TableCell className="whitespace-nowrap text-sm">{horodatage(m.createdAt)}</TableCell>
                  <TableCell className="text-sm">
                    {m.format.reference.libelle} · {m.format.libelle}
                  </TableCell>
                  <TableCell className="text-sm">{TYPES_MOUVEMENT[m.type as keyof typeof TYPES_MOUVEMENT] ?? m.type}</TableCell>
                  <TableCell className={`text-right tabular-nums ${m.quantite < 0 ? "text-destructive" : "text-emerald-700"}`}>{m.quantite > 0 ? `+${m.quantite}` : m.quantite}</TableCell>
                  <TableCell className="text-right tabular-nums">{m.stockApres}</TableCell>
                  <TableCell className="text-sm">{m.auteurNom}</TableCell>
                  <TableCell className="text-sm text-muted-foreground max-w-64 truncate">{m.motif}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      </Section>
    </div>
  );
}
