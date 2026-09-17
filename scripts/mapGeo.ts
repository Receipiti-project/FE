export type LatLng = { latitude: number; longitude: number };

const EARTH_RADIUS_KM = 6371;

const toRad = (deg: number) => (deg * Math.PI) / 180;

export function bearingDeg(a: LatLng, b: LatLng): number {
  return (
    (Math.atan2(b.longitude - a.longitude, b.latitude - a.latitude) * 180) /
    Math.PI
  );
}

export function midPoint(a: LatLng, b: LatLng): LatLng {
  return {
    latitude: (a.latitude + b.latitude) / 2,
    longitude: (a.longitude + b.longitude) / 2,
  };
}

export function haversineKm(a: LatLng, b: LatLng): number {
  const dLat = toRad(b.latitude - a.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);

  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h));
}

export function routeDistanceKm(points: LatLng[]): number {
  if (points.length < 2) return 0;
  return points.reduce(
    (sum, p, i) => (i === 0 ? 0 : sum + haversineKm(points[i - 1], p)),
    0
  );
}

export function minutesBetween(fromIso: string, toIso: string): number {
  const from = new Date(fromIso).getTime();
  const to = new Date(toIso).getTime();
  if (!Number.isFinite(from) || !Number.isFinite(to)) return 0;
  return Math.max(0, Math.round((to - from) / 60000));
}

export function hourOf(isoDatetime: string): number {
  return new Date(isoDatetime).getHours();
}
