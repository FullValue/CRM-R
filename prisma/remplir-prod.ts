/**
 * Remplit UNE fois la base de production avec le jeu de démonstration :
 * catalogue Parfumerie Mobile du fichier fournisseur Vanora, et données
 * fictives (stocks, ventes, tournée, zones, trésorerie, Maya, Amari).
 *
 * Appelé par le build de production (prisma/generer-client.mjs) quand
 * CRM_DEMO_PROD n'est pas « 0 ». Ne fait rien si le repère « demo.prod » est
 * présent ou si le catalogue Parfumerie Mobile contient déjà des références
 * (données réelles saisies). Aucun compte administrateur de démonstration :
 * voir le mode production de prisma/seed.ts.
 */
import { prisma } from "../lib/db";
import { remplirDemo } from "./seed";

const REPERE = "demo.prod";

async function principal() {
  if (await prisma.reglage.findUnique({ where: { cle: REPERE } })) {
    console.log("Démonstration déjà installée en production : rien à faire.");
    return;
  }
  const references = await prisma.reference.count({ where: { activiteId: "pm" } });
  if (references > 0) {
    console.log(`Catalogue Parfumerie Mobile non vide (${references} références) : démonstration non installée.`);
    return;
  }
  console.log("Installation de la démonstration en production…");
  await remplirDemo({ production: true });
  await prisma.reglage.create({ data: { cle: REPERE, valeur: new Date().toISOString() } });
  console.log("Démonstration installée.");
}

principal()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
