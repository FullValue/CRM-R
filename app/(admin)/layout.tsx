import { cookies } from "next/headers";
import { CadreCRM } from "@/components/barre-laterale";
import { exigerAdmin } from "@/lib/auth/acces";
import { cookiePalette, estPalette, PALETTES_DEFAUT } from "@/lib/palettes";

export default async function LayoutAdmin({ children }: { children: React.ReactNode }) {
  const u = await exigerAdmin();
  const jar = await cookies();
  const palettes = { ...PALETTES_DEFAUT };
  for (const espace of u.espaces) {
    const valeur = jar.get(cookiePalette(espace))?.value;
    if (estPalette(valeur)) palettes[espace] = valeur;
  }

  return (
    <CadreCRM nom={u.nom} email={u.email} espaces={u.espaces} gestionnaire={u.gestionnaire} palettesInitiales={palettes}>
      {children}
    </CadreCRM>
  );
}
