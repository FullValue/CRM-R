import { exigerEspaceAdmin } from "@/lib/auth/acces";

/**
 * Contrôle d'habilitation de l'espace avant tout rendu : un lien direct vers
 * un espace non attribué est refusé côté serveur (ACC-01, R01).
 */
export default async function LayoutEspace({ children, params }: { children: React.ReactNode; params: Promise<{ espace: string }> }) {
  const { espace } = await params;
  await exigerEspaceAdmin(espace);
  return children;
}
