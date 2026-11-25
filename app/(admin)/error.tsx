"use client";

import { AlertTriangleIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";

export default function Erreur({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <Empty className="border">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <AlertTriangleIcon />
        </EmptyMedia>
        <EmptyTitle>Cette page n&apos;a pas pu être chargée</EmptyTitle>
        <EmptyDescription>Les données n&apos;ont pas été modifiées. Réessayez ; si le problème persiste, prévenez l&apos;administrateur.</EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button onClick={reset}>Réessayer</Button>
      </EmptyContent>
    </Empty>
  );
}
