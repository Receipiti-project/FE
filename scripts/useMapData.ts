import { getTimeRange, Mode, TimeRangeId } from "@/constants/mapConfig";
import { CategoryId } from "@/constants/mockData";
import {
  ConsumptionRoutePlace,
  ExpenditureListItem,
  getConsumptionRoute,
  getMonthlyExpenditures,
} from "@/services/api/expenditureApi";
import { nameToLocalCategoryId } from "@/services/categoryMapping";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityZone, buildActivityZones } from "./activityZones";
import { resolveLocation } from "./locationPipeline";
import { hasNoLocation } from "./noLocationExpenses";
import { classifyNonPlace } from "./onlineMerchant";
import {
  haversineKm,
  hourOf,
  LatLng,
  routeDistanceKm,
} from "./mapGeo";

export type MapPin = {
  id: string;
  storeName: string;
  amount: number;
  category: CategoryId;
  paymentDate: string;
  latitude: number;
  longitude: number;
  address: string;
  memo?: string;
};

export type MapZone = ActivityZone;

export type HeatPoint = LatLng & { weight: number };

export type TopStore = { store: string; count: number; total: number };

export type UnmappedExpense = {
  id: string;
  storeName: string;
  amount: number;
  paymentDate: string;
};

export type MapSummary = {
  distanceKm: number;
  dayTotal: number;
  visibleCount: number;
};

export type MapData = {
  pins: MapPin[];
  route: MapPin[];
  zones: MapZone[];
  heatmapPoints: HeatPoint[];
  stores: TopStore[];
  unmapped: UnmappedExpense[];
  summary: MapSummary;
  loading: boolean;
  reload: () => void;
};

export function localDate(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function buildPin(
  item: ExpenditureListItem,
  coords: LatLng,
  address: string
): MapPin {
  return {
    id: String(item.expenditureId),
    storeName: item.storeName,
    amount: item.amount,
    category: nameToLocalCategoryId(item.categoryName),
    paymentDate: item.expenditureDate,
    latitude: coords.latitude,
    longitude: coords.longitude,
    address,
    memo: item.memo,
  };
}

async function toPins(items: ExpenditureListItem[]): Promise<MapPin[]> {
  const resolved = await Promise.all(
    items.map(async (item): Promise<MapPin | null> => {
      if (item.latitude != null && item.longitude != null) {
        return buildPin(
          item,
          { latitude: item.latitude, longitude: item.longitude },
          item.address ?? ""
        );
      }

      try {
        const loc = await resolveLocation(item.storeName);
        if (loc.status === "nonPlace") return null;

        if (loc.latitude != null && loc.longitude != null) {
          return buildPin(
            item,
            { latitude: loc.latitude, longitude: loc.longitude },
            loc.address ?? item.address ?? ""
          );
        }

        if (loc.suggested) {
          return buildPin(
            item,
            {
              latitude: loc.suggested.latitude,
              longitude: loc.suggested.longitude,
            },
            loc.suggested.roadAddress || loc.suggested.address
          );
        }
      } catch {
        return null;
      }

      return null;
    })
  );

  return resolved.filter((p): p is MapPin => p !== null);
}

function toRoutePins(places: ConsumptionRoutePlace[]): MapPin[] {
  return [...places]
    .sort((a, b) => a.sequence - b.sequence)
    .map((p) => ({
      id: String(p.expenditureId),
      storeName: p.storeName,
      amount: p.amount,
      category: nameToLocalCategoryId(p.categoryName),
      paymentDate: p.visitedAt,
      latitude: p.latitude,
      longitude: p.longitude,
      address: p.address ?? "",
    }));
}

function toTopStores(items: ExpenditureListItem[], n: number): TopStore[] {
  const grouped = new Map<string, TopStore>();

  for (const item of items) {
    const store = item.storeName;
    const acc = grouped.get(store) ?? { store, count: 0, total: 0 };
    acc.count += 1;
    acc.total += item.amount;
    grouped.set(store, acc);
  }

  return [...grouped.values()]
    .sort((a, b) => b.count - a.count || b.total - a.total)
    .slice(0, n);
}

export function useMapData(
  mode: Mode,
  timeRange: TimeRangeId,
  dateKey: string
): MapData {
  const range = getTimeRange(timeRange);
  const [allPins, setAllPins] = useState<MapPin[]>([]);
  const [fullRoute, setFullRoute] = useState<MapPin[]>([]);
  const [stores, setStores] = useState<TopStore[]>([]);
  const [unmapped, setUnmapped] = useState<UnmappedExpense[]>([]);
  const [routeMeters, setRouteMeters] = useState<number | null>(null);
  const [routeTotal, setRouteTotal] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);
  const reload = useCallback(() => setReloadKey((k) => k + 1), []);

  useEffect(() => {
    let alive = true;
    const [year, month] = dateKey.split("-").map(Number);

    setLoading(true);

    const load = async () => {
      const [list, route] = await Promise.all([
        getMonthlyExpenditures(year, month).catch((e) => {
          console.warn("[useMapData] 월별 목록 조회 실패", e);
          return null;
        }),
        getConsumptionRoute(dateKey).catch((e) => {
          console.warn("[useMapData] 소비 동선 조회 실패", e);
          return null;
        }),
      ]);

      if (alive) {
        setFullRoute(route ? toRoutePins(route.places) : []);
        setRouteMeters(route ? route.estimatedDistanceMeters : null);
        setRouteTotal(route ? route.totalExpenditure : null);
      }

      const items = list
        ? list.dailyExpenditures.flatMap((d) => d.list)
        : [];
      if (alive) {
        setStores(toTopStores(items, 3));
        setUnmapped(
          items
            .filter(
              (e) =>
                (e.latitude == null || e.longitude == null) &&
                classifyNonPlace(e.storeName) === null &&
                !hasNoLocation(String(e.expenditureId))
            )
            .map((e) => ({
              id: String(e.expenditureId),
              storeName: e.storeName,
              amount: e.amount,
              paymentDate: e.expenditureDate,
            }))
            .sort((a, b) => b.paymentDate.localeCompare(a.paymentDate))
        );
      }

      const pins = await toPins(items);
      if (alive) setAllPins(pins);
    };

    load().finally(() => {
      if (alive) setLoading(false);
    });

    return () => {
      alive = false;
    };
  }, [dateKey, reloadKey]);

  const inRange = useMemo(
    () => (pin: MapPin) => {
      if (timeRange === "all") return true;
      const h = hourOf(pin.paymentDate);
      return h >= range.from && h < range.to;
    },
    [timeRange, range]
  );

  const localRoute = useMemo(
    () =>
      allPins
        .filter((p) => p.paymentDate.slice(0, 10) === dateKey)
        .sort((a, b) => a.paymentDate.localeCompare(b.paymentDate)),
    [allPins, dateKey]
  );

  const mergedRoute = useMemo(() => {
    const fromServer = new Set(fullRoute.map((p) => p.id));
    const extras = localRoute.filter((p) => !fromServer.has(p.id));
    return {
      pins: [...fullRoute, ...extras].sort((a, b) =>
        a.paymentDate.localeCompare(b.paymentDate)
      ),
      complete: fullRoute.length > 0 && extras.length === 0,
    };
  }, [fullRoute, localRoute]);

  const route = useMemo(
    () => mergedRoute.pins.filter(inRange),
    [mergedRoute, inRange]
  );

  const pins = useMemo(
    () => (mode === "today" ? route : allPins.filter(inRange)),
    [mode, route, allPins, inRange]
  );

  const zones: MapZone[] = useMemo(
    () => buildActivityZones(allPins.filter(inRange)),
    [allPins, inRange]
  );

  const heatmapPoints = useMemo(
    () =>
      allPins.filter(inRange).map((p) => ({
        latitude: p.latitude,
        longitude: p.longitude,
        weight: Math.log10(p.amount + 1),
      })),
    [allPins, inRange]
  );

  const summary = useMemo(() => {
    const useServerTotals = timeRange === "all" && mergedRoute.complete;

    const distanceKm =
      useServerTotals && routeMeters != null
        ? routeMeters / 1000
        : routeDistanceKm(route);

    const dayTotal =
      useServerTotals && routeTotal != null
        ? routeTotal
        : route.reduce((s, p) => s + p.amount, 0);

    return {
      distanceKm: Math.round(distanceKm * 10) / 10,
      dayTotal,
      visibleCount: pins.length,
    };
  }, [route, pins, timeRange, mergedRoute, routeMeters, routeTotal]);

  return {
    pins,
    route,
    zones,
    heatmapPoints,
    stores,
    unmapped,
    summary,
    loading,
    reload,
  };
}
