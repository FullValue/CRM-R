import type { Metadata } from "next";
import { exigerUtilisateur } from "@/lib/auth/acces";
import { donneesFormulaireVente } from "@/lib/requetes/pm";
import { aujourdhui } from "@/lib/dates";
import { EntetePage } from "@/components/entete-page";
import { FormulaireVente } from "@/components/vente/formulaire-vente";

export const metadata: Metadata = { title: "Déclarer une vente" };

export default async function DeclarerVente() {
  const u = await exigerUtilisateur();
  const donnees = await donneesFormulaireVente();
  return (
    <div className="space-y-4">
      <EntetePage titre="Déclarer une vente" description="Ajoutez les articles et les coordonnées du client, puis vérifiez le total avant de confirmer." />
      <FormulaireVente donnees={donnees} aujourdhui={aujourdhui()} mode="vendeur" prixModifiable={u.prixModifiable} lienJournal="/vendeur/ventes" />
    </div>
  );
}
