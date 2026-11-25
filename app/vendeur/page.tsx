import type { Metadata } from "next";
import { exigerUtilisateur } from "@/lib/auth/acces";
import { donneesFormulaireVente } from "@/lib/requetes/pm";
import { aujourdhui } from "@/lib/dates";
import { FormulaireVente } from "@/components/vente/formulaire-vente";

export const metadata: Metadata = { title: "Déclarer une vente" };

export default async function DeclarerVente() {
  const u = await exigerUtilisateur();
  const donnees = await donneesFormulaireVente();
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Déclarer une vente</h1>
        <p className="text-sm text-muted-foreground">Choisissez l&apos;article, le client et la zone, vérifiez le total puis confirmez.</p>
      </div>
      <FormulaireVente donnees={donnees} aujourdhui={aujourdhui()} mode="vendeur" prixModifiable={u.prixModifiable} lienJournal="/vendeur/ventes" />
    </div>
  );
}
