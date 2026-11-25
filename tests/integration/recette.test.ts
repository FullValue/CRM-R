/**
 * Recette des fonctions métier sur base réelle (chapitre 12) :
 * R04, R05, R06, R07, R09, R10, R11, R12.
 */
import { beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { enregistrerVente, corrigerVente, annulerVente, reglerVente, type SaisieVente } from "@/lib/services/ventes";
import { creerDepense, annulerDepense, modifierDepense } from "@/lib/services/depenses";
import { appliquerMouvement } from "@/lib/services/stock";
import { syntheseTresorerie } from "@/lib/calcul/tresorerie";
import { aujourdhui } from "@/lib/dates";
import type { UtilisateurCourant } from "@/lib/auth/acces";

let admin: UtilisateurCourant;
let vendeur: UtilisateurCourant;
let formatId: string;
let formatSansCout: string;
let referenceId: string;
const auj = aujourdhui();

function vente(p: Partial<SaisieVente> & { lignes: SaisieVente["lignes"] }): SaisieVente {
  return { cleIdempotence: `cle-${Math.random().toString(36).slice(2)}-${Date.now()}`, client: "Client test", dateVente: auj, canal: "TERRAIN", zoneId: null, zoneProvenance: "NON_RENSEIGNEE", regleeLe: auj, ...p };
}

beforeAll(async () => {
  await prisma.activite.createMany({ data: [{ id: "pm", nom: "Parfumerie Mobile" }, { id: "amari", nom: "Atelier Amari" }, { id: "maya", nom: "Maison Maya" }] });
  const a = await prisma.utilisateur.create({ data: { email: "a@test", nom: "Admin", role: "ADMIN", motDePasseHash: "x", habilitations: { create: [{ activiteId: "pm" }, { activiteId: "amari" }] } } });
  const v = await prisma.utilisateur.create({ data: { email: "v@test", nom: "Vendeur", role: "VENDEUR", motDePasseHash: "x", habilitations: { create: [{ activiteId: "pm" }] } } });
  admin = { id: a.id, nom: a.nom, email: a.email, role: "ADMIN", gestionnaire: true, prixModifiable: true, espaces: ["pm", "amari"] };
  vendeur = { id: v.id, nom: v.nom, email: v.email, role: "VENDEUR", gestionnaire: false, prixModifiable: false, espaces: ["pm"] };
  const ref = await prisma.reference.create({ data: { activiteId: "pm", code: "PM-T1", libelle: "Parfum test" } });
  referenceId = ref.id;
  const f = await prisma.format.create({ data: { activiteId: "pm", referenceId: ref.id, sku: "PM-T1-50", libelle: "50 ml", prixVenteCents: 4000, quantite: 10 } });
  formatId = f.id;
  await prisma.prixTouche.create({ data: { referenceId: ref.id, formatId: f.id, coutCents: 1800, dateEffet: new Date(Date.now() - 1000) } });
  const ref2 = await prisma.reference.create({ data: { activiteId: "pm", code: "PM-T2", libelle: "Sans coût" } });
  formatSansCout = (await prisma.format.create({ data: { activiteId: "pm", referenceId: ref2.id, sku: "PM-T2-10", libelle: "10 ml", prixVenteCents: 1500, quantite: 5 } })).id;
});

const stock = async (id = formatId) => (await prisma.format.findUniqueOrThrow({ where: { id } })).quantite;

describe("R10 · rentabilité figée à la validation", () => {
  it("2 × 40 € à 18 € de coût → 80 €, coût 36 €, marge 44 €", async () => {
    const r = await enregistrerVente(vente({ lignes: [{ formatId, quantite: 2, prixUnitaireCents: null }] }), vendeur);
    const v = await prisma.vente.findUniqueOrThrow({ where: { id: r.venteId } });
    expect(v.montantCents).toBe(8000);
    expect(v.coutCents).toBe(3600);
    expect(v.montantCents - v.coutCents!).toBe(4400);
  });

  it("prix de touche de commande 30 € → marge 50 €", async () => {
    const r = await enregistrerVente(vente({ lignes: [{ formatId, quantite: 2, prixUnitaireCents: null }], coutCommandeCents: 3000 }), admin);
    const v = await prisma.vente.findUniqueOrThrow({ where: { id: r.venteId } });
    expect(v.coutSource).toBe("COMMANDE");
    expect(v.montantCents - v.coutCents!).toBe(5000);
  });

  it("coût absent → « à compléter » ; modifier le coût courant ne change pas le passé", async () => {
    const r = await enregistrerVente(vente({ lignes: [{ formatId: formatSansCout, quantite: 1, prixUnitaireCents: null }] }), vendeur);
    expect((await prisma.vente.findUniqueOrThrow({ where: { id: r.venteId } })).coutSource).toBe("A_COMPLETER");
    const avant = await prisma.vente.findFirstOrThrow({ where: { coutSource: "LIGNES" } });
    await prisma.prixTouche.create({ data: { referenceId, formatId, coutCents: 2500, dateEffet: new Date() } });
    const apres = await prisma.vente.findUniqueOrThrow({ where: { id: avant.id } });
    expect(apres.coutCents).toBe(avant.coutCents);
  });

  it("le vendeur ne peut pas modifier le prix unitaire", async () => {
    const r = await enregistrerVente(vente({ lignes: [{ formatId, quantite: 1, prixUnitaireCents: 100 }] }), vendeur);
    expect((await prisma.vente.findUniqueOrThrow({ where: { id: r.venteId } })).montantCents).toBe(4000);
  });
});

describe("R12 / VEN-02 · relance sans doublon", () => {
  it("même clé : une seule vente, un seul mouvement de stock", async () => {
    const s = vente({ cleIdempotence: "tentative-fixe-123", lignes: [{ formatId, quantite: 1, prixUnitaireCents: null }] });
    const avant = await stock();
    const [r1, r2] = await Promise.all([enregistrerVente(s, vendeur), enregistrerVente(s, vendeur)]);
    const r3 = await enregistrerVente(s, vendeur);
    expect(new Set([r1.venteId, r2.venteId, r3.venteId]).size).toBe(1);
    expect(r3.statut).toBe("deja");
    expect(await stock()).toBe(avant - 1);
    expect(await prisma.mouvementStock.count({ where: { venteId: r1.venteId } })).toBe(1);
    expect(await prisma.mouvementTresorerie.count({ where: { venteId: r1.venteId } })).toBe(1);
  });
});

describe("R05 · concurrence sur le dernier article", () => {
  it("deux ventes simultanées sur 1 article : une seule passe", async () => {
    const reste = await stock();
    if (reste > 1) {
      await prisma.$transaction((tx) => appliquerMouvement(tx, { formatId, quantite: -(reste - 1), type: "AJUSTEMENT", origine: "CRM", motif: "Préparation du test" }));
    }
    expect(await stock()).toBe(1);
    const res = await Promise.allSettled([
      enregistrerVente(vente({ lignes: [{ formatId, quantite: 1, prixUnitaireCents: null }] }), vendeur),
      enregistrerVente(vente({ lignes: [{ formatId, quantite: 1, prixUnitaireCents: null }] }), vendeur),
    ]);
    expect(res.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const echec = res.find((r) => r.status === "rejected") as PromiseRejectedResult;
    expect(String(echec.reason.message)).toContain("Stock insuffisant");
    expect(await stock()).toBe(0);
  });
});

describe("R09 · correction et annulation", () => {
  it("correction avec écart de quantité répercuté, puis annulation sans retour physique", async () => {
    await prisma.$transaction((tx) => appliquerMouvement(tx, { formatId, quantite: 10, type: "ENTREE", origine: "CRM", motif: "Réassort" }));
    const r = await enregistrerVente(vente({ lignes: [{ formatId, quantite: 3, prixUnitaireCents: null }] }), admin);
    const s0 = await stock();
    const l = await prisma.ligneVente.findFirstOrThrow({ where: { venteId: r.venteId } });
    await corrigerVente(r.venteId, { motif: "Erreur de quantité", client: "Client test", commentaire: null, dateVente: auj, zoneId: null, coutCommandeCents: null, repercuterStock: true, lignes: [{ id: l.id, quantite: 2, prixUnitaireCents: 4000, coutUnitaireCents: l.coutUnitaireCents }] }, admin);
    expect(await stock()).toBe(s0 + 1);
    const v = await prisma.vente.findUniqueOrThrow({ where: { id: r.venteId } });
    expect(v.montantCents).toBe(8000);
    expect(v.corrigee).toBe(true);
    expect((await prisma.mouvementTresorerie.findUniqueOrThrow({ where: { venteId: r.venteId } })).montantCents).toBe(8000);

    await annulerVente(r.venteId, { motif: "Client parti", retourStock: false, rembourse: true }, admin);
    expect(await stock()).toBe(s0 + 1); // pas de retour physique : stock inchangé
    expect((await prisma.vente.findUniqueOrThrow({ where: { id: r.venteId } })).statut).toBe("ANNULEE");
    expect(await prisma.mouvementTresorerie.count({ where: { libelle: { contains: "Remboursement" }, type: "DECAISSEMENT" } })).toBe(1);
    await expect(annulerVente(r.venteId, { motif: "Encore", retourStock: true, rembourse: false }, admin)).rejects.toThrow("déjà annulée");
  });

  it("annulation avec retour physique : remise en stock", async () => {
    const r = await enregistrerVente(vente({ lignes: [{ formatId, quantite: 2, prixUnitaireCents: null }] }), admin);
    const s0 = await stock();
    await annulerVente(r.venteId, { motif: "Article restitué", retourStock: true, rembourse: false }, admin);
    expect(await stock()).toBe(s0 + 2);
  });
});

describe("R04 · article archivé", () => {
  it("nouvelle saisie impossible, la vente d'origine garde ses informations", async () => {
    const r = await enregistrerVente(vente({ lignes: [{ formatId, quantite: 1, prixUnitaireCents: null }] }), admin);
    await prisma.reference.update({ where: { id: referenceId }, data: { etat: "ARCHIVE", libelle: "Parfum renommé" } });
    await expect(enregistrerVente(vente({ lignes: [{ formatId, quantite: 1, prixUnitaireCents: null }] }), admin)).rejects.toThrow("archivé");
    const l = await prisma.ligneVente.findFirstOrThrow({ where: { venteId: r.venteId } });
    expect(l.referenceLibelle).toBe("Parfum test");
    await prisma.reference.update({ where: { id: referenceId }, data: { etat: "ACTIF", libelle: "Parfum test" } });
  });
});

describe("R11 · fonds de roulement et vente impayée", () => {
  it("une vente non réglée n'entre qu'à son encaissement", async () => {
    await prisma.mouvementTresorerie.create({ data: { activiteId: "pm", dateReglement: "2026-01-01", type: "OUVERTURE", montantCents: 30000, libelle: "Ouverture", origine: "MANUEL" } });
    const r = await enregistrerVente(vente({ lignes: [{ formatId, quantite: 1, prixUnitaireCents: null }], regleeLe: null }), admin);
    expect(await prisma.mouvementTresorerie.count({ where: { venteId: r.venteId } })).toBe(0);
    await reglerVente(r.venteId, auj, admin);
    await expect(reglerVente(r.venteId, auj, admin)).rejects.toThrow("déjà réglée");
    const flux = await prisma.mouvementTresorerie.findMany({ where: { activiteId: "pm" } });
    const s = syntheseTresorerie(flux, "2026-01-01", "2999-12-31");
    const attendu = 30000 + flux.filter((f) => f.type === "ENCAISSEMENT" && !f.annule).reduce((a, f) => a + f.montantCents, 0) - flux.filter((f) => f.type === "DECAISSEMENT").reduce((a, f) => a + f.montantCents, 0);
    expect(s.soldeClotureCents).toBe(attendu);
  });
});

describe("R06 / R07 · Atelier Amari", () => {
  it("120 € fixes à 60/40 et 30 € ponctuels, puis annulation et clé incomplète", async () => {
    const poste = await prisma.poste.create({ data: { activiteId: "amari", libelle: "Loyer" } });
    const n = await prisma.participant.create({ data: { activiteId: "amari", nom: "Nadia" } });
    const s = await prisma.participant.create({ data: { activiteId: "amari", nom: "Samir" } });
    const cf = await prisma.coutFixe.create({ data: { activiteId: "amari", libelle: "Loyer", posteId: poste.id, montantCents: 12000, periodicite: "MENSUELLE" } });
    const base = { date: "2026-11-05", posteId: poste.id, tiers: null, note: null, dateReglement: null };
    const fixe = await creerDepense({ ...base, libelle: "Loyer", montantCents: 12000, type: "FIXE", coutFixeId: cf.id, modeRepartition: "POURCENTAGE", parts: [{ participantId: n.id, valeur: 6000 }, { participantId: s.id, valeur: 4000 }] }, admin);
    const ponct = await creerDepense({ ...base, libelle: "Livraison", montantCents: 3000, type: "PONCTUELLE", coutFixeId: null, modeRepartition: "AUCUNE", parts: [] }, admin);
    const parts = await prisma.partDepense.findMany({ where: { depenseId: fixe.id }, orderBy: { montantCents: "desc" } });
    expect(parts.map((p) => p.montantCents)).toEqual([7200, 4800]);

    const actives = async () => (await prisma.depense.aggregate({ where: { activiteId: "amari", statut: "ACTIVE" }, _sum: { montantCents: true } }))._sum.montantCents;
    expect(await actives()).toBe(15000); // le coût fixe paramétré n'est pas additionné
    await annulerDepense(ponct.id, "Doublon", admin);
    expect(await actives()).toBe(12000);
    expect(await prisma.depense.count({ where: { statut: "ANNULEE" } })).toBe(1);

    await expect(
      modifierDepense(fixe.id, { ...base, libelle: "Loyer", montantCents: 12000, type: "FIXE", coutFixeId: cf.id, modeRepartition: "POURCENTAGE", parts: [{ participantId: n.id, valeur: 5500 }, { participantId: s.id, valeur: 4000 }], motif: "Nouvelle clé" }, admin),
    ).rejects.toThrow("écart de 5 %");
    // la clé d'origine est conservée
    expect((await prisma.partDepense.findMany({ where: { depenseId: fixe.id } })).length).toBe(2);
  });
});
