import { prisma } from "@/lib/db";
import { journaliser } from "@/lib/audit";
import type { UtilisateurCourant } from "@/lib/auth/acces";
import { ErreurShopify, MUT_AJUSTEMENT, REQ_BOUTIQUE, REQ_VARIANTES_PAR_SKU, requeteShopify } from "./client";

/** Teste les accès d'une boutique et mémorise l'état (SHP-02). */
export async function testerBoutique(boutiqueId: string, auteur: UtilisateurCourant) {
  const b = await prisma.boutique.findUniqueOrThrow({ where: { id: boutiqueId } });
  try {
    const data = await requeteShopify<{ shop: { name: string }; locations: { nodes: { id: string; name: string; isActive: boolean }[] } }>(b, REQ_BOUTIQUE);
    await prisma.boutique.update({ where: { id: b.id }, data: { statut: "ACTIVE", derniereErreur: null, derniereSyncOk: new Date() } });
    await journaliser({ activiteId: b.activiteId, auteur, action: "shopify.test", entite: "Boutique", entiteId: b.id, resume: `Connexion Shopify réussie (${data.shop.name})` });
    return { ok: true as const, message: `Connexion réussie : ${data.shop.name}. Emplacements : ${data.locations.nodes.map((l) => `${l.name} (${l.id})`).join(", ") || "aucun"}.` };
  } catch (e) {
    const message = e instanceof ErreurShopify ? e.message : "Erreur inattendue.";
    await prisma.boutique.update({ where: { id: b.id }, data: { statut: "ERREUR", derniereErreur: message } });
    await journaliser({ activiteId: b.activiteId, auteur, action: "shopify.erreur", entite: "Boutique", entiteId: b.id, resume: `Échec du test Shopify : ${message}` });
    return { ok: false as const, message };
  }
}

/**
 * Rapprochement par SKU (SHP-01) : une seule variante = liée ; plusieurs
 * variantes = « ambigu », gardé hors synchronisation jusqu'à validation.
 */
export async function rapprocherParSku(activiteId: string, auteur: UtilisateurCourant) {
  const b = await prisma.boutique.findFirst({ where: { activiteId } });
  if (!b) return { ok: false as const, message: "Aucune boutique déclarée pour cet espace." };
  const formats = await prisma.format.findMany({ where: { activiteId, etat: "ACTIF", lienStatut: { in: ["NON_LIE", "ERREUR", "AMBIGU"] } } });
  let lies = 0;
  let ambigus = 0;
  let absents = 0;
  try {
    for (const f of formats) {
      const data = await requeteShopify<{ productVariants: { nodes: { id: string; sku: string; inventoryItem: { id: string } }[] } }>(b, REQ_VARIANTES_PAR_SKU, { q: `sku:${f.sku}` });
      const exacts = data.productVariants.nodes.filter((n) => n.sku?.toUpperCase() === f.sku.toUpperCase());
      if (exacts.length === 1) {
        await prisma.format.update({ where: { id: f.id }, data: { lienStatut: "LIE", shopifyVariantId: exacts[0].id, shopifyInventoryItemId: exacts[0].inventoryItem.id, lienMessage: null, dernierEchangeLe: new Date() } });
        lies++;
      } else if (exacts.length > 1) {
        await prisma.format.update({ where: { id: f.id }, data: { lienStatut: "AMBIGU", lienMessage: `${exacts.length} variantes partagent ce SKU : choisir manuellement.`, dernierEchangeLe: new Date() } });
        ambigus++;
      } else absents++;
    }
  } catch (e) {
    const message = e instanceof ErreurShopify ? e.message : "Erreur inattendue.";
    await prisma.boutique.update({ where: { id: b.id }, data: { statut: "ERREUR", derniereErreur: message } });
    return { ok: false as const, message };
  }
  await prisma.boutique.update({ where: { id: b.id }, data: { derniereSyncOk: new Date(), derniereErreur: null, statut: "ACTIVE" } });
  await journaliser({ activiteId, auteur, action: "shopify.rapprochement", entite: "Boutique", entiteId: b.id, resume: `Rapprochement : ${lies} lié(s), ${ambigus} ambigu(s), ${absents} sans correspondance` });
  return { ok: true as const, message: `${lies} format(s) lié(s), ${ambigus} ambigu(s), ${absents} sans variante correspondante.` };
}

/**
 * Traite la file des ajustements de stock (SHP-03). Une opération « incertaine »
 * (réponse perdue) n'est jamais rejouée à l'aveugle : elle attend une
 * vérification manuelle du stock Shopify.
 */
export async function traiterFile(activiteId: string, auteur: UtilisateurCourant) {
  const b = await prisma.boutique.findFirst({ where: { activiteId } });
  const ops = await prisma.operationSync.findMany({
    where: { statut: { in: ["EN_ATTENTE", "ERREUR"] }, format: { activiteId } },
    include: { format: true },
    orderBy: { createdAt: "asc" },
    take: 50,
  });
  if (ops.length === 0) return { ok: true as const, message: "Aucun ajustement en attente." };
  if (!b || !b.droitEcriture || !b.emplacementId) {
    return { ok: false as const, message: "Écriture Shopify non autorisée ou emplacement non défini : les ajustements restent « à synchroniser »." };
  }
  let ok = 0;
  let ko = 0;
  for (const op of ops) {
    try {
      const data = await requeteShopify<{ inventoryAdjustQuantities: { userErrors: { message: string }[] } }>(b, MUT_AJUSTEMENT, {
        input: {
          reason: "correction",
          name: "available",
          referenceDocumentUri: `crm://operation/${op.cle}`,
          changes: [{ delta: op.delta, inventoryItemId: op.format.shopifyInventoryItemId, locationId: b.emplacementId }],
        },
      });
      const errs = data.inventoryAdjustQuantities.userErrors;
      if (errs.length) throw new ErreurShopify(errs.map((e) => e.message).join(" ; "));
      await prisma.operationSync.update({ where: { id: op.id }, data: { statut: "OK", tentatives: { increment: 1 }, erreur: null } });
      await prisma.format.update({ where: { id: op.formatId }, data: { dernierEchangeLe: new Date() } });
      ok++;
    } catch (e) {
      const incertain = e instanceof ErreurShopify && e.incertain;
      await prisma.operationSync.update({
        where: { id: op.id },
        data: { statut: incertain ? "INCERTAIN" : "ERREUR", tentatives: { increment: 1 }, erreur: e instanceof Error ? e.message : "Erreur" },
      });
      ko++;
    }
  }
  // Une vente est synchronisée quand toutes ses opérations sont OK.
  const ventes = [...new Set(ops.map((o) => o.venteId).filter((v): v is string => !!v))];
  for (const venteId of ventes) {
    const restantes = await prisma.operationSync.count({ where: { venteId, statut: { not: "OK" } } });
    await prisma.vente.update({ where: { id: venteId }, data: { stockSync: restantes === 0 ? "SYNCHRONISE" : "ERREUR" } });
  }
  await prisma.boutique.update({ where: { id: b.id }, data: ko === 0 ? { derniereSyncOk: new Date(), derniereErreur: null } : { derniereErreur: `${ko} ajustement(s) en échec` } });
  await journaliser({ activiteId, auteur, action: "shopify.file", entite: "Boutique", entiteId: b.id, resume: `File Shopify : ${ok} envoyé(s), ${ko} en échec` });
  return { ok: ko === 0, message: `${ok} ajustement(s) envoyé(s), ${ko} en échec.` };
}
