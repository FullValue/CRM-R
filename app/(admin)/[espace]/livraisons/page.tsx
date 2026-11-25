import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ExternalLinkIcon } from "lucide-react";
import { exigerEspaceAdmin } from "@/lib/auth/acces";
import { prisma } from "@/lib/db";
import { aujourdhui, dateCourte, dateLongue } from "@/lib/dates";
import { JOURS_SEMAINE, ETATS_LIVRAISON } from "@/lib/domaine";
import { heure } from "@/lib/calcul/creneaux";
import { lireReglages } from "@/lib/reglages";
import { EntetePage, Section } from "@/components/entete-page";
import { BoutonRetirer, NouveauCreneau, NouvelleFermeture } from "@/components/zones";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export const metadata: Metadata = { title: "Livraisons" };

export default async function Livraisons({ params }: { params: Promise<{ espace: string }> }) {
  const { espace } = await params;
  if (espace !== "pm") notFound();
  await exigerEspaceAdmin(espace);
  const auj = aujourdhui();
  const [zones, aVenir, reglages] = await Promise.all([
    prisma.zone.findMany({ where: { activiteId: "pm", active: true }, include: { creneaux: { orderBy: [{ jour: "asc" }, { heureDebut: "asc" }] }, fermetures: { where: { date: { gte: auj } }, orderBy: { date: "asc" } } }, orderBy: { libelle: "asc" } }),
    prisma.vente.findMany({ where: { activiteId: "pm", statut: "CONFIRMEE", livraisonEtat: { in: ["PREFERENCE", "CONFIRMEE"] }, livraisonDate: { gte: auj } }, orderBy: { livraisonDate: "asc" }, include: { lignes: true } }),
    lireReglages(),
  ]);
  const ouvertes = zones.filter((z) => z.livraison);

  return (
    <div className="space-y-8">
      <EntetePage
        titre="Livraisons et créneaux WhatsApp"
        description="Source unique des villes, jours, horaires et exceptions proposés au visiteur du site (LIV-01). Une demande WhatsApp reste une préférence jusqu'à confirmation de l'équipe."
        actions={
          <>
            <NouveauCreneau zones={ouvertes.map((z) => ({ id: z.id, libelle: z.libelle }))} />
            <NouvelleFermeture zones={ouvertes.map((z) => ({ id: z.id, libelle: z.libelle }))} aujourdhui={auj} />
            <Button asChild>
              <Link href="/livraison" target="_blank">
                Aperçu du parcours client <ExternalLinkIcon />
              </Link>
            </Button>
          </>
        }
      />
      {!reglages["whatsapp.numero"] && (
        <Alert variant="destructive">
          <AlertTitle>Numéro WhatsApp non renseigné</AlertTitle>
          <AlertDescription>Le bouton de demande ne peut pas fonctionner. Renseignez-le dans les réglages métier (décision D10).</AlertDescription>
        </Alert>
      )}

      <Section titre="Livraisons à venir" description="Rattachées aux ventes ; la date de livraison n'influe pas sur le classement des journées, qui suit la date de vente.">
        <Card className="p-0 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Livraison</TableHead>
                <TableHead>Créneau</TableHead>
                <TableHead>Ville</TableHead>
                <TableHead>Vente</TableHead>
                <TableHead>Date de vente</TableHead>
                <TableHead>État</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {aVenir.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-muted-foreground">
                    Aucune livraison planifiée.
                  </TableCell>
                </TableRow>
              )}
              {aVenir.map((v) => (
                <TableRow key={v.id}>
                  <TableCell className="capitalize">{dateLongue(v.livraisonDate!)}</TableCell>
                  <TableCell>{v.livraisonCreneau ?? "—"}</TableCell>
                  <TableCell>{v.livraisonVille ?? "—"}</TableCell>
                  <TableCell>
                    <Link href={`/pm/ventes/${v.id}`} className="font-mono text-xs hover:underline">
                      {v.numero}
                    </Link>
                    <div className="text-xs text-muted-foreground">{v.lignes.map((l) => `${l.referenceCode} ${l.formatLibelle}`).join(", ")}</div>
                  </TableCell>
                  <TableCell>{dateCourte(v.dateVente)}</TableCell>
                  <TableCell>
                    <Badge variant={v.livraisonEtat === "CONFIRMEE" ? "secondary" : "outline"}>{ETATS_LIVRAISON[v.livraisonEtat as keyof typeof ETATS_LIVRAISON]}</Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      </Section>

      <Section titre="Calendrier par zone" description={`Numéro WhatsApp : ${reglages["whatsapp.numero"] || "non renseigné"} · délai minimal ${reglages["whatsapp.delai_jours"]} jour(s) · horizon ${reglages["whatsapp.horizon_jours"]} jours.`}>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {zones.map((z) => (
            <Card key={z.id} className={z.livraison ? "" : "opacity-60"}>
              <CardHeader>
                <CardTitle className="text-base">{z.libelle}</CardTitle>
                <CardDescription>{z.livraison ? `${z.ville} · ouverte aux demandes` : "Fermée aux demandes de livraison"}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                {JOURS_SEMAINE.map((j) => {
                  const cr = z.creneaux.filter((c) => c.jour === j.v);
                  if (cr.length === 0) return null;
                  return (
                    <div key={j.v} className="flex items-start justify-between gap-2">
                      <span className="w-20 text-muted-foreground">{j.l}</span>
                      <div className="flex flex-1 flex-wrap justify-end gap-1">
                        {cr.map((c) => (
                          <Badge key={c.id} variant="outline" className="gap-1 pr-0.5">
                            {heure(c.heureDebut)}–{heure(c.heureFin)}
                            <BoutonRetirer id={c.id} type="creneau" libelle={`le créneau ${j.l} ${c.heureDebut}`} />
                          </Badge>
                        ))}
                      </div>
                    </div>
                  );
                })}
                {z.creneaux.length === 0 && <p className="text-muted-foreground">Aucun créneau : la zone n&apos;est pas proposée au visiteur.</p>}
                {z.fermetures.length > 0 && (
                  <div className="border-t pt-2">
                    <div className="mb-1 text-xs text-muted-foreground">Exceptions</div>
                    {z.fermetures.map((f) => (
                      <div key={f.id} className="flex items-center justify-between">
                        <span>
                          {dateCourte(f.date)} {f.motif && <span className="text-muted-foreground">· {f.motif}</span>}
                        </span>
                        <BoutonRetirer id={f.id} type="fermeture" libelle={`l'exception du ${f.date}`} />
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </Section>
    </div>
  );
}
