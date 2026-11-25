import Link from "next/link";
import type { Metadata } from "next";
import { ArrowUpRightIcon, FlaskConicalIcon, PlusIcon, ReceiptIcon, ShoppingBagIcon } from "lucide-react";
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
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CouleurEspace } from "@/components/palette-espace";
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";

export const metadata: Metadata = { title: "Vue d'ensemble" };

const ESPACES_NAV = {
  maya: { href: "/maya/catalogue", icone: FlaskConicalIcon },
  amari: { href: "/amari/finances", icone: ReceiptIcon },
  pm: { href: "/pm/tableau-de-bord", icone: ShoppingBagIcon },
};

const RACCOURCIS: Record<EspaceId, { titre: string; href: string }[]> = {
  maya: [
    { titre: "Stock", href: "/maya/stock" },
    { titre: "Coûts de revient", href: "/maya/couts" },
    { titre: "Reprise et import", href: "/maya/import" },
  ],
  amari: [
    { titre: "Dépenses", href: "/amari/depenses" },
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
  const action = u.espaces.includes("pm")
    ? { href: "/pm/ventes/nouvelle", libelle: "Nouvelle vente" }
    : u.espaces.includes("amari") ? { href: "/amari/depenses", libelle: "Voir les dépenses" }
    : null;

  return (
    <div className="space-y-8">
      <EntetePage
        titre="Vue d’ensemble"
        description={`Bonjour ${u.nom.split(" ")[0]}. Dates de référence : date de vente pour les ventes, date de rattachement pour les dépenses.`}
        actions={action && (
          <Button asChild><Link href={action.href}>{u.espaces.includes("pm") && <PlusIcon />}{action.libelle}</Link></Button>
        )}
      />
      <BarreFiltres
        periode
        selects={
          u.espaces.length > 1
            ? [{ nom: "activite", libelle: "Activité", options: [{ valeur: "tous", libelle: "Toutes mes activités" }, ...u.espaces.map((e) => ({ valeur: e, libelle: ESPACES[e].nom }))] }]
            : []
        }
      />
      <div className="crm-kpi-grid">
        <Indicateur
          titre="Chiffre d'affaires suivi"
          vedette
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
          detail={[...refsActives.map((r) => `${ESPACES[r.activiteId as EspaceId].court} ${r._count}`), ...(ruptures ? [`${ruptures} format(s) en rupture`] : [])].join(" · ")}
          definition="Références actives distinctes ; les formats d'une même référence ne gonflent pas le total."
        />
      </div>
      {sansSource.length > 0 && (
        <p className="-mt-5 text-xs text-muted-foreground">
          {pm ? `Total partiel : le chiffre d’affaires couvre la Parfumerie Mobile (terrain, WhatsApp et boutique saisis dans le CRM), montants ${reglages["vente.base_montants"]}.` : "Chiffre d’affaires indisponible pour cette sélection."}{" "}
          Aucune source de ventes validée pour {sansSource.map((e) => ESPACES[e].nom).join(" et ")} (décision D08 : import ou rapprochement des commandes Shopify).
        </p>
      )}
      {syncKO > 0 && (
        <Alert variant="destructive">
          <AlertTitle>{syncKO} ajustement(s) Shopify en échec ou incertain(s)</AlertTitle>
          <AlertDescription>
            {u.gestionnaire ? <Link href="/admin/shopify" className="underline">Ouvrir les liaisons Shopify</Link> : "Signalez l’écart à votre administrateur."}
          </AlertDescription>
        </Alert>
      )}

      <Section titre="Mes espaces">
        {u.espaces.length === 0 ? <p className="text-sm text-muted-foreground">Aucun espace attribué. Contactez votre administrateur.</p> : (
          <div className="crm-activities">
            {u.espaces.map((espace) => {
              const { href, icone: Icone } = ESPACES_NAV[espace];
              return (
                <CouleurEspace key={espace} espace={espace} className="crm-activity">
                  <Link href={href} className="crm-activity-title">
                    <i aria-hidden="true"><Icone /></i>
                    <strong>{ESPACES[espace].nom}</strong>
                    <ArrowUpRightIcon aria-hidden="true" />
                  </Link>
                  <div className="crm-activity-actions">
                    {RACCOURCIS[espace].map((r) => <Link key={r.href} href={r.href}>{r.titre}</Link>)}
                  </div>
                </CouleurEspace>
              );
            })}
          </div>
        )}
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
  );
}
