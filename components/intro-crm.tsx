/**
 * Animation d'entrée du CRM, jouée une seule fois par session de navigateur.
 * Entièrement en CSS : le script en tête de page marque la session avant le
 * premier affichage, donc aucun flash lors des navigations suivantes.
 */
export const SCRIPT_INTRO = `try{if(sessionStorage.getItem("crm-intro")||matchMedia("(prefers-reduced-motion: reduce)").matches){document.documentElement.dataset.intro="vu"}else{sessionStorage.setItem("crm-intro","1")}}catch(e){document.documentElement.dataset.intro="vu"}`;

export function IntroCRM() {
  return (
    <div className="crm-intro" aria-hidden="true">
      <div className="crm-intro-centre">
        <span className="crm-intro-nom">CRM centralisé</span>
        <span className="crm-intro-ligne"><i /></span>
        <span className="crm-intro-espaces">Maison Maya · Atelier Amari · Parfumerie Mobile</span>
      </div>
    </div>
  );
}
