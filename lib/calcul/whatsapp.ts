import { jourMois } from "@/lib/dates";
import { libelleCreneau } from "./creneaux";

/**
 * Message WhatsApp prérempli (LIV-02) : référence, ville, date et créneau.
 * Le client vérifie puis déclenche lui-même l'envoi dans WhatsApp.
 */
export function messageWhatsApp(p: { reference: string; ville: string; date: string; debut: string; fin: string }): string {
  return `Bonjour, je souhaite commander la référence ${p.reference}. La livraison souhaitée est à ${p.ville} le ${jourMois(p.date)}, ${libelleCreneau(p.debut, p.fin)}. Pouvez-vous me confirmer ce créneau ?`;
}

/** Lien wa.me : numéro au format international sans « + » ni espaces. */
export function lienWhatsApp(numero: string, message: string): string {
  const num = numero.replace(/[^\d]/g, "");
  return `https://wa.me/${num}?text=${encodeURIComponent(message)}`;
}
