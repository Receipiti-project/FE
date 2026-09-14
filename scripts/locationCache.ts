import { Directory, File, Paths } from 'expo-file-system';

const CACHE_DIR = 'receipiti';
const CACHE_FILE = 'placeCache.json';
const MAX_ENTRIES = 500;
const CACHE_VERSION = 4;

export type CachedPlace = {
  placeId: string;
  latitude: number;
  longitude: number;
  address: string;
  placeName: string;
  confidence: 'high' | 'medium' | 'low';
  source: 'auto' | 'user';
  savedAt: number;
};

type CacheShape = Record<string, CachedPlace>;
type CacheFileShape = { version: number; entries: CacheShape };

let memory: CacheShape | null = null;

const cacheKey = (storeName: string): string =>
  storeName.trim().replace(/\s+/g, ' ').toUpperCase();

function cacheFile(): File {
  const dir = new Directory(Paths.document, CACHE_DIR);
  if (!dir.exists) dir.create({ intermediates: true, idempotent: true });
  return new File(dir, CACHE_FILE);
}

function load(): CacheShape {
  if (memory) return memory;
  try {
    const file = cacheFile();
    if (!file.exists) {
      memory = {};
      return memory;
    }
    const parsed = JSON.parse(file.textSync()) as Partial<CacheFileShape>;
    memory = parsed.version === CACHE_VERSION ? (parsed.entries ?? {}) : {};
  } catch {
    memory = {};
  }
  return memory;
}

function persist(data: CacheShape): void {
  try {
    cacheFile().write(
      JSON.stringify({ version: CACHE_VERSION, entries: data })
    );
  } catch (e) {
    console.warn('[placeCache] 저장 실패', e);
  }
}

function evictOldest(data: CacheShape): CacheShape {
  const entries = Object.entries(data);
  if (entries.length <= MAX_ENTRIES) return data;
  const kept = entries
    .sort((a, b) => b[1].savedAt - a[1].savedAt)
    .slice(0, MAX_ENTRIES);
  return Object.fromEntries(kept);
}

export function getCachedPlace(storeName: string): CachedPlace | null {
  const key = cacheKey(storeName);
  if (!key) return null;
  return load()[key] ?? null;
}

export function setCachedPlace(
  storeName: string,
  place: Omit<CachedPlace, 'savedAt'>
): void {
  const key = cacheKey(storeName);
  if (!key) return;
  const data = load();
  data[key] = { ...place, savedAt: Date.now() };
  memory = evictOldest(data);
  persist(memory);
}

export function removeCachedPlace(storeName: string): void {
  const key = cacheKey(storeName);
  if (!key) return;
  const data = load();
  if (!(key in data)) return;
  delete data[key];
  memory = data;
  persist(memory);
}

export function clearPlaceCache(): void {
  memory = {};
  persist(memory);
}

export function placeCacheSize(): number {
  return Object.keys(load()).length;
}
