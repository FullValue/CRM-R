import { redirect } from "next/navigation";
import { exigerUtilisateur } from "@/lib/auth/acces";

export default async function Accueil() {
  const u = await exigerUtilisateur();
  redirect(u.role === "VENDEUR" ? "/vendeur" : "/tableau-de-bord");
}
