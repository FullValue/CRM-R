"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowUpRightIcon, ListIcon, LogOutIcon, PlusIcon } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

export function NavigationVendeur({ nom, admin }: { nom: string; admin: boolean }) {
  const chemin = usePathname();
  const initiales = nom.trim().split(/\s+/).slice(0, 2).map((mot) => mot[0]).join("").toUpperCase();

  return (
    <>
    <header className="crm-vendeur-header">
      <Link href="/vendeur" className="crm-brand"><span>Parfumerie Mobile</span></Link>
      <nav aria-label="Espace vendeur" className="crm-vendeur-nav">
        <Link href="/vendeur" aria-current={chemin === "/vendeur" ? "page" : undefined}><PlusIcon /> Déclarer</Link>
        <Link href="/vendeur/ventes" aria-current={chemin === "/vendeur/ventes" ? "page" : undefined}><ListIcon /> Mes ventes</Link>
      </nav>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="crm-compte" type="button" aria-label={`Compte de ${nom}`}>
            <span className="crm-avatar" aria-hidden="true">{initiales}</span>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          {admin && <DropdownMenuItem asChild><Link href="/tableau-de-bord">Administration <ArrowUpRightIcon className="ml-auto" /></Link></DropdownMenuItem>}
          <form action="/deconnexion" method="post">
            <DropdownMenuItem asChild><button type="submit" className="w-full"><LogOutIcon /> Se déconnecter</button></DropdownMenuItem>
          </form>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
    <nav className="crm-tabbar crm-tabbar-vendeur" aria-label="Raccourcis vendeur">
      <Link href="/vendeur" aria-current={chemin === "/vendeur" ? "page" : undefined}>
        <span className="crm-tabbar-icone"><PlusIcon aria-hidden="true" /></span><span>Déclarer</span>
      </Link>
      <Link href="/vendeur/ventes" aria-current={chemin === "/vendeur/ventes" ? "page" : undefined}>
        <span className="crm-tabbar-icone"><ListIcon aria-hidden="true" /></span><span>Mes ventes</span>
      </Link>
    </nav>
    </>
  );
}
