import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { NavigationVendeur } from "@/components/navigation-vendeur";
import { UtiliserPalette } from "@/components/palette-espace";
import { exigerUtilisateur } from "@/lib/auth/acces";
import { cookiePalette, estPalette, PALETTES_DEFAUT } from "@/lib/palettes";

export default async function LayoutVendeur({ children }: { children: React.ReactNode }) {
  const u = await exigerUtilisateur();
  if (!u.espaces.includes("pm")) redirect("/acces-refuse?espace=pm");
  const paletteCookie = (await cookies()).get(cookiePalette("pm"))?.value;
  const palette = estPalette(paletteCookie) ? paletteCookie : PALETTES_DEFAUT.pm;

  return (
    <div className="crm-vendeur" data-palette={palette}>
      <UtiliserPalette palette={palette} />
      <NavigationVendeur nom={u.nom} admin={u.role === "ADMIN"} />
      <main className="mx-auto max-w-5xl px-4 pt-6 pb-24 sm:pt-9">{children}</main>
    </div>
  );
}
