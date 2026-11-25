import { Skeleton } from "@/components/ui/skeleton";

export default function Chargement() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Chargement en cours">
      <Skeleton className="h-8 w-64" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-28" />
        ))}
      </div>
      <Skeleton className="h-72" />
    </div>
  );
}
