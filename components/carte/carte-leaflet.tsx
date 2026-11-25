"use client";

import "leaflet/dist/leaflet.css";
import { CircleMarker, MapContainer, TileLayer, Tooltip } from "react-leaflet";

export type PointCarte = { id: string; libelle: string; lat: number; lng: number; ventes: number; caCents: number; estimees: number };

const fmt = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" });

/** Carte des ventes par zone (GEO-03) : cercles proportionnels au CA. */
export default function CarteLeaflet({ points, surErreurTuiles }: { points: PointCarte[]; surErreurTuiles?: () => void }) {
  const avecVentes = points.filter((p) => p.ventes > 0);
  const base = avecVentes.length ? avecVentes : points;
  const lat = base.reduce((a, p) => a + p.lat, 0) / Math.max(1, base.length) || 45.76;
  const lng = base.reduce((a, p) => a + p.lng, 0) / Math.max(1, base.length) || 4.85;
  const max = Math.max(1, ...points.map((p) => p.caCents));
  return (
    <MapContainer center={[lat, lng]} zoom={12} scrollWheelZoom={false} className="h-[420px] w-full rounded-xl">
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        eventHandlers={{ tileerror: () => surErreurTuiles?.() }}
      />
      {points.map((p) => (
        <CircleMarker
          key={p.id}
          center={[p.lat, p.lng]}
          radius={p.ventes === 0 ? 5 : 8 + Math.sqrt(p.caCents / max) * 26}
          pathOptions={{ color: "oklch(0.45 0.13 255)", fillColor: "oklch(0.55 0.13 255)", fillOpacity: p.ventes === 0 ? 0.15 : 0.45, weight: 1.5 }}
        >
          <Tooltip>
            <strong>{p.libelle}</strong>
            <br />
            {p.ventes} vente(s) · {fmt.format(p.caCents / 100)}
            {p.estimees > 0 && (
              <>
                <br />
                dont {p.estimees} zone(s) estimée(s)
              </>
            )}
          </Tooltip>
        </CircleMarker>
      ))}
    </MapContainer>
  );
}
