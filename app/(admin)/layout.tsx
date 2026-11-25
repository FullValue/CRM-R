import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { BarreLaterale } from "@/components/barre-laterale";
import { BadgeEspace } from "@/components/badge-espace";
import { exigerAdmin } from "@/lib/auth/acces";

export default async function LayoutAdmin({ children }: { children: React.ReactNode }) {
  const u = await exigerAdmin();
  return (
    <SidebarProvider>
      <BarreLaterale nom={u.nom} email={u.email} espaces={u.espaces} gestionnaire={u.gestionnaire} />
      <SidebarInset>
        <header className="sticky top-0 z-10 flex h-14 shrink-0 items-center gap-2 border-b bg-background/95 px-4 backdrop-blur">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-1 data-[orientation=vertical]:h-4" />
          <BadgeEspace espaces={u.espaces} />
        </header>
        <div className="flex-1 p-4 md:p-6 lg:p-8">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  );
}
