import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { PlusIcon } from "lucide-react";
import { exigerEspaceAdmin } from "@/lib/auth/acces";
import { prisma } from "@/lib/db";
import { euros } from "@/lib/argent";
import { dateCourte, resoudrePeriode } from "@/lib/dates";
import { CANAUX, ETATS_LIVRAISON, PROVENANCES_ZONE } from "@/lib/domaine";
import { agregerVentes } from "@/lib/calcul/vente";
import { filtreVentes, ventesDetaillees, type FiltresVentes } from "@/lib/requetes/pm";
import { lireReglages } from "@/lib/reglages";
import { EntetePage } from "@/components/entete-page";
import { BarreFiltres } from "@/components/filtres";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export const metadata: Metadata = { title: "Journal des ventes" };

type SP = FiltresVentes & { periode?: string; du?: string; au?: string };

export default async function JournalVentes({ params, searchParams }: { params: Promise<{ espace: string }>; searchParams: Promise<SP> }) {
  const { espace } = await params;
  if (espace !== "pm") notFound();
  await exigerEspaceAdmin(espace);
  const sp = await searchParams;
  const periode = resoudrePeriode(sp);
  const where = filtreVentes(periode, sp);
  const [ventes, tous, refs, vendeurs, zones, reglages] = await Promise.all([
    ventesDetaillees(where, 500),
    prisma.vente.findMany({ where, select: { statut: true, montantCents: true, coutCents: true, lignes: { select: { quantite: true } } } }),
    prisma.reference.findMany({ where: { activiteId: "pm" }, orderBy: { code: "asc" } }),
    prisma.utilisateur.findMany({ where: { habilitations: { some: { activiteId: "pm" } } }, orderBy: { nom: "asc" } }),
    prisma.zone.findMany({ where: { activiteId: "pm" }, orderBy: { libelle: "asc" } }),
    lireReglages(),
  ]);
  // Totaux sur l'ensemble des ventes filtrées (pas seulement les lignes affichées).
  const ag = agregerVentes(tous);
  const unites = tous.filter((v) => v.statut !== "ANNULEE").reduce((a, v) => a + v.lignes.reduce((b, l) => b + l.quantite, 0), 0);

  return (
    <div className="space-y-6">
      <EntetePage
        titre="Journal des ventes"
        description={`Date de référence : date de vente (Europe/Paris). Montants ${reglages["vente.base_montants"]}. Les totaux suivent exactement les filtres ; les ventes annulées sont listées mais exclues des totaux.`}
        actions={
          <Button asChild>
            <Link href="/pm/ventes/nouvelle">
              <PlusIcon /> Nouvelle vente
            </Link>
          </Button>
        }
      />
      <BarreFiltres
        periode
        recherche={{ placeholder: "Rechercher un client" }}
        selects={[
          { nom: "reference", libelle: "Référence", options: [{ valeur: "tous", libelle: "Toutes les références" }, ...refs.map((r) => ({ valeur: r.id, libelle: `${r.code} · ${r.libelle}${r.etat === "ARCHIVE" ? " (archivée)" : ""}` }))] },
          { nom: "vendeur", libelle: "Vendeur", options: [{ valeur: "tous", libelle: "Tous les vendeurs" }, ...vendeurs.map((v) => ({ valeur: v.id, libelle: v.nom }))] },
          { nom: "zone", libelle: "Zone", options: [{ valeur: "tous", libelle: "Toutes les zones" }, { valeur: "aucune", libelle: "Zone non renseignée" }, ...zones.map((z) => ({ valeur: z.id, libelle: z.libelle }))] },
          {
            nom: "etat",
            libelle: "État",
            options: [
              { valeur: "tous", libelle: "Tous les états" },
              { valeur: "CONFIRMEE", libelle: "Confirmées" },
              { valeur: "CORRIGEE", libelle: "Corrigées" },
              { valeur: "ANNULEE", libelle: "Annulées" },
              { valeur: "A_COMPLETER", libelle: "Coût à compléter" },
              { valeur: "NON_REGLEE", libelle: "Non réglées" },
            ],
          },
          { nom: "canal", libelle: "Canal", options: [{ valeur: "tous", libelle: "Tous les canaux" }, ...Object.entries(CANAUX).map(([v, l]) => ({ valeur: v, libelle: l }))] },
        ]}
      />
      <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
        <span>
          <span className="text-muted-foreground">Ventes : </span>
          <span className="font-medium tabular-nums">{ag.nbVentes}</span>
        </span>
        <span>
          <span className="text-muted-foreground">Unités : </span>
          <span className="font-medium tabular-nums">{unites}</span>
        </span>
        <span>
          <span className="text-muted-foreground">CA suivi : </span>
          <span className="font-medium tabular-nums">{euros(ag.caCents)}</span>
        </span>
        <span>
          <span className="text-muted-foreground">Marge estimée : </span>
          <span className="font-medium tabular-nums">{euros(ag.margeCents)}</span>
          <span className="text-muted-foreground"> (couverture {ag.couverture === null ? "—" : `${ag.nbCoutConnu}/${ag.nbVentes}`})</span>
        </span>
      </div>
      <Card className="p-0 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date de vente</TableHead>
              <TableHead>N°</TableHead>
              <TableHead>Client</TableHead>
              <TableHead>Articles</TableHead>
              <TableHead className="text-right">Qté</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead>Zone</TableHead>
              <TableHead>Vendeur · canal</TableHead>
              <TableHead>Livraison</TableHead>
              <TableHead>État</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {ventes.length === 0 && (
              <TableRow>
                <TableCell colSpan={10} className="py-8 text-center text-muted-foreground">
                  Aucune vente sur cette période avec ces filtres.
                </TableCell>
              </TableRow>
            )}
            {ventes.map((v) => (
              <TableRow key={v.id} className={v.statut === "ANNULEE" ? "opacity-60" : ""}>
                <TableCell className="whitespace-nowrap">{dateCourte(v.dateVente)}</TableCell>
                <TableCell>
                  <Link href={`/pm/ventes/${v.id}`} className="font-mono text-xs hover:underline">
                    {v.numero}
                  </Link>
                </TableCell>
                <TableCell className="max-w-40 truncate">{v.client}</TableCell>
                <TableCell className="text-sm">
                  {v.lignes.map((l) => (
                    <div key={l.id} className="whitespace-nowrap">
                      {l.referenceCode} · {l.referenceLibelle} <span className="text-muted-foreground">{l.formatLibelle} · {euros(l.prixUnitaireCents)}</span>
                    </div>
                  ))}
                </TableCell>
                <TableCell className="text-right tabular-nums">{v.lignes.reduce((a, l) => a + l.quantite, 0)}</TableCell>
                <TableCell className="text-right tabular-nums font-medium">{euros(v.montantCents)}</TableCell>
                <TableCell className="text-sm">
                  {v.zoneLibelle ?? <span className="text-muted-foreground">Non renseignée</span>}
                  {v.zoneProvenance === "PROPOSEE" && <div className="text-xs text-muted-foreground">{PROVENANCES_ZONE.PROPOSEE}</div>}
                </TableCell>
                <TableCell className="text-sm whitespace-nowrap">
                  {v.vendeur.nom}
                  <div className="text-xs text-muted-foreground">{CANAUX[v.canal as keyof typeof CANAUX] ?? v.canal}</div>
                </TableCell>
                <TableCell className="text-sm whitespace-nowrap">
                  {v.livraisonDate ? (
                    <>
                      {dateCourte(v.livraisonDate)}
                      <div className="text-xs text-muted-foreground">{ETATS_LIVRAISON[v.livraisonEtat as keyof typeof ETATS_LIVRAISON]}</div>
                    </>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell>
                  <div className="flex flex-col items-start gap-1">
                    {v.statut === "ANNULEE" ? <Badge variant="destructive">Annulée</Badge> : v.corrigee ? <Badge variant="outline">Corrigée</Badge> : <Badge variant="secondary">Confirmée</Badge>}
                    {v.statut !== "ANNULEE" && v.coutSource === "A_COMPLETER" && (
                      <Badge variant="outline" className="border-amber-300 text-amber-700">
                        Coût à compléter
                      </Badge>
                    )}
                    {v.statut !== "ANNULEE" && !v.regleeLe && <Badge variant="outline">Non réglée</Badge>}
                    {v.stockSync === "A_SYNCHRONISER" && <Badge variant="outline">Stock à synchroniser</Badge>}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
          {ventes.length > 0 && (
            <TableFooter>
              <TableRow>
                <TableCell colSpan={4}>Total des ventes éligibles (hors annulées)</TableCell>
                <TableCell className="text-right tabular-nums">{unites}</TableCell>
                <TableCell className="text-right tabular-nums">{euros(ag.caCents)}</TableCell>
                <TableCell colSpan={4} />
              </TableRow>
            </TableFooter>
          )}
        </Table>
      </Card>
      {ventes.length >= 500 && <p className="text-sm text-muted-foreground">Affichage limité aux 500 ventes les plus récentes : affinez la période.</p>}
    </div>
  );
}
