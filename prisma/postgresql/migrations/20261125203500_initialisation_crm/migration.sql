BEGIN;

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "Activite" (
    "id" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "description" TEXT,
    "ordre" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Activite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Utilisateur" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "motDePasseHash" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "gestionnaire" BOOLEAN NOT NULL DEFAULT false,
    "prixModifiable" BOOLEAN NOT NULL DEFAULT false,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "desactiveLe" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Utilisateur_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Habilitation" (
    "id" TEXT NOT NULL,
    "utilisateurId" TEXT NOT NULL,
    "activiteId" TEXT NOT NULL,

    CONSTRAINT "Habilitation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "jetonHash" TEXT NOT NULL,
    "utilisateurId" TEXT NOT NULL,
    "expireLe" TIMESTAMP(3) NOT NULL,
    "revoqueLe" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TentativeConnexion" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "reussie" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TentativeConnexion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JournalAudit" (
    "id" TEXT NOT NULL,
    "activiteId" TEXT,
    "auteurId" TEXT,
    "auteurNom" TEXT,
    "action" TEXT NOT NULL,
    "entite" TEXT NOT NULL,
    "entiteId" TEXT,
    "resume" TEXT NOT NULL,
    "details" TEXT,
    "motif" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JournalAudit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Reglage" (
    "cle" TEXT NOT NULL,
    "valeur" TEXT NOT NULL,

    CONSTRAINT "Reglage_pkey" PRIMARY KEY ("cle")
);

-- CreateTable
CREATE TABLE "Compteur" (
    "cle" TEXT NOT NULL,
    "valeur" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Compteur_pkey" PRIMARY KEY ("cle")
);

-- CreateTable
CREATE TABLE "Reference" (
    "id" TEXT NOT NULL,
    "activiteId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "libelle" TEXT NOT NULL,
    "famille" TEXT,
    "description" TEXT,
    "etat" TEXT NOT NULL DEFAULT 'ACTIF',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Reference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Format" (
    "id" TEXT NOT NULL,
    "activiteId" TEXT NOT NULL,
    "referenceId" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "libelle" TEXT NOT NULL,
    "contenanceMl" INTEGER,
    "prixVenteCents" INTEGER NOT NULL,
    "quantite" INTEGER NOT NULL DEFAULT 0,
    "etat" TEXT NOT NULL DEFAULT 'ACTIF',
    "stockMajLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "shopifyVariantId" TEXT,
    "shopifyInventoryItemId" TEXT,
    "lienStatut" TEXT NOT NULL DEFAULT 'NON_LIE',
    "lienMessage" TEXT,
    "dernierEchangeLe" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Format_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MouvementStock" (
    "id" TEXT NOT NULL,
    "formatId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "quantite" INTEGER NOT NULL,
    "stockApres" INTEGER NOT NULL,
    "origine" TEXT NOT NULL,
    "auteurId" TEXT,
    "auteurNom" TEXT,
    "motif" TEXT,
    "venteId" TEXT,
    "cleUnique" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MouvementStock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PrixTouche" (
    "id" TEXT NOT NULL,
    "referenceId" TEXT NOT NULL,
    "formatId" TEXT,
    "coutCents" INTEGER NOT NULL,
    "dateEffet" TIMESTAMP(3) NOT NULL,
    "auteurNom" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PrixTouche_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Vente" (
    "id" TEXT NOT NULL,
    "activiteId" TEXT NOT NULL,
    "numero" TEXT NOT NULL,
    "cleIdempotence" TEXT NOT NULL,
    "client" TEXT NOT NULL,
    "commentaire" TEXT,
    "dateVente" TEXT NOT NULL,
    "saisieLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "vendeurId" TEXT NOT NULL,
    "auteurId" TEXT NOT NULL,
    "canal" TEXT NOT NULL,
    "statut" TEXT NOT NULL DEFAULT 'CONFIRMEE',
    "corrigee" BOOLEAN NOT NULL DEFAULT false,
    "zoneId" TEXT,
    "zoneLibelle" TEXT,
    "zoneProvenance" TEXT NOT NULL DEFAULT 'NON_RENSEIGNEE',
    "livraisonEtat" TEXT NOT NULL DEFAULT 'AUCUNE',
    "livraisonDate" TEXT,
    "livraisonCreneau" TEXT,
    "livraisonVille" TEXT,
    "livraisonEffective" TEXT,
    "coutCommandeCents" INTEGER,
    "montantCents" INTEGER NOT NULL,
    "coutCents" INTEGER,
    "coutSource" TEXT NOT NULL,
    "regleeLe" TEXT,
    "stockSync" TEXT NOT NULL DEFAULT 'NON_LIE',
    "annuleeLe" TIMESTAMP(3),
    "motifAnnulation" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Vente_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LigneVente" (
    "id" TEXT NOT NULL,
    "venteId" TEXT NOT NULL,
    "formatId" TEXT NOT NULL,
    "referenceId" TEXT NOT NULL,
    "referenceCode" TEXT NOT NULL,
    "referenceLibelle" TEXT NOT NULL,
    "formatLibelle" TEXT NOT NULL,
    "quantite" INTEGER NOT NULL,
    "prixUnitaireCents" INTEGER NOT NULL,
    "coutUnitaireCents" INTEGER,
    "coutSource" TEXT NOT NULL,

    CONSTRAINT "LigneVente_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CorrectionVente" (
    "id" TEXT NOT NULL,
    "venteId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "motif" TEXT NOT NULL,
    "avant" TEXT NOT NULL,
    "apres" TEXT NOT NULL,
    "effetStock" BOOLEAN NOT NULL DEFAULT false,
    "auteurNom" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CorrectionVente_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Zone" (
    "id" TEXT NOT NULL,
    "activiteId" TEXT NOT NULL,
    "libelle" TEXT NOT NULL,
    "ville" TEXT NOT NULL,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "rayonKm" DOUBLE PRECISION NOT NULL DEFAULT 3,
    "livraison" BOOLEAN NOT NULL DEFAULT true,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Zone_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Creneau" (
    "id" TEXT NOT NULL,
    "zoneId" TEXT NOT NULL,
    "jour" INTEGER NOT NULL,
    "heureDebut" TEXT NOT NULL,
    "heureFin" TEXT NOT NULL,
    "actif" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Creneau_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FermetureZone" (
    "id" TEXT NOT NULL,
    "zoneId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "motif" TEXT,

    CONSTRAINT "FermetureZone_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MouvementTresorerie" (
    "id" TEXT NOT NULL,
    "activiteId" TEXT NOT NULL,
    "dateReglement" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "montantCents" INTEGER NOT NULL,
    "libelle" TEXT NOT NULL,
    "origine" TEXT NOT NULL,
    "venteId" TEXT,
    "motif" TEXT,
    "annule" BOOLEAN NOT NULL DEFAULT false,
    "auteurNom" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MouvementTresorerie_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Poste" (
    "id" TEXT NOT NULL,
    "activiteId" TEXT NOT NULL,
    "libelle" TEXT NOT NULL,
    "actif" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Poste_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Participant" (
    "id" TEXT NOT NULL,
    "activiteId" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "partDefautBp" INTEGER,
    "actif" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Participant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CoutFixe" (
    "id" TEXT NOT NULL,
    "activiteId" TEXT NOT NULL,
    "libelle" TEXT NOT NULL,
    "posteId" TEXT NOT NULL,
    "montantCents" INTEGER NOT NULL,
    "periodicite" TEXT NOT NULL,
    "actif" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "CoutFixe_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Depense" (
    "id" TEXT NOT NULL,
    "activiteId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "libelle" TEXT NOT NULL,
    "montantCents" INTEGER NOT NULL,
    "posteId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "coutFixeId" TEXT,
    "tiers" TEXT,
    "note" TEXT,
    "dateReglement" TEXT,
    "statut" TEXT NOT NULL DEFAULT 'ACTIVE',
    "annuleeLe" TIMESTAMP(3),
    "motifAnnulation" TEXT,
    "modeRepartition" TEXT NOT NULL DEFAULT 'AUCUNE',
    "cleAppliquee" TEXT,
    "auteurNom" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Depense_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PartDepense" (
    "id" TEXT NOT NULL,
    "depenseId" TEXT NOT NULL,
    "participantId" TEXT NOT NULL,
    "participantNom" TEXT NOT NULL,
    "pourcentageBp" INTEGER,
    "montantCents" INTEGER NOT NULL,

    CONSTRAINT "PartDepense_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PrixLiquide" (
    "id" TEXT NOT NULL,
    "referenceId" TEXT NOT NULL,
    "prixLitreHT" TEXT NOT NULL,
    "dateEffet" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PrixLiquide_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ComposantMaya" (
    "id" TEXT NOT NULL,
    "libelle" TEXT NOT NULL,
    "contenanceMl" INTEGER NOT NULL,
    "coutUnitHT" TEXT NOT NULL,
    "optionnel" BOOLEAN NOT NULL DEFAULT false,
    "dateEffet" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ComposantMaya_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FaconnageMaya" (
    "id" TEXT NOT NULL,
    "contenanceMl" INTEGER NOT NULL,
    "coutFixeSerie" TEXT NOT NULL,
    "coutVarUnitHT" TEXT NOT NULL,
    "qteLotRef" INTEGER NOT NULL,
    "dateEffet" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FaconnageMaya_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ParametreMaya" (
    "id" TEXT NOT NULL,
    "cle" TEXT NOT NULL,
    "valeur" TEXT NOT NULL,
    "dateEffet" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ParametreMaya_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImportLot" (
    "id" TEXT NOT NULL,
    "activiteId" TEXT NOT NULL,
    "nomFichier" TEXT NOT NULL,
    "statut" TEXT NOT NULL,
    "lignesOk" INTEGER NOT NULL,
    "lignesRejet" INTEGER NOT NULL,
    "doublons" INTEGER NOT NULL,
    "releve" TEXT NOT NULL,
    "auteurNom" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ImportLot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Boutique" (
    "id" TEXT NOT NULL,
    "activiteId" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "domaine" TEXT,
    "jetonChiffre" TEXT,
    "emplacementId" TEXT,
    "droitEcriture" BOOLEAN NOT NULL DEFAULT false,
    "statut" TEXT NOT NULL DEFAULT 'NON_CONFIGUREE',
    "derniereSyncOk" TIMESTAMP(3),
    "derniereErreur" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Boutique_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OperationSync" (
    "id" TEXT NOT NULL,
    "boutiqueId" TEXT,
    "formatId" TEXT NOT NULL,
    "venteId" TEXT,
    "delta" INTEGER NOT NULL,
    "cle" TEXT NOT NULL,
    "statut" TEXT NOT NULL DEFAULT 'EN_ATTENTE',
    "tentatives" INTEGER NOT NULL DEFAULT 0,
    "erreur" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OperationSync_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebhookRecu" (
    "id" TEXT NOT NULL,
    "webhookId" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "domaine" TEXT NOT NULL,
    "statut" TEXT NOT NULL,
    "message" TEXT,
    "recuLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WebhookRecu_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Utilisateur_email_key" ON "Utilisateur"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Habilitation_utilisateurId_activiteId_key" ON "Habilitation"("utilisateurId", "activiteId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_jetonHash_key" ON "Session"("jetonHash");

-- CreateIndex
CREATE INDEX "Session_utilisateurId_idx" ON "Session"("utilisateurId");

-- CreateIndex
CREATE INDEX "TentativeConnexion_email_createdAt_idx" ON "TentativeConnexion"("email", "createdAt");

-- CreateIndex
CREATE INDEX "JournalAudit_activiteId_createdAt_idx" ON "JournalAudit"("activiteId", "createdAt");

-- CreateIndex
CREATE INDEX "JournalAudit_entite_entiteId_idx" ON "JournalAudit"("entite", "entiteId");

-- CreateIndex
CREATE UNIQUE INDEX "Reference_activiteId_code_key" ON "Reference"("activiteId", "code");

-- CreateIndex
CREATE INDEX "Format_referenceId_idx" ON "Format"("referenceId");

-- CreateIndex
CREATE UNIQUE INDEX "Format_activiteId_sku_key" ON "Format"("activiteId", "sku");

-- CreateIndex
CREATE UNIQUE INDEX "MouvementStock_cleUnique_key" ON "MouvementStock"("cleUnique");

-- CreateIndex
CREATE INDEX "MouvementStock_formatId_createdAt_idx" ON "MouvementStock"("formatId", "createdAt");

-- CreateIndex
CREATE INDEX "MouvementStock_venteId_idx" ON "MouvementStock"("venteId");

-- CreateIndex
CREATE INDEX "PrixTouche_referenceId_idx" ON "PrixTouche"("referenceId");

-- CreateIndex
CREATE UNIQUE INDEX "Vente_numero_key" ON "Vente"("numero");

-- CreateIndex
CREATE UNIQUE INDEX "Vente_cleIdempotence_key" ON "Vente"("cleIdempotence");

-- CreateIndex
CREATE INDEX "Vente_activiteId_dateVente_idx" ON "Vente"("activiteId", "dateVente");

-- CreateIndex
CREATE INDEX "Vente_vendeurId_idx" ON "Vente"("vendeurId");

-- CreateIndex
CREATE INDEX "LigneVente_formatId_idx" ON "LigneVente"("formatId");

-- CreateIndex
CREATE UNIQUE INDEX "FermetureZone_zoneId_date_key" ON "FermetureZone"("zoneId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "MouvementTresorerie_venteId_key" ON "MouvementTresorerie"("venteId");

-- CreateIndex
CREATE INDEX "MouvementTresorerie_activiteId_dateReglement_idx" ON "MouvementTresorerie"("activiteId", "dateReglement");

-- CreateIndex
CREATE UNIQUE INDEX "Poste_activiteId_libelle_key" ON "Poste"("activiteId", "libelle");

-- CreateIndex
CREATE UNIQUE INDEX "Participant_activiteId_nom_key" ON "Participant"("activiteId", "nom");

-- CreateIndex
CREATE INDEX "Depense_activiteId_date_idx" ON "Depense"("activiteId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "PartDepense_depenseId_participantId_key" ON "PartDepense"("depenseId", "participantId");

-- CreateIndex
CREATE UNIQUE INDEX "PrixLiquide_referenceId_dateEffet_key" ON "PrixLiquide"("referenceId", "dateEffet");

-- CreateIndex
CREATE UNIQUE INDEX "ParametreMaya_cle_dateEffet_key" ON "ParametreMaya"("cle", "dateEffet");

-- CreateIndex
CREATE UNIQUE INDEX "OperationSync_cle_key" ON "OperationSync"("cle");

-- CreateIndex
CREATE INDEX "OperationSync_statut_idx" ON "OperationSync"("statut");

-- CreateIndex
CREATE UNIQUE INDEX "WebhookRecu_webhookId_key" ON "WebhookRecu"("webhookId");

-- AddForeignKey
ALTER TABLE "Habilitation" ADD CONSTRAINT "Habilitation_utilisateurId_fkey" FOREIGN KEY ("utilisateurId") REFERENCES "Utilisateur"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Habilitation" ADD CONSTRAINT "Habilitation_activiteId_fkey" FOREIGN KEY ("activiteId") REFERENCES "Activite"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_utilisateurId_fkey" FOREIGN KEY ("utilisateurId") REFERENCES "Utilisateur"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reference" ADD CONSTRAINT "Reference_activiteId_fkey" FOREIGN KEY ("activiteId") REFERENCES "Activite"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Format" ADD CONSTRAINT "Format_activiteId_fkey" FOREIGN KEY ("activiteId") REFERENCES "Activite"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Format" ADD CONSTRAINT "Format_referenceId_fkey" FOREIGN KEY ("referenceId") REFERENCES "Reference"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MouvementStock" ADD CONSTRAINT "MouvementStock_formatId_fkey" FOREIGN KEY ("formatId") REFERENCES "Format"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrixTouche" ADD CONSTRAINT "PrixTouche_referenceId_fkey" FOREIGN KEY ("referenceId") REFERENCES "Reference"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrixTouche" ADD CONSTRAINT "PrixTouche_formatId_fkey" FOREIGN KEY ("formatId") REFERENCES "Format"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vente" ADD CONSTRAINT "Vente_activiteId_fkey" FOREIGN KEY ("activiteId") REFERENCES "Activite"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vente" ADD CONSTRAINT "Vente_vendeurId_fkey" FOREIGN KEY ("vendeurId") REFERENCES "Utilisateur"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vente" ADD CONSTRAINT "Vente_auteurId_fkey" FOREIGN KEY ("auteurId") REFERENCES "Utilisateur"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vente" ADD CONSTRAINT "Vente_zoneId_fkey" FOREIGN KEY ("zoneId") REFERENCES "Zone"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LigneVente" ADD CONSTRAINT "LigneVente_venteId_fkey" FOREIGN KEY ("venteId") REFERENCES "Vente"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LigneVente" ADD CONSTRAINT "LigneVente_formatId_fkey" FOREIGN KEY ("formatId") REFERENCES "Format"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CorrectionVente" ADD CONSTRAINT "CorrectionVente_venteId_fkey" FOREIGN KEY ("venteId") REFERENCES "Vente"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Zone" ADD CONSTRAINT "Zone_activiteId_fkey" FOREIGN KEY ("activiteId") REFERENCES "Activite"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Creneau" ADD CONSTRAINT "Creneau_zoneId_fkey" FOREIGN KEY ("zoneId") REFERENCES "Zone"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FermetureZone" ADD CONSTRAINT "FermetureZone_zoneId_fkey" FOREIGN KEY ("zoneId") REFERENCES "Zone"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MouvementTresorerie" ADD CONSTRAINT "MouvementTresorerie_activiteId_fkey" FOREIGN KEY ("activiteId") REFERENCES "Activite"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Poste" ADD CONSTRAINT "Poste_activiteId_fkey" FOREIGN KEY ("activiteId") REFERENCES "Activite"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Participant" ADD CONSTRAINT "Participant_activiteId_fkey" FOREIGN KEY ("activiteId") REFERENCES "Activite"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoutFixe" ADD CONSTRAINT "CoutFixe_activiteId_fkey" FOREIGN KEY ("activiteId") REFERENCES "Activite"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoutFixe" ADD CONSTRAINT "CoutFixe_posteId_fkey" FOREIGN KEY ("posteId") REFERENCES "Poste"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Depense" ADD CONSTRAINT "Depense_activiteId_fkey" FOREIGN KEY ("activiteId") REFERENCES "Activite"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Depense" ADD CONSTRAINT "Depense_posteId_fkey" FOREIGN KEY ("posteId") REFERENCES "Poste"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Depense" ADD CONSTRAINT "Depense_coutFixeId_fkey" FOREIGN KEY ("coutFixeId") REFERENCES "CoutFixe"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartDepense" ADD CONSTRAINT "PartDepense_depenseId_fkey" FOREIGN KEY ("depenseId") REFERENCES "Depense"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartDepense" ADD CONSTRAINT "PartDepense_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "Participant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrixLiquide" ADD CONSTRAINT "PrixLiquide_referenceId_fkey" FOREIGN KEY ("referenceId") REFERENCES "Reference"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportLot" ADD CONSTRAINT "ImportLot_activiteId_fkey" FOREIGN KEY ("activiteId") REFERENCES "Activite"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Boutique" ADD CONSTRAINT "Boutique_activiteId_fkey" FOREIGN KEY ("activiteId") REFERENCES "Activite"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OperationSync" ADD CONSTRAINT "OperationSync_boutiqueId_fkey" FOREIGN KEY ("boutiqueId") REFERENCES "Boutique"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OperationSync" ADD CONSTRAINT "OperationSync_formatId_fkey" FOREIGN KEY ("formatId") REFERENCES "Format"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Activités et réglages de liaison disponibles avant la création des comptes.
INSERT INTO "Activite" ("id", "nom", "ordre") VALUES
  ('maya', 'Maison Maya', 1),
  ('amari', 'Atelier Amari', 2),
  ('pm', 'Parfumerie Mobile', 3);

INSERT INTO "Boutique" ("id", "activiteId", "nom", "updatedAt") VALUES
  ('boutique-maya', 'maya', 'Boutique Maison Maya', CURRENT_TIMESTAMP),
  ('boutique-amari', 'amari', 'Boutique Atelier Amari', CURRENT_TIMESTAMP),
  ('boutique-pm', 'pm', 'Boutique Parfumerie Mobile', CURRENT_TIMESTAMP);

COMMIT;
