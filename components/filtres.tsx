"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useEffectEvent, useState, useTransition } from "react";
import { CalendarDaysIcon, SearchIcon, SlidersHorizontalIcon, XIcon } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Spinner } from "@/components/ui/spinner";
import { dateCourte, estDateIso, PERIODES } from "@/lib/dates";
import { cn } from "@/lib/utils";

export type FiltreSelect = { nom: string; libelle: string; options: { valeur: string; libelle: string }[]; defaut?: string };

export function BarreFiltres({ selects = [], recherche, periode = false, className }: {
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
  const filtreRecherche = sp.get(nomRecherche) ?? "";
  const [texte, setTexte] = useState(filtreRecherche);
  const [precedenteRecherche, setPrecedenteRecherche] = useState(filtreRecherche);
  const [precedentChemin, setPrecedentChemin] = useState(chemin);
  const [datesOuvertes, setDatesOuvertes] = useState(false);
  const [dates, setDates] = useState({ du: "", au: "" });

  if (precedenteRecherche !== filtreRecherche || precedentChemin !== chemin) {
    setPrecedenteRecherche(filtreRecherche);
    setPrecedentChemin(chemin);
    if (texte === precedenteRecherche || precedentChemin !== chemin || !enCours) setTexte(filtreRecherche);
  }

  function appliquer(maj: Record<string, string | null>) {
    const p = new URLSearchParams(sp);
    const changements = recherche ? { [nomRecherche]: texte.trim(), ...maj } : maj;
    for (const [k, v] of Object.entries(changements)) {
      if (v) p.set(k, v);
      else p.delete(k);
    }
    p.delete("page");
    const query = p.toString();
    if (query !== sp.toString()) {
      demarrer(() => router.replace(`${chemin}${query ? `?${query}` : ""}`, { scroll: false }));
    }
  }

  const envoyerRecherche = useEffectEvent(() => appliquer({}));
  const rechercheEnAttente = Boolean(recherche) && texte.trim() !== filtreRecherche;
  useEffect(() => {
    if (!rechercheEnAttente) return;
    const minuterie = window.setTimeout(envoyerRecherche, 350);
    return () => window.clearTimeout(minuterie);
  }, [texte, rechercheEnAttente]);

  const du = sp.get("du");
  const au = sp.get("au");
  const datesPersonnalisees = estDateIso(du) && estDateIso(au) && du <= au;
  const preset = sp.get("periode");
  const periodeCourante = datesPersonnalisees ? "perso" : (PERIODES.find((p) => p.cle === preset)?.cle ?? "mois");
  const cles = [...selects.map((s) => s.nom), ...(recherche ? [nomRecherche] : []), ...(periode ? ["periode", "du", "au"] : [])];
  const actifs = cles.some((cle) => sp.has(cle)) || Boolean(recherche && texte);
  const filtresActifs = selects.filter((s) => sp.has(s.nom)).length;
  const datesValides = estDateIso(dates.du) && estDateIso(dates.au) && dates.du <= dates.au;
  const selection = selects.map((s) => {
    const defaut = s.defaut ?? "tous";
    const valeur = s.options.find((o) => o.valeur === sp.get(s.nom))?.valeur ?? defaut;
    return (
      <Select key={s.nom} value={valeur} onValueChange={(v) => appliquer({ [s.nom]: v === defaut ? null : v })}>
        <SelectTrigger className="min-w-36 max-w-full" aria-label={s.libelle}>
          <SelectValue placeholder={s.libelle} />
        </SelectTrigger>
        <SelectContent>
          {s.options.map((o) => <SelectItem key={o.valeur} value={o.valeur}>{o.libelle}</SelectItem>)}
        </SelectContent>
      </Select>
    );
  });

  return (
    <div className={cn("crm-filter", className)} role="group" aria-label="Filtres">
      {recherche && (
        <InputGroup className="w-full sm:w-64">
          <InputGroupAddon><SearchIcon /></InputGroupAddon>
          <InputGroupInput type="search" value={texte} onChange={(e) => setTexte(e.target.value)} placeholder={recherche.placeholder} aria-label={recherche.placeholder} />
        </InputGroup>
      )}
      {periode && (
        <>
          <Select value={periodeCourante} onValueChange={(v) => appliquer({ periode: v === "mois" ? null : v, du: null, au: null })}>
            <SelectTrigger className="min-w-36" aria-label="Période"><SelectValue /></SelectTrigger>
            <SelectContent>
              {PERIODES.map((p) => <SelectItem key={p.cle} value={p.cle}>{p.libelle}</SelectItem>)}
              {datesPersonnalisees && <SelectItem value="perso">Période personnalisée</SelectItem>}
            </SelectContent>
          </Select>
          <Popover open={datesOuvertes} onOpenChange={(ouvert) => {
            if (ouvert) setDates({ du: du ?? "", au: au ?? "" });
            setDatesOuvertes(ouvert);
          }}>
            <PopoverTrigger asChild>
              <Button type="button" variant="outline">
                <CalendarDaysIcon /> {datesPersonnalisees ? `${dateCourte(du)} – ${dateCourte(au)}` : "Choisir les dates"}
              </Button>
            </PopoverTrigger>
            <PopoverContent align="start" aria-label="Dates de la période" className="p-3">
              <form className="grid gap-3" onSubmit={(event) => {
                event.preventDefault();
                if (!datesValides) return;
                appliquer({ du: dates.du, au: dates.au, periode: null });
                setDatesOuvertes(false);
              }}>
                <label className="grid gap-1 text-sm font-medium">Du
                  <Input type="date" required value={dates.du} onChange={(e) => setDates({ ...dates, du: e.target.value })} />
                </label>
                <label className="grid gap-1 text-sm font-medium">Au
                  <Input type="date" required min={dates.du || undefined} value={dates.au} onChange={(e) => setDates({ ...dates, au: e.target.value })} />
                </label>
                <Button type="submit" disabled={!datesValides}>Appliquer les dates</Button>
              </form>
            </PopoverContent>
          </Popover>
        </>
      )}
      {selection.length <= 2 ? selection : (
        <details className="crm-filter-details">
          <summary><SlidersHorizontalIcon /> Plus de filtres {filtresActifs > 0 && <span>{filtresActifs}</span>}</summary>
          <div className="crm-filter-extra">{selection}</div>
        </details>
      )}
      {actifs && (
        <Button variant="ghost" size="sm" onClick={() => {
          setTexte("");
          appliquer(Object.fromEntries(cles.map((cle) => [cle, null])));
        }}>
          <XIcon /> Réinitialiser
        </Button>
      )}
      {enCours && <Spinner className="text-muted-foreground" />}
    </div>
  );
}
