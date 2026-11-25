import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { InfoIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Carte d'indicateur. `valeur` null → « Données indisponibles » (PIL-01).
 * `definition` affiche la règle de calcul au survol.
 */
export function Indicateur({
  titre,
  valeur,
  detail,
  definition,
  lien,
  className,
  ton,
}: {
  titre: string;
  valeur: React.ReactNode | null;
  detail?: React.ReactNode;
  definition?: string;
  lien?: string;
  className?: string;
  ton?: "alerte" | "ok";
}) {
  const contenu = (
    <Card className={cn("gap-2 h-full", lien && "transition-colors hover:bg-muted/40", className)}>
      <CardHeader className="gap-1">
        <CardDescription className="flex items-center gap-1.5">
          {titre}
          {definition && (
            <Tooltip>
              <TooltipTrigger asChild>
                <InfoIcon className="size-3.5 opacity-60" aria-label={`Définition : ${definition}`} />
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">{definition}</TooltipContent>
            </Tooltip>
          )}
        </CardDescription>
        <CardTitle className={cn("text-2xl tabular-nums", ton === "alerte" && "text-destructive", valeur === null && "text-muted-foreground text-base font-normal")}>
          {valeur === null ? "Données indisponibles" : valeur}
        </CardTitle>
      </CardHeader>
      {detail && <CardContent className="text-muted-foreground text-xs">{detail}</CardContent>}
    </Card>
  );
  return lien ? (
    <Link href={lien} className="block rounded-xl focus-visible:outline-2 focus-visible:outline-ring">
      {contenu}
    </Link>
  ) : (
    contenu
  );
}
