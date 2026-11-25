import { NextResponse, type NextRequest } from "next/server";
import { prisma, estDoublon } from "@/lib/db";
import { signatureValide } from "@/lib/shopify/client";
import { appliquerMouvement } from "@/lib/services/stock";
import { journaliser } from "@/lib/audit";

/**
 * Notifications Shopify (SHP-02, SHP-03, SHP-04) :
 * - signature HMAC vérifiée avec SHOPIFY_WEBHOOK_SECRET (sinon 401) ;
 * - dédoublonnage par X-Shopify-Webhook-Id ;
 * - inventory_levels/update : le stock lié est aligné sur l'emplacement validé,
 *   par un mouvement différentiel tracé (aucun second débit d'une vente) ;
 * - products/update : libellé et prix publiés des variantes liées ;
 * - orders/* : journalisé seulement, l'import des commandes relève de D08.
 */
export async function POST(req: NextRequest) {
  const corps = await req.text();
  if (!signatureValide(corps, req.headers.get("x-shopify-hmac-sha256"), process.env.SHOPIFY_WEBHOOK_SECRET)) {
    return NextResponse.json({ erreur: "Signature invalide" }, { status: 401 });
  }
  const webhookId = req.headers.get("x-shopify-webhook-id") ?? `sans-id:${Date.now()}`;
  const topic = req.headers.get("x-shopify-topic") ?? "inconnu";
  const domaine = req.headers.get("x-shopify-shop-domain") ?? "inconnu";

  try {
    await prisma.webhookRecu.create({ data: { webhookId, topic, domaine, statut: "EN_COURS" } });
  } catch (e) {
    if (estDoublon(e)) return NextResponse.json({ ok: true, doublon: true });
    throw e;
  }

  const fin = (statut: string, message: string) => prisma.webhookRecu.update({ where: { webhookId }, data: { statut, message } });

  try {
    const boutique = await prisma.boutique.findFirst({ where: { domaine } });
    if (!boutique) {
      await fin("IGNORE", "Boutique inconnue");
      return NextResponse.json({ ok: true });
    }
    const p = JSON.parse(corps) as Record<string, unknown>;

    if (topic === "inventory_levels/update") {
      const itemId = `gid://shopify/InventoryItem/${p.inventory_item_id}`;
      const locationId = `gid://shopify/Location/${p.location_id}`;
      if (boutique.emplacementId && boutique.emplacementId !== locationId) {
        await fin("IGNORE", "Emplacement non suivi");
        return NextResponse.json({ ok: true });
      }
      const f = await prisma.format.findFirst({ where: { activiteId: boutique.activiteId, shopifyInventoryItemId: itemId, lienStatut: "LIE" } });
      if (!f) {
        await fin("IGNORE", "Article non lié");
        return NextResponse.json({ ok: true });
      }
      const disponible = Number(p.available);
      const delta = disponible - f.quantite;
      if (Number.isInteger(disponible) && delta !== 0) {
        await prisma.$transaction(async (tx) => {
          await appliquerMouvement(tx, { formatId: f.id, quantite: delta, type: "SHOPIFY", origine: "SHOPIFY", motif: `Alignement sur Shopify (${disponible})`, cleUnique: `webhook:${webhookId}`, politique: "AUTORISER" });
          await tx.format.update({ where: { id: f.id }, data: { dernierEchangeLe: new Date() } });
        });
      }
      await prisma.boutique.update({ where: { id: boutique.id }, data: { derniereSyncOk: new Date() } });
      await fin("TRAITE", `${f.sku} : ${delta >= 0 ? "+" : ""}${delta}`);
    } else if (topic === "products/update") {
      const variantes = (p.variants as { admin_graphql_api_id: string; price: string; title: string }[] | undefined) ?? [];
      let n = 0;
      for (const v of variantes) {
        const f = await prisma.format.findFirst({ where: { activiteId: boutique.activiteId, shopifyVariantId: v.admin_graphql_api_id, lienStatut: "LIE" } });
        if (!f) continue;
        const prix = Math.round(Number(v.price) * 100);
        if (Number.isFinite(prix) && prix !== f.prixVenteCents) {
          await prisma.format.update({ where: { id: f.id }, data: { prixVenteCents: prix, dernierEchangeLe: new Date() } });
          await journaliser({ activiteId: boutique.activiteId, action: "shopify.prix", entite: "Format", entiteId: f.id, resume: `Prix publié de ${f.sku} aligné sur Shopify` });
          n++;
        }
      }
      await fin("TRAITE", `${n} prix aligné(s)`);
    } else {
      await fin("IGNORE", "Sujet non traité (import des commandes : décision D08)");
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    // L'erreur reste visible ; l'identifiant est libéré pour que la relance de Shopify soit traitée.
    // Les mouvements déjà appliqués portent une clé unique : une relance ne les double pas.
    await prisma.webhookRecu
      .update({ where: { webhookId }, data: { webhookId: `${webhookId}:erreur:${Date.now()}`, statut: "ERREUR", message: e instanceof Error ? e.message.slice(0, 200) : "Erreur" } })
      .catch(() => undefined);
    return NextResponse.json({ erreur: "Traitement impossible" }, { status: 503 });
  }
}
