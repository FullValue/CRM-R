"use client";

import { useState } from "react";
import { ChevronsUpDownIcon, SearchIcon } from "lucide-react";
import { Command as CommandPrimitive } from "cmdk";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { euros } from "@/lib/argent";
import { cn } from "@/lib/utils";
import type { DonneesFormulaireVente } from "@/lib/requetes/pm";

type Reference = DonneesFormulaireVente["catalogue"][number];

/**
 * Choix du parfum en feuille plein écran sur téléphone : on tape quelques
 * lettres (nom ou code) et on touche la bonne ligne. Le stock et les prix
 * sont visibles avant de choisir.
 */
export function SelecteurReference({ id, catalogue, valeur, onChoisir, invalide, bloquer }: {
  id: string;
  catalogue: Reference[];
  valeur: string;
  onChoisir: (id: string) => void;
  invalide?: boolean;
  bloquer: boolean;
}) {
  const [ouvert, setOuvert] = useState(false);
  const choisie = catalogue.find((r) => r.id === valeur);

  return (
    <Sheet open={ouvert} onOpenChange={setOuvert}>
      <SheetTrigger asChild>
        <button
          id={id}
          type="button"
          data-invalide={invalide || undefined}
          className={cn(
            "crm-choix flex min-h-12 w-full items-center gap-3 rounded-xl bg-[var(--crm-fill)] px-3 py-2 text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/40 data-[invalide=true]:shadow-[0_0_0_1px_var(--destructive)]",
            choisie && "bg-white shadow-[0_0_0_1px_var(--crm-accent)]",
          )}
        >
          <SearchIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          {choisie ? (
            <span className="min-w-0 flex-1">
              <span className="block truncate font-semibold">{choisie.libelle}</span>
              <span className="block truncate text-xs text-muted-foreground">{choisie.code} · {choisie.formats.map((f) => f.libelle).join(", ")}</span>
            </span>
          ) : (
            <span className="flex-1 text-muted-foreground">Rechercher un parfum…</span>
          )}
          <ChevronsUpDownIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        </button>
      </SheetTrigger>
      <SheetContent side="bottom" className="mx-auto flex max-h-[88svh] w-full max-w-xl flex-col gap-0 rounded-t-3xl p-0 sm:bottom-6 sm:rounded-3xl sm:border">
        <div className="mx-auto mt-2.5 h-1.5 w-10 shrink-0 rounded-full bg-border" aria-hidden="true" />
        <SheetHeader className="px-5 pt-3 pb-2">
          <SheetTitle className="text-lg">Choisir un parfum</SheetTitle>
          <SheetDescription>Tapez le nom ou le code, puis touchez le parfum.</SheetDescription>
        </SheetHeader>
        <CommandPrimitive className="flex min-h-0 flex-1 flex-col" loop>
          <div className="px-4 pb-2">
            <div className="flex h-12 items-center gap-2 rounded-xl bg-[var(--crm-fill)] px-3 focus-within:bg-white focus-within:shadow-[0_0_0_1px_var(--crm-accent)]">
              <SearchIcon className="size-4 text-muted-foreground" aria-hidden="true" />
              <CommandPrimitive.Input autoFocus placeholder="Nom ou code du parfum" className="h-full w-full bg-transparent text-base outline-none placeholder:text-muted-foreground" />
            </div>
          </div>
          <CommandPrimitive.List className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 pb-[max(1rem,env(safe-area-inset-bottom))]">
            <CommandPrimitive.Empty className="py-10 text-center text-sm text-muted-foreground">Aucun parfum ne correspond.</CommandPrimitive.Empty>
            {catalogue.map((r) => {
              const stock = r.formats.reduce((a, f) => a + Math.max(0, f.quantite), 0);
              const prix = r.formats.map((f) => f.prixVenteCents);
              const min = Math.min(...prix);
              const max = Math.max(...prix);
              const epuise = stock === 0;
              return (
                <CommandPrimitive.Item
                  key={r.id}
                  value={`${r.libelle} ${r.code} ${r.id}`}
                  disabled={bloquer && epuise}
                  onSelect={() => { onChoisir(r.id); setOuvert(false); }}
                  className="flex min-h-14 cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 data-[disabled=true]:opacity-45 data-[selected=true]:bg-accent"
                >
                  <span className={cn("grid size-10 shrink-0 place-items-center rounded-xl text-xs font-bold", r.id === valeur ? "bg-primary text-primary-foreground" : "bg-accent text-accent-foreground")}>
                    {r.libelle.slice(0, 2).toUpperCase()}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">{r.libelle}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {r.code} · {min === max ? euros(min) : `${euros(min)} à ${euros(max)}`}
                    </span>
                  </span>
                  <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums", epuise ? "bg-destructive/10 text-destructive" : stock <= 3 ? "bg-amber-100 text-amber-800" : "bg-muted text-muted-foreground")}>
                    {epuise ? "Rupture" : `${stock} en stock`}
                  </span>
                </CommandPrimitive.Item>
              );
            })}
          </CommandPrimitive.List>
        </CommandPrimitive>
      </SheetContent>
    </Sheet>
  );
}
