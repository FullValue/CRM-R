import Link from "next/link";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ArrowUpRightIcon, InfoIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function Indicateur({ titre, valeur, detail, definition, lien, className, ton, vedette = false }: {
  titre: string;
  valeur: React.ReactNode | null;
  detail?: React.ReactNode;
  definition?: string;
  lien?: string;
  className?: string;
  ton?: "alerte" | "ok";
  vedette?: boolean;
}) {
  return (
    <article className={cn("crm-kpi", className)} data-vedette={vedette}>
      <div className="crm-kpi-head">
        <h2>{titre}</h2>
        {definition && (
          <Tooltip>
            <TooltipTrigger asChild>
              <button type="button" className="crm-kpi-info" aria-label={`Définition de « ${titre} »`}><InfoIcon /></button>
            </TooltipTrigger>
            <TooltipContent className="max-w-xs">{definition}</TooltipContent>
          </Tooltip>
        )}
        {lien && (
          <Link href={lien} className="crm-kpi-arrow ml-auto after:absolute after:inset-0" aria-label={`Voir le détail de « ${titre} »`}>
            <ArrowUpRightIcon className="size-3.5" />
          </Link>
        )}
      </div>
      <div className={cn("crm-kpi-value", ton === "alerte" && "text-destructive")} data-absente={valeur === null}>
        {valeur === null ? "Données indisponibles" : valeur}
      </div>
      {detail && <div className="crm-kpi-detail">{detail}</div>}
    </article>
  );
}
