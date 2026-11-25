"use client";

import { usePathname } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { ESPACES, estEspace, type EspaceId } from "@/lib/domaine";

/** Rappel permanent de l'espace actif (ACC-01). */
export function BadgeEspace({ espaces }: { espaces: EspaceId[] }) {
  const seg = usePathname().split("/")[1] ?? "";
  if (estEspace(seg) && espaces.includes(seg)) {
    return (
      <div className="flex items-center gap-2 text-sm">
        <span className="text-muted-foreground">Espace</span>
        <Badge variant="secondary">{ESPACES[seg].nom}</Badge>
      </div>
    );
  }
  if (seg === "admin") return <Badge variant="outline">Administration</Badge>;
  return <span className="text-sm text-muted-foreground">Vue d&apos;ensemble</span>;
}
