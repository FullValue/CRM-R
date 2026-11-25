import Link from "next/link";
import type { Metadata } from "next";
import { ArrowRightIcon } from "lucide-react";
import { exigerAdmin } from "@/lib/auth/acces";
import { prisma } from "@/lib/db";
import { euros, pourcent } from "@/lib/argent";
import { horodatage, resoudrePeriode } from "@/lib/dates";
import { ESPACES, estEspace, type EspaceId } from "@/lib/domaine";
import { agregerVentes } from "@/lib/calcul/vente";
import { filtreVentes } from "@/lib/requetes/pm";
import { filtreDepenses } from "@/lib/requetes/amari";
import { lireReglages } from "@/lib/reglages";
import { EntetePage, Section } from "@/components/entete-page";
import { BarreFiltres } from "@/components/filtres";
import { Indicateur } from "@/components/indicateur";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";

export const metadata: Metadata = { title: "Vue d'ensemble" };

const RACCOURCIS: Record<EspaceId, { titre: string; href: string }[]> = {
  maya: [
    { titre: "Catalogue", href: "/maya/catalogue" },
    { titre: "Coûts de revient", href: "/maya/couts" },
    { titre: "Reprise et import", href: "/maya/import" },
  ],
  amari: [
    { titre: "Nouvelle dépense", href: "/amari/depenses" },
    { titre: "Vue financière", href: "/amari/finances" },
    { titre: "Coûts fixes", href: "/amari/couts-fixes" },
  ],
  pm: [
    { titre: "Nouvelle vente", href: "/pm/ventes/nouvelle" },
    { titre: "Journal des ventes", href: "/pm/ventes" },
    { titre: "Fonds de roulement", href: "/pm/tresorerie" },
  ],
};

/**
 * Vue d'ensemble (PIL-01) : limitée aux espaces autorisés. Un indicateur sans
 * source affiche « Données indisponibles » et le total est signalé partiel.
 */
export default async function VueEnsemble({ searchParams }: { searchParams: Promise<{ periode?: string; du?: string; au?: string; activite?: string }> }) {
  const u = await exigerAdmin();
  const sp = await searchParams;
  const periode = resoudrePeriode(sp);
  const filtre = sp.activite && estEspace(sp.activite) && u.espaces.includes(sp.activite) ? [sp.activite] : u.espaces;
  const reglages = await lireReglages();

  const pm = filtre.includes("pm") ? agregerVentes(await prisma.vente.findMany({ where: filtreVentes(periode), select: { statut: true, montantCents: true, coutCents: true } })) : null;
  const depensesAmari = filtre.includes("amari") ? await prisma.depense.aggregate({ where: filtreDepenses(periode), _sum: { montantCents: true }, _count: true }) : null;
  const refsActives = await prisma.reference.groupBy({ by: ["activiteId"], where: { activiteId: { in: filtre }, etat: "ACTIF" }, _count: true });
  const nbRefs = refsActives.reduce((a, r) => a + r._count, 0);
  const ruptures = await prisma.format.count({ where: { activiteId: { in: filtre }, etat: "ACTIF", quantite: { lte: 0 }, reference: { etat: "ACTIF" } } });
  const changements = await prisma.journalAudit.findMany({
    where: { activiteId: { in: filtre }, NOT: { action: { startsWith: "connexion." } } },
    orderBy: { createdAt: "desc" },
    take: 10,
  });
  const syncKO = await prisma.operationSync.count({ where: { statut: { in: ["ERREUR", "INCERTAIN"] }, format: { activiteId: { in: filtre } } } });
  const sansSource = filtre.filter((e) => e !== "pm");

  return (
    <div className="space-y-8">
      <EntetePage
        titre={`Bonjour ${u.nom.split(" ")[0]}`}
        description={`Vue d'ensemble de vos espaces autorisés : ${u.espaces.map((e) => ESPACES[e].nom).join(", ")}. Date de référence des ventes : date de vente ; dépenses : date de rattachement.`}
      />
      <BarreFiltres
        periode
        selects={
          u.espaces.length > 1
            ? [{ nom: "activite", libelle: "Activité", options: [{ valeur: "tous", libelle: "Toutes mes activités" }, ...u.espaces.map((e) => ({ valeur: e, libelle: ESPACES[e].nom }))] }]
            : []
        }
      />
      {sansSource.length > 0 && (
        <Alert>
          <AlertTitle>Total partiel</AlertTitle>
          <AlertDescription>
            Aucune source de ventes n&apos;est encore validée pour {sansSource.map((e) => ESPACES[e].nom).join(" et ")} (décision D08 : import ou rapprochement des commandes Shopify). Le chiffre d&apos;affaires suivi couvre la Parfumerie
            Mobile, canaux terrain, WhatsApp et boutique saisis dans le CRM, base {reglages["vente.base_montants"]}.
          </AlertDescription>
        </Alert>
      )}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Indicateur
          titre="Chiffre d'affaires suivi"
          valeur={pm ? euros(pm.caCents) : null}
          detail={pm ? `${pm.nbVentes} vente(s) Parfumerie Mobile${sansSource.length ? " · total partiel" : ""}` : "Aucune activité avec source de ventes dans ce filtre"}
          lien={pm ? "/pm/tableau-de-bord" : undefined}
        />
        <Indicateur
          titre="Marge estimée"
          valeur={pm && pm.nbCoutConnu > 0 ? euros(pm.margeCents) : null}
          detail={pm ? `Couverture des coûts ${pourcent(pm.couverture, 0)} · taux ${pourcent(pm.tauxMarge)}` : undefined}
          definition="Somme des marges des ventes à coût connu. Les charges de structure ne sont pas déduites (formule distincte à valider)."
          lien={pm ? "/pm/rentabilite" : undefined}
        />
        <Indicateur
          titre="Dépenses Atelier Amari"
          valeur={depensesAmari ? euros(depensesAmari._sum.montantCents ?? 0) : null}
          detail={depensesAmari ? `${depensesAmari._count} dépense(s) active(s)` : undefined}
          lien={depensesAmari ? "/amari/finances" : undefined}
        />
        <Indicateur
          titre="Références actives"
          valeur={nbRefs}
          detail={refsActives.map((r) => `${ESPACES[r.activiteId as EspaceId].court} ${r._count}`).join(" · ") + (ruptures ? ` · ${ruptures} format(s) en rupture` : "")}
          definition="Références actives distinctes ; les formats d'une même référence ne gonflent pas le total."
        />
      </div>
      {syncKO > 0 && (
        <Alert variant="destructive">
          <AlertTitle>{syncKO} ajustement(s) Shopify en échec ou incertain(s)</AlertTitle>
          <AlertDescription>
            <Link href="/admin/shopify" className="underline">
              Vérifier le stock et reprendre la file
            </Link>
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-6 xl:grid-cols-[1fr_1.2fr]">
        <Section titre="Raccourcis">
          <div className="grid gap-3">
            {filtre.map((e) => (
              <Card key={e} className="gap-3 py-4">
                <CardHeader className="px-4">
                  <CardTitle className="text-base">{ESPACES[e].nom}</CardTitle>
                  <CardDescription>{e === "pm" ? "Ventes, rentabilité, zones" : e === "amari" ? "Dépenses et parts" : "Catalogue et coûts de revient"}</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-wrap gap-2 px-4">
                  {RACCOURCIS[e].map((r) => (
                    <Link key={r.href} href={r.href} className="inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-sm hover:bg-muted">
                      {r.titre} <ArrowRightIcon className="size-3.5" />
                    </Link>
                  ))}
                </CardContent>
              </Card>
            ))}
          </div>
        </Section>
        <Section titre="Derniers changements">
          <Card className="p-0 overflow-hidden">
            <Table>
              <TableBody>
                {changements.length === 0 && (
                  <TableRow>
                    <TableCell className="text-muted-foreground">Aucun changement récent.</TableCell>
                  </TableRow>
                )}
                {changements.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="whitespace-nowrap text-xs text-muted-foreground">{horodatage(c.createdAt)}</TableCell>
                    <TableCell className="text-sm">
                      {c.resume}
                      {c.motif && <div className="text-xs text-muted-foreground">Motif : {c.motif}</div>}
                    </TableCell>
                    <TableCell className="text-right">
                      {c.activiteId && estEspace(c.activiteId) && <Badge variant="outline">{ESPACES[c.activiteId].court}</Badge>}
                      <div className="text-xs text-muted-foreground">{c.auteurNom}</div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </Section>
      </div>
    </div>
  );
}
