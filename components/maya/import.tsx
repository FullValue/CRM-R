"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { DownloadIcon, FlaskConicalIcon, UploadIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { appliquerImport, essaiImport, type ResultatEssai } from "@/app/actions/maya";
import { euros } from "@/lib/argent";
import { MODELE_CSV } from "@/lib/import";

/** Migration contrôlée (MAY-02) : essai sans écriture, relevé des écarts, puis application. */
export function AssistantImport() {
  const router = useRouter();
  const ref = useRef<HTMLFormElement>(null);
  const [essai, setEssai] = useState<ResultatEssai | null>(null);
  const [enCours, demarrer] = useTransition();

  const lancer = (mode: "essai" | "appliquer") => {
    if (!ref.current) return;
    const fd = new FormData(ref.current);
    demarrer(async () => {
      if (mode === "essai") {
        const r = await essaiImport(fd);
        if (r.ok && r.donnees) {
          setEssai(r.donnees);
          toast.success(r.message);
        } else toast.error(r.message ?? "Erreur");
      } else {
        const r = await appliquerImport(fd);
        if (r.ok) {
          toast.success(r.message);
          setEssai(null);
          ref.current?.reset();
        } else toast.error(r.message);
      }
      router.refresh();
    });
  };

  const modele = `data:text/csv;charset=utf-8,${encodeURIComponent(MODELE_CSV)}`;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Fichier à reprendre</CardTitle>
          <CardDescription>Export CSV (séparateur « ; » ou « , ») : code_reference ; libelle ; format ; sku ; prix ; quantite ; contenance_ml.</CardDescription>
        </CardHeader>
        <CardContent>
          <form ref={ref} className="space-y-4" onChange={() => setEssai(null)} onSubmit={(e) => e.preventDefault()}>
            <Field>
              <FieldLabel htmlFor="fichier">Fichier CSV</FieldLabel>
              <Input id="fichier" name="fichier" type="file" accept=".csv,text/csv,text/plain" />
            </Field>
            <Field>
              <FieldLabel htmlFor="contenu">Ou contenu collé</FieldLabel>
              <Textarea id="contenu" name="contenu" rows={5} className="font-mono text-xs" placeholder={MODELE_CSV} />
              <FieldDescription>Rien n&apos;est écrit pendant l&apos;essai. Les doublons et lignes invalides sont isolés avec leur motif.</FieldDescription>
            </Field>
          </form>
        </CardContent>
        <CardFooter className="flex flex-wrap gap-2">
          <Button onClick={() => lancer("essai")} disabled={enCours}>
            {enCours ? <Spinner /> : <FlaskConicalIcon />} Lancer l&apos;import d&apos;essai
          </Button>
          <Button variant="outline" asChild>
            <a href={modele} download="modele-reprise-maya.csv">
              <DownloadIcon /> Modèle CSV
            </a>
          </Button>
        </CardFooter>
      </Card>

      {essai && (
        <Card>
          <CardHeader>
            <CardTitle>Résultat de l&apos;essai · {essai.nomFichier}</CardTitle>
            <CardDescription>
              {essai.totalLignes} ligne(s) lue(s) · {essai.aCreer.length} prête(s) · {essai.doublons.length} doublon(s) · {essai.rejets.length} rejet(s)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-3 sm:grid-cols-4 text-sm">
              <div className="rounded-lg border p-3">
                <div className="text-muted-foreground">Références</div>
                <div className="text-xl font-semibold tabular-nums">{essai.volumes.references}</div>
              </div>
              <div className="rounded-lg border p-3">
                <div className="text-muted-foreground">Formats</div>
                <div className="text-xl font-semibold tabular-nums">{essai.volumes.formats}</div>
              </div>
              <div className="rounded-lg border p-3">
                <div className="text-muted-foreground">Unités en stock</div>
                <div className="text-xl font-semibold tabular-nums">{essai.volumes.quantite}</div>
              </div>
              <div className="rounded-lg border p-3">
                <div className="text-muted-foreground">Valeur au prix de vente</div>
                <div className="text-xl font-semibold tabular-nums">{euros(essai.volumes.valeurCents)}</div>
              </div>
            </div>
            <p className="text-sm text-muted-foreground">Confrontez ces volumes, prix et quantités par format à la source avant d&apos;appliquer.</p>
            {essai.aCreer.length > 0 && (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Ligne</TableHead>
                    <TableHead>Référence</TableHead>
                    <TableHead>Format</TableHead>
                    <TableHead>SKU</TableHead>
                    <TableHead className="text-right">Prix</TableHead>
                    <TableHead className="text-right">Quantité</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {essai.aCreer.map((l) => (
                    <TableRow key={l.numero}>
                      <TableCell className="text-muted-foreground">{l.numero}</TableCell>
                      <TableCell>
                        {l.libelle} <span className="text-xs text-muted-foreground">{l.codeReference}</span>
                      </TableCell>
                      <TableCell>{l.format}</TableCell>
                      <TableCell className="font-mono text-xs">{l.sku}</TableCell>
                      <TableCell className="text-right tabular-nums">{euros(l.prixCents)}</TableCell>
                      <TableCell className="text-right tabular-nums">{l.quantite}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
            {[...essai.doublons, ...essai.rejets].length > 0 && (
              <Alert variant="destructive">
                <AlertTitle>Relevé des lignes écartées</AlertTitle>
                <AlertDescription>
                  <ul className="mt-2 space-y-1">
                    {[...essai.doublons.map((x) => ({ ...x, genre: "Doublon" })), ...essai.rejets.map((x) => ({ ...x, genre: "Rejet" }))].map((r) => (
                      <li key={`${r.genre}-${r.numero}`}>
                        <Badge variant="outline" className="mr-2">
                          {r.genre} · ligne {r.numero}
                        </Badge>
                        {r.motif} <span className="text-muted-foreground">→ {r.resolution}</span>
                      </li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
          <CardFooter>
            <Button onClick={() => lancer("appliquer")} disabled={enCours || essai.aCreer.length === 0}>
              {enCours ? <Spinner /> : <UploadIcon />} Appliquer l&apos;import ({essai.aCreer.length} format(s))
            </Button>
          </CardFooter>
        </Card>
      )}
    </div>
  );
}
