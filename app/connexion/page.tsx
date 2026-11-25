import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { utilisateurCourant } from "@/lib/auth/acces";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FormulaireConnexion } from "./formulaire";

export const metadata: Metadata = { title: "Connexion" };

export default async function PageConnexion() {
  const u = await utilisateurCourant();
  if (u) redirect(u.role === "VENDEUR" ? "/vendeur" : "/tableau-de-bord");
  return (
    <main className="flex min-h-svh items-center justify-center bg-muted/40 p-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center space-y-1">
          <p className="text-sm font-medium tracking-wide text-muted-foreground">Maison Maya · Atelier Amari · Parfumerie Mobile</p>
          <h1 className="text-2xl font-semibold tracking-tight">CRM centralisé</h1>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Connexion</CardTitle>
            <CardDescription>Compte nominatif fourni par l&apos;administrateur.</CardDescription>
          </CardHeader>
          <CardContent>
            <FormulaireConnexion />
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
