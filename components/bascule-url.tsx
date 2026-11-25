"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

/** Bascule à choix unique synchronisée avec un paramètre d'URL. */
export function BasculeUrl({ nom, options, defaut, libelle }: { nom: string; options: { valeur: string; libelle: string }[]; defaut: string; libelle: string }) {
  const router = useRouter();
  const chemin = usePathname();
  const sp = useSearchParams();
  const valeur = sp.get(nom) ?? defaut;
  return (
    <ToggleGroup
      type="single"
      variant="outline"
      size="sm"
      value={valeur}
      aria-label={libelle}
      onValueChange={(v) => {
        if (!v) return;
        const p = new URLSearchParams(sp.toString());
        if (v === defaut) p.delete(nom);
        else p.set(nom, v);
        router.replace(`${chemin}${p.toString() ? `?${p}` : ""}`, { scroll: false });
      }}
    >
      {options.map((o) => (
        <ToggleGroupItem key={o.valeur} value={o.valeur} className="px-3">
          {o.libelle}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}
