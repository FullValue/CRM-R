"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { verifierEspaceAdmin } from "@/lib/auth/acces";
import { journaliser } from "@/lib/audit";
import { saisieVersCents } from "@/lib/argent";
import { estDateIso } from "@/lib/dates";
import { champ, ErreurMetier, executer, type Resultat } from "@/lib/services/resultat";

/** Mouvement manuel du fonds de roulement (FIN-03). */
export async function ajouterMouvementTresorerie(fd: FormData): Promise<Resultat> {
  return executer(async () => {
    const u = await verifierEspaceAdmin("pm");
    const type = champ(fd, "type");
    const date = champ(fd, "date");
    const montant = saisieVersCents(champ(fd, "montant"));
    const libelle = champ(fd, "libelle");
    const motif = champ(fd, "motif") || null;
    const champs: Record<string, string> = {};
    if (!["OUVERTURE", "ENCAISSEMENT", "DECAISSEMENT", "AJUSTEMENT"].includes(type)) champs.type = "Type inconnu.";
    if (!estDateIso(date)) champs.date = "Date de règlement invalide.";
    if (montant === null || montant === 0) champs.montant = "Montant invalide.";
    else if (type !== "AJUSTEMENT" && montant < 0) champs.montant = "Montant positif attendu (le sens dépend du type).";
    if (libelle.length < 2) champs.libelle = "Libellé obligatoire.";
    if (type === "AJUSTEMENT" && (!motif || motif.length < 3)) champs.motif = "Un ajustement doit être justifié.";
    if (Object.keys(champs).length) throw new ErreurMetier("Certains champs sont à corriger.", champs);
    const m = await prisma.mouvementTresorerie.create({
      data: { activiteId: "pm", dateReglement: date, type, montantCents: montant!, libelle, origine: "MANUEL", motif, auteurNom: u.nom },
    });
    await journaliser({ activiteId: "pm", auteur: u, action: "tresorerie.ajout", entite: "MouvementTresorerie", entiteId: m.id, resume: `${type} ${libelle} : ${(montant! / 100).toFixed(2)} €`, motif });
    revalidatePath("/pm/tresorerie");
    return { ok: true, message: "Mouvement enregistré." };
  });
}

export async function annulerMouvementTresorerie(id: string, fd: FormData): Promise<Resultat> {
  return executer(async () => {
    const u = await verifierEspaceAdmin("pm");
    const motif = champ(fd, "motif");
    if (motif.length < 3) throw new ErreurMetier("Motif obligatoire.", { motif: "Motif obligatoire." });
    const m = await prisma.mouvementTresorerie.findFirst({ where: { id, activiteId: "pm" } });
    if (!m) throw new ErreurMetier("Mouvement introuvable.");
    if (m.annule) throw new ErreurMetier("Mouvement déjà annulé.");
    if (m.origine === "VENTE") throw new ErreurMetier("Un encaissement de vente s'annule depuis la vente (annulation avec remboursement).");
    await prisma.mouvementTresorerie.update({ where: { id }, data: { annule: true, motif: `${m.motif ? `${m.motif} · ` : ""}Annulé : ${motif}` } });
    await journaliser({ activiteId: "pm", auteur: u, action: "tresorerie.annulation", entite: "MouvementTresorerie", entiteId: id, resume: `Mouvement « ${m.libelle} » annulé`, motif });
    revalidatePath("/pm/tresorerie");
    return { ok: true, message: "Mouvement annulé : il reste visible et sort du calcul." };
  });
}
