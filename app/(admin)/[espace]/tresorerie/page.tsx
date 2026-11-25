import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { exigerEspaceAdmin } from "@/lib/auth/acces";
import { prisma } from "@/lib/db";
import { euros } from "@/lib/argent";
import { aujourdhui, dateCourte, resoudrePeriode } from "@/lib/dates";
import { syntheseTresorerie, effet } from "@/lib/calcul/tresorerie";
import { TYPES_TRESORERIE } from "@/lib/domaine";
import { EntetePage, Section } from "@/components/entete-page";
import { BarreFiltres } from "@/components/filtres";
import { Indicateur } from "@/components/indicateur";
import { AnnulerMouvement, NouveauMouvement, ReglerVente } from "@/components/tresorerie";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export const metadata: Metadata = { title: "Fonds de roulement" };

export default async function Tresorerie({ params, searchParams }: { params: Promise<{ espace: string }>; searchParams: Promise<{ periode?: string; du?: string; au?: string; type?: string }> }) {
  const { espace } = await params;
  if (espace !== "pm") notFound();
  await exigerEspaceAdmin(espace);
  const sp = await searchParams;
  const periode = resoudrePeriode(sp);
  const [flux, nonReglees] = await Promise.all([
    prisma.mouvementTresorerie.findMany({ where: { activiteId: "pm" }, orderBy: [{ dateReglement: "desc" }, { createdAt: "desc" }] }),
    prisma.vente.findMany({ where: { activiteId: "pm", statut: "CONFIRMEE", regleeLe: null }, orderBy: { dateVente: "desc" }, take: 50 }),
  ]);
  const s = syntheseTresorerie(flux, periode.debut, periode.fin);
  const dansPeriode = flux.filter(
    (f) => f.dateReglement >= s.debutEffectif && f.dateReglement <= periode.fin && (!sp.type || sp.type === "tous" || f.type === sp.type),
  );
  const totalImpayes = nonReglees.reduce((a, v) => a + v.montantCents, 0);

  return (
    <div className="space-y-8">
      <EntetePage
        titre="Fonds de roulement"
        description="Modalité proposée (D07) : suivi de trésorerie opérationnelle. Solde de clôture = ouverture + encaissements − décaissements ± ajustements. Date de référence : date de règlement ; une vente non réglée n'est comptée qu'à son encaissement."
        actions={<NouveauMouvement aujourdhui={aujourdhui()} />}
      />
      <BarreFiltres periode />
      {!s.dateOuverture && (
        <Alert>
          <AlertTitle>Aucun solde d&apos;ouverture</AlertTitle>
          <AlertDescription>Saisissez un « solde d&apos;ouverture daté » pour démarrer le suivi.</AlertDescription>
        </Alert>
      )}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <Indicateur titre="Solde d'ouverture" valeur={euros(s.soldeOuvertureCents)} detail={s.dateOuverture ? `Au ${dateCourte(s.debutEffectif)} (ouverture du ${dateCourte(s.dateOuverture)})` : "—"} />
        <Indicateur titre="Encaissements" valeur={euros(s.encaissementsCents)} lien="/pm/tresorerie?type=ENCAISSEMENT" />
        <Indicateur titre="Décaissements" valeur={euros(s.decaissementsCents)} lien="/pm/tresorerie?type=DECAISSEMENT" />
        <Indicateur titre="Ajustements" valeur={euros(s.ajustementsCents)} lien="/pm/tresorerie?type=AJUSTEMENT" />
        <Indicateur titre="Solde de clôture" valeur={euros(s.soldeClotureCents)} detail={`Au ${dateCourte(periode.fin > "2900-01-01" ? aujourdhui() : periode.fin)}`} ton={s.soldeClotureCents < 0 ? "alerte" : undefined} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
        <Section
          titre="Mouvements de la période"
          actions={
            <BarreFiltres
              selects={[{ nom: "type", libelle: "Type", options: [{ valeur: "tous", libelle: "Tous les types" }, ...Object.entries(TYPES_TRESORERIE).map(([v, l]) => ({ valeur: v, libelle: l }))] }]}
            />
          }
        >
          <Card className="p-0 overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date de règlement</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Libellé</TableHead>
                  <TableHead className="text-right">Effet</TableHead>
                  <TableHead>Origine</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {dansPeriode.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-muted-foreground">
                      Aucun mouvement.
                    </TableCell>
                  </TableRow>
                )}
                {dansPeriode.map((f) => {
                  const e = effet(f);
                  return (
                    <TableRow key={f.id} className={f.annule ? "opacity-50 line-through" : ""}>
                      <TableCell>{dateCourte(f.dateReglement)}</TableCell>
                      <TableCell className="text-sm">{TYPES_TRESORERIE[f.type as keyof typeof TYPES_TRESORERIE]}</TableCell>
                      <TableCell className="text-sm">
                        {f.venteId ? (
                          <Link className="hover:underline" href={`/pm/ventes/${f.venteId}`}>
                            {f.libelle}
                          </Link>
                        ) : (
                          f.libelle
                        )}
                        {f.motif && <div className="text-xs text-muted-foreground no-underline">{f.motif}</div>}
                      </TableCell>
                      <TableCell className={`text-right tabular-nums ${e < 0 ? "text-destructive" : ""}`}>
                        {e > 0 ? "+" : ""}
                        {euros(e)}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{{ VENTE: "Vente", MANUEL: "Manuel", REMBOURSEMENT: "Remboursement" }[f.origine] ?? f.origine}</Badge>
                      </TableCell>
                      <TableCell>{!f.annule && f.origine !== "VENTE" && <AnnulerMouvement id={f.id} libelle={f.libelle} />}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Card>
        </Section>
        <Section titre="Ventes non réglées" description={`${nonReglees.length} vente(s) · ${euros(totalImpayes)} exclus du fonds de roulement jusqu'à encaissement.`}>
          <Card className="p-0 overflow-hidden">
            <Table>
              <TableBody>
                {nonReglees.length === 0 && (
                  <TableRow>
                    <TableCell className="text-muted-foreground">Toutes les ventes sont réglées.</TableCell>
                  </TableRow>
                )}
                {nonReglees.map((v) => (
                  <TableRow key={v.id}>
                    <TableCell>
                      <Link href={`/pm/ventes/${v.id}`} className="font-mono text-xs hover:underline">
                        {v.numero}
                      </Link>
                      <div className="text-xs text-muted-foreground">{dateCourte(v.dateVente)}</div>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{euros(v.montantCents)}</TableCell>
                    <TableCell className="text-right">
                      <ReglerVente venteId={v.id} dateVente={v.dateVente} aujourdhui={aujourdhui()} />
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
