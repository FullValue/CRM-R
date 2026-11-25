import type { Metadata } from "next";
import { exigerGestionnaire } from "@/lib/auth/acces";
import { prisma } from "@/lib/db";
import { horodatage } from "@/lib/dates";
import { ESPACES, estEspace } from "@/lib/domaine";
import { EntetePage } from "@/components/entete-page";
import { ActivationUtilisateur, EditerUtilisateur } from "@/components/admin";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

export const metadata: Metadata = { title: "Utilisateurs et accès" };

export default async function Utilisateurs() {
  const moi = await exigerGestionnaire();
  const users = await prisma.utilisateur.findMany({
    include: { habilitations: true, sessions: { where: { revoqueLe: null, expireLe: { gt: new Date() } }, select: { id: true } } },
    orderBy: [{ actif: "desc" }, { role: "asc" }, { nom: "asc" }],
  });
  const dernieres = await prisma.tentativeConnexion.findMany({ where: { reussie: true }, orderBy: { createdAt: "desc" }, take: 500 });
  const derniere = (email: string) => dernieres.find((t) => t.email === email)?.createdAt ?? null;
  return (
    <div className="space-y-6">
      <EntetePage
        titre="Utilisateurs et accès"
        description="Comptes nominatifs, rôle et espaces attribués (ACC-01, ACC-02). La désactivation révoque immédiatement les sessions ouvertes."
        actions={<EditerUtilisateur />}
      />
      <Card className="p-0 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Compte</TableHead>
              <TableHead>Rôle</TableHead>
              <TableHead>Espaces</TableHead>
              <TableHead>Sessions</TableHead>
              <TableHead>Dernière connexion</TableHead>
              <TableHead>État</TableHead>
              <TableHead className="w-40" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((u) => {
              const espaces = u.habilitations.map((h) => h.activiteId).filter(estEspace);
              return (
                <TableRow key={u.id} className={u.actif ? "" : "opacity-60"}>
                  <TableCell>
                    <div className="font-medium">{u.nom}</div>
                    <div className="text-xs text-muted-foreground">{u.email}</div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={u.role === "ADMIN" ? "secondary" : "outline"}>{u.role === "ADMIN" ? "Administrateur" : "Vendeur"}</Badge>
                    {u.gestionnaire && <Badge className="ml-1">Désigné</Badge>}
                    {u.prixModifiable && <div className="text-xs text-muted-foreground mt-1">Prix modifiable</div>}
                  </TableCell>
                  <TableCell className="text-sm">{espaces.map((e) => ESPACES[e].court).join(", ")}</TableCell>
                  <TableCell className="tabular-nums">{u.sessions.length}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{horodatage(derniere(u.email))}</TableCell>
                  <TableCell>{u.actif ? <Badge variant="secondary">Actif</Badge> : <Badge variant="destructive">Désactivé</Badge>}</TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-1">
                      <EditerUtilisateur u={{ id: u.id, nom: u.nom, email: u.email, role: u.role, gestionnaire: u.gestionnaire, prixModifiable: u.prixModifiable, espaces }} />
                      {u.id !== moi.id && <ActivationUtilisateur id={u.id} actif={u.actif} />}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
