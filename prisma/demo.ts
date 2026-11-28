/**
 * Données de démonstration FICTIVES pour visualiser l'app mobile : moyens de
 * paiement et trajets sur les ventes, tournée des prochains jours, ventes du
 * jour, quelques ruptures et références supplémentaires.
 *
 * Additif et idempotent : ne supprime rien, et ne s'applique qu'une fois par
 * base (repère « demo.enrichi » dans les réglages).
 * Usage : npm run db:demo   (appelé aussi à la fin de npm run db:seed)
 */
import { pathToFileURL } from "node:url";
import { prisma } from "../lib/db";
import { ajouterJours, aujourdhui } from "../lib/dates";
import { enregistrerVente } from "../lib/services/ventes";
import type { UtilisateurCourant } from "../lib/auth/acces";
import type { EspaceId, Role } from "../lib/domaine";

const REPERE = "demo.enrichi";

let graine = 20261128;
function alea() {
  graine = (graine * 1103515245 + 12345) % 2147483648;
  return graine / 2147483648;
}
function choix<T>(t: readonly T[]): T {
  return t[Math.floor(alea() * t.length)];
}

const DEPARTS = ["Dépôt Lyon 7e", "Marché de la Croix-Rousse", "Camion · Place Bellecour", "Marché Saint-Antoine", "Dépôt Lyon 7e"] as const;
const ADRESSES = [
  "12 rue de la République, Lyon 2e",
  "48 cours Vitton, Lyon 6e",
  "5 place Sathonay, Lyon 1er",
  "103 avenue Félix Faure, Lyon 3e",
  "27 rue Paul Bert, Lyon 3e",
  "9 avenue Henri Barbusse, Villeurbanne",
  "61 grande rue de la Croix-Rousse, Lyon 4e",
  "14 rue Victor Hugo, Oullins",
  "2 place Jules Ferry, Lyon 6e",
  "33 rue Marietton, Lyon 9e",
  "18 avenue de Saxe, Lyon 6e",
  "7 rue des Charmettes, Villeurbanne",
] as const;
const CLIENTS = [
  "Inès Benali", "Thomas Roux", "Chloé Garnier", "Yanis Haddad", "Léa Fontaine", "Hugo Mercier",
  "Manon Lefèvre", "Karim Saïdi", "Julie Chevalier", "Nathan Girard", "Sofia Morel", "Lucas Faure",
] as const;
// Pondération : la carte et les espèces dominent sur le terrain.
const MOYENS = ["CARTE", "CARTE", "CARTE", "ESPECES", "ESPECES", "LYDIA", "VIREMENT", "CHEQUE"] as const;

async function utilisateur(email: string): Promise<UtilisateurCourant | null> {
  const u = await prisma.utilisateur.findUnique({ where: { email }, include: { habilitations: true } });
  if (!u) return null;
  return {
    id: u.id,
    nom: u.nom,
    email: u.email,
    role: u.role as Role,
    gestionnaire: u.gestionnaire,
    prixModifiable: u.prixModifiable,
    espaces: u.habilitations.map((h) => h.activiteId as EspaceId),
  };
}

export async function enrichirDemo() {
  if (await prisma.reglage.findUnique({ where: { cle: REPERE } })) {
    console.log("Démo déjà enrichie : rien à faire.");
    return;
  }
  const auj = aujourdhui();

  // 1. Paiement et trajet sur les ventes existantes.
  const ventes = await prisma.vente.findMany({ where: { activiteId: "pm", moyenPaiement: null }, select: { id: true, zoneLibelle: true, livraisonEtat: true } });
  for (const v of ventes) {
    await prisma.vente.update({
      where: { id: v.id },
      data: {
        moyenPaiement: choix(MOYENS),
        lieuDepart: choix(DEPARTS),
        lieuArrivee: v.livraisonEtat !== "AUCUNE" ? choix(ADRESSES) : (v.zoneLibelle ?? choix(ADRESSES)),
      },
    });
  }

  // 2. Références supplémentaires (Amari, Maya) pour un stock plus riche.
  const nouvelles = [
    { espace: "amari", code: "AA-FIG", libelle: "Bougie Figuier", famille: "Bougie", formats: [["180 g", 3200, 14], ["300 g", 4800, 4]] },
    { espace: "amari", code: "AA-BRU", libelle: "Brume d'oreiller Lavande", famille: "Brume", formats: [["100 ml", 2200, 0]] },
    { espace: "amari", code: "AA-POT", libelle: "Pot-pourri Agrumes", famille: "Maison", formats: [["250 g", 1900, 22]] },
    { espace: "maya", code: "MM-JAS", libelle: "Jasmin de Minuit", famille: "Eau de parfum", formats: [["50 ml", 5200, 9], ["10 ml", 1900, 3]] },
  ] as const;
  for (const r of nouvelles) {
    if (await prisma.reference.findUnique({ where: { activiteId_code: { activiteId: r.espace, code: r.code } } })) continue;
    const ref = await prisma.reference.create({ data: { activiteId: r.espace, code: r.code, libelle: r.libelle, famille: r.famille } });
    for (const [lib, prix, qte] of r.formats) {
      const f = await prisma.format.create({
        data: { activiteId: r.espace, referenceId: ref.id, sku: `${r.code}-${lib.replace(/\s/g, "").toUpperCase()}`, libelle: lib, prixVenteCents: prix, quantite: qte },
      });
      if (qte > 0) await prisma.mouvementStock.create({ data: { formatId: f.id, type: "ENTREE", quantite: qte, stockApres: qte, origine: "CRM", auteurNom: "Démo", motif: "Réception fournisseur" } });
    }
  }

  // 3. Quelques ruptures et stocks faibles, tracés comme des ajustements.
  for (const [code, cible] of [["PM-007", 0], ["PM-004", 2], ["PM-009", 3], ["MM-SUA", 0], ["AA-DIF", 3]] as const) {
    const f = await prisma.format.findFirst({ where: { reference: { code } }, orderBy: { createdAt: "desc" } });
    if (!f || f.quantite === cible) continue;
    await prisma.format.update({ where: { id: f.id }, data: { quantite: cible, stockMajLe: new Date() } });
    await prisma.mouvementStock.create({ data: { formatId: f.id, type: "AJUSTEMENT", quantite: cible - f.quantite, stockApres: cible, origine: "CRM", auteurNom: "Démo", motif: "Inventaire du camion" } });
  }

  // 4. Ventes du jour et tournée des prochains jours.
  const vendeurs = (await Promise.all(["vendeur@crm.test", "vendeuse@crm.test"].map(utilisateur))).filter((u): u is UtilisateurCourant => !!u);
  const premierAdmin = await prisma.utilisateur.findFirst({ where: { actif: true, role: "ADMIN" }, orderBy: [{ gestionnaire: "desc" }, { createdAt: "asc" }] });
  const admin = await utilisateur("parfumerie@crm.test") ?? await utilisateur("direction@crm.test") ?? (premierAdmin && await utilisateur(premierAdmin.email));
  const zones = await prisma.zone.findMany({ where: { activiteId: "pm", active: true } });
  if (vendeurs.length && admin && zones.length) {
    const plan = [
      // [jours de livraison après aujourd'hui (null = pas de livraison), créneau, état]
      [0, "10:00-12:00", "CONFIRMEE"], [0, "10:00-12:00", "CONFIRMEE"], [0, "15:00-17:00", "CONFIRMEE"], [0, "15:00-17:00", "PREFERENCE"],
      [1, "10:00-12:00", "CONFIRMEE"], [1, "15:00-17:00", "PREFERENCE"], [2, "15:00-17:00", "CONFIRMEE"], [3, "10:00-12:00", "PREFERENCE"],
      [5, "15:00-17:00", "CONFIRMEE"], [null, null, null], [null, null, null], [null, null, null], [null, null, null],
    ] as const;
    for (const [i, [dans, creneau, etat]] of plan.entries()) {
      const formats = await prisma.format.findMany({ where: { activiteId: "pm", etat: "ACTIF", quantite: { gte: 3 } }, select: { id: true } });
      if (formats.length < 2) break;
      const f1 = choix(formats);
      const f2 = choix(formats.filter((f) => f.id !== f1.id));
      const zone = choix(zones);
      const livree = dans !== null;
      await enregistrerVente(
        {
          cleIdempotence: `demo-${auj}-${i}`,
          client: CLIENTS[i % CLIENTS.length],
          dateVente: livree ? ajouterJours(auj, -Math.floor(alea() * 2)) : auj,
          canal: livree ? "WHATSAPP" : "TERRAIN",
          zoneId: zone.id,
          zoneProvenance: "SAISIE",
          lignes: alea() < 0.35 ? [{ formatId: f1.id, quantite: 1, prixUnitaireCents: null }, { formatId: f2.id, quantite: 1, prixUnitaireCents: null }] : [{ formatId: f1.id, quantite: alea() < 0.7 ? 1 : 2, prixUnitaireCents: null }],
          regleeLe: livree && etat === "PREFERENCE" ? null : auj,
          moyenPaiement: choix(MOYENS),
          lieuDepart: livree ? "Dépôt Lyon 7e" : choix(DEPARTS),
          lieuArrivee: livree ? ADRESSES[i % ADRESSES.length] : zone.libelle,
          livraison: livree ? { etat, date: ajouterJours(auj, dans), creneau, ville: zone.ville } : null,
        },
        livree ? admin : vendeurs[i % vendeurs.length],
      );
    }
  }

  await prisma.reglage.create({ data: { cle: REPERE, valeur: auj } });
  console.log(`Démo enrichie : ${ventes.length} ventes complétées, tournée et ventes du jour ajoutées.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  enrichirDemo()
    .catch((e) => {
      console.error(e);
      process.exit(1);
    })
    .finally(() => prisma.$disconnect());
}
