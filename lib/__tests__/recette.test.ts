/**
 * Exemples chiffrés du cahier des charges (chapitres 03, 05, 06, 07, 09)
 * et scénarios de recette R06, R07, R10, R11, R15, R19, R20.
 */
import { describe, expect, it } from "vitest";
import { agregerVentes, rentabiliteVente } from "../calcul/vente";
import { repartirMontants, repartirPourcentages } from "../calcul/repartition";
import { syntheseTresorerie } from "../calcul/tresorerie";
import { meilleuresJournees, meilleuresVentes } from "../calcul/classement";
import { suggererZone } from "../calcul/geo";
import { datesDisponibles } from "../calcul/creneaux";
import { lienWhatsApp, messageWhatsApp } from "../calcul/whatsapp";
import { saisieVersBp, saisieVersCents } from "../argent";
import { decompositionMaya, margeMaya } from "../calcul/coutMaya";
import { ajouterJours, estDateIso, jourSemaine } from "../dates";

describe("FIN-01 / FIN-02 — rentabilité d'une vente (R10)", () => {
  const lignes = [{ quantite: 2, prixUnitaireCents: 4000, coutUnitaireCents: 1800 }];

  it("coût unitaire : 80 €, coût 36 €, marge 44 €, 55 %", () => {
    const r = rentabiliteVente(lignes);
    expect(r.montantCents).toBe(8000);
    expect(r.coutCents).toBe(3600);
    expect(r.margeCents).toBe(4400);
    expect(r.tauxMarge).toBeCloseTo(0.55, 10);
    expect(r.coutSource).toBe("LIGNES");
  });

  it("prix de touche de commande de 30 € prioritaire : marge 50 €", () => {
    const r = rentabiliteVente(lignes, 3000);
    expect(r.coutCents).toBe(3000);
    expect(r.margeCents).toBe(5000);
    expect(r.coutSource).toBe("COMMANDE");
  });

  it("coût absent : « coût à compléter », marge vide", () => {
    const r = rentabiliteVente([{ quantite: 1, prixUnitaireCents: 4000, coutUnitaireCents: null }]);
    expect(r.coutSource).toBe("A_COMPLETER");
    expect(r.margeCents).toBeNull();
    expect(r.montantCents).toBe(4000);
  });

  it("coût saisi à 0 € = valeur connue", () => {
    const r = rentabiliteVente([{ quantite: 1, prixUnitaireCents: 4000, coutUnitaireCents: 0 }]);
    expect(r.coutSource).toBe("LIGNES");
    expect(r.margeCents).toBe(4000);
  });

  it("montant nul : taux vide", () => {
    expect(rentabiliteVente([{ quantite: 1, prixUnitaireCents: 0, coutUnitaireCents: 0 }]).tauxMarge).toBeNull();
  });

  it("agrégats : coût absent réduit la couverture, CA compté, annulée exclue", () => {
    const a = agregerVentes([
      { statut: "CONFIRMEE", montantCents: 8000, coutCents: 3600 },
      { statut: "CONFIRMEE", montantCents: 4000, coutCents: null },
      { statut: "ANNULEE", montantCents: 9999, coutCents: 1 },
    ]);
    expect(a.nbVentes).toBe(2);
    expect(a.caCents).toBe(12000);
    expect(a.caCouvertCents).toBe(8000);
    expect(a.margeCents).toBe(4400);
    expect(a.tauxMarge).toBeCloseTo(0.55, 10);
    expect(a.couverture).toBe(0.5);
  });
});

describe("AMA-03 — parts (R07)", () => {
  it("120 € à 60 % / 40 % → 72 € et 48 €", () => {
    const r = repartirPourcentages(12000, [
      { participantId: "a", valeur: 6000 },
      { participantId: "b", valeur: 4000 },
    ]);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.parts.map((p) => p.montantCents)).toEqual([7200, 4800]);
  });

  it("répartition à 95 % bloquée avec l'écart", () => {
    const r = repartirPourcentages(12000, [
      { participantId: "a", valeur: 5500 },
      { participantId: "b", valeur: 4000 },
    ]);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.ecart).toBe(500);
      expect(r.erreur).toContain("5 %");
    }
  });

  it("arrondi stable : 100 € en trois tiers, somme exacte", () => {
    const r = repartirPourcentages(10000, [
      { participantId: "a", valeur: 3333 },
      { participantId: "b", valeur: 3333 },
      { participantId: "c", valeur: 3334 },
    ]);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.parts.reduce((s, p) => s + p.montantCents, 0)).toBe(10000);
      expect(r.parts.map((p) => p.montantCents)).toEqual([3333, 3333, 3334]);
    }
  });

  it("10,01 € à 50/50 : le centime va au premier (départage stable)", () => {
    const r = repartirPourcentages(1001, [
      { participantId: "a", valeur: 5000 },
      { participantId: "b", valeur: 5000 },
    ]);
    if (!r.ok) throw new Error();
    expect(r.parts.map((p) => p.montantCents)).toEqual([501, 500]);
  });

  it("montants : somme égale exigée", () => {
    expect(repartirMontants(12000, [{ participantId: "a", valeur: 7000 }, { participantId: "b", valeur: 5000 }]).ok).toBe(true);
    const r = repartirMontants(12000, [{ participantId: "a", valeur: 7000 }, { participantId: "b", valeur: 4000 }]);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.ecart).toBe(1000);
  });
});

describe("FIN-03 — fonds de roulement (R11)", () => {
  it("300 € d'ouverture, 80 € encaissés, 45 € décaissés → 335 €", () => {
    const s = syntheseTresorerie(
      [
        { dateReglement: "2026-11-01", type: "OUVERTURE", montantCents: 30000, annule: false },
        { dateReglement: "2026-11-05", type: "ENCAISSEMENT", montantCents: 8000, annule: false },
        { dateReglement: "2026-11-06", type: "DECAISSEMENT", montantCents: 4500, annule: false },
      ],
      "2026-11-01",
      "2026-11-30",
    );
    expect(s.soldeOuvertureCents).toBe(30000);
    expect(s.encaissementsCents).toBe(8000);
    expect(s.decaissementsCents).toBe(4500);
    expect(s.soldeClotureCents).toBe(33500);
  });

  it("période ultérieure : l'ouverture reprend les flux antérieurs ; flux annulé exclu", () => {
    const s = syntheseTresorerie(
      [
        { dateReglement: "2026-11-01", type: "OUVERTURE", montantCents: 30000, annule: false },
        { dateReglement: "2026-11-05", type: "ENCAISSEMENT", montantCents: 8000, annule: false },
        { dateReglement: "2026-11-06", type: "DECAISSEMENT", montantCents: 4500, annule: false },
        { dateReglement: "2026-11-20", type: "ENCAISSEMENT", montantCents: 1000, annule: false },
        { dateReglement: "2026-11-21", type: "ENCAISSEMENT", montantCents: 5000, annule: true },
        { dateReglement: "2026-11-22", type: "AJUSTEMENT", montantCents: -200, annule: false },
      ],
      "2026-11-15",
      "2026-11-30",
    );
    expect(s.soldeOuvertureCents).toBe(33500);
    expect(s.encaissementsCents).toBe(1000);
    expect(s.ajustementsCents).toBe(-200);
    expect(s.soldeClotureCents).toBe(34300);
  });
});

describe("PIL-02 — classements (R15, R20)", () => {
  const base = { referenceCode: "PM-001", formatLibelle: "50 ml", formatId: "f1", referenceId: "r1", referenceLibelle: "Ambre" };
  it("par unités puis par CA ; annulées exclues", () => {
    const lignes = [
      { ...base, venteStatut: "CONFIRMEE", dateVente: "2026-11-01", quantite: 3, prixUnitaireCents: 1000 },
      { ...base, referenceId: "r2", referenceLibelle: "Cuir", formatId: "f2", venteStatut: "CONFIRMEE", dateVente: "2026-11-01", quantite: 1, prixUnitaireCents: 5000 },
      { ...base, referenceId: "r2", referenceLibelle: "Cuir", formatId: "f2", venteStatut: "ANNULEE", dateVente: "2026-11-01", quantite: 10, prixUnitaireCents: 5000 },
    ];
    expect(meilleuresVentes(lignes, "reference", "unites")[0].libelle).toBe("Ambre");
    expect(meilleuresVentes(lignes, "reference", "ca")[0].libelle).toBe("Cuir");
    expect(meilleuresVentes(lignes, "reference", "ca")[0].unites).toBe(1);
  });
  it("journées regroupées par date de vente", () => {
    const j = meilleuresJournees([
      { statut: "CONFIRMEE", dateVente: "2026-11-02", montantCents: 1000 },
      { statut: "CONFIRMEE", dateVente: "2026-11-03", montantCents: 5000 },
      { statut: "CONFIRMEE", dateVente: "2026-11-02", montantCents: 4500 },
    ]);
    expect(j[0]).toEqual({ date: "2026-11-02", caCents: 5500, nbVentes: 2 });
  });
});

describe("GEO-01 — proposition de zone", () => {
  const zones = [
    { id: "lyon", libelle: "Lyon Presqu'île", lat: 45.7597, lng: 4.8357, rayonKm: 2 },
    { id: "villeurbanne", libelle: "Villeurbanne", lat: 45.7719, lng: 4.8902, rayonKm: 2.5 },
  ];
  it("zone la plus proche", () => {
    expect(suggererZone({ lat: 45.771, lng: 4.888 }, zones)?.zone.id).toBe("villeurbanne");
  });
  it("trop loin ou imprécis : aucune suggestion", () => {
    expect(suggererZone({ lat: 48.85, lng: 2.35 }, zones)).toBeNull();
    expect(suggererZone({ lat: 45.76, lng: 4.83, precisionM: 9000 }, zones)).toBeNull();
  });
});

describe("LIV-01 / LIV-02 — créneaux et message WhatsApp (R19)", () => {
  it("message conforme à l'exemple", () => {
    const m = messageWhatsApp({ reference: "PM-014", ville: "Lyon", date: "2026-12-03", debut: "15:00", fin: "17:00" });
    expect(m).toBe(
      "Bonjour, je souhaite commander la référence PM-014. La livraison souhaitée est à Lyon le 3 décembre, de 15 h à 17 h. Pouvez-vous me confirmer ce créneau ?",
    );
    expect(lienWhatsApp("+33 6 12 34 56 78", m)).toMatch(/^https:\/\/wa\.me\/33612345678\?text=Bonjour/);
  });
  it("dates sans créneau et fermetures écartées", () => {
    // 2026-11-25 est un mercredi
    expect(jourSemaine("2026-11-25")).toBe(3);
    const dispo = datesDisponibles(
      [{ jour: 4, heureDebut: "15:00", heureFin: "17:00", actif: true }],
      ["2026-12-03"],
      "2026-11-25",
      14,
    );
    expect(dispo.map((d) => d.date)).toEqual(["2026-11-26"]);
  });
});

describe("Saisies", () => {
  it("euros → centimes sans flottant", () => {
    expect(saisieVersCents("12,5")).toBe(1250);
    expect(saisieVersCents("0,1")).toBe(10);
    expect(saisieVersCents("1 200,00 €")).toBe(120000);
    expect(saisieVersCents("-3")).toBe(-300);
    expect(saisieVersCents("12,345")).toBeNull();
    expect(saisieVersCents("abc")).toBeNull();
    expect(saisieVersCents("")).toBeNull();
  });
  it("pourcentages → points de base", () => {
    expect(saisieVersBp("60")).toBe(6000);
    expect(saisieVersBp("33,33")).toBe(3333);
    expect(saisieVersBp("x")).toBeNull();
  });
  it("dates", () => {
    expect(estDateIso("2026-02-30")).toBe(false);
    expect(estDateIso("2026-12-03")).toBe(true);
    expect(ajouterJours("2026-12-31", 1)).toBe("2027-01-01");
  });
});

describe("Maison Maya — coût de revient (valeurs du classeur Maya OS)", () => {
  const D = new Date("2026-01-01T00:00:00Z");
  const ctx = (ml: number, prixL: string) => ({
    contenanceMl: ml,
    prixLiquides: [{ prixLitreHT: prixL, dateEffet: D }],
    parametres: [{ cle: "taux_perte", valeur: "0.111", dateEffet: D }],
    composants:
      ml === 50
        ? [
            { libelle: "Flacon + boîte", coutUnitHT: "1.06", optionnel: false, dateEffet: D },
            { libelle: "Étiquette", coutUnitHT: "0.50", optionnel: false, dateEffet: D },
            { libelle: "Blistage", coutUnitHT: "1.18", optionnel: false, dateEffet: D },
            { libelle: "Sac", coutUnitHT: "0.82", optionnel: true, dateEffet: D },
          ]
        : [
            { libelle: "Flacon + boîte", coutUnitHT: "0.87", optionnel: false, dateEffet: D },
            { libelle: "Sac", coutUnitHT: "0.82", optionnel: true, dateEffet: D },
          ],
    faconnages: [{ coutFixeSerie: "420", coutVarUnitHT: "0", qteLotRef: 140, dateEffet: D }],
  });
  const eur = (x: { toDecimalPlaces: (n: number) => { toFixed: (n: number) => string } }) => x.toDecimalPlaces(2).toFixed(2);

  it("Réveil en Lusitanie 50 ml : 6,11 / 8,85 / 11,85", () => {
    const r = decompositionMaya(ctx(50, "110"), D);
    expect(eur(r.liquide)).toBe("6.11");
    expect(eur(r.matiereEtCond)).toBe("8.85");
    expect(eur(r.complet)).toBe("11.85");
    expect(r.manquants).toEqual([]);
  });
  it("Suave 10 ml : 1,54 / 4,54", () => {
    const r = decompositionMaya(ctx(10, "60"), D);
    expect(eur(r.matiereEtCond)).toBe("1.54");
    expect(eur(r.complet)).toBe("4.54");
  });
  it("marge à 20 € HT sur 11,85 €", () => {
    const m = margeMaya("20", decompositionMaya(ctx(50, "110"), D).complet);
    expect(m.marge.toDecimalPlaces(2).toFixed(2)).toBe("8.15");
  });
  it("éléments manquants signalés", () => {
    const r = decompositionMaya({ ...ctx(50, "110"), prixLiquides: [] }, D);
    expect(r.manquants).toContain("prix du liquide");
  });
});
