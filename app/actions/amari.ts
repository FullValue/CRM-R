"use server";

import { revalidatePath } from "next/cache";
import { prisma, estDoublon } from "@/lib/db";
import { verifierEspaceAdmin } from "@/lib/auth/acces";
import { journaliser } from "@/lib/audit";
import { saisieVersBp, saisieVersCents } from "@/lib/argent";
import { annulerDepense, creerDepense, modifierDepense, type SaisieDepense } from "@/lib/services/depenses";
import { champ, ErreurMetier, executer, type Resultat } from "@/lib/services/resultat";

const E = "amari";

function lireDepense(fd: FormData): SaisieDepense {
  const mode = champ(fd, "modeRepartition");
  const modeRepartition = mode === "POURCENTAGE" || mode === "MONTANT" ? mode : "AUCUNE";
  const ids = fd.getAll("partParticipant").map(String);
  const valeurs = fd.getAll("partValeur").map(String);
  return {
    date: champ(fd, "date"),
    libelle: champ(fd, "libelle"),
    montantCents: saisieVersCents(champ(fd, "montant")),
    posteId: champ(fd, "posteId"),
    type: champ(fd, "type") === "FIXE" ? "FIXE" : "PONCTUELLE",
    coutFixeId: champ(fd, "coutFixeId") && champ(fd, "coutFixeId") !== "aucun" ? champ(fd, "coutFixeId") : null,
    tiers: champ(fd, "tiers") || null,
    note: champ(fd, "note") || null,
    dateReglement: champ(fd, "dateReglement") || null,
    modeRepartition,
    parts: ids
      .map((participantId, i) => ({
        participantId,
        valeur: valeurs[i]?.trim() === "" ? null : modeRepartition === "POURCENTAGE" ? saisieVersBp(valeurs[i]) : saisieVersCents(valeurs[i]),
      }))
      .filter((p) => p.participantId),
    motif: champ(fd, "motif") || null,
  };
}

export async function creerDepenseAction(fd: FormData): Promise<Resultat> {
  return executer(async () => {
    const u = await verifierEspaceAdmin(E);
    await creerDepense(lireDepense(fd), u);
    revalidatePath("/amari", "layout");
    return { ok: true, message: "Dépense enregistrée." };
  });
}

export async function modifierDepenseAction(id: string, fd: FormData): Promise<Resultat> {
  return executer(async () => {
    const u = await verifierEspaceAdmin(E);
    await modifierDepense(id, lireDepense(fd), u);
    revalidatePath("/amari", "layout");
    return { ok: true, message: "Dépense modifiée : la modification est tracée." };
  });
}

export async function annulerDepenseAction(id: string, fd: FormData): Promise<Resultat> {
  return executer(async () => {
    const u = await verifierEspaceAdmin(E);
    await annulerDepense(id, champ(fd, "motif"), u);
    revalidatePath("/amari", "layout");
    return { ok: true, message: "Dépense annulée : elle reste identifiable et sort des totaux actifs." };
  });
}

export async function enregistrerPoste(id: string | null, fd: FormData): Promise<Resultat> {
  return executer(async () => {
    const u = await verifierEspaceAdmin(E);
    const libelle = champ(fd, "libelle");
    if (libelle.length < 2) throw new ErreurMetier("Libellé obligatoire.", { libelle: "Obligatoire." });
    const actif = id ? fd.get("actif") === "on" : true;
    try {
      if (id) {
        const p = await prisma.poste.findFirst({ where: { id, activiteId: E } });
        if (!p) throw new ErreurMetier("Poste introuvable.");
        await prisma.poste.update({ where: { id }, data: { libelle, actif } });
      } else await prisma.poste.create({ data: { activiteId: E, libelle } });
    } catch (e) {
      if (estDoublon(e)) throw new ErreurMetier("Ce poste existe déjà.", { libelle: "Déjà utilisé." });
      throw e;
    }
    await journaliser({ activiteId: E, auteur: u, action: id ? "poste.modification" : "poste.creation", entite: "Poste", entiteId: id, resume: `Poste ${libelle}${id && !actif ? " désactivé" : ""}` });
    revalidatePath("/amari", "layout");
    return { ok: true, message: id ? "Poste mis à jour." : "Poste créé." };
  });
}

export async function enregistrerParticipant(id: string | null, fd: FormData): Promise<Resultat> {
  return executer(async () => {
    const u = await verifierEspaceAdmin(E);
    const nom = champ(fd, "nom");
    const partTxt = champ(fd, "partDefaut");
    const partDefautBp = partTxt ? saisieVersBp(partTxt) : null;
    if (nom.length < 2) throw new ErreurMetier("Nom obligatoire.", { nom: "Obligatoire." });
    if (partTxt && (partDefautBp === null || partDefautBp > 10000)) throw new ErreurMetier("Part par défaut entre 0 et 100 %.", { partDefaut: "Invalide." });
    const actif = id ? fd.get("actif") === "on" : true;
    try {
      if (id) {
        const p = await prisma.participant.findFirst({ where: { id, activiteId: E } });
        if (!p) throw new ErreurMetier("Participant introuvable.");
        await prisma.participant.update({ where: { id }, data: { nom, partDefautBp, actif } });
      } else await prisma.participant.create({ data: { activiteId: E, nom, partDefautBp } });
    } catch (e) {
      if (estDoublon(e)) throw new ErreurMetier("Ce participant existe déjà.", { nom: "Déjà utilisé." });
      throw e;
    }
    await journaliser({ activiteId: E, auteur: u, action: id ? "participant.modification" : "participant.creation", entite: "Participant", entiteId: id, resume: `Participant ${nom}` });
    revalidatePath("/amari", "layout");
    return { ok: true, message: "Participant enregistré. Les dépenses existantes gardent la clé appliquée." };
  });
}

export async function enregistrerCoutFixe(id: string | null, fd: FormData): Promise<Resultat> {
  return executer(async () => {
    const u = await verifierEspaceAdmin(E);
    const libelle = champ(fd, "libelle");
    const posteId = champ(fd, "posteId");
    const montantCents = saisieVersCents(champ(fd, "montant"));
    const periodicite = champ(fd, "periodicite");
    const champs: Record<string, string> = {};
    if (libelle.length < 2) champs.libelle = "Libellé obligatoire.";
    if (montantCents === null || montantCents <= 0) champs.montant = "Montant invalide.";
    if (!["MENSUELLE", "TRIMESTRIELLE", "ANNUELLE"].includes(periodicite)) champs.periodicite = "Périodicité invalide.";
    if (!(await prisma.poste.findFirst({ where: { id: posteId, activiteId: E } }))) champs.posteId = "Poste inconnu.";
    if (Object.keys(champs).length) throw new ErreurMetier("Certains champs sont à corriger.", champs);
    const data = { libelle, posteId, montantCents: montantCents!, periodicite, actif: id ? fd.get("actif") === "on" : true };
    if (id) {
      const c = await prisma.coutFixe.findFirst({ where: { id, activiteId: E } });
      if (!c) throw new ErreurMetier("Coût fixe introuvable.");
      await prisma.coutFixe.update({ where: { id }, data });
    } else await prisma.coutFixe.create({ data: { ...data, activiteId: E } });
    await journaliser({ activiteId: E, auteur: u, action: id ? "cout_fixe.modification" : "cout_fixe.creation", entite: "CoutFixe", entiteId: id, resume: `Coût fixe ${libelle}` });
    revalidatePath("/amari", "layout");
    return { ok: true, message: "Coût fixe enregistré (modèle de saisie, non compté dans les totaux)." };
  });
}
