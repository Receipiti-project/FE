import { apiUrl, buildAuthHeaders, isApiConfigured } from "./config";

export const API_PLACE_SEARCH_TIMEOUT_MS = 8_000;

export type PlaceSearchResponse = {
  placeId: string;
  placeName: string;
  categoryName: string | null;
  address: string | null;
  roadAddress: string | null;
  latitude: number;
  longitude: number;
  distanceMeters: number | null;
};

export function isPlaceApiConfigured(): boolean {
  return isApiConfigured();
}

export async function searchPlacesFromServer(
  query: string,
  latitude: number,
  longitude: number,
  radius?: number
): Promise<PlaceSearchResponse[]> {
  if (!isApiConfigured()) {
    throw new Error("API_BASE_URL 이 설정되지 않았습니다.");
  }

  const params = new URLSearchParams({
    query,
    latitude: String(latitude),
    longitude: String(longitude),
  });
  if (radius != null) params.set("radius", String(radius));

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), API_PLACE_SEARCH_TIMEOUT_MS);

  try {
    const res = await fetch(`${apiUrl("/api/v1/places/search")}?${params}`, {
      headers: buildAuthHeaders(),
      signal: controller.signal,
    });

    if (!res.ok) {
      throw new Error(`장소 검색 실패 (HTTP ${res.status})`);
    }

    const json = await res.json();
    return Array.isArray(json) ? json : (json?.result ?? []);
  } finally {
    clearTimeout(timer);
  }
}
