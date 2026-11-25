"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { verifierEspaceAdmin } from "@/lib/auth/acces";
import { journaliser } from "@/lib/audit";
import { estDateIso } from "@/lib/dates";
import { champ, ErreurMetier, executer, type Resultat } from "@/lib/services/resultat";

function nombreDecimal(s: string) {
  const v = Number(s.replace(",", "."));
  return Number.isFinite(v) ? v : NaN;
}

export async function enregistrerZone(id: string | null, fd: FormData): Promise<Resultat> {
  return executer(async () => {
    const u = await verifierEspaceAdmin("pm");
    const libelle = champ(fd, "libelle");
    const ville = champ(fd, "ville");
    const lat = nombreDecimal(champ(fd, "lat"));
    const lng = nombreDecimal(champ(fd, "lng"));
    const rayonKm = nombreDecimal(champ(fd, "rayonKm") || "2");
    const champs: Record<string, string> = {};
    if (libelle.length < 2) champs.libelle = "Libellé obligatoire.";
    if (ville.length < 2) champs.ville = "Ville obligatoire.";
    if (!(lat >= -90 && lat <= 90)) champs.lat = "Latitude invalide (ex. 45,7597).";
    if (!(lng >= -180 && lng <= 180)) champs.lng = "Longitude invalide (ex. 4,8357).";
    if (!(rayonKm > 0 && rayonKm <= 50)) champs.rayonKm = "Rayon entre 0 et 50 km.";
    if (Object.keys(champs).length) throw new ErreurMetier("Certains champs sont à corriger.", champs);
    const data = { libelle, ville, lat, lng, rayonKm, livraison: fd.get("livraison") === "on", active: id ? fd.get("active") === "on" : true };
    if (id) {
      const z = await prisma.zone.findFirst({ where: { id, activiteId: "pm" } });
      if (!z) throw new ErreurMetier("Zone introuvable.");
      await prisma.zone.update({ where: { id }, data });
    } else {
      await prisma.zone.create({ data: { ...data, activiteId: "pm" } });
    }
    await journaliser({ activiteId: "pm", auteur: u, action: id ? "zone.modification" : "zone.creation", entite: "Zone", entiteId: id, resume: `Zone ${libelle} ${id ? "modifiée" : "créée"}` });
    revalidatePath("/pm/zones");
    revalidatePath("/pm/livraisons");
    return { ok: true, message: id ? "Zone mise à jour." : "Zone créée." };
  });
}

export async function ajouterCreneau(fd: FormData): Promise<Resultat> {
  return executer(async () => {
    const u = await verifierEspaceAdmin("pm");
    const zoneId = champ(fd, "zoneId");
    const jour = Number(champ(fd, "jour"));
    const heureDebut = champ(fd, "heureDebut");
    const heureFin = champ(fd, "heureFin");
    const champs: Record<string, string> = {};
    if (!(jour >= 1 && jour <= 7)) champs.jour = "Jour invalide.";
    if (!/^\d{2}:\d{2}$/.test(heureDebut)) champs.heureDebut = "Heure invalide.";
    if (!/^\d{2}:\d{2}$/.test(heureFin)) champs.heureFin = "Heure invalide.";
    if (heureFin <= heureDebut) champs.heureFin = "La fin doit suivre le début.";
    if (Object.keys(champs).length) throw new ErreurMetier("Certains champs sont à corriger.", champs);
    const z = await prisma.zone.findFirst({ where: { id: zoneId, activiteId: "pm" } });
    if (!z) throw new ErreurMetier("Zone introuvable.", { zoneId: "Zone introuvable." });
    await prisma.creneau.create({ data: { zoneId, jour, heureDebut, heureFin } });
    await journaliser({ activiteId: "pm", auteur: u, action: "creneau.creation", entite: "Zone", entiteId: zoneId, resume: `Créneau ajouté à ${z.libelle}` });
    revalidatePath("/pm/livraisons");
    return { ok: true, message: "Créneau ajouté." };
  });
}

export async function supprimerCreneau(id: string): Promise<Resultat> {
  return executer(async () => {
    const u = await verifierEspaceAdmin("pm");
    const c = await prisma.creneau.findFirst({ where: { id, zone: { activiteId: "pm" } }, include: { zone: true } });
    if (!c) throw new ErreurMetier("Créneau introuvable.");
    await prisma.creneau.delete({ where: { id } });
    await journaliser({ activiteId: "pm", auteur: u, action: "creneau.suppression", entite: "Zone", entiteId: c.zoneId, resume: `Créneau retiré de ${c.zone.libelle}` });
    revalidatePath("/pm/livraisons");
    return { ok: true, message: "Créneau retiré." };
  });
}

export async function ajouterFermeture(fd: FormData): Promise<Resultat> {
  return executer(async () => {
    const u = await verifierEspaceAdmin("pm");
    const zoneId = champ(fd, "zoneId");
    const date = champ(fd, "date");
    if (!estDateIso(date)) throw new ErreurMetier("Date invalide.", { date: "Date invalide." });
    const z = await prisma.zone.findFirst({ where: { id: zoneId, activiteId: "pm" } });
    if (!z) throw new ErreurMetier("Zone introuvable.");
    await prisma.fermetureZone.upsert({ where: { zoneId_date: { zoneId, date } }, create: { zoneId, date, motif: champ(fd, "motif") || null }, update: { motif: champ(fd, "motif") || null } });
    await journaliser({ activiteId: "pm", auteur: u, action: "fermeture.creation", entite: "Zone", entiteId: zoneId, resume: `Fermeture de ${z.libelle} le ${date}` });
    revalidatePath("/pm/livraisons");
    return { ok: true, message: "Exception enregistrée : aucun créneau proposé ce jour-là." };
  });
}

export async function supprimerFermeture(id: string): Promise<Resultat> {
  return executer(async () => {
    await verifierEspaceAdmin("pm");
    const f = await prisma.fermetureZone.findFirst({ where: { id, zone: { activiteId: "pm" } } });
    if (!f) throw new ErreurMetier("Exception introuvable.");
    await prisma.fermetureZone.delete({ where: { id } });
    revalidatePath("/pm/livraisons");
    return { ok: true, message: "Exception retirée." };
  });
}
