/**
 * Jeu de démonstration FICTIF (chapitre 12 : « jeu anonymisé ou fictif »).
 * Les données Maison Maya (parfums, composants, façonnage, taux de perte)
 * reprennent les valeurs de référence de Maya OS ; les prix de vente, stocks,
 * ventes, dépenses et personnes sont inventés pour la recette.
 *
 * Le catalogue Parfumerie Mobile reprend les références du fichier fournisseur
 * prisma/donnees/vanora-parfums.csv (stocks et coûts fictifs).
 *
 * Comptes de test : voir README.md (section « Comptes de démonstration »).
 * Usage : npm run db:reset   (efface la base locale puis rejoue ce fichier)
 *
 * Mode « production » (prisma/remplir-prod.ts) : la base contient déjà les
 * activités, les boutiques et le compte administrateur réel. Aucun compte
 * administrateur de démonstration n'est créé ; les vendeurs fictifs reçoivent
 * un mot de passe aléatoire jamais communiqué (connexion impossible).
 */
import { randomBytes } from "node:crypto";
import { pathToFileURL } from "node:url";
import { hacherMotDePasse } from "../lib/auth/motdepasse";
import { chargerVanora } from "./catalogue-vanora";
import { ajouterJours, aujourdhui } from "../lib/dates";
import { enregistrerVente, annulerVente, corrigerVente } from "../lib/services/ventes";
import { creerDepense, annulerDepense } from "../lib/services/depenses";
import type { UtilisateurCourant } from "../lib/auth/acces";
import { enrichirDemo } from "./demo";

import { prisma } from "../lib/db";

export const COMPTES_DEMO = [
  { email: "direction@crm.test", nom: "Camille Direction", role: "ADMIN", gestionnaire: true, espaces: ["maya", "amari", "pm"], mdp: "demo-direction-2026" },
  { email: "maya@crm.test", nom: "Responsable Maya", role: "ADMIN", gestionnaire: false, espaces: ["maya"], mdp: "demo-maya-2026" },
  { email: "amari@crm.test", nom: "Responsable Amari", role: "ADMIN", gestionnaire: false, espaces: ["amari"], mdp: "demo-amari-2026" },
  { email: "parfumerie@crm.test", nom: "Responsable Parfumerie", role: "ADMIN", gestionnaire: false, espaces: ["pm"], mdp: "demo-parfumerie-2026" },
  { email: "vendeur@crm.test", nom: "Léo Vendeur", role: "VENDEUR", gestionnaire: false, espaces: ["pm"], mdp: "demo-vendeur-2026" },
  { email: "vendeuse@crm.test", nom: "Sarah Vendeuse", role: "VENDEUR", gestionnaire: false, espaces: ["pm"], mdp: "demo-vendeuse-2026", prixModifiable: true },
] as const;

// Générateur pseudo-aléatoire déterministe : le jeu est identique à chaque seed.
let graine = 20261125;
function alea() {
  graine = (graine * 1103515245 + 12345) % 2147483648;
  return graine / 2147483648;
}
function choix<T>(t: readonly T[]): T {
  return t[Math.floor(alea() * t.length)];
}

const D0 = new Date("2026-01-01T00:00:00.000Z");

export async function remplirDemo({ production = false }: { production?: boolean } = {}) {
  const auj = aujourdhui();

  for (const a of [
    { id: "maya", nom: "Maison Maya", description: "Reprise du CRM existant : références, formats, prix, stocks et coûts de revient.", ordre: 1 },
    { id: "amari", nom: "Atelier Amari", description: "Catalogue, dépenses, coûts fixes, postes et parts.", ordre: 2 },
    { id: "pm", nom: "Parfumerie Mobile", description: "Ventes terrain, rentabilité, fonds de roulement, zones et livraisons.", ordre: 3 },
  ]) {
    await prisma.activite.upsert({ where: { id: a.id }, create: a, update: { description: a.description } });
  }

  // En production, l'administrateur réel (le plus ancien gestionnaire) tient
  // lieu de tous les comptes administrateur de démonstration.
  const adminReel = production
    ? await prisma.utilisateur.findFirst({ where: { actif: true, role: "ADMIN" }, orderBy: [{ gestionnaire: "desc" }, { createdAt: "asc" }] })
    : null;
  if (production && !adminReel) throw new Error("Aucun administrateur actif en base : créez-le avant de remplir la démonstration.");

  const users: Record<string, UtilisateurCourant> = {};
  for (const c of COMPTES_DEMO) {
    if (adminReel && c.role === "ADMIN") {
      users[c.email] = { id: adminReel.id, nom: adminReel.nom, email: adminReel.email, role: "ADMIN", gestionnaire: adminReel.gestionnaire, prixModifiable: adminReel.prixModifiable, espaces: ["maya", "amari", "pm"] };
      continue;
    }
    const existant = await prisma.utilisateur.findUnique({ where: { email: c.email } });
    const u = existant ?? await prisma.utilisateur.create({
      data: {
        email: c.email,
        nom: c.nom,
        role: c.role,
        gestionnaire: c.gestionnaire,
        prixModifiable: "prixModifiable" in c ? c.prixModifiable : false,
        motDePasseHash: await hacherMotDePasse(production ? randomBytes(24).toString("base64url") : c.mdp),
        habilitations: { create: c.espaces.map((a) => ({ activiteId: a })) },
      },
    });
    users[c.email] = { id: u.id, nom: u.nom, email: u.email, role: c.role, gestionnaire: c.gestionnaire, prixModifiable: u.prixModifiable, espaces: [...c.espaces] };
  }
  const direction = users["direction@crm.test"];

  for (const [cle, valeur] of [
    ["stock.politique", "BLOQUER"],
    ["vente.zone_obligatoire", "NON"],
    ["vente.base_montants", "TTC"],
    ["whatsapp.numero", "+33 6 00 00 00 00"],
  ]) {
    await prisma.reglage.upsert({ where: { cle }, create: { cle, valeur }, update: {} });
  }

  for (const a of ["maya", "amari", "pm"]) {
    if (await prisma.boutique.findFirst({ where: { activiteId: a } })) continue;
    await prisma.boutique.create({ data: { activiteId: a, nom: a === "maya" ? "Boutique Maison Maya" : a === "amari" ? "Boutique Atelier Amari" : "Boutique Parfumerie Mobile" } });
  }

  // ---------------------------------------------------------------- Maya
  const parfumsMaya = [
    { nom: "Réveil en Lusitanie", tri: "REV", prixL: "110.00" },
    { nom: "Noyau Blanc", tri: "NBL", prixL: "80.00" },
    { nom: "Mandoria", tri: "MAN", prixL: "80.00" },
    { nom: "Royal Safran", tri: "ROY", prixL: "70.00" },
    { nom: "Suave", tri: "SUA", prixL: "60.00" },
    { nom: "Place Vendôme", tri: "PLA", prixL: "60.00" },
  ];
  for (const p of parfumsMaya) {
    const ref = await prisma.reference.create({
      data: { activiteId: "maya", code: `MM-${p.tri}`, libelle: p.nom, famille: "Eau de parfum", prixLiquides: { create: { prixLitreHT: p.prixL, dateEffet: D0 } } },
    });
    for (const [ml, prix, qte] of [
      [50, 4900, 18 + Math.floor(alea() * 20)],
      [10, 1800, 25 + Math.floor(alea() * 30)],
    ] as const) {
      const f = await prisma.format.create({
        data: { activiteId: "maya", referenceId: ref.id, sku: `MM-${p.tri}-${ml}`, libelle: `${ml} ml`, contenanceMl: ml, prixVenteCents: prix, quantite: qte },
      });
      await prisma.mouvementStock.create({ data: { formatId: f.id, type: "IMPORT", quantite: qte, stockApres: qte, origine: "IMPORT", auteurNom: "Reprise Maya OS", motif: "Stock initial repris" } });
    }
  }
  await prisma.parametreMaya.create({ data: { cle: "taux_perte", valeur: "0.111", dateEffet: D0 } });
  await prisma.composantMaya.createMany({
    data: [
      { libelle: "Flacon + boîte", contenanceMl: 50, coutUnitHT: "1.0600", optionnel: false, dateEffet: D0 },
      { libelle: "Étiquette", contenanceMl: 50, coutUnitHT: "0.5000", optionnel: false, dateEffet: D0 },
      { libelle: "Blistage", contenanceMl: 50, coutUnitHT: "1.1800", optionnel: false, dateEffet: D0 },
      { libelle: "Sac", contenanceMl: 50, coutUnitHT: "0.8200", optionnel: true, dateEffet: D0 },
      { libelle: "Flacon + boîte", contenanceMl: 10, coutUnitHT: "0.8700", optionnel: false, dateEffet: D0 },
      { libelle: "Sac", contenanceMl: 10, coutUnitHT: "0.8200", optionnel: true, dateEffet: D0 },
    ],
  });
  await prisma.faconnageMaya.createMany({
    data: [
      { contenanceMl: 50, coutFixeSerie: "420.00", coutVarUnitHT: "0.0000", qteLotRef: 140, dateEffet: D0 },
      { contenanceMl: 10, coutFixeSerie: "420.00", coutVarUnitHT: "0.0000", qteLotRef: 140, dateEffet: D0 },
    ],
  });

  // ---------------------------------------------------------------- Amari
  const amariRefs = [
    { code: "AA-BOU", libelle: "Bougie Atelier", formats: [["180 g", 2800, 30]] },
    { code: "AA-DIF", libelle: "Diffuseur Cèdre", formats: [["100 ml", 3400, 16], ["250 ml", 5900, 8]] },
    { code: "AA-SAV", libelle: "Savon Fleur d'oranger", formats: [["120 g", 900, 60]] },
  ] as const;
  for (const r of amariRefs) {
    const ref = await prisma.reference.create({ data: { activiteId: "amari", code: r.code, libelle: r.libelle } });
    for (const [lib, prix, qte] of r.formats) {
      const f = await prisma.format.create({
        data: { activiteId: "amari", referenceId: ref.id, sku: `${r.code}-${lib.replace(/\s/g, "").toUpperCase()}`, libelle: lib, prixVenteCents: prix, quantite: qte },
      });
      await prisma.mouvementStock.create({ data: { formatId: f.id, type: "ENTREE", quantite: qte, stockApres: qte, origine: "CRM", auteurNom: "Initialisation" } });
    }
  }
  const postes: Record<string, string> = {};
  for (const l of ["Loyer atelier", "Matières premières", "Énergie", "Logiciels", "Transport", "Ancien poste"]) {
    postes[l] = (await prisma.poste.create({ data: { activiteId: "amari", libelle: l, actif: l !== "Ancien poste" } })).id;
  }
  const nadia = await prisma.participant.create({ data: { activiteId: "amari", nom: "Nadia", partDefautBp: 6000 } });
  const samir = await prisma.participant.create({ data: { activiteId: "amari", nom: "Samir", partDefautBp: 4000 } });
  const cfLoyer = await prisma.coutFixe.create({ data: { activiteId: "amari", libelle: "Loyer de l'atelier", posteId: postes["Loyer atelier"], montantCents: 12000, periodicite: "MENSUELLE" } });
  const cfLog = await prisma.coutFixe.create({ data: { activiteId: "amari", libelle: "Abonnement logiciel de caisse", posteId: postes["Logiciels"], montantCents: 2900, periodicite: "MENSUELLE" } });
  await prisma.coutFixe.create({ data: { activiteId: "amari", libelle: "Assurance multirisque", posteId: postes["Loyer atelier"], montantCents: 36000, periodicite: "ANNUELLE" } });

  const amariAdmin = users["amari@crm.test"];
  const moisCourant = auj.slice(0, 8);
  const moisPrec = ajouterJours(`${moisCourant}01`, -1).slice(0, 8);
  const parts6040 = [
    { participantId: nadia.id, valeur: 6000 },
    { participantId: samir.id, valeur: 4000 },
  ];
  for (const m of [moisPrec, moisCourant]) {
    await creerDepense(
      { date: `${m}05`, libelle: "Loyer de l'atelier", montantCents: 12000, posteId: postes["Loyer atelier"], type: "FIXE", coutFixeId: cfLoyer.id, tiers: "SCI des Pentes", note: null, dateReglement: `${m}05`, modeRepartition: "POURCENTAGE", parts: parts6040 },
      amariAdmin,
    );
    await creerDepense(
      { date: `${m}03`, libelle: "Abonnement logiciel de caisse", montantCents: 2900, posteId: postes["Logiciels"], type: "FIXE", coutFixeId: cfLog.id, tiers: null, note: null, dateReglement: `${m}03`, modeRepartition: "POURCENTAGE", parts: parts6040 },
      amariAdmin,
    );
  }
  await creerDepense(
    { date: `${moisPrec}12`, libelle: "Cire de soja (20 kg)", montantCents: 18450, posteId: postes["Matières premières"], type: "PONCTUELLE", coutFixeId: null, tiers: "Fournisseur Cires", note: null, dateReglement: `${moisPrec}15`, modeRepartition: "MONTANT", parts: [{ participantId: nadia.id, valeur: 10000 }, { participantId: samir.id, valeur: 8450 }] },
    amariAdmin,
  );
  await creerDepense(
    { date: `${moisCourant}02`, libelle: "Facture électricité", montantCents: 6780, posteId: postes["Énergie"], type: "PONCTUELLE", coutFixeId: null, tiers: "Fournisseur énergie", note: null, dateReglement: null, modeRepartition: "AUCUNE", parts: [] },
    amariAdmin,
  );
  const ponctuelle = await creerDepense(
    { date: `${moisCourant}04`, libelle: "Livraison salon artisanal", montantCents: 3000, posteId: postes["Transport"], type: "PONCTUELLE", coutFixeId: null, tiers: null, note: "Exemple de recette R06 : à annuler", dateReglement: null, modeRepartition: "AUCUNE", parts: [] },
    amariAdmin,
  );
  await annulerDepense(ponctuelle.id, "Doublon de saisie (scénario R06)", amariAdmin);

  // ---------------------------------------------------------------- Parfumerie Mobile
  // Références réelles du fichier fournisseur ; stocks et coûts fictifs.
  const formatsPM: { id: string; prix: number }[] = [];
  for (const [i, p] of chargerVanora().entries()) {
    const ref = await prisma.reference.create({ data: { activiteId: "pm", code: p.code, libelle: p.libelle, famille: p.marque, description: p.description } });
    // Prix de touche : par format pour la plupart ; PM-009 au niveau référence ; PM-010 et PM-011 sans coût (« coût à compléter »).
    if (p.code === "PM-009") await prisma.prixTouche.create({ data: { referenceId: ref.id, coutCents: Math.round(p.formats[0].prixVenteCents * 0.4), dateEffet: D0, auteurNom: "Initialisation" } });
    for (const fv of p.formats) {
      // Environ une référence sur douze en rupture, une sur huit en stock faible.
      const r = alea();
      const qte = r < 0.08 ? 0 : r < 0.2 ? 1 + Math.floor(alea() * 4) : 6 + Math.floor(alea() * 14);
      const f = await prisma.format.create({
        data: { activiteId: "pm", referenceId: ref.id, sku: `${p.code}-${fv.suffixe}`, libelle: fv.libelle, contenanceMl: fv.contenanceMl, prixVenteCents: fv.prixVenteCents, quantite: qte },
      });
      if (qte > 0) await prisma.mouvementStock.create({ data: { formatId: f.id, type: "ENTREE", quantite: qte, stockApres: qte, origine: "CRM", auteurNom: "Initialisation", motif: "Stock initial du camion" } });
      if (!["PM-009", "PM-010", "PM-011"].includes(p.code)) {
        // Coût d'achat fictif : 35 à 45 % du prix de vente.
        await prisma.prixTouche.create({ data: { referenceId: ref.id, formatId: f.id, coutCents: Math.round(fv.prixVenteCents * (0.35 + (i % 3) * 0.05)), dateEffet: D0, auteurNom: "Initialisation" } });
      }
      formatsPM.push({ id: f.id, prix: fv.prixVenteCents });
    }
  }
  // Format lié à Shopify pour illustrer l'état du lien (SHP-01) et un SKU ambigu (R16).
  const premierFormat = (code: string) => prisma.format.findFirst({ where: { activiteId: "pm", reference: { code } }, orderBy: { createdAt: "asc" } });
  const lie = await premierFormat("PM-014");
  if (lie) await prisma.format.update({ where: { id: lie.id }, data: { lienStatut: "LIE", shopifyVariantId: "gid://shopify/ProductVariant/1000000014", shopifyInventoryItemId: "gid://shopify/InventoryItem/2000000014", dernierEchangeLe: new Date() } });
  const ambigu = await premierFormat("PM-001");
  if (ambigu) await prisma.format.update({ where: { id: ambigu.id }, data: { lienStatut: "AMBIGU", lienMessage: "2 variantes partagent ce SKU : choisir manuellement." } });

  const zonesDef = [
    ["Lyon Presqu'île", "Lyon", 45.7597, 4.8357, 1.5],
    ["Lyon Part-Dieu", "Lyon", 45.7606, 4.8596, 1.5],
    ["Villeurbanne Gratte-Ciel", "Villeurbanne", 45.7686, 4.8794, 2],
    ["Vénissieux Centre", "Vénissieux", 45.6975, 4.8867, 2.5],
    ["Bron", "Bron", 45.7386, 4.9131, 2.5],
    ["Caluire-et-Cuire", "Caluire-et-Cuire", 45.7953, 4.8467, 2],
    ["Oullins", "Oullins", 45.7144, 4.8075, 2],
  ] as const;
  const zones: { id: string }[] = [];
  for (const [libelle, ville, lat, lng, rayonKm] of zonesDef) {
    const z = await prisma.zone.create({ data: { activiteId: "pm", libelle, ville, lat, lng, rayonKm, livraison: libelle !== "Lyon Part-Dieu" } });
    zones.push(z);
    const jours = ville === "Lyon" ? [3, 4, 6] : ville === "Villeurbanne" ? [2, 5] : [4];
    for (const j of jours) {
      await prisma.creneau.createMany({
        data: [
          { zoneId: z.id, jour: j, heureDebut: "10:00", heureFin: "12:00" },
          { zoneId: z.id, jour: j, heureDebut: "15:00", heureFin: "17:00" },
        ],
      });
    }
  }
  await prisma.fermetureZone.create({ data: { zoneId: zones[0].id, date: ajouterJours(auj, 8), motif: "Marché de Noël : camion indisponible" } });

  const debutHisto = ajouterJours(auj, -44);
  await prisma.mouvementTresorerie.create({ data: { activiteId: "pm", dateReglement: debutHisto, type: "OUVERTURE", montantCents: 30000, libelle: "Fonds de caisse d'ouverture", origine: "MANUEL", auteurNom: direction.nom } });

  const vendeurs = [users["vendeur@crm.test"], users["vendeuse@crm.test"]];
  const clients = ["Mme Martin", "M. Bernard", "Client de passage", "Mme Petit", "M. Durand", "Mme Leroy", "M. Moreau", "Mme Simon", "M. Laurent", "Mme Michel"];
  const ventes: string[] = [];
  for (let jour = 44; jour >= 0; jour--) {
    const date = ajouterJours(auj, -jour);
    const nb = Math.floor(alea() * 3) + (jour % 7 === 2 ? 2 : 0);
    for (let k = 0; k < nb; k++) {
      const vendeur = choix(vendeurs);
      const nbLignes = alea() < 0.25 ? 2 : 1;
      const choisis = new Set<string>();
      const lignes = [];
      while (lignes.length < nbLignes) {
        const f = choix(formatsPM);
        if (choisis.has(f.id)) continue;
        const stock = (await prisma.format.findUniqueOrThrow({ where: { id: f.id } })).quantite;
        if (stock < 2) {
          choisis.add(f.id);
          if (choisis.size >= formatsPM.length) break;
          continue;
        }
        choisis.add(f.id);
        lignes.push({ formatId: f.id, quantite: alea() < 0.8 ? 1 : 2, prixUnitaireCents: null });
      }
      if (lignes.length === 0) continue;
      const r = alea();
      const zone = r < 0.15 ? null : choix(zones);
      const regle = alea() < 0.88;
      const livraison = alea() < 0.2;
      const v = await enregistrerVente(
        {
          cleIdempotence: `seed-${date}-${k}`,
          client: choix(clients),
          dateVente: date,
          canal: livraison ? "WHATSAPP" : "TERRAIN",
          zoneId: zone?.id ?? null,
          zoneProvenance: zone ? (alea() < 0.5 ? "PROPOSEE" : "SAISIE") : "NON_RENSEIGNEE",
          lignes,
          coutCommandeCents: alea() < 0.06 ? 1500 : null,
          regleeLe: regle ? date : null,
          livraison: livraison ? { etat: jour > 3 ? "LIVREE" : "CONFIRMEE", date: ajouterJours(date, 2), creneau: "15:00-17:00", ville: "Lyon" } : null,
        },
        vendeur,
      );
      ventes.push(v.venteId);
    }
    // Dépenses de terrain : carburant et emplacement de marché.
    if (jour % 6 === 0) {
      await prisma.mouvementTresorerie.create({ data: { activiteId: "pm", dateReglement: date, type: "DECAISSEMENT", montantCents: 4500 + Math.floor(alea() * 2000), libelle: "Carburant camion", origine: "MANUEL", auteurNom: direction.nom } });
    }
    if (jour % 10 === 5) {
      await prisma.mouvementTresorerie.create({ data: { activiteId: "pm", dateReglement: date, type: "DECAISSEMENT", montantCents: 3500, libelle: "Droit de place marché", origine: "MANUEL", auteurNom: direction.nom } });
    }
  }
  // Une annulation avec retour physique, une sans, une correction (scénario R09).
  const pmAdmin = users["parfumerie@crm.test"];
  if (ventes.length > 10) {
    await annulerVente(ventes[3], { motif: "Article restitué par le client", retourStock: true, rembourse: true }, pmAdmin);
    await annulerVente(ventes[8], { motif: "Erreur de saisie : vente en double", retourStock: true, rembourse: false }, pmAdmin);
    const v = await prisma.vente.findUniqueOrThrow({ where: { id: ventes[12] }, include: { lignes: true } });
    if (v.statut !== "ANNULEE") {
      await corrigerVente(
        v.id,
        {
          motif: "Remise commerciale accordée oralement",
          client: v.client,
          commentaire: "Remise de 3 € appliquée",
          dateVente: v.dateVente,
          zoneId: v.zoneId,
          coutCommandeCents: v.coutCommandeCents,
          repercuterStock: true,
          lignes: v.lignes.map((l) => ({ id: l.id, quantite: l.quantite, prixUnitaireCents: Math.max(0, l.prixUnitaireCents - 300), coutUnitaireCents: l.coutUnitaireCents })),
        },
        pmAdmin,
      );
    }
  }
  console.log(`Seed terminé : ${ventes.length} ventes Parfumerie Mobile.`);
  await enrichirDemo();
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  remplirDemo()
    .catch((e) => {
      console.error(e);
      process.exit(1);
    })
    .finally(() => prisma.$disconnect());
}
