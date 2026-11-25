import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeftIcon } from "lucide-react";
import { exigerEspaceAdmin } from "@/lib/auth/acces";
import { prisma } from "@/lib/db";
import { euros, pourcent } from "@/lib/argent";
import { dateCourte, horodatage } from "@/lib/dates";
import { LIENS_SHOPIFY, TYPES_MOUVEMENT } from "@/lib/domaine";
import { valeurAuJour } from "@/lib/calcul/valeurAuJour";
import { coutsFormatsMaya } from "@/lib/requetes/maya";
import { EntetePage, Section } from "@/components/entete-page";
import { ArchiverReference, AjouterFormat, ModifierFormat, ModifierReference, MouvementStock, NouveauPrixTouche } from "@/components/catalogue/actions-fiche";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export default async function FicheReference({ params }: { params: Promise<{ espace: string; id: string }> }) {
  const { espace, id } = await params;
  await exigerEspaceAdmin(espace);
  // L'activité de la donnée est vérifiée : un lien direct vers une autre activité renvoie « introuvable » (ACC-01).
  const ref = await prisma.reference.findFirst({
    where: { id, activiteId: espace },
    include: { formats: { orderBy: { contenanceMl: "desc" } }, prixTouche: { orderBy: { dateEffet: "desc" }, include: { format: true } } },
  });
  if (!ref) notFound();
  const formatIds = ref.formats.map((f) => f.id);
  const [mouvements, nbVentes] = await Promise.all([
    prisma.mouvementStock.findMany({ where: { formatId: { in: formatIds } }, orderBy: { createdAt: "desc" }, take: 25, include: { format: true } }),
    prisma.ligneVente.count({ where: { referenceId: ref.id } }),
  ]);
  const coutsMaya = espace === "maya" ? await coutsFormatsMaya([ref.id]) : [];
  const maintenant = new Date();
  const coutCourant = (formatId: string) => {
    const f = valeurAuJour(ref.prixTouche.filter((p) => p.formatId === formatId), maintenant);
    if (f) return { cents: f.coutCents, source: "Format" };
    const r = valeurAuJour(ref.prixTouche.filter((p) => p.formatId === null), maintenant);
    if (r) return { cents: r.coutCents, source: "Référence" };
    return null;
  };

  return (
    <div className="space-y-8">
      <div className="space-y-3">
        <Button variant="ghost" size="sm" asChild className="-ml-2">
          <Link href={`/${espace}/catalogue`}>
            <ChevronLeftIcon /> Catalogue
          </Link>
        </Button>
        <EntetePage
          titre={ref.libelle}
          description={
            <span className="flex flex-wrap items-center gap-2">
              <span>{ref.code}</span>
              {ref.famille && <span>· {ref.famille}</span>}
              {ref.etat === "ARCHIVE" ? <Badge variant="outline">Archivée</Badge> : <Badge variant="secondary">Active</Badge>}
            </span>
          }
          actions={
            <>
              <ModifierReference espace={espace} reference={ref} />
              <ArchiverReference espace={espace} id={ref.id} etat={ref.etat} nbVentes={nbVentes} />
            </>
          }
        />
        {ref.description && <p className="text-sm text-muted-foreground max-w-3xl">{ref.description}</p>}
      </div>

      {ref.etat === "ARCHIVE" && (
        <Alert>
          <AlertTitle>Référence archivée</AlertTitle>
          <AlertDescription>Aucune nouvelle saisie n&apos;est possible. Les ventes et mouvements passés restent visibles.</AlertDescription>
        </Alert>
      )}

      <Section titre="Formats" actions={<AjouterFormat espace={espace} referenceId={ref.id} />}>
        <Card className="p-0 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Format</TableHead>
                <TableHead>SKU</TableHead>
                <TableHead className="text-right">Prix de vente</TableHead>
                {espace === "pm" && <TableHead className="text-right">Prix de touche</TableHead>}
                <TableHead className="text-right">Stock</TableHead>
                <TableHead>État</TableHead>
                <TableHead>Lien Shopify</TableHead>
                <TableHead className="w-20" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {ref.formats.map((f) => {
                const c = coutCourant(f.id);
                return (
                  <TableRow key={f.id}>
                    <TableCell className="font-medium">{f.libelle}</TableCell>
                    <TableCell className="font-mono text-xs">{f.sku}</TableCell>
                    <TableCell className="text-right tabular-nums">{euros(f.prixVenteCents)}</TableCell>
                    {espace === "pm" && (
                      <TableCell className="text-right tabular-nums">
                        {c ? (
                          <>
                            {euros(c.cents)} <span className="text-xs text-muted-foreground">({c.source})</span>
                          </>
                        ) : (
                          <Badge variant="outline" className="text-amber-700 border-amber-300">
                            Coût à compléter
                          </Badge>
                        )}
                      </TableCell>
                    )}
                    <TableCell className="text-right tabular-nums">
                      <span className={f.quantite <= 0 ? "text-destructive font-medium" : ""}>{f.quantite}</span>
                      <div className="text-xs text-muted-foreground">{horodatage(f.stockMajLe)}</div>
                    </TableCell>
                    <TableCell>{f.etat === "ACTIF" ? <Badge variant="secondary">Actif</Badge> : <Badge variant="outline">Archivé</Badge>}</TableCell>
                    <TableCell className="text-sm">
                      <Badge variant={f.lienStatut === "LIE" ? "secondary" : f.lienStatut === "NON_LIE" ? "outline" : "destructive"}>{LIENS_SHOPIFY[f.lienStatut as keyof typeof LIENS_SHOPIFY]}</Badge>
                      {f.lienMessage && <div className="text-xs text-muted-foreground mt-1">{f.lienMessage}</div>}
                      {f.dernierEchangeLe && <div className="text-xs text-muted-foreground mt-1">Dernier échange : {horodatage(f.dernierEchangeLe)}</div>}
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end">
                        <MouvementStock espace={espace} format={f} />
                        <ModifierFormat espace={espace} format={f} />
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      </Section>

      {espace === "maya" && (
        <Section titre="Coût de revient" description="Moteur repris de Maya OS : liquide × (1 + taux de perte) + conditionnement + façonnage amorti sur le lot de référence. Marge sur prix public ramené en HT (TVA 20 %).">
          <Card className="p-0 overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Format</TableHead>
                  <TableHead className="text-right">Liquide</TableHead>
                  <TableHead className="text-right">Conditionnement</TableHead>
                  <TableHead className="text-right">Façonnage</TableHead>
                  <TableHead className="text-right">Coût complet</TableHead>
                  <TableHead className="text-right">Prix HT</TableHead>
                  <TableHead className="text-right">Marge</TableHead>
                  <TableHead className="text-right">Taux de marque</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {coutsMaya.map((c) => (
                  <TableRow key={c.formatId}>
                    <TableCell>
                      {c.libelle}
                      {c.manquants.length > 0 && <div className="text-xs text-destructive">Manque : {c.manquants.join(", ")}</div>}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{euros(c.liquideCents)}</TableCell>
                    <TableCell className="text-right tabular-nums">{euros(c.conditionnementCents)}</TableCell>
                    <TableCell className="text-right tabular-nums">{euros(c.faconnageCents)}</TableCell>
                    <TableCell className="text-right tabular-nums font-medium">{euros(c.completCents)}</TableCell>
                    <TableCell className="text-right tabular-nums">{euros(c.prixHTCents)}</TableCell>
                    <TableCell className="text-right tabular-nums">{euros(c.margeCents)}</TableCell>
                    <TableCell className="text-right tabular-nums">{pourcent(c.tauxMarque)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </Section>
      )}

      {espace === "pm" && (
        <Section
          titre="Historique des prix de touche"
          description="Le coût du format est prioritaire sur celui de la référence. Une nouvelle valeur s'applique aux prochaines ventes."
          actions={<NouveauPrixTouche espace={espace} referenceId={ref.id} formats={ref.formats.map((f) => ({ id: f.id, libelle: f.libelle }))} />}
        >
          <Card className="p-0 overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Depuis le</TableHead>
                  <TableHead>Niveau</TableHead>
                  <TableHead className="text-right">Coût unitaire</TableHead>
                  <TableHead>Saisi par</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ref.prixTouche.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-muted-foreground">
                      Aucun prix de touche : les ventes de cette référence sont en « coût à compléter » et exclues des agrégats de marge.
                    </TableCell>
                  </TableRow>
                )}
                {ref.prixTouche.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>{horodatage(p.dateEffet)}</TableCell>
                    <TableCell>{p.format ? `Format ${p.format.libelle}` : "Référence"}</TableCell>
                    <TableCell className="text-right tabular-nums">{euros(p.coutCents)}</TableCell>
                    <TableCell className="text-muted-foreground">{p.auteurNom}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </Section>
      )}

      <Section titre="Derniers mouvements de stock" description="Type, quantité signée, stock après mouvement, origine, auteur et motif.">
        <Card className="p-0 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Format</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="text-right">Quantité</TableHead>
                <TableHead className="text-right">Stock après</TableHead>
                <TableHead>Origine</TableHead>
                <TableHead>Motif</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {mouvements.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-muted-foreground">
                    Aucun mouvement.
                  </TableCell>
                </TableRow>
              )}
              {mouvements.map((m) => (
                <TableRow key={m.id}>
                  <TableCell className="whitespace-nowrap">{horodatage(m.createdAt)}</TableCell>
                  <TableCell>{m.format.libelle}</TableCell>
                  <TableCell>{TYPES_MOUVEMENT[m.type as keyof typeof TYPES_MOUVEMENT] ?? m.type}</TableCell>
                  <TableCell className={`text-right tabular-nums ${m.quantite < 0 ? "text-destructive" : "text-emerald-700"}`}>{m.quantite > 0 ? `+${m.quantite}` : m.quantite}</TableCell>
                  <TableCell className="text-right tabular-nums">{m.stockApres}</TableCell>
                  <TableCell className="text-sm">
                    {m.origine} · {m.auteurNom}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {m.venteId ? (
                      <Link className="hover:underline" href={`/pm/ventes/${m.venteId}`}>
                        {m.motif}
                      </Link>
                    ) : (
                      m.motif
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
        <p className="text-xs text-muted-foreground">Référence créée le {dateCourte(ref.createdAt.toISOString().slice(0, 10))}.</p>
      </Section>
    </div>
  );
}
