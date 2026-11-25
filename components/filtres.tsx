"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { SearchIcon, XIcon } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { PERIODES } from "@/lib/dates";
import { cn } from "@/lib/utils";

export type FiltreSelect = { nom: string; libelle: string; options: { valeur: string; libelle: string }[]; defaut?: string };

/**
 * Filtres synchronisés avec l'URL : les listes et les totaux d'une page
 * utilisent exactement les mêmes paramètres (PIL-03).
 */
export function BarreFiltres({
  selects = [],
  recherche,
  periode = false,
  className,
}: {
  selects?: FiltreSelect[];
  recherche?: { nom?: string; placeholder: string };
  periode?: boolean;
  className?: string;
}) {
  const router = useRouter();
  const chemin = usePathname();
  const sp = useSearchParams();
  const [enCours, demarrer] = useTransition();
  const nomRecherche = recherche?.nom ?? "q";
  const [texte, setTexte] = useState(sp.get(nomRecherche) ?? "");

  const appliquer = (maj: Record<string, string | null>) => {
    const p = new URLSearchParams(sp.toString());
    for (const [k, v] of Object.entries(maj)) {
      if (v === null || v === "") p.delete(k);
      else p.set(k, v);
    }
    p.delete("page");
    demarrer(() => router.replace(`${chemin}${p.toString() ? `?${p}` : ""}`, { scroll: false }));
  };

  useEffect(() => {
    if (!recherche) return;
    const t = setTimeout(() => {
      if ((sp.get(nomRecherche) ?? "") !== texte) appliquer({ [nomRecherche]: texte });
    }, 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [texte]);

  const periodeCourante = sp.get("du") && sp.get("au") ? "perso" : (sp.get("periode") ?? "mois");
  const actifs = [...selects.map((s) => s.nom), nomRecherche, "periode", "du", "au"].some((k) => sp.get(k));

  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      {recherche && (
        <InputGroup className="w-full sm:w-64">
          <InputGroupAddon>
            <SearchIcon />
          </InputGroupAddon>
          <InputGroupInput value={texte} onChange={(e) => setTexte(e.target.value)} placeholder={recherche.placeholder} aria-label={recherche.placeholder} />
        </InputGroup>
      )}
      {periode && (
        <>
          <Select value={periodeCourante} onValueChange={(v) => appliquer({ periode: v === "perso" ? null : v, du: null, au: null })}>
            <SelectTrigger className="w-48" aria-label="Période">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PERIODES.map((p) => (
                <SelectItem key={p.cle} value={p.cle}>
                  {p.libelle}
                </SelectItem>
              ))}
              {periodeCourante === "perso" && <SelectItem value="perso">Période personnalisée</SelectItem>}
            </SelectContent>
          </Select>
          <div className="flex items-center gap-1">
            <Input
              type="date"
              className="w-38"
              aria-label="Du"
              value={sp.get("du") ?? ""}
              onChange={(e) => {
                const au = sp.get("au") || e.target.value;
                if (e.target.value) appliquer({ du: e.target.value, au, periode: null });
              }}
            />
            <span className="text-muted-foreground text-sm">→</span>
            <Input
              type="date"
              className="w-38"
              aria-label="Au"
              value={sp.get("au") ?? ""}
              onChange={(e) => {
                const du = sp.get("du") || e.target.value;
                if (e.target.value) appliquer({ au: e.target.value, du, periode: null });
              }}
            />
          </div>
        </>
      )}
      {selects.map((s) => (
        <Select key={s.nom} value={sp.get(s.nom) ?? s.defaut ?? "tous"} onValueChange={(v) => appliquer({ [s.nom]: v === (s.defaut ?? "tous") ? null : v })}>
          <SelectTrigger className="min-w-36" aria-label={s.libelle}>
            <SelectValue placeholder={s.libelle} />
          </SelectTrigger>
          <SelectContent>
            {s.options.map((o) => (
              <SelectItem key={o.valeur} value={o.valeur}>
                {o.libelle}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ))}
      {actifs && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setTexte("");
            demarrer(() => router.replace(chemin, { scroll: false }));
          }}
        >
          <XIcon /> Réinitialiser
        </Button>
      )}
      {enCours && <Spinner className="text-muted-foreground" />}
    </div>
  );
}
