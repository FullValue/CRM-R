import type { Metadata } from "next";
import { exigerEspaceAdmin } from "@/lib/auth/acces";
import { prisma } from "@/lib/db";
import { ajouterJours, aujourdhui, dateLongue } from "@/lib/dates";
import { EntetePage } from "@/components/entete-page";
import { MOYENS_PAIEMENT, estMoyenPaiement } from "@/lib/domaine";
import { Tournee, type ArretTournee } from "@/components/mobile/tournee";

export const metadata: Metadata = { title: "Tournée" };

/**
 * Mode livraison : la tournée du livreur. Livraisons à faire (en retard,
 * aujourd'hui, à venir) et livraisons effectuées récemment, regroupées par jour.
 */
export default async function PageTournee() {
  await exigerEspaceAdmin("pm");
  const auj = aujourdhui();
  const ventes = await prisma.vente.findMany({
    where: {
      activiteId: "pm",
      statut: "CONFIRMEE",
      OR: [
        { livraisonEtat: { in: ["PREFERENCE", "CONFIRMEE"] }, livraisonDate: { gte: ajouterJours(auj, -14) } },
        { livraisonEtat: "LIVREE", livraisonDate: { gte: ajouterJours(auj, -7) } },
      ],
    },
    include: { lignes: true },
    orderBy: [{ livraisonDate: "asc" }, { livraisonCreneau: "asc" }],
    take: 200,
  });

  const arrets: ArretTournee[] = ventes.map((v) => ({
    id: v.id,
    numero: v.numero,
    client: v.client,
    etat: v.livraisonEtat as ArretTournee["etat"],
    date: v.livraisonDate!,
    jour: dateLongue(v.livraisonDate!),
    creneau: v.livraisonCreneau,
    ville: v.livraisonVille ?? v.zoneLibelle,
    effective: v.livraisonEffective,
    montantCents: v.montantCents,
    reglee: Boolean(v.regleeLe),
    paiement: estMoyenPaiement(v.moyenPaiement) ? MOYENS_PAIEMENT[v.moyenPaiement] : null,
    depart: v.lieuDepart,
    arrivee: v.lieuArrivee,
    commentaire: v.commentaire,
    articles: v.lignes.map((l) => ({ id: l.id, libelle: `${l.referenceLibelle} · ${l.formatLibelle}`, quantite: l.quantite })),
  }));

  const aFaire = arrets.filter((a) => a.etat !== "LIVREE");
  const duJour = aFaire.filter((a) => a.date === auj).length;
  return (
    <div className="space-y-5">
      <EntetePage
        titre="Tournée"
        description={duJour ? `${duJour} livraison${duJour > 1 ? "s" : ""} prévue${duJour > 1 ? "s" : ""} aujourd’hui, ${dateLongue(auj)}.` : `Rien de prévu aujourd’hui, ${dateLongue(auj)}.`}
      />
      <Tournee arrets={arrets} aujourdhui={auj} demain={ajouterJours(auj, 1)} />
    </div>
  );
}
