import {
  PlaceSearchResponse,
  isPlaceApiConfigured,
  searchPlacesFromServer,
} from '@/services/api/placeApi';
import { LatLng } from './mapGeo';

const FALLBACK_CENTER: LatLng = { latitude: 37.5665, longitude: 126.978 };
const WIDE_RADIUS_M = 20000;

export type Place = {
  id: string;
  name: string;
  address: string;
  roadAddress: string;
  categoryName: string;
  latitude: number;
  longitude: number;
  distanceMeters: number | null;
};

export type PlaceSearchResult = {
  places: Place[];
  totalCount: number;
};

export function isSpendingPlace(place: Place): boolean {
  return place.categoryName.trim().length > 0;
}

export function isPlaceSearchConfigured(): boolean {
  return isPlaceApiConfigured();
}

function fromBackend(p: PlaceSearchResponse): Place | null {
  if (!Number.isFinite(p.latitude) || !Number.isFinite(p.longitude)) return null;
  return {
    id: String(p.placeId),
    name: p.placeName,
    address: p.address ?? '',
    roadAddress: p.roadAddress ?? '',
    categoryName: p.categoryName ?? '',
    latitude: p.latitude,
    longitude: p.longitude,
    distanceMeters: p.distanceMeters ?? null,
  };
}

export async function searchPlaces(
  query: string,
  near?: LatLng
): Promise<PlaceSearchResult> {
  const q = query.trim();
  if (!q) return { places: [], totalCount: 0 };

  const origin = near ?? FALLBACK_CENTER;
  let list = await searchPlacesFromServer(q, origin.latitude, origin.longitude);
  if (list.length === 0) {
    list = await searchPlacesFromServer(
      q,
      origin.latitude,
      origin.longitude,
      WIDE_RADIUS_M
    );
  }
  const places = list.map(fromBackend).filter((p): p is Place => p !== null);

  return { places, totalCount: places.length };
}
