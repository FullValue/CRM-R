import { exigerGestionnaire } from "@/lib/auth/acces";

/** Comptes, réglages et liaisons : réservés à l'administrateur désigné (ACC-02). */
export default async function LayoutAdministration({ children }: { children: React.ReactNode }) {
  await exigerGestionnaire();
  return children;
}
