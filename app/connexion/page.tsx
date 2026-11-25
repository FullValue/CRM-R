import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { utilisateurCourant } from "@/lib/auth/acces";
import { ESPACES, LISTE_ESPACES } from "@/lib/domaine";
import { PALETTES_DEFAUT } from "@/lib/palettes";
import { FormulaireConnexion } from "./formulaire";

export const metadata: Metadata = { title: "Connexion" };

export default async function PageConnexion() {
  const u = await utilisateurCourant();
  if (u) redirect(u.role === "VENDEUR" ? "/vendeur" : "/tableau-de-bord");
  return (
    <main className="crm-auth">
      <div className="crm-login">
        <section className="crm-login-art" aria-label="CRM centralisé">
          <div className="crm-brand">CRM centralisé</div>
          <ul className="crm-login-brands">
            {LISTE_ESPACES.map((espace) => (
              <li key={espace}><i className="crm-palette-dot" data-palette={PALETTES_DEFAUT[espace]} aria-hidden="true" />{ESPACES[espace].nom}</li>
            ))}
          </ul>
        </section>
        <section className="crm-login-form" aria-labelledby="titre-connexion">
          <div>
            <h1 id="titre-connexion">Connexion</h1>
            <p>Utilisez le compte fourni par votre administrateur.</p>
          </div>
          <FormulaireConnexion />
        </section>
      </div>
    </main>
  );
}
