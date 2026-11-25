import { NextResponse } from "next/server";
import { offreLivraison } from "@/lib/requetes/creneaux";

/**
 * Créneaux publics pour le bouton WhatsApp du site Shopify (LIV-01).
 * Aucune donnée personnelle : villes, dates et plages horaires uniquement.
 */
export async function GET() {
  const offre = await offreLivraison();
  return NextResponse.json(
    { villes: offre.villes, whatsapp: offre.numero ? offre.numero.replace(/[^\d]/g, "") : null },
    { headers: { "Cache-Control": "public, max-age=300", "Access-Control-Allow-Origin": "*" } },
  );
}
