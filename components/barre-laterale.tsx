"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  ArrowUpRightIcon, BarChart3Icon, BookOpenIcon, BoxesIcon, CalculatorIcon, CalendarClockIcon, ChevronDownIcon,
  CoinsIcon, FileClockIcon, FileUpIcon, LayoutDashboardIcon, LogOutIcon, MapIcon, MenuIcon,
  PaletteIcon, PanelLeftCloseIcon, PanelLeftOpenIcon, PlusIcon, ReceiptIcon, RefreshCwIcon,
  Settings2Icon, ShoppingBagIcon, TruckIcon, UsersIcon, WalletIcon, type LucideIcon,
} from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuRadioGroup,
  DropdownMenuRadioItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { PalettesContext, UtiliserPalette } from "@/components/palette-espace";
import { BasculeLivraison } from "@/components/mobile/bascule-livraison";
import { ROUTE_LIVRAISON, type ModeApp } from "@/lib/mode";
import { ESPACES, estEspace, type EspaceId } from "@/lib/domaine";
import { PALETTES, PALETTES_DEFAUT, cookiePalette, estPalette, type PalettesEspaces } from "@/lib/palettes";

type Lien = { titre: string; href: string; icone: LucideIcon };
type Groupe = { titre: string; liens: Lien[] };

const VUE_ENSEMBLE: Lien = { titre: "Vue d’ensemble", href: "/tableau-de-bord", icone: LayoutDashboardIcon };

const MENUS: Record<EspaceId, Groupe[]> = {
  maya: [
    { titre: "Produits", liens: [
      { titre: "Catalogue", href: "/maya/catalogue", icone: BookOpenIcon },
      { titre: "Stock et mouvements", href: "/maya/stock", icone: BoxesIcon },
      { titre: "Coûts de revient", href: "/maya/couts", icone: CalculatorIcon },
      { titre: "Reprise et import", href: "/maya/import", icone: FileUpIcon },
    ] },
  ],
  amari: [
    { titre: "Finances", liens: [
      { titre: "Vue financière", href: "/amari/finances", icone: BarChart3Icon },
      { titre: "Dépenses", href: "/amari/depenses", icone: ReceiptIcon },
      { titre: "Coûts fixes", href: "/amari/couts-fixes", icone: CoinsIcon },
      { titre: "Postes et participants", href: "/amari/parametres", icone: UsersIcon },
    ] },
    { titre: "Produits", liens: [
      { titre: "Catalogue", href: "/amari/catalogue", icone: BookOpenIcon },
      { titre: "Stock et mouvements", href: "/amari/stock", icone: BoxesIcon },
    ] },
  ],
  pm: [
    { titre: "Ventes", liens: [
      { titre: "Tableau de bord", href: "/pm/tableau-de-bord", icone: LayoutDashboardIcon },
      { titre: "Nouvelle vente", href: "/pm/ventes/nouvelle", icone: PlusIcon },
      { titre: "Journal des ventes", href: "/pm/ventes", icone: ShoppingBagIcon },
      { titre: "Livraisons", href: "/pm/livraisons", icone: TruckIcon },
      { titre: "Zones et carte", href: "/pm/zones", icone: MapIcon },
    ] },
    { titre: "Finances", liens: [
      { titre: "Rentabilité", href: "/pm/rentabilite", icone: BarChart3Icon },
      { titre: "Fonds de roulement", href: "/pm/tresorerie", icone: WalletIcon },
    ] },
    { titre: "Produits", liens: [
      { titre: "Catalogue", href: "/pm/catalogue", icone: BookOpenIcon },
      { titre: "Stock et mouvements", href: "/pm/stock", icone: BoxesIcon },
    ] },
  ],
};

const ADMIN: Groupe = { titre: "Administration", liens: [
  { titre: "Utilisateurs et accès", href: "/admin/utilisateurs", icone: UsersIcon },
  { titre: "Réglages métier", href: "/admin/reglages", icone: Settings2Icon },
  { titre: "Liaisons Shopify", href: "/admin/shopify", icone: RefreshCwIcon },
  { titre: "Journal d’audit", href: "/admin/journal", icone: FileClockIcon },
] };

const ACCUEILS: Record<EspaceId, string> = { maya: "/maya/catalogue", amari: "/amari/finances", pm: "/pm/tableau-de-bord" };

/** Onglets du bas d'écran sur téléphone : les gestes du quotidien à portée de pouce. */
type Onglet = Lien & { principal?: boolean };
const ONGLETS: Record<EspaceId, Onglet[]> = {
  pm: [
    { titre: "Accueil", href: "/pm/tableau-de-bord", icone: LayoutDashboardIcon },
    { titre: "Ventes", href: "/pm/ventes", icone: ShoppingBagIcon },
    { titre: "Vendre", href: "/pm/ventes/nouvelle", icone: PlusIcon, principal: true },
    { titre: "Livraisons", href: "/pm/livraisons", icone: TruckIcon },
  ],
  maya: [
    { titre: "Accueil", href: "/tableau-de-bord", icone: LayoutDashboardIcon },
    { titre: "Catalogue", href: "/maya/catalogue", icone: BookOpenIcon },
    { titre: "Stock", href: "/maya/stock", icone: BoxesIcon },
    { titre: "Coûts", href: "/maya/couts", icone: CalculatorIcon },
  ],
  amari: [
    { titre: "Accueil", href: "/tableau-de-bord", icone: LayoutDashboardIcon },
    { titre: "Finances", href: "/amari/finances", icone: BarChart3Icon },
    { titre: "Dépenses", href: "/amari/depenses", icone: ReceiptIcon },
    { titre: "Stock", href: "/amari/stock", icone: BoxesIcon },
  ],
};
/** Mode livraison : la barre d'onglets ne garde que les gestes de la tournée. */
const ONGLETS_LIVRAISON: Onglet[] = [
  { titre: "Tournée", href: ROUTE_LIVRAISON, icone: TruckIcon },
  { titre: "Créneaux", href: "/pm/livraisons", icone: CalendarClockIcon },
  { titre: "Zones", href: "/pm/zones", icone: MapIcon },
  { titre: "Ventes", href: "/pm/ventes", icone: ShoppingBagIcon },
];
const TITRES_ONGLETS: Record<EspaceId, string> = { maya: "Maya", amari: "Amari", pm: "Parfums" };
const ICONES_ESPACES: Record<EspaceId, LucideIcon> = { maya: BookOpenIcon, amari: BarChart3Icon, pm: ShoppingBagIcon };

function ongletsHorsEspace(espaces: EspaceId[]): Onglet[] {
  const onglets: Onglet[] = [{ ...VUE_ENSEMBLE, titre: "Accueil" }];
  for (const e of espaces) onglets.push({ titre: TITRES_ONGLETS[e], href: ACCUEILS[e], icone: ICONES_ESPACES[e] });
  if (espaces.includes("pm")) onglets.splice(Math.ceil(onglets.length / 2), 0, { titre: "Vendre", href: "/pm/ventes/nouvelle", icone: PlusIcon, principal: true });
  return onglets;
}

export function CadreCRM({ nom, email, espaces, gestionnaire, palettesInitiales, modeInitial, children }: {
  nom: string;
  email: string;
  espaces: EspaceId[];
  gestionnaire: boolean;
  palettesInitiales: PalettesEspaces;
  modeInitial: ModeApp;
  children: React.ReactNode;
}) {
  const chemin = usePathname();
  const segment = chemin.split("/")[1] ?? "";
  const espace = estEspace(segment) && espaces.includes(segment) ? segment : null;
  const [palettes, setPalettes] = useState(palettesInitiales);
  const [replie, setReplie] = useState(false);
  const [menuMobile, setMenuMobile] = useState(false);
  const livraisonPossible = espaces.includes("pm");
  const [mode, setMode] = useState<ModeApp>(livraisonPossible ? modeInitial : "gestion");
  const enLivraison = mode === "livraison";
  const [defile, setDefile] = useState(false);
  const [titrePage, setTitrePage] = useState("");
  const palette = espace ? palettes[espace] : PALETTES_DEFAUT.pm;
  const groupes = espace ? MENUS[espace] : enLivraison ? MENUS.pm : [];
  const afficherAdmin = gestionnaire && (segment === "admin" || (!espace && !enLivraison));
  const titre = enLivraison ? "Livraison" : espace ? ESPACES[espace].nom : segment === "admin" ? "Administration" : "Vue d’ensemble";
  const onglets = enLivraison ? ONGLETS_LIVRAISON : espace ? ONGLETS[espace] : ongletsHorsEspace(espaces);
  const routeActive = [VUE_ENSEMBLE, ...groupes.flatMap((g) => g.liens), ...ADMIN.liens, ...onglets]
    .filter((l) => chemin === l.href || chemin.startsWith(`${l.href}/`))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;

  const indexActif = onglets.findIndex((o) => o.href === routeActive);

  // Grand titre façon iOS : au défilement, il se replie dans la barre du haut.
  useEffect(() => {
    let image = 0;
    function lire() {
      image = 0;
      const bas = window.scrollY > 52;
      setDefile(bas);
      if (bas) setTitrePage(document.querySelector("#contenu-crm h1")?.textContent?.trim() ?? "");
    }
    function auDefilement() { if (!image) image = requestAnimationFrame(lire); }
    lire();
    window.addEventListener("scroll", auDefilement, { passive: true });
    return () => { window.removeEventListener("scroll", auDefilement); cancelAnimationFrame(image); };
  }, [chemin]);

  function changerCouleur(valeur: string) {
    if (!espace || !estPalette(valeur)) return;
    const securise = location.protocol === "https:" ? "; Secure" : "";
    document.cookie = `${cookiePalette(espace)}=${valeur}; Path=/; Max-Age=31536000; SameSite=Lax${securise}`;
    setPalettes((precedentes) => ({ ...precedentes, [espace]: valeur }));
  }

  function lienNavigation(lien: Lien, fermer?: () => void) {
    return (
      <Link key={lien.href} href={lien.href} className="crm-nav-link" aria-label={lien.titre} title={lien.titre} onClick={fermer} aria-current={routeActive === lien.href ? "page" : undefined}>
        <lien.icone aria-hidden="true" />
        <span>{lien.titre}</span>
      </Link>
    );
  }

  function navigation(fermer?: () => void) {
    return (
      <nav className="crm-nav" aria-label="Navigation principale">
        {lienNavigation(VUE_ENSEMBLE, fermer)}
        {[...groupes, ...(afficherAdmin ? [ADMIN] : [])].map((g) => (
          <div className="crm-nav-group" key={g.titre}>
            <p>{g.titre}</p>
            {g.liens.map((lien) => lienNavigation(lien, fermer))}
          </div>
        ))}
        {gestionnaire && !afficherAdmin && (
          <div className="crm-nav-group">
            {lienNavigation({ titre: "Administration", href: "/admin/utilisateurs", icone: Settings2Icon }, fermer)}
          </div>
        )}
      </nav>
    );
  }

  const initiales = nom.trim().split(/\s+/).slice(0, 2).map((mot) => mot[0]).join("").toUpperCase();
  return (
    <PalettesContext.Provider value={palettes}>
      <UtiliserPalette palette={palette} />
      <div className="crm-shell" data-palette={palette} data-replie={replie} data-mode={enLivraison ? "livraison" : undefined} data-defile={defile || undefined}>
        <a href="#contenu-crm" className="crm-skip">Aller au contenu</a>
        <aside className="crm-sidebar">
          <Link href={VUE_ENSEMBLE.href} className="crm-brand" aria-label="CRM centralisé" title="Vue d’ensemble">
            <span className="crm-brand-long">CRM centralisé</span><span className="crm-brand-court" aria-hidden="true">CRM</span>
          </Link>
          {navigation()}
          <button type="button" className="crm-nav-link crm-collapse" aria-label={replie ? "Déplier le menu" : "Réduire le menu"} onClick={() => setReplie(!replie)} aria-expanded={!replie}>
            {replie ? <PanelLeftOpenIcon aria-hidden="true" /> : <PanelLeftCloseIcon aria-hidden="true" />}
            <span>Réduire le menu</span>
          </button>
        </aside>
        <div className="crm-shell-body">
          <header className="crm-topbar">
            <div className="crm-mobile-menu">
              <Sheet open={menuMobile} onOpenChange={setMenuMobile}>
                <SheetTrigger asChild>
                  <button type="button" className="crm-icon-button" aria-label="Ouvrir la navigation"><MenuIcon /></button>
                </SheetTrigger>
                <SheetContent side="bottom" className="crm-mobile-sheet" aria-describedby={undefined} showCloseButton={false}>
                  <FeuilleGlissante onFermer={() => setMenuMobile(false)}>
                    <SheetTitle className="crm-brand">{enLivraison ? "Mode livraison" : "CRM centralisé"}</SheetTitle>
                    {navigation(() => setMenuMobile(false))}
                  </FeuilleGlissante>
                </SheetContent>
              </Sheet>
            </div>

            <nav className="crm-workspaces" aria-label="Changer d’espace">
              {espaces.map((e) => (
                <Link key={e} href={ACCUEILS[e]} data-palette={palettes[e]} className="crm-workspace-link" aria-current={espace === e ? "true" : undefined}>
                  <i aria-hidden="true" /> {ESPACES[e].nom}
                </Link>
              ))}
            </nav>
            <div className="crm-mobile-spaces">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="crm-space-trigger" type="button" aria-label={`Changer d’espace, ${titre}`}>
                    <i aria-hidden="true" /><span>{titre}</span><ChevronDownIcon />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56">
                  <DropdownMenuItem asChild><Link href={VUE_ENSEMBLE.href}>Vue d’ensemble</Link></DropdownMenuItem>
                  {espaces.map((e) => (
                    <DropdownMenuItem key={e} asChild><Link href={ACCUEILS[e]} aria-current={espace === e ? "true" : undefined}>{ESPACES[e].nom}</Link></DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            <span className="crm-topbar-titre" aria-hidden="true">{titrePage}</span>

            <div className="crm-topbar-actions">
              {livraisonPossible && <BasculeLivraison mode={mode} onChange={setMode} />}
              {espace && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="crm-icon-button crm-palette-trigger" type="button" title="Couleur de l’espace" aria-label="Couleur de l’espace">
                      <PaletteIcon /><span>Couleur</span>
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-52">
                    <DropdownMenuLabel>{ESPACES[espace].nom}</DropdownMenuLabel>
                    <DropdownMenuRadioGroup value={palette} onValueChange={changerCouleur}>
                      {Object.entries(PALETTES).map(([id, nomPalette]) => (
                        <DropdownMenuRadioItem key={id} value={id}>
                          <i className="crm-palette-dot" data-palette={id} aria-hidden="true" /> {nomPalette}
                        </DropdownMenuRadioItem>
                      ))}
                    </DropdownMenuRadioGroup>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onSelect={() => changerCouleur(PALETTES_DEFAUT[espace])}>Couleur d’origine</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="crm-compte" type="button" aria-label={`Compte de ${nom}`}>
                    <span className="crm-avatar" aria-hidden="true">{initiales}</span>
                    <span className="crm-compte-nom">{nom}</span>
                    <ChevronDownIcon className="crm-compte-chevron" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-60">
                  <DropdownMenuLabel className="truncate">{email}</DropdownMenuLabel>
                  {espaces.includes("pm") && (
                    <DropdownMenuItem asChild><Link href="/vendeur">Espace vendeur <ArrowUpRightIcon className="ml-auto" /></Link></DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  <form action="/deconnexion" method="post">
                    <DropdownMenuItem asChild>
                      <button type="submit" className="w-full"><LogOutIcon /> Se déconnecter</button>
                    </DropdownMenuItem>
                  </form>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </header>
          <main id="contenu-crm" className="crm-content" tabIndex={-1}>{children}</main>
        </div>
        <nav
          key={mode}
          className="crm-tabbar"
          aria-label="Raccourcis"
          data-mode={enLivraison ? "livraison" : undefined}
          style={{ "--n": onglets.length + 1, "--i": Math.max(indexActif, 0) } as React.CSSProperties}
        >
          <span className="crm-tabbar-repere" aria-hidden="true" data-visible={indexActif >= 0 || undefined} />
          {onglets.map((o) => (
            <Link key={o.href} href={o.href} data-principal={o.principal || undefined} aria-current={routeActive === o.href ? "page" : undefined}>
              <span className="crm-tabbar-icone"><o.icone aria-hidden="true" /></span>
              <span>{o.titre}</span>
            </Link>
          ))}
          <button type="button" onClick={() => setMenuMobile(true)} aria-expanded={menuMobile}>
            <span className="crm-tabbar-icone"><MenuIcon aria-hidden="true" /></span>
            <span>Menu</span>
          </button>
        </nav>
      </div>
    </PalettesContext.Provider>
  );
}

/**
 * Feuille du bas qu'on referme d'un glissement vers le bas, comme sur iOS.
 * Le geste ne démarre que depuis la poignée ou quand la liste est en haut.
 */
function FeuilleGlissante({ onFermer, children }: { onFermer: () => void; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const depart = useRef<number | null>(null);
  const [decalage, setDecalage] = useState(0);

  function feuille() { return ref.current?.closest<HTMLElement>("[data-slot='sheet-content']") ?? null; }

  function debut(e: React.TouchEvent) {
    const f = feuille();
    if (f && f.scrollTop > 0) return;
    depart.current = e.touches[0].clientY;
  }
  function mouvement(e: React.TouchEvent) {
    if (depart.current === null) return;
    const d = e.touches[0].clientY - depart.current;
    setDecalage(d > 0 ? d : 0);
  }
  function fin() {
    if (depart.current === null) return;
    depart.current = null;
    if (decalage > 90) onFermer();
    setDecalage(0);
  }

  useEffect(() => {
    const f = feuille();
    if (!f) return;
    f.style.transform = decalage ? `translateY(${decalage}px)` : "";
    f.style.transition = decalage ? "none" : "";
  }, [decalage]);

  return (
    <div ref={ref} className="crm-feuille" onTouchStart={debut} onTouchMove={mouvement} onTouchEnd={fin} onTouchCancel={fin}>
      <span className="crm-feuille-poignee" aria-hidden="true" />
      {children}
    </div>
  );
}
