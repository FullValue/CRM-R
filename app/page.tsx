import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { exigerUtilisateur } from "@/lib/auth/acces";
import { COOKIE_MODE, estModeLivraison, ROUTE_LIVRAISON } from "@/lib/mode";

export default async function Accueil() {
  const u = await exigerUtilisateur();
  if (u.role === "VENDEUR") redirect("/vendeur");
  const livraison = u.espaces.includes("pm") && estModeLivraison((await cookies()).get(COOKIE_MODE)?.value);
  redirect(livraison ? ROUTE_LIVRAISON : "/tableau-de-bord");
}
