import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";

export default function Introuvable() {
  return (
    <main className="flex min-h-svh items-center justify-center p-4">
      <Empty>
        <EmptyHeader>
          <EmptyTitle>Page introuvable</EmptyTitle>
          <EmptyDescription>Le lien est incorrect ou l&apos;élément n&apos;existe plus.</EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button asChild>
            <Link href="/">Revenir à l&apos;accueil</Link>
          </Button>
        </EmptyContent>
      </Empty>
    </main>
  );
}
