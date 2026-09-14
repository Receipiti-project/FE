import { getLocationHint } from './currentLocation';
import {
  getCachedPlace,
  removeCachedPlace,
  setCachedPlace,
} from './locationCache';
import { haversineKm, LatLng } from './mapGeo';
import {
  classifyNonPlace,
  hasOnlineSignal,
  NonPlaceReason,
} from './onlineMerchant';
import {
  isPlaceSearchConfigured,
  isSpendingPlace,
  Place,
  searchPlaces,
} from './placeSearch';

export type LocationStatus =
  | 'resolved'
  | 'ambiguous'
  | 'nonPlace'
  | 'notFound'
  | 'failed';

export type ResolvedLocation = {
  status: LocationStatus;
  placeId: string | null;
  latitude: number | null;
  longitude: number | null;
  address: string | null;
  placeName: string | null;
  confidence: 'high' | 'medium' | 'low';
  nonPlaceReason: NonPlaceReason;
  candidates: Place[];
  suggested: Place | null;
  fromCache: boolean;
  elapsedMs: number;
};

const NEARBY_PICK_RADIUS_KM = 3;
const BRANCH_TOKEN_RE = /[가-힣A-Za-z0-9]+(?:점|지점)(?![가-힣])/g;

const squash = (s: string): string => s.replace(/\s+/g, '');

function branchTokens(storeName: string): string[] {
  return storeName.match(BRANCH_TOKEN_RE) ?? [];
}

export function hasBranchToken(storeName: string): boolean {
  return branchTokens(storeName).length > 0;
}

export function stripBranchName(storeName: string): string {
  const parts = storeName.trim().split(/\s+/);
  if (parts.length < 2 || !/점$/.test(parts[parts.length - 1])) {
    return storeName.trim();
  }
  return parts.slice(0, -1).join(' ');
}

function matchesBranch(place: Place, tokens: string[]): boolean {
  if (tokens.length === 0) return false;
  const name = squash(place.name);
  return tokens.some((t) => name.includes(squash(t)));
}

function empty(
  status: LocationStatus,
  elapsedMs: number,
  nonPlaceReason: NonPlaceReason = null
): ResolvedLocation {
  return {
    status,
    placeId: null,
    latitude: null,
    longitude: null,
    address: null,
    placeName: null,
    confidence: 'low',
    nonPlaceReason,
    candidates: [],
    suggested: null,
    fromCache: false,
    elapsedMs,
  };
}

function preferSpendingPlaces(candidates: Place[]): Place[] {
  const spending = candidates.filter(isSpendingPlace);
  return spending.length > 0 ? spending : candidates;
}

function pickByBranch(candidates: Place[], tokens: string[]): Place | null {
  return candidates.find((p) => matchesBranch(p, tokens)) ?? null;
}

function pickBest(candidates: Place[], near?: LatLng): Place | null {
  if (candidates.length === 0) return null;
  if (candidates.length === 1) return candidates[0];

  if (near) {
    const nearest = candidates.reduce((best, p) =>
      haversineKm(near, p) < haversineKm(near, best) ? p : best
    );
    if (haversineKm(near, nearest) <= NEARBY_PICK_RADIUS_KM) return nearest;
  }

  return candidates[0];
}

export type ResolveOptions = {
  near?: LatLng;
  rawSms?: string;
};

export async function resolveLocation(
  storeName: string | null,
  options: ResolveOptions = {}
): Promise<ResolvedLocation> {
  const { near, rawSms } = options;
  const t0 = Date.now();
  const name = storeName?.trim() ?? '';
  if (!name) return empty('notFound', Date.now() - t0);

  const cached = getCachedPlace(name);
  const userPinned = cached?.source === 'user';

  if (!userPinned) {
    if (rawSms && hasOnlineSignal(rawSms)) {
      return empty('nonPlace', Date.now() - t0, 'online');
    }

    const nonPlaceReason = classifyNonPlace(name);
    if (nonPlaceReason) {
      return empty('nonPlace', Date.now() - t0, nonPlaceReason);
    }
  }

  if (cached) {
    return {
      status: 'resolved',
      placeId: cached.placeId,
      latitude: cached.latitude,
      longitude: cached.longitude,
      address: cached.address,
      placeName: cached.placeName,
      confidence: cached.confidence,
      nonPlaceReason: null,
      candidates: [],
      suggested: null,
      fromCache: true,
      elapsedMs: Date.now() - t0,
    };
  }

  if (!isPlaceSearchConfigured()) {
    return empty('failed', Date.now() - t0);
  }

  const hint = near ?? (await getLocationHint()) ?? undefined;
  const tokens = branchTokens(name);

  let places: Place[];
  let totalCount: number;
  try {
    const result = await searchPlaces(name, hint);
    places = result.places;
    totalCount = result.totalCount;
  } catch (e) {
    console.warn('[resolveLocation] 장소 검색 실패', e);
    return empty('failed', Date.now() - t0);
  }

  if (places.length === 0) {
    return empty('notFound', Date.now() - t0);
  }

  const candidates = preferSpendingPlaces(places);
  const exactSingle = totalCount === 1;
  const byBranch = tokens.length > 0 ? pickByBranch(candidates, tokens) : null;
  const best = byBranch ?? (exactSingle ? candidates[0] : null);

  if (!best) {
    return {
      ...empty('ambiguous', Date.now() - t0),
      candidates,
      suggested: pickBest(candidates, hint),
    };
  }

  const confidence: 'high' | 'medium' | 'low' = exactSingle
    ? 'high'
    : byBranch
      ? 'medium'
      : 'low';

  setCachedPlace(name, {
    placeId: best.id,
    latitude: best.latitude,
    longitude: best.longitude,
    address: best.roadAddress || best.address,
    placeName: best.name,
    confidence,
    source: 'auto',
  });

  return {
    status: 'resolved',
    placeId: best.id,
    latitude: best.latitude,
    longitude: best.longitude,
    address: best.roadAddress || best.address,
    placeName: best.name,
    confidence,
    nonPlaceReason: null,
    candidates,
    suggested: best,
    fromCache: false,
    elapsedMs: Date.now() - t0,
  };
}

export function confirmLocation(storeName: string, place: Place): void {
  setCachedPlace(storeName, {
    placeId: place.id,
    latitude: place.latitude,
    longitude: place.longitude,
    address: place.roadAddress || place.address,
    placeName: place.name,
    confidence: 'high',
    source: 'user',
  });
}

export function unpinLocation(storeName: string): void {
  removeCachedPlace(storeName);
}
