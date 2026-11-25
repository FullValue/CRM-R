"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { verifierEspaceAdmin, verifierSaisieVente } from "@/lib/auth/acces";
import { annulerVente, corrigerVente, enregistrerVente, majLivraison, reglerVente, type IssueVente } from "@/lib/services/ventes";
import { champ, ErreurMetier, executer, type Resultat } from "@/lib/services/resultat";
import { saisieVersCents } from "@/lib/argent";

const schemaVente = z.object({
  cleIdempotence: z.string().min(8).max(80),
  client: z.string().trim().max(120),
  commentaire: z.string().trim().max(500).optional(),
  dateVente: z.string(),
  canal: z.string().default("TERRAIN"),
  vendeurId: z.string().optional(),
  zoneId: z.string().nullable(),
  zoneProvenance: z.enum(["PROPOSEE", "SAISIE", "NON_RENSEIGNEE"]),
  lignes: z.array(z.object({ formatId: z.string(), quantite: z.number(), prixUnitaireCents: z.number().nullable() })).max(20),
  coutCommandeCents: z.number().nullable().optional(),
  regleeLe: z.string().nullable().optional(),
  livraison: z.object({ etat: z.string(), date: z.string().nullable().optional(), creneau: z.string().nullable().optional(), ville: z.string().nullable().optional() }).nullable().optional(),
});

/**
 * Déclaration d'une vente (VEN-01). Accessible au vendeur et à
 * l'administrateur habilité à la Parfumerie Mobile. Idempotente (VEN-02).
 */
export async function declarerVente(donnees: unknown): Promise<Resultat<IssueVente>> {
  return executer(async () => {
    const u = await verifierSaisieVente();
    const parse = schemaVente.safeParse(donnees);
    if (!parse.success) throw new ErreurMetier("Saisie incomplète ou mal formée. Vérifiez les champs.");
    const s = parse.data;
    // Le vendeur ne choisit ni le vendeur, ni le coût, ni la livraison confirmée.
    const estAdmin = u.role === "ADMIN";
    const issue = await enregistrerVente(
      {
        ...s,
        vendeurId: estAdmin ? s.vendeurId : undefined,
        coutCommandeCents: estAdmin ? (s.coutCommandeCents ?? null) : null,
        canal: estAdmin ? s.canal : s.canal === "WHATSAPP" ? "WHATSAPP" : "TERRAIN",
        livraison: s.livraison ? { ...s.livraison, etat: estAdmin ? s.livraison.etat : "PREFERENCE" } : null,
      },
      u,
    );
    revalidatePath("/pm", "layout");
    revalidatePath("/vendeur", "layout");
    return {
      ok: true,
      message: issue.statut === "deja" ? `Vente ${issue.numero} déjà enregistrée : aucun doublon créé.` : `Vente ${issue.numero} enregistrée.`,
      donnees: issue,
    };
  });
}

function lignesCorrection(fd: FormData) {
  const ids = fd.getAll("ligneId").map(String);
  return ids.map((id) => {
    const q = Number(champ(fd, `quantite-${id}`));
    const pu = saisieVersCents(champ(fd, `prix-${id}`));
    const coutTxt = champ(fd, `cout-${id}`);
    const cout = coutTxt === "" ? null : saisieVersCents(coutTxt);
    if (pu === null) throw new ErreurMetier("Prix unitaire invalide.", { [`prix-${id}`]: "Invalide." });
    if (coutTxt !== "" && cout === null) throw new ErreurMetier("Coût unitaire invalide.", { [`cout-${id}`]: "Invalide." });
    return { id, quantite: q, prixUnitaireCents: pu, coutUnitaireCents: cout };
  });
}

export async function corrigerVenteAction(venteId: string, fd: FormData): Promise<Resultat> {
  return executer(async () => {
    const u = await verifierEspaceAdmin("pm");
    const coutCmdTxt = champ(fd, "coutCommande");
    const coutCommande = coutCmdTxt === "" ? null : saisieVersCents(coutCmdTxt);
    if (coutCmdTxt !== "" && coutCommande === null) throw new ErreurMetier("Prix de touche de commande invalide.", { coutCommande: "Invalide." });
    const zone = champ(fd, "zoneId");
    await corrigerVente(
      venteId,
      {
        motif: champ(fd, "motif"),
        client: champ(fd, "client"),
        commentaire: champ(fd, "commentaire") || null,
        dateVente: champ(fd, "dateVente"),
        zoneId: zone && zone !== "aucune" ? zone : null,
        coutCommandeCents: coutCommande,
        repercuterStock: fd.get("repercuterStock") === "on",
        lignes: lignesCorrection(fd),
      },
      u,
    );
    revalidatePath("/pm", "layout");
    return { ok: true, message: "Vente corrigée. Journal, indicateurs et stock sont à jour." };
  });
}

export async function annulerVenteAction(venteId: string, fd: FormData): Promise<Resultat> {
  return executer(async () => {
    const u = await verifierEspaceAdmin("pm");
    await annulerVente(venteId, { motif: champ(fd, "motif"), retourStock: fd.get("retourStock") === "on", rembourse: fd.get("rembourse") === "on" }, u);
    revalidatePath("/pm", "layout");
    return { ok: true, message: "Vente annulée." };
  });
}

export async function reglerVenteAction(venteId: string, fd: FormData): Promise<Resultat> {
  return executer(async () => {
    const u = await verifierEspaceAdmin("pm");
    await reglerVente(venteId, champ(fd, "date"), u);
    revalidatePath("/pm", "layout");
    return { ok: true, message: "Règlement enregistré : l'encaissement entre dans le fonds de roulement à sa date." };
  });
}

export async function livraisonAction(venteId: string, fd: FormData): Promise<Resultat> {
  return executer(async () => {
    const u = await verifierEspaceAdmin("pm");
    await majLivraison(
      venteId,
      { etat: champ(fd, "etat"), date: champ(fd, "date") || null, creneau: champ(fd, "creneau") || null, ville: champ(fd, "ville") || null, effective: champ(fd, "effective") || null },
      u,
    );
    revalidatePath("/pm", "layout");
    return { ok: true, message: "Livraison mise à jour." };
  });
}
