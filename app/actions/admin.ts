"use server";

import { revalidatePath } from "next/cache";
import { prisma, estDoublon } from "@/lib/db";
import { verifierGestionnaire } from "@/lib/auth/acces";
import { hacherMotDePasse, motDePasseInvalide } from "@/lib/auth/motdepasse";
import { revoquerSessions } from "@/lib/auth/session";
import { journaliser } from "@/lib/audit";
import { chiffrer } from "@/lib/chiffrement";
import { LISTE_ESPACES } from "@/lib/domaine";
import { REGLAGES_DEFAUT, type CleReglage } from "@/lib/reglages";
import { rapprocherParSku, testerBoutique, traiterFile } from "@/lib/shopify/sync";
import { champ, ErreurMetier, executer, type Resultat } from "@/lib/services/resultat";

// ------------------------------------------------------------------ Comptes

export async function enregistrerUtilisateur(id: string | null, fd: FormData): Promise<Resultat> {
  return executer(async () => {
    const g = await verifierGestionnaire();
    const nom = champ(fd, "nom");
    const email = champ(fd, "email").toLowerCase();
    const role = champ(fd, "role") === "VENDEUR" ? "VENDEUR" : "ADMIN";
    const espaces = LISTE_ESPACES.filter((e) => fd.get(`espace-${e}`) === "on");
    const mdp = String(fd.get("motDePasse") ?? "");
    const gestionnaire = role === "ADMIN" && fd.get("gestionnaire") === "on";
    const prixModifiable = fd.get("prixModifiable") === "on";
    const champs: Record<string, string> = {};
    if (nom.length < 2) champs.nom = "Nom obligatoire.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) champs.email = "Adresse e-mail invalide.";
    if (espaces.length === 0) champs.espaces = "Attribuez au moins un espace.";
    if (role === "VENDEUR" && !espaces.includes("pm")) champs.espaces = "Un vendeur est affecté à la Parfumerie Mobile (D05).";
    if (!id || mdp) {
      const err = motDePasseInvalide(mdp);
      if (err) champs.motDePasse = err;
    }
    if (Object.keys(champs).length) throw new ErreurMetier("Certains champs sont à corriger.", champs);
    if (id === g.id && (!gestionnaire || role !== "ADMIN")) throw new ErreurMetier("Vous ne pouvez pas retirer vos propres droits d'administrateur désigné.");

    try {
      await prisma.$transaction(async (tx) => {
        const data = { nom, email, role, gestionnaire, prixModifiable, ...(mdp ? { motDePasseHash: await hacherMotDePasse(mdp) } : {}) };
        const u = id ? await tx.utilisateur.update({ where: { id }, data }) : await tx.utilisateur.create({ data: { ...data, motDePasseHash: data.motDePasseHash! } });
        await tx.habilitation.deleteMany({ where: { utilisateurId: u.id } });
        await tx.habilitation.createMany({ data: espaces.map((a) => ({ utilisateurId: u.id, activiteId: a })) });
        await journaliser({ auteur: g, action: id ? "utilisateur.modification" : "utilisateur.creation", entite: "Utilisateur", entiteId: u.id, resume: `Compte ${nom} ${id ? "modifié" : "créé"} (${role}, ${espaces.join(", ")})${mdp && id ? " · mot de passe réinitialisé" : ""}` }, tx);
      });
    } catch (e) {
      if (estDoublon(e)) throw new ErreurMetier("Un compte existe déjà avec cette adresse.", { email: "Déjà utilisée." });
      throw e;
    }
    // Un changement de droits ou de mot de passe ferme les sessions ouvertes.
    if (id && id !== g.id) await revoquerSessions(id);
    revalidatePath("/admin/utilisateurs");
    return { ok: true, message: id ? (id === g.id ? "Compte mis à jour." : "Compte mis à jour. Ses sessions ouvertes ont été fermées.") : "Compte créé." };
  });
}

/** Désactivation (ACC-02, R02) : l'accès est perdu immédiatement, sessions révoquées. */
export async function basculerActivation(id: string): Promise<Resultat> {
  return executer(async () => {
    const g = await verifierGestionnaire();
    if (id === g.id) throw new ErreurMetier("Vous ne pouvez pas désactiver votre propre compte.");
    const u = await prisma.utilisateur.findUnique({ where: { id } });
    if (!u) throw new ErreurMetier("Compte introuvable.");
    const actif = !u.actif;
    await prisma.utilisateur.update({ where: { id }, data: { actif, desactiveLe: actif ? null : new Date() } });
    if (!actif) await revoquerSessions(id);
    await journaliser({ auteur: g, action: actif ? "utilisateur.reactivation" : "utilisateur.desactivation", entite: "Utilisateur", entiteId: id, resume: `Compte ${u.nom} ${actif ? "réactivé" : "désactivé (sessions révoquées)"}` });
    revalidatePath("/admin/utilisateurs");
    return { ok: true, message: actif ? "Compte réactivé." : "Compte désactivé : ses sessions actives sont révoquées." };
  });
}

// ------------------------------------------------------------------ Réglages

export async function enregistrerReglages(fd: FormData): Promise<Resultat> {
  return executer(async () => {
    const g = await verifierGestionnaire();
    const valeurs: Partial<Record<CleReglage, string>> = {};
    for (const cle of Object.keys(REGLAGES_DEFAUT) as CleReglage[]) {
      const v = fd.get(cle);
      if (typeof v === "string") valeurs[cle] = v.trim();
    }
    const champs: Record<string, string> = {};
    if (valeurs["stock.politique"] && !["BLOQUER", "AUTORISER"].includes(valeurs["stock.politique"])) champs["stock.politique"] = "Valeur inconnue.";
    if (valeurs["vente.base_montants"] && !["HT", "TTC"].includes(valeurs["vente.base_montants"])) champs["vente.base_montants"] = "HT ou TTC.";
    if (valeurs["whatsapp.numero"] && !/^\+?[\d\s.]{8,20}$/.test(valeurs["whatsapp.numero"])) champs["whatsapp.numero"] = "Numéro international (ex. +33 6 12 34 56 78).";
    for (const k of ["whatsapp.delai_jours", "whatsapp.horizon_jours"] as const) {
      if (valeurs[k] && !/^\d{1,2}$/.test(valeurs[k]!)) champs[k] = "Nombre de jours.";
    }
    if (Object.keys(champs).length) throw new ErreurMetier("Certains réglages sont invalides.", champs);
    const avant = await prisma.reglage.findMany();
    await prisma.$transaction(Object.entries(valeurs).map(([cle, valeur]) => prisma.reglage.upsert({ where: { cle }, create: { cle, valeur }, update: { valeur } })));
    await journaliser({ auteur: g, action: "reglages.modification", entite: "Reglage", resume: "Réglages métier modifiés", details: { avant: Object.fromEntries(avant.map((r) => [r.cle, r.valeur])), apres: valeurs } });
    revalidatePath("/", "layout");
    return { ok: true, message: "Réglages enregistrés." };
  });
}

// ------------------------------------------------------------------ Shopify

export async function enregistrerBoutique(id: string, fd: FormData): Promise<Resultat> {
  return executer(async () => {
    const g = await verifierGestionnaire();
    const b = await prisma.boutique.findUnique({ where: { id } });
    if (!b) throw new ErreurMetier("Boutique introuvable.");
    const domaine = champ(fd, "domaine").toLowerCase();
    const jeton = String(fd.get("jeton") ?? "").trim();
    const emplacementId = champ(fd, "emplacementId") || null;
    if (domaine && !/^[a-z0-9-]+\.myshopify\.com$/.test(domaine)) throw new ErreurMetier("Domaine attendu : boutique.myshopify.com", { domaine: "Format invalide." });
    if (emplacementId && !/^gid:\/\/shopify\/Location\/\d+$/.test(emplacementId)) throw new ErreurMetier("Emplacement attendu : gid://shopify/Location/123", { emplacementId: "Format invalide." });
    let jetonChiffre: string | undefined;
    if (jeton) {
      try {
        jetonChiffre = chiffrer(jeton);
      } catch {
        throw new ErreurMetier("Chiffrement indisponible : la variable CHIFFREMENT_CLE du serveur est absente ou invalide.");
      }
    }
    await prisma.boutique.update({
      where: { id },
      data: { domaine: domaine || null, emplacementId, droitEcriture: fd.get("droitEcriture") === "on", ...(jetonChiffre ? { jetonChiffre } : {}), statut: domaine && (jetonChiffre || b.jetonChiffre) ? (jetonChiffre ? "NON_CONFIGUREE" : b.statut) : "NON_CONFIGUREE" },
    });
    // Le jeton n'est jamais journalisé.
    await journaliser({ activiteId: b.activiteId, auteur: g, action: "shopify.configuration", entite: "Boutique", entiteId: id, resume: `Boutique ${b.nom} configurée${jeton ? " (jeton remplacé)" : ""}` });
    revalidatePath("/admin/shopify");
    return { ok: true, message: "Boutique enregistrée. Testez la connexion avant d'ouvrir les échanges." };
  });
}

export async function actionShopify(boutiqueId: string, action: "tester" | "rapprocher" | "file"): Promise<Resultat> {
  return executer(async () => {
    const g = await verifierGestionnaire();
    const b = await prisma.boutique.findUnique({ where: { id: boutiqueId } });
    if (!b) throw new ErreurMetier("Boutique introuvable.");
    const r = action === "tester" ? await testerBoutique(boutiqueId, g) : action === "rapprocher" ? await rapprocherParSku(b.activiteId, g) : await traiterFile(b.activiteId, g);
    revalidatePath("/admin/shopify");
    return r.ok ? { ok: true, message: r.message } : { ok: false, message: r.message };
  });
}

/** Liaison manuelle d'un format (SKU ambigu ou absent) ou dissociation (SHP-01). */
export async function lierFormat(formatId: string, fd: FormData): Promise<Resultat> {
  return executer(async () => {
    const g = await verifierGestionnaire();
    const f = await prisma.format.findUnique({ where: { id: formatId } });
    if (!f) throw new ErreurMetier("Format introuvable.");
    const variant = champ(fd, "variantId");
    const inventaire = champ(fd, "inventoryItemId");
    if (!variant && !inventaire) {
      await prisma.format.update({ where: { id: formatId }, data: { lienStatut: "NON_LIE", shopifyVariantId: null, shopifyInventoryItemId: null, lienMessage: "Dissocié manuellement" } });
      await journaliser({ activiteId: f.activiteId, auteur: g, action: "shopify.dissociation", entite: "Format", entiteId: formatId, resume: `Format ${f.sku} dissocié de Shopify (ventes et mouvements conservés)` });
    } else {
      if (!/^gid:\/\/shopify\/ProductVariant\/\d+$/.test(variant)) throw new ErreurMetier("Identifiant de variante attendu : gid://shopify/ProductVariant/…", { variantId: "Format invalide." });
      if (!/^gid:\/\/shopify\/InventoryItem\/\d+$/.test(inventaire)) throw new ErreurMetier("Article de stock attendu : gid://shopify/InventoryItem/…", { inventoryItemId: "Format invalide." });
      await prisma.format.update({ where: { id: formatId }, data: { lienStatut: "LIE", shopifyVariantId: variant, shopifyInventoryItemId: inventaire, lienMessage: "Lié manuellement" } });
      await journaliser({ activiteId: f.activiteId, auteur: g, action: "shopify.liaison", entite: "Format", entiteId: formatId, resume: `Format ${f.sku} lié manuellement à ${variant}` });
    }
    revalidatePath("/admin/shopify");
    return { ok: true, message: "Liaison mise à jour." };
  });
}

/** Opération incertaine vérifiée à la main : marquée appliquée ou remise en file. */
export async function resoudreOperation(id: string, decision: "appliquee" | "rejouer"): Promise<Resultat> {
  return executer(async () => {
    const g = await verifierGestionnaire();
    const op = await prisma.operationSync.findUnique({ where: { id }, include: { format: true } });
    if (!op) throw new ErreurMetier("Opération introuvable.");
    await prisma.operationSync.update({ where: { id }, data: decision === "appliquee" ? { statut: "OK", erreur: "Vérifiée manuellement dans Shopify" } : { statut: "EN_ATTENTE", erreur: null } });
    await journaliser({ activiteId: op.format.activiteId, auteur: g, action: "shopify.resolution", entite: "OperationSync", entiteId: id, resume: `Ajustement ${op.format.sku} ${decision === "appliquee" ? "constaté appliqué" : "remis en file après vérification"}` });
    revalidatePath("/admin/shopify");
    return { ok: true, message: decision === "appliquee" ? "Marquée comme appliquée." : "Remise en file." };
  });
}
