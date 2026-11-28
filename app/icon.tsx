import { ImageResponse } from "next/og";
import { Marque } from "@/components/marque-icone";

export const size = { width: 512, height: 512 };
export const contentType = "image/png";

/** Icône de l'app : pétales sur fond vert forêt. */
export default function Icone() {
  return new ImageResponse(<Marque taille={512} />, size);
}
