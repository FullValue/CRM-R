import type { MetadataRoute } from "next";

/** Installable sur l'écran d'accueil : s'ouvre en plein écran, comme une app. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "CRM centralisé",
    short_name: "CRM",
    description: "Maison Maya · Atelier Amari · Parfumerie Mobile",
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f5f5f7",
    theme_color: "#f5f5f7",
    lang: "fr",
    icons: [
      { src: "/icon", sizes: "512x512", type: "image/png" },
      { src: "/apple-icon", sizes: "180x180", type: "image/png" },
    ],
  };
}
