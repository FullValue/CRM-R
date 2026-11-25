import { createHmac, timingSafeEqual } from "node:crypto";
import { dechiffrer } from "@/lib/chiffrement";

/**
 * Client Admin API GraphQL Shopify (SHP-02..04). Les jetons restent côté
 * serveur, chiffrés en base ; ils ne sont jamais renvoyés au navigateur.
 */

export const VERSION_API = "2025-10";

export type BoutiqueConnexion = { domaine: string | null; jetonChiffre: string | null };

export class ErreurShopify extends Error {
  constructor(
    message: string,
    public incertain = false,
  ) {
    super(message);
  }
}

export async function requeteShopify<T>(b: BoutiqueConnexion, query: string, variables: Record<string, unknown> = {}): Promise<T> {
  if (!b.domaine || !b.jetonChiffre) throw new ErreurShopify("Boutique non configurée : domaine ou jeton manquant.");
  let jeton: string;
  try {
    jeton = dechiffrer(b.jetonChiffre);
  } catch {
    throw new ErreurShopify("Jeton illisible : vérifiez la clé de chiffrement du serveur.");
  }
  let rep: Response;
  try {
    rep = await fetch(`https://${b.domaine}/admin/api/${VERSION_API}/graphql.json`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Shopify-Access-Token": jeton },
      body: JSON.stringify({ query, variables }),
      signal: AbortSignal.timeout(15000),
      cache: "no-store",
    });
  } catch {
    // Réponse inconnue : l'écriture a pu aboutir côté Shopify.
    throw new ErreurShopify("Shopify ne répond pas (délai dépassé ou réseau).", true);
  }
  if (rep.status === 401 || rep.status === 403) throw new ErreurShopify("Autorisation refusée par Shopify : jeton révoqué ou droits insuffisants.");
  if (rep.status === 429) throw new ErreurShopify("Limite de requêtes Shopify atteinte : réessayer plus tard.");
  if (!rep.ok) throw new ErreurShopify(`Shopify a répondu ${rep.status}.`, rep.status >= 500);
  const json = (await rep.json()) as { data?: T; errors?: { message: string }[] };
  if (json.errors?.length) throw new ErreurShopify(json.errors.map((e) => e.message).join(" ; "));
  return json.data as T;
}

/** Vérifie la signature HMAC d'une notification (SHP-04). */
export function signatureValide(corps: string, hmacEntete: string | null, secret: string | undefined): boolean {
  if (!secret || !hmacEntete) return false;
  const calcule = createHmac("sha256", secret).update(corps, "utf8").digest();
  const recu = Buffer.from(hmacEntete, "base64");
  return recu.length === calcule.length && timingSafeEqual(recu, calcule);
}

export const REQ_BOUTIQUE = `query { shop { name myshopifyDomain } locations(first: 20) { nodes { id name isActive } } }`;

export const REQ_VARIANTES_PAR_SKU = `query($q: String!) {
  productVariants(first: 5, query: $q) {
    nodes { id sku title price inventoryItem { id } product { title } }
  }
}`;

export const MUT_AJUSTEMENT = `mutation($input: InventoryAdjustQuantitiesInput!) {
  inventoryAdjustQuantities(input: $input) {
    userErrors { field message }
    inventoryAdjustmentGroup { id }
  }
}`;
