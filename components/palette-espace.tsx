"use client";

import { createContext, useContext, useLayoutEffect } from "react";
import type { EspaceId } from "@/lib/domaine";
import { PALETTES_DEFAUT, type Palette } from "@/lib/palettes";

export const PalettesContext = createContext(PALETTES_DEFAUT);

export function UtiliserPalette({ palette }: { palette: Palette }) {
  useLayoutEffect(() => {
    document.documentElement.dataset.palette = palette;
    return () => { delete document.documentElement.dataset.palette; };
  }, [palette]);

  return null;
}

export function CouleurEspace({ espace, children, className }: { espace: EspaceId; children: React.ReactNode; className?: string }) {
  return <div className={className} data-palette={useContext(PalettesContext)[espace]}>{children}</div>;
}
