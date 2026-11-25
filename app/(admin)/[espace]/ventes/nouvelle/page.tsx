import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { exigerEspaceAdmin } from "@/lib/auth/acces";
import { donneesFormulaireVente } from "@/lib/requetes/pm";
import { aujourdhui } from "@/lib/dates";
import { EntetePage } from "@/components/entete-page";
import { FormulaireVente } from "@/components/vente/formulaire-vente";

export const metadata: Metadata = { title: "Nouvelle vente" };

export default async function NouvelleVente({ params }: { params: Promise<{ espace: string }> }) {
  const { espace } = await params;
  if (espace !== "pm") notFound();
  const u = await exigerEspaceAdmin(espace);
  const donnees = await donneesFormulaireVente();
  return (
    <div className="space-y-6">
      <EntetePage titre="Nouvelle vente" description="Saisie par un administrateur habilité : vendeur, canal, prix et prix de touche de commande modifiables. Les ventes WhatsApp conclues hors Shopify s'enregistrent ici." />
      <FormulaireVente donnees={donnees} aujourdhui={aujourdhui()} mode="admin" prixModifiable={u.prixModifiable} lienJournal="/pm/ventes" />
    </div>
  );
}
