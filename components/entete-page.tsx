import { cn } from "@/lib/utils";

export function EntetePage({
  titre,
  description,
  actions,
  className,
}: {
  titre: string;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("crm-page-heading", className)}>
      <div>
        <h1>{titre}</h1>
        {description && <p>{description}</p>}
      </div>
      {actions && <div className="crm-page-heading-actions">{actions}</div>}
    </div>
  );
}

export function Section({ titre, description, actions, children, className }: { titre: string; description?: React.ReactNode; actions?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn("space-y-3", className)}>
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="crm-section-title">{titre}</h2>
          {description && <p className="text-muted-foreground text-sm">{description}</p>}
        </div>
        {actions}
      </div>
      {children}
    </section>
  );
}
