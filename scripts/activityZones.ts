import { ZONE_COLORS } from "@/constants/mapConfig";
import { haversineKm, LatLng } from "./mapGeo";

const CLUSTER_RADIUS_KM = 0.6;
const MIN_VISITS = 2;
const MIN_RADIUS_M = 150;
const MAX_RADIUS_M = 1200;

export type ZonePin = {
  latitude: number;
  longitude: number;
  amount: number;
  address: string;
  paymentDate: string;
};

export type ActivityZone = {
  id: string;
  label: string;
  shortLabel: string;
  role: string;
  color: string;
  visitCount: number;
  totalSpend: number;
  latitude: number;
  longitude: number;
  radiusMeters: number;
};

function centerOf(cluster: ZonePin[]): LatLng {
  const sum = cluster.reduce(
    (acc, p) => ({
      latitude: acc.latitude + p.latitude,
      longitude: acc.longitude + p.longitude,
    }),
    { latitude: 0, longitude: 0 }
  );
  return {
    latitude: sum.latitude / cluster.length,
    longitude: sum.longitude / cluster.length,
  };
}

function mostCommon(values: string[]): string | null {
  const counts = new Map<string, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);

  let top: string | null = null;
  let best = 0;
  for (const [value, count] of counts) {
    if (count > best) {
      top = value;
      best = count;
    }
  }
  return top;
}

function districtOf(address: string): string | null {
  const tokens = address.trim().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return null;

  const gu = tokens.find((t) => /(구|군)$/.test(t));
  if (gu) return gu;

  const si = tokens.slice(1).find((t) => /시$/.test(t));
  if (si) return si;

  return tokens[1] ?? tokens[0];
}

function neighborhoodOf(address: string): string | null {
  const tokens = address.trim().split(/\s+/).filter(Boolean);
  return tokens.find((t) => /동$/.test(t) && t.length > 1) ?? null;
}

function roleOf(paymentDate: string): string {
  const d = new Date(paymentDate);
  if (Number.isNaN(d.getTime())) return "기타";

  const day = d.getDay();
  if (day === 0 || day === 6) return "주말";

  const hour = d.getHours();
  return hour >= 6 && hour < 18 ? "평일 낮" : "평일 저녁";
}

function nameOf(cluster: ZonePin[]): { label: string; shortLabel: string } {
  const addresses = cluster.map((p) => p.address).filter(Boolean);

  const district = mostCommon(
    addresses.map(districtOf).filter((v): v is string => v !== null)
  );
  const neighborhood = mostCommon(
    addresses.map(neighborhoodOf).filter((v): v is string => v !== null)
  );

  if (!district) return { label: "이 근처", shortLabel: "근처" };

  return {
    label: neighborhood ? `${district} · ${neighborhood}` : district,
    shortLabel: district,
  };
}

function toZone(cluster: ZonePin[], index: number): ActivityZone {
  const center = centerOf(cluster);
  const spread = cluster.reduce(
    (max, p) => Math.max(max, haversineKm(center, p) * 1000),
    0
  );
  const { label, shortLabel } = nameOf(cluster);

  return {
    id: `zone-${index}`,
    label,
    shortLabel,
    role: mostCommon(cluster.map((p) => roleOf(p.paymentDate))) ?? "기타",
    color: ZONE_COLORS[index % ZONE_COLORS.length],
    visitCount: cluster.length,
    totalSpend: cluster.reduce((s, p) => s + p.amount, 0),
    latitude: center.latitude,
    longitude: center.longitude,
    radiusMeters: Math.round(
      Math.min(Math.max(spread, MIN_RADIUS_M), MAX_RADIUS_M)
    ),
  };
}

export function buildActivityZones(pins: ZonePin[]): ActivityZone[] {
  const clusters: ZonePin[][] = [];

  for (const pin of pins) {
    const target = clusters.find(
      (c) => haversineKm(centerOf(c), pin) <= CLUSTER_RADIUS_KM
    );
    if (target) target.push(pin);
    else clusters.push([pin]);
  }

  return clusters
    .filter((c) => c.length >= MIN_VISITS)
    .sort((a, b) => b.length - a.length)
    .map(toZone);
}
