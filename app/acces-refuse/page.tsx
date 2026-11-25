import Link from "next/link";
import { ShieldXIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { exigerUtilisateur } from "@/lib/auth/acces";
import { ESPACES, estEspace } from "@/lib/domaine";

export default async function AccesRefuse({ searchParams }: { searchParams: Promise<{ espace?: string }> }) {
  const u = await exigerUtilisateur();
  const { espace } = await searchParams;
  const nom = espace && estEspace(espace) ? ESPACES[espace].nom : null;
  return (
    <main className="flex min-h-svh items-center justify-center p-4">
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <ShieldXIcon />
          </EmptyMedia>
          <EmptyTitle>Accès refusé</EmptyTitle>
          <EmptyDescription>
            {nom ? `L'espace ${nom} ne vous est pas attribué.` : "Cette page ou cette action ne correspond pas à vos droits."} Si vous pensez qu&apos;il
            s&apos;agit d&apos;une erreur, contactez l&apos;administrateur désigné.
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button asChild>
            <Link href={u.role === "VENDEUR" ? "/vendeur" : "/tableau-de-bord"}>Revenir à mon accueil</Link>
          </Button>
        </EmptyContent>
      </Empty>
    </main>
  );
}
