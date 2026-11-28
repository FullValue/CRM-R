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
      <div className="crm-hero-app" data-titre-court="Nouvelle vente">
        <p>Bonjour {u.nom.split(" ")[0]}</p>
        <h1>Nouvelle vente</h1>
        <span className="crm-hero-sous">Articles, paiement, trajet : le total se met à jour en bas de l’écran.</span>
      </div>
      <EntetePage className="crm-entete-bureau" titre="Déclarer une vente" description="Ajoutez les articles et les coordonnées du client, puis vérifiez le total avant de confirmer." />
      <FormulaireVente donnees={donnees} aujourdhui={aujourdhui()} mode="vendeur" prixModifiable={u.prixModifiable} lienJournal="/vendeur/ventes" />
    </div>
  );
}
