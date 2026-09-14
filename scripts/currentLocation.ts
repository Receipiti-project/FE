import * as Location from 'expo-location';
import { LatLng } from './mapGeo';

const FRESH_WINDOW_MS = 5 * 60 * 1000;
const LOOKUP_TIMEOUT_MS = 4000;

let cached: { value: LatLng; at: number } | null = null;
let permissionDenied = false;

const toLatLng = (pos: Location.LocationObject): LatLng => ({
  latitude: pos.coords.latitude,
  longitude: pos.coords.longitude,
});

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | null> {
  return Promise.race([
    promise,
    new Promise<null>((resolve) => setTimeout(() => resolve(null), ms)),
  ]);
}

async function ensurePermission(): Promise<boolean> {
  if (permissionDenied) return false;
  const current = await Location.getForegroundPermissionsAsync();
  if (current.granted) return true;
  if (!current.canAskAgain) {
    permissionDenied = true;
    return false;
  }
  const asked = await Location.requestForegroundPermissionsAsync();
  if (!asked.granted) permissionDenied = true;
  return asked.granted;
}

export async function getLocationHint(): Promise<LatLng | null> {
  if (cached && Date.now() - cached.at < FRESH_WINDOW_MS) {
    return cached.value;
  }

  try {
    const services = await Location.hasServicesEnabledAsync();
    if (!services) return null;
    if (!(await ensurePermission())) return null;

    const last = await Location.getLastKnownPositionAsync({
      maxAge: FRESH_WINDOW_MS,
    });
    if (last) {
      cached = { value: toLatLng(last), at: Date.now() };
      return cached.value;
    }

    const fresh = await withTimeout(
      Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      }),
      LOOKUP_TIMEOUT_MS
    );
    if (!fresh) return null;

    cached = { value: toLatLng(fresh), at: Date.now() };
    return cached.value;
  } catch (e) {
    console.warn('[getLocationHint] 위치 조회 실패', e);
    return null;
  }
}

export function resetLocationHint(): void {
  cached = null;
  permissionDenied = false;
}
