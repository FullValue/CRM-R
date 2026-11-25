import type { Metadata } from "next";
import { offreLivraison } from "@/lib/requetes/creneaux";
import { prisma } from "@/lib/db";
import { ParcoursWhatsApp } from "@/components/parcours-whatsapp";

export const metadata: Metadata = { title: "Demande de livraison" };

/**
 * Parcours public de demande WhatsApp (LIV-01, LIV-02), tel qu'il sera
 * intégré aux fiches produits Shopify. Page de démonstration et de recette.
 */
export default async function PageLivraison({ searchParams }: { searchParams: Promise<{ ref?: string }> }) {
  const { ref } = await searchParams;
  const [offre, refs] = await Promise.all([
    offreLivraison(),
    prisma.reference.findMany({ where: { activiteId: "pm", etat: "ACTIF" }, select: { code: true, libelle: true }, orderBy: { code: "asc" } }),
  ]);
  return (
    <main className="crm-public flex min-h-svh items-start justify-center bg-muted/40 p-4 sm:items-center">
      <ParcoursWhatsApp offre={offre} references={refs} referenceInitiale={ref} />
    </main>
  );
}
