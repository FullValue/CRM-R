import Link from "next/link";
import { redirect } from "next/navigation";
import { ListIcon, LogOutIcon, PlusCircleIcon } from "lucide-react";
import { exigerUtilisateur } from "@/lib/auth/acces";
import { Button } from "@/components/ui/button";

/** Accès vendeur distinct, centré sur « Déclarer une vente » (ACC-02, VEN-01). */
export default async function LayoutVendeur({ children }: { children: React.ReactNode }) {
  const u = await exigerUtilisateur();
  if (!u.espaces.includes("pm")) redirect("/acces-refuse?espace=pm");
  return (
    <div className="min-h-svh bg-muted/30">
      <header className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-2 px-4">
          <div className="min-w-0 leading-tight">
            <div className="text-xs text-muted-foreground">Parfumerie Mobile · Vendeur</div>
            <div className="truncate text-sm font-semibold">{u.nom}</div>
          </div>
          <nav className="flex shrink-0 items-center gap-1">
            <Button variant="ghost" size="sm" asChild>
              <Link href="/vendeur">
                <PlusCircleIcon /> <span className="hidden sm:inline">Déclarer</span>
              </Link>
            </Button>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/vendeur/ventes">
                <ListIcon /> <span className="hidden sm:inline">Mes ventes</span>
              </Link>
            </Button>
            {u.role === "ADMIN" && (
              <Button variant="outline" size="sm" asChild>
                <Link href="/tableau-de-bord">Administration</Link>
              </Button>
            )}
            <form action="/deconnexion" method="post">
              <Button variant="ghost" size="icon-sm" type="submit" aria-label="Se déconnecter">
                <LogOutIcon />
              </Button>
            </form>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-5xl p-4 pb-24">{children}</main>
    </div>
  );
}
