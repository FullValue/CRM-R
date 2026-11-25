/**
 * Proposition de zone (GEO-01). La position n'est utilisée que dans le
 * navigateur pour calculer la suggestion : seule la zone retenue et sa
 * provenance sont transmises au serveur (GEO-02).
 */

export type ZoneGeo = { id: string; libelle: string; lat: number; lng: number; rayonKm: number };

export function distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371;
  const rad = (x: number) => (x * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export type Suggestion = { zone: ZoneGeo; distanceKm: number; dansRayon: boolean } | null;

/**
 * Zone plausible : la plus proche. `dansRayon` indique si la position tombe dans
 * le rayon de la zone ; au-delà de `maxKm` (ou précision trop faible), aucune
 * suggestion n'est faite.
 */
export function suggererZone(
  position: { lat: number; lng: number; precisionM?: number },
  zones: readonly ZoneGeo[],
  maxKm = 25,
): Suggestion {
  if (zones.length === 0) return null;
  if (position.precisionM !== undefined && position.precisionM > 5000) return null;
  let meilleure: { zone: ZoneGeo; distanceKm: number } | null = null;
  for (const z of zones) {
    const dk = distanceKm(position, z);
    if (!meilleure || dk < meilleure.distanceKm) meilleure = { zone: z, distanceKm: dk };
  }
  if (!meilleure || meilleure.distanceKm > maxKm) return null;
  return { ...meilleure, dansRayon: meilleure.distanceKm <= meilleure.zone.rayonKm };
}
