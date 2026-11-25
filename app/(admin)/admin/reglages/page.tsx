import type { Metadata } from "next";
import { exigerGestionnaire } from "@/lib/auth/acces";
import { lireReglages } from "@/lib/reglages";
import { EntetePage } from "@/components/entete-page";
import { FormulaireReglages } from "@/components/admin";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

export const metadata: Metadata = { title: "Réglages métier" };

const DECISIONS = [
  ["D01", "Écrans et historiques Maison Maya à reprendre, stratégie de bascule", "Voir l'inventaire dans Reprise et import"],
  ["D02", "Boutiques, emplacements, sens d'échange et délai de synchronisation", "Liaisons Shopify"],
  ["D03", "Règle de stock insuffisant et mode dégradé", "Réglable ci-dessus"],
  ["D04", "Sens des parts, participants, clés, postes", "Atelier Amari · Postes et participants"],
  ["D05", "Vendeurs, champs requis, multi-lignes, prix modifiable", "Multi-lignes actif · prix modifiable par compte"],
  ["D06", "Prix de touche : sens, priorité, HT/TTC", "Commande prioritaire · base réglable"],
  ["D07", "Définition du fonds de roulement", "Trésorerie opérationnelle proposée"],
  ["D08", "Sources de CA, import des commandes Shopify", "Non branché : total partiel signalé"],
  ["D09", "Zones, précision, ventes sans zone", "Réglable ci-dessus"],
  ["D10", "Villes, calendriers, numéro WhatsApp", "Livraisons + réglages ci-dessus"],
  ["D11", "Volumes, hébergement, sauvegardes, support", "À fixer au cadrage"],
  ["D12", "RGPD : responsabilités, conservation, droits", "À fixer au cadrage"],
];

export default async function Reglages() {
  await exigerGestionnaire();
  const valeurs = await lireReglages();
  return (
    <div className="space-y-6">
      <EntetePage titre="Réglages métier" description="Paramètres qui traduisent les décisions de lancement. Chaque modification est journalisée avec l'état précédent." />
      <Card>
        <CardHeader>
          <CardTitle>Règles appliquées</CardTitle>
        </CardHeader>
        <CardContent>
          <FormulaireReglages valeurs={valeurs} />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Décisions de lancement</CardTitle>
          <CardDescription>Modalités proposées par défaut dans cette version, à valider avec les responsables.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableBody>
              {DECISIONS.map(([id, objet, etat]) => (
                <TableRow key={id}>
                  <TableCell className="w-14">
                    <Badge variant="outline">{id}</Badge>
                  </TableCell>
                  <TableCell>{objet}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{etat}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
