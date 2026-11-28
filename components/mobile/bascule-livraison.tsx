"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { LayoutDashboardIcon, TruckIcon } from "lucide-react";
import { COOKIE_MODE, ROUTE_ACCUEIL, ROUTE_LIVRAISON, type ModeApp } from "@/lib/mode";

/**
 * Interrupteur « Livraison » en haut à droite. La bascule déroule un voile
 * circulaire depuis l'interrupteur (comme une app native), change de mode
 * puis ouvre l'écran d'accueil du mode choisi.
 */
export function BasculeLivraison({ mode, onChange }: { mode: ModeApp; onChange: (mode: ModeApp) => void }) {
  const router = useRouter();
  const chemin = usePathname();
  const bouton = useRef<HTMLButtonElement>(null);
  const [voile, setVoile] = useState<null | { vers: ModeApp; x: number; y: number; phase: "entre" | "sort" }>(null);
  const cible = useRef<string | null>(null);
  const actif = mode === "livraison";

  // Le voile se retire une fois la nouvelle page affichée.
  useEffect(() => {
    if (!voile || voile.phase !== "entre" || !cible.current) return;
    if (chemin === cible.current || chemin.startsWith(`${cible.current}/`)) {
      const t = setTimeout(() => setVoile((v) => (v ? { ...v, phase: "sort" } : v)), 120);
      return () => clearTimeout(t);
    }
  }, [chemin, voile]);

  useEffect(() => {
    if (voile?.phase !== "sort") return;
    const t = setTimeout(() => setVoile(null), 520);
    return () => clearTimeout(t);
  }, [voile]);

  function basculer() {
    const vers: ModeApp = actif ? "gestion" : "livraison";
    const securise = location.protocol === "https:" ? "; Secure" : "";
    document.cookie = `${COOKIE_MODE}=${vers}; Path=/; Max-Age=31536000; SameSite=Lax${securise}`;
    navigator.vibrate?.(8);
    const r = bouton.current?.getBoundingClientRect();
    const x = r ? r.left + r.width / 2 : window.innerWidth - 40;
    const y = r ? r.top + r.height / 2 : 30;
    const destination = vers === "livraison" ? ROUTE_LIVRAISON : ROUTE_ACCUEIL;
    cible.current = destination;
    const reduit = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduit) {
      onChange(vers);
      router.push(destination);
      return;
    }
    setVoile({ vers, x, y, phase: "entre" });
    // La navigation part pendant que le voile couvre l'écran.
    setTimeout(() => {
      onChange(vers);
      if (chemin === destination) setVoile((v) => (v ? { ...v, phase: "sort" } : v));
      else router.push(destination);
    }, 380);
    // Filet de sécurité : le voile ne reste jamais bloqué.
    setTimeout(() => setVoile((v) => (v && v.phase === "entre" ? { ...v, phase: "sort" } : v)), 2600);
  }

  // Le bouton suit le doigt tout de suite, le reste de l'app sous le voile.
  const affiche = voile?.phase === "entre" ? voile.vers === "livraison" : actif;

  return (
    <>
      <button
        ref={bouton}
        type="button"
        role="switch"
        aria-checked={affiche}
        aria-label="Mode livraison"
        className="crm-bascule"
        data-actif={affiche || undefined}
        onClick={basculer}
      >
        <TruckIcon aria-hidden="true" />
        <span className="crm-bascule-libelle">Livraison</span>
        <span className="crm-bascule-piste" aria-hidden="true"><i /></span>
      </button>
      {voile && (
        <div
          className="crm-voile"
          data-vers={voile.vers}
          data-phase={voile.phase}
          style={{ "--x": `${voile.x}px`, "--y": `${voile.y}px` } as React.CSSProperties}
          aria-hidden="true"
        >
          <div className="crm-voile-contenu">
            <span className="crm-voile-icone">{voile.vers === "livraison" ? <TruckIcon /> : <LayoutDashboardIcon />}</span>
            <strong>{voile.vers === "livraison" ? "Mode livraison" : "Mode gestion"}</strong>
            <small>{voile.vers === "livraison" ? "Votre tournée s’ouvre" : "Retour au tableau de bord"}</small>
          </div>
        </div>
      )}
    </>
  );
}
