"use client";

import dynamic from "next/dynamic";
import { Component, useState } from "react";
import { MapPinOffIcon } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import type { PointCarte } from "./carte-leaflet";

const CarteLeaflet = dynamic(() => import("./carte-leaflet"), { ssr: false, loading: () => <Skeleton className="h-[420px] w-full rounded-xl" /> });

function Indisponible() {
  return (
    <div className="flex h-[420px] flex-col items-center justify-center gap-2 rounded-xl border border-dashed text-center text-sm text-muted-foreground">
      <MapPinOffIcon className="size-6" />
      Service cartographique indisponible. Le tableau par zone ci-dessous reste consultable.
    </div>
  );
}

class Garde extends Component<{ children: React.ReactNode }, { erreur: boolean }> {
  state = { erreur: false };
  static getDerivedStateFromError() {
    return { erreur: true };
  }
  render() {
    return this.state.erreur ? <Indisponible /> : this.props.children;
  }
}

/** Carte tolérante aux pannes : en cas d'erreur, le tableau reste la référence (GEO-03, R14). */
export function CarteVentes({ points }: { points: PointCarte[] }) {
  const [tuilesKO, setTuilesKO] = useState(false);
  return (
    <Garde>
      <div className="relative">
        <CarteLeaflet points={points} surErreurTuiles={() => setTuilesKO(true)} />
        {tuilesKO && (
          <div className="absolute bottom-2 left-2 z-[400] rounded-md bg-background/90 px-2 py-1 text-xs text-muted-foreground shadow">
            Fond de carte indisponible : positions affichées sans fond. Le tableau fait foi.
          </div>
        )}
      </div>
    </Garde>
  );
}
