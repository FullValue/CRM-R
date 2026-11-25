import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { exigerEspaceAdmin } from "@/lib/auth/acces";
import { prisma } from "@/lib/db";
import { euros, pourcent } from "@/lib/argent";
import { aujourdhui, dateCourte } from "@/lib/dates";
import { valeurAuJour, valeurAuJourParGroupe } from "@/lib/calcul/valeurAuJour";
import { coutsFormatsMaya, registreMaya } from "@/lib/requetes/maya";
import { EntetePage, Section } from "@/components/entete-page";
import { Indicateur } from "@/components/indicateur";
import { NouvelleValeur } from "@/components/maya/registre";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

export const metadata: Metadata = { title: "Coûts de revient" };

const SEUIL = 0.35;

export default async function CoutsMaya({ params }: { params: Promise<{ espace: string }> }) {
  const { espace } = await params;
  if (espace !== "maya") notFound();
  await exigerEspaceAdmin(espace);
  const maintenant = new Date();
  const auj = aujourdhui();
  const [reg, lignes, parfums] = await Promise.all([
    registreMaya(),
    coutsFormatsMaya(null, maintenant),
    prisma.reference.findMany({ where: { activiteId: "maya" }, include: { prixLiquides: { orderBy: { dateEffet: "desc" } } }, orderBy: { code: "asc" } }),
  ]);
  const taux = valeurAuJour(reg.parametres.filter((p) => p.cle === "taux_perte"), maintenant);
  const contenances = [...new Set([...reg.composants.map((c) => c.contenanceMl), ...reg.faconnages.map((f) => f.contenanceMl)])].sort((a, b) => b - a);
  const valides = lignes.filter((l) => l.manquants.length === 0);
  const moyenne = (ml: number) => {
    const l = valides.filter((x) => x.contenanceMl === ml);
    return l.length ? Math.round(l.reduce((a, x) => a + x.completCents, 0) / l.length) : null;
  };
  const sousSeuil = valides.filter((l) => l.tauxMarque !== null && l.tauxMarque < SEUIL).length;
  const de = (d: Date) => dateCourte(d.toISOString().slice(0, 10));

  return (
    <div className="space-y-8">
      <EntetePage
        titre="Coûts de revient · Maison Maya"
        description="Moteur de calcul repris de Maya OS (valeurs du classeur, testées) : coût du liquide avec taux de perte, conditionnement par contenance, façonnage amorti sur le lot. Toute valeur est historisée par date d'effet ; aucun arrondi intermédiaire."
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Indicateur titre="Taux de perte appliqué" valeur={taux ? pourcent(Number(taux.valeur)) : null} detail={taux ? `Depuis le ${de(taux.dateEffet)}` : undefined} />
        {contenances.slice(0, 2).map((ml) => (
          <Indicateur key={ml} titre={`Coût complet moyen ${ml} ml`} valeur={moyenne(ml) === null ? null : euros(moyenne(ml))} detail="Repère d'affichage, jamais base de marge" />
        ))}
        <Indicateur titre={`Formats sous ${pourcent(SEUIL, 0)} de marque`} valeur={sousSeuil} ton={sousSeuil > 0 ? "alerte" : undefined} detail="Sur prix public ramené en HT" />
      </div>

      <Section titre="Coût de revient et marge par format" description="Prix publics TTC ramenés en HT (TVA 20 %). Coût complet = liquide + conditionnement + façonnage.">
        <Card className="p-0 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Format</TableHead>
                <TableHead className="text-right">Liquide</TableHead>
                <TableHead className="text-right">Cond.</TableHead>
                <TableHead className="text-right">Façonnage</TableHead>
                <TableHead className="text-right">Coût complet</TableHead>
                <TableHead className="text-right">Prix HT</TableHead>
                <TableHead className="text-right">Marge</TableHead>
                <TableHead className="text-right">Taux de marque</TableHead>
                <TableHead className="text-right">Coef.</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {lignes.map((l) => (
                <TableRow key={l.formatId}>
                  <TableCell>
                    <span className="font-medium">{l.libelle}</span> <span className="text-xs text-muted-foreground font-mono">{l.sku}</span>
                    {l.manquants.length > 0 && <div className="text-xs text-destructive">Données indisponibles : {l.manquants.join(", ")}</div>}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{euros(l.liquideCents)}</TableCell>
                  <TableCell className="text-right tabular-nums">{euros(l.conditionnementCents)}</TableCell>
                  <TableCell className="text-right tabular-nums">{euros(l.faconnageCents)}</TableCell>
                  <TableCell className="text-right tabular-nums font-medium">{euros(l.completCents)}</TableCell>
                  <TableCell className="text-right tabular-nums">{euros(l.prixHTCents)}</TableCell>
                  <TableCell className="text-right tabular-nums">{euros(l.margeCents)}</TableCell>
                  <TableCell className={`text-right tabular-nums ${l.tauxMarque !== null && l.tauxMarque < SEUIL ? "text-destructive font-medium" : ""}`}>{pourcent(l.tauxMarque)}</TableCell>
                  <TableCell className="text-right tabular-nums">{l.coefficient === null ? "—" : `${l.coefficient.toFixed(2).replace(".", ",")}×`}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      </Section>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Prix du liquide</CardTitle>
            <CardDescription>€ HT par litre, valeur applicable aujourd&apos;hui.</CardDescription>
            <CardAction>
              <NouvelleValeur genre="prix_liquide" aujourdhui={auj} parfums={parfums.map((p) => ({ id: p.id, libelle: p.libelle }))} />
            </CardAction>
          </CardHeader>
          <CardContent>
            <Table>
              <TableBody>
                {parfums.map((p) => {
                  const v = valeurAuJour(p.prixLiquides, maintenant);
                  return (
                    <TableRow key={p.id}>
                      <TableCell>
                        <Link className="hover:underline" href={`/maya/catalogue/${p.id}`}>
                          {p.libelle}
                        </Link>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{v ? `${euros(Math.round(Number(v.prixLitreHT) * 100))} /L` : <Badge variant="destructive">Manquant</Badge>}</TableCell>
                      <TableCell className="text-right text-xs text-muted-foreground">{v ? `depuis le ${de(v.dateEffet)}` : ""}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Paramètres, composants et façonnage</CardTitle>
            <CardDescription>Valeurs applicables aujourd&apos;hui par contenance.</CardDescription>
            <CardAction className="flex flex-wrap gap-2">
              <NouvelleValeur genre="taux_perte" aujourdhui={auj} />
              <NouvelleValeur genre="composant" aujourdhui={auj} />
              <NouvelleValeur genre="faconnage" aujourdhui={auj} />
            </CardAction>
          </CardHeader>
          <CardContent className="space-y-4">
            {contenances.map((ml) => {
              const comps = valeurAuJourParGroupe(reg.composants.filter((c) => c.contenanceMl === ml), maintenant, (c) => c.libelle);
              const fac = valeurAuJour(reg.faconnages.filter((f) => f.contenanceMl === ml), maintenant);
              return (
                <div key={ml} className="rounded-lg border">
                  <div className="border-b bg-muted/40 px-3 py-2 text-sm font-medium">{ml} ml</div>
                  <Table>
                    <TableBody>
                      {comps.map((c) => (
                        <TableRow key={c.id}>
                          <TableCell>
                            {c.libelle} {c.optionnel && <Badge variant="outline">Optionnel</Badge>}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">{Number(c.coutUnitHT).toFixed(4).replace(".", ",")} €</TableCell>
                          <TableCell className="text-right text-xs text-muted-foreground">depuis le {de(c.dateEffet)}</TableCell>
                        </TableRow>
                      ))}
                      <TableRow className="bg-foreground text-background hover:bg-foreground">
                        <TableCell>Façonnage (coût de série)</TableCell>
                        <TableCell className="text-right tabular-nums">{fac ? `${Number(fac.coutFixeSerie).toFixed(2).replace(".", ",")} € / ${fac.qteLotRef} + ${Number(fac.coutVarUnitHT).toFixed(2).replace(".", ",")} €` : "Manquant"}</TableCell>
                        <TableCell className="text-right text-xs opacity-70">{fac ? `depuis le ${de(fac.dateEffet)}` : ""}</TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
