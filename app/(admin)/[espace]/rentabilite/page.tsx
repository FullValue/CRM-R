import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { exigerEspaceAdmin } from "@/lib/auth/acces";
import { prisma } from "@/lib/db";
import { euros, pourcent } from "@/lib/argent";
import { dateCourte, resoudrePeriode } from "@/lib/dates";
import { agregerVentes } from "@/lib/calcul/vente";
import { valeurAuJour } from "@/lib/calcul/valeurAuJour";
import { filtreVentes, ventesDetaillees } from "@/lib/requetes/pm";
import { lireReglages } from "@/lib/reglages";
import { EntetePage, Section } from "@/components/entete-page";
import { BarreFiltres } from "@/components/filtres";
import { Indicateur } from "@/components/indicateur";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export const metadata: Metadata = { title: "Rentabilité" };

export default async function Rentabilite({ params, searchParams }: { params: Promise<{ espace: string }>; searchParams: Promise<{ periode?: string; du?: string; au?: string }> }) {
  const { espace } = await params;
  if (espace !== "pm") notFound();
  await exigerEspaceAdmin(espace);
  const sp = await searchParams;
  const periode = resoudrePeriode(sp);
  const [ventes, refs, reglages] = await Promise.all([
    ventesDetaillees(filtreVentes(periode)),
    prisma.reference.findMany({ where: { activiteId: "pm" }, include: { formats: { orderBy: { contenanceMl: "asc" } }, prixTouche: true }, orderBy: { code: "asc" } }),
    lireReglages(),
  ]);
  const ag = agregerVentes(ventes);
  const eligibles = ventes.filter((v) => v.statut !== "ANNULEE");
  const aCompleter = eligibles.filter((v) => v.coutSource === "A_COMPLETER");
  const parCommande = eligibles.filter((v) => v.coutSource === "COMMANDE").length;

  // Par référence : ventes à coût connu uniquement pour la marge (prorata impossible pour un coût de commande multi-références → exclu).
  type Agr = { ca: number; caConnu: number; cout: number; nb: number; nbConnu: number };
  const parRef = new Map<string, Agr>();
  for (const v of eligibles) {
    for (const l of v.lignes) {
      const a = parRef.get(l.referenceId) ?? { ca: 0, caConnu: 0, cout: 0, nb: 0, nbConnu: 0 };
      const ca = l.quantite * l.prixUnitaireCents;
      a.ca += ca;
      a.nb += 1;
      if (v.coutSource === "LIGNES" && l.coutUnitaireCents !== null) {
        a.caConnu += ca;
        a.cout += l.quantite * l.coutUnitaireCents;
        a.nbConnu += 1;
      } else if (v.coutSource === "COMMANDE" && v.lignes.length === 1 && v.coutCents !== null) {
        a.caConnu += ca;
        a.cout += v.coutCents;
        a.nbConnu += 1;
      }
      parRef.set(l.referenceId, a);
    }
  }
  const maintenant = new Date();

  return (
    <div className="space-y-8">
      <EntetePage
        titre="Rentabilité"
        description={`Prix de touche = coût d'achat imputé. Coût de commande prioritaire, sinon somme des coûts unitaires par ligne. Une vente sans coût est « à compléter » : son CA est compté, elle est exclue des marges. Base ${reglages["vente.base_montants"]} pour toutes les composantes (D06).`}
      />
      <BarreFiltres periode />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Indicateur titre="Montant des ventes" valeur={euros(ag.caCents)} detail={`${ag.nbVentes} ventes éligibles`} />
        <Indicateur titre="Coût d'achat imputé" valeur={euros(ag.coutCents)} detail={`Sur ${ag.nbCoutConnu} ventes à coût connu`} />
        <Indicateur titre="Marge brute estimée" valeur={euros(ag.margeCents)} detail={`Taux de marge ${pourcent(ag.tauxMarge)}`} definition="Marge ÷ montant des ventes à coût connu × 100." />
        <Indicateur
          titre="Couverture des coûts"
          valeur={pourcent(ag.couverture, 0)}
          detail={`CA couvert ${euros(ag.caCouvertCents)} sur ${euros(ag.caCents)}`}
          ton={ag.couverture !== null && ag.couverture < 0.8 ? "alerte" : undefined}
          definition="Ventes éligibles à coût connu ÷ ventes éligibles."
        />
      </div>
      {parCommande > 0 && (
        <p className="text-sm text-muted-foreground">
          {parCommande} vente(s) utilisent un prix de touche de commande : leur marge est comptée au total mais n&apos;est ventilée par référence que pour les ventes d&apos;un seul article.
        </p>
      )}

      {aCompleter.length > 0 && (
        <Alert>
          <AlertTitle>{aCompleter.length} vente(s) avec coût à compléter</AlertTitle>
          <AlertDescription>
            <div className="flex flex-wrap gap-2 mt-1">
              {aCompleter.slice(0, 20).map((v) => (
                <Link key={v.id} href={`/pm/ventes/${v.id}`} className="font-mono text-xs underline">
                  {v.numero}
                </Link>
              ))}
            </div>
            Renseignez le prix de touche de la référence pour les prochaines ventes, ou corrigez la vente pour lui attribuer un coût.
          </AlertDescription>
        </Alert>
      )}

      <Section titre="Marge par référence" description="Sur la période, ventes à coût connu.">
        <Card className="p-0 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Référence</TableHead>
                <TableHead className="text-right">CA</TableHead>
                <TableHead className="text-right">CA couvert</TableHead>
                <TableHead className="text-right">Coût</TableHead>
                <TableHead className="text-right">Marge</TableHead>
                <TableHead className="text-right">Taux</TableHead>
                <TableHead className="text-right">Couverture</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {refs
                .filter((r) => parRef.has(r.id))
                .map((r) => {
                  const a = parRef.get(r.id)!;
                  const marge = a.caConnu - a.cout;
                  return (
                    <TableRow key={r.id}>
                      <TableCell>
                        <Link href={`/pm/catalogue/${r.id}`} className="hover:underline font-medium">
                          {r.libelle}
                        </Link>
                        <span className="ml-2 text-xs text-muted-foreground">{r.code}</span>
                        {r.etat === "ARCHIVE" && <Badge variant="outline" className="ml-2">Archivée</Badge>}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{euros(a.ca)}</TableCell>
                      <TableCell className="text-right tabular-nums">{euros(a.caConnu)}</TableCell>
                      <TableCell className="text-right tabular-nums">{a.nbConnu ? euros(a.cout) : "—"}</TableCell>
                      <TableCell className="text-right tabular-nums">{a.nbConnu ? euros(marge) : "—"}</TableCell>
                      <TableCell className="text-right tabular-nums">{a.caConnu ? pourcent(marge / a.caConnu) : "—"}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {a.nbConnu}/{a.nb}
                      </TableCell>
                    </TableRow>
                  );
                })}
            </TableBody>
          </Table>
        </Card>
      </Section>

      <Section titre="Prix de touche courants" description="Coût applicable aux prochaines ventes, par format. Modifiable depuis la fiche de la référence.">
        <Card className="p-0 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Référence</TableHead>
                <TableHead>Format</TableHead>
                <TableHead className="text-right">Prix de vente</TableHead>
                <TableHead className="text-right">Prix de touche</TableHead>
                <TableHead>Source</TableHead>
                <TableHead className="text-right">Marge unitaire</TableHead>
                <TableHead className="text-right">Taux</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {refs
                .filter((r) => r.etat === "ACTIF")
                .flatMap((r) =>
                  r.formats
                    .filter((f) => f.etat === "ACTIF")
                    .map((f) => {
                      const pf = valeurAuJour(r.prixTouche.filter((p) => p.formatId === f.id), maintenant);
                      const pr = valeurAuJour(r.prixTouche.filter((p) => p.formatId === null), maintenant);
                      const p = pf ?? pr;
                      const marge = p ? f.prixVenteCents - p.coutCents : null;
                      return (
                        <TableRow key={f.id}>
                          <TableCell>
                            <Link href={`/pm/catalogue/${r.id}`} className="hover:underline">
                              {r.libelle}
                            </Link>
                          </TableCell>
                          <TableCell>{f.libelle}</TableCell>
                          <TableCell className="text-right tabular-nums">{euros(f.prixVenteCents)}</TableCell>
                          <TableCell className="text-right tabular-nums">{p ? euros(p.coutCents) : <Badge variant="outline" className="border-amber-300 text-amber-700">À compléter</Badge>}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">{pf ? `Format · depuis le ${dateCourte(pf.dateEffet.toISOString().slice(0, 10))}` : pr ? "Référence" : "—"}</TableCell>
                          <TableCell className="text-right tabular-nums">{marge === null ? "—" : euros(marge)}</TableCell>
                          <TableCell className="text-right tabular-nums">{marge === null || f.prixVenteCents === 0 ? "—" : pourcent(marge / f.prixVenteCents)}</TableCell>
                        </TableRow>
                      );
                    }),
                )}
            </TableBody>
          </Table>
        </Card>
      </Section>
    </div>
  );
}
