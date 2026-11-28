-- Moyen de paiement et trajet (départ, arrivée) d'une vente.
ALTER TABLE "Vente" ADD COLUMN "moyenPaiement" TEXT;
ALTER TABLE "Vente" ADD COLUMN "lieuDepart" TEXT;
ALTER TABLE "Vente" ADD COLUMN "lieuArrivee" TEXT;
