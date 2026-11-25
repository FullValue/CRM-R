"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  BarChart3Icon,
  BookOpenIcon,
  BoxesIcon,
  CalculatorIcon,
  ChevronsUpDownIcon,
  CoinsIcon,
  FileClockIcon,
  FileUpIcon,
  LayoutDashboardIcon,
  LogOutIcon,
  MapIcon,
  PackageIcon,
  PiggyBankIcon,
  PlusCircleIcon,
  ReceiptIcon,
  RefreshCwIcon,
  Settings2Icon,
  ShoppingBagIcon,
  TruckIcon,
  UsersIcon,
  WalletIcon,
  CheckIcon,
  type LucideIcon,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ESPACES, estEspace, type EspaceId } from "@/lib/domaine";

type Lien = { titre: string; href: string; icone: LucideIcon };

const MENUS: Record<EspaceId, Lien[]> = {
  maya: [
    { titre: "Catalogue", href: "/maya/catalogue", icone: BookOpenIcon },
    { titre: "Stock et mouvements", href: "/maya/stock", icone: BoxesIcon },
    { titre: "Coûts de revient", href: "/maya/couts", icone: CalculatorIcon },
    { titre: "Reprise et import", href: "/maya/import", icone: FileUpIcon },
  ],
  amari: [
    { titre: "Vue financière", href: "/amari/finances", icone: BarChart3Icon },
    { titre: "Dépenses", href: "/amari/depenses", icone: ReceiptIcon },
    { titre: "Coûts fixes", href: "/amari/couts-fixes", icone: CoinsIcon },
    { titre: "Postes et participants", href: "/amari/parametres", icone: UsersIcon },
    { titre: "Catalogue", href: "/amari/catalogue", icone: BookOpenIcon },
    { titre: "Stock et mouvements", href: "/amari/stock", icone: BoxesIcon },
  ],
  pm: [
    { titre: "Tableau de bord", href: "/pm/tableau-de-bord", icone: LayoutDashboardIcon },
    { titre: "Nouvelle vente", href: "/pm/ventes/nouvelle", icone: PlusCircleIcon },
    { titre: "Journal des ventes", href: "/pm/ventes", icone: ShoppingBagIcon },
    { titre: "Rentabilité", href: "/pm/rentabilite", icone: PiggyBankIcon },
    { titre: "Fonds de roulement", href: "/pm/tresorerie", icone: WalletIcon },
    { titre: "Zones et carte", href: "/pm/zones", icone: MapIcon },
    { titre: "Livraisons", href: "/pm/livraisons", icone: TruckIcon },
    { titre: "Catalogue", href: "/pm/catalogue", icone: BookOpenIcon },
    { titre: "Stock et mouvements", href: "/pm/stock", icone: BoxesIcon },
  ],
};

const ADMIN: Lien[] = [
  { titre: "Utilisateurs et accès", href: "/admin/utilisateurs", icone: UsersIcon },
  { titre: "Réglages métier", href: "/admin/reglages", icone: Settings2Icon },
  { titre: "Liaisons Shopify", href: "/admin/shopify", icone: RefreshCwIcon },
  { titre: "Journal d'audit", href: "/admin/journal", icone: FileClockIcon },
];

export function BarreLaterale({ nom, email, espaces, gestionnaire }: { nom: string; email: string; espaces: EspaceId[]; gestionnaire: boolean }) {
  const chemin = usePathname();
  const router = useRouter();
  const { isMobile, setOpenMobile } = useSidebar();
  const segment = chemin.split("/")[1] ?? "";
  const actif: EspaceId | null = estEspace(segment) && espaces.includes(segment) ? segment : null;
  const espaceMenu: EspaceId | undefined = actif ?? espaces[0];

  const estActif = (href: string) => {
    if (href === "/pm/ventes") return chemin === "/pm/ventes" || (chemin.startsWith("/pm/ventes/") && !chemin.startsWith("/pm/ventes/nouvelle"));
    return chemin === href || chemin.startsWith(`${href}/`);
  };
  const fermer = () => isMobile && setOpenMobile(false);

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton size="lg" className="data-[state=open]:bg-sidebar-accent" aria-label="Changer d'espace">
                  <div className="bg-primary text-primary-foreground flex aspect-square size-8 items-center justify-center rounded-lg">
                    <PackageIcon className="size-4" />
                  </div>
                  <div className="grid flex-1 text-left text-sm leading-tight">
                    <span className="truncate text-xs text-muted-foreground">{actif ? "Espace actif" : "Vue d'ensemble"}</span>
                    <span className="truncate font-semibold">{actif ? ESPACES[actif].nom : "Toutes mes activités"}</span>
                  </div>
                  <ChevronsUpDownIcon className="ml-auto" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="min-w-60" align="start" side={isMobile ? "bottom" : "right"}>
                <DropdownMenuLabel className="text-xs text-muted-foreground">Mes espaces autorisés</DropdownMenuLabel>
                {espaces.map((e) => (
                  <DropdownMenuItem
                    key={e}
                    onSelect={() => {
                      fermer();
                      router.push(MENUS[e][0].href);
                    }}
                  >
                    {ESPACES[e].nom}
                    {actif === e && <CheckIcon className="ml-auto" />}
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => router.push("/tableau-de-bord")}>
                  <LayoutDashboardIcon /> Vue d&apos;ensemble
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton asChild isActive={chemin === "/tableau-de-bord"} tooltip="Vue d'ensemble">
                <Link href="/tableau-de-bord" onClick={fermer}>
                  <LayoutDashboardIcon />
                  <span>Vue d&apos;ensemble</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroup>
        {espaceMenu && (
          <SidebarGroup>
            <SidebarGroupLabel>{ESPACES[espaceMenu].nom}</SidebarGroupLabel>
            <SidebarMenu>
              {MENUS[espaceMenu].map((l) => (
                <SidebarMenuItem key={l.href}>
                  <SidebarMenuButton asChild isActive={estActif(l.href)} tooltip={l.titre}>
                    <Link href={l.href} onClick={fermer}>
                      <l.icone />
                      <span>{l.titre}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroup>
        )}
        {gestionnaire && (
          <SidebarGroup>
            <SidebarGroupLabel>Administration</SidebarGroupLabel>
            <SidebarMenu>
              {ADMIN.map((l) => (
                <SidebarMenuItem key={l.href}>
                  <SidebarMenuButton asChild isActive={estActif(l.href)} tooltip={l.titre}>
                    <Link href={l.href} onClick={fermer}>
                      <l.icone />
                      <span>{l.titre}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroup>
        )}
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton size="lg">
                  <Avatar className="size-8 rounded-lg">
                    <AvatarFallback className="rounded-lg">{initiales(nom)}</AvatarFallback>
                  </Avatar>
                  <div className="grid flex-1 text-left text-sm leading-tight">
                    <span className="truncate font-medium">{nom}</span>
                    <span className="truncate text-xs text-muted-foreground">{email}</span>
                  </div>
                  <ChevronsUpDownIcon className="ml-auto size-4" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="min-w-56" side={isMobile ? "bottom" : "right"} align="end">
                <DropdownMenuLabel className="font-normal text-xs text-muted-foreground">Connecté en tant que {nom}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <form action="/deconnexion" method="post">
                  <DropdownMenuItem asChild>
                    <button type="submit" className="w-full">
                      <LogOutIcon /> Se déconnecter
                    </button>
                  </DropdownMenuItem>
                </form>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}

export function initiales(nom: string) {
  return nom
    .split(/\s+/)
    .map((m) => m[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}
