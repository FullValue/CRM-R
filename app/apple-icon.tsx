import { ImageResponse } from "next/og";
import { Marque } from "@/components/marque-icone";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function IconeApple() {
  return new ImageResponse(<Marque taille={180} />, size);
}
