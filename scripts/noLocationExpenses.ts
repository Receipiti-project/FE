import { Directory, File, Paths } from 'expo-file-system';

const CACHE_DIR = 'receipiti';
const CACHE_FILE = 'noLocationExpenses.json';
const MAX_ENTRIES = 1000;
const CACHE_VERSION = 1;

type StoreShape = Record<string, number>;
type StoreFileShape = { version: number; entries: StoreShape };

let memory: StoreShape | null = null;

function storeFile(): File {
  const dir = new Directory(Paths.document, CACHE_DIR);
  if (!dir.exists) dir.create({ intermediates: true, idempotent: true });
  return new File(dir, CACHE_FILE);
}

function load(): StoreShape {
  if (memory) return memory;
  try {
    const file = storeFile();
    if (!file.exists) {
      memory = {};
      return memory;
    }
    const parsed = JSON.parse(file.textSync()) as Partial<StoreFileShape>;
    memory = parsed.version === CACHE_VERSION ? (parsed.entries ?? {}) : {};
  } catch {
    memory = {};
  }
  return memory;
}

function persist(data: StoreShape): void {
  try {
    storeFile().write(
      JSON.stringify({ version: CACHE_VERSION, entries: data })
    );
  } catch (e) {
    console.warn('[noLocationExpenses] 저장 실패', e);
  }
}

function evictOldest(data: StoreShape): StoreShape {
  const entries = Object.entries(data);
  if (entries.length <= MAX_ENTRIES) return data;
  const kept = entries.sort((a, b) => b[1] - a[1]).slice(0, MAX_ENTRIES);
  return Object.fromEntries(kept);
}

export function hasNoLocation(expenditureId: string): boolean {
  if (!expenditureId) return false;
  return expenditureId in load();
}

export function markNoLocation(expenditureId: string): void {
  if (!expenditureId) return;
  const data = load();
  data[expenditureId] = Date.now();
  memory = evictOldest(data);
  persist(memory);
}

export function clearNoLocation(): void {
  memory = {};
  persist(memory);
}
