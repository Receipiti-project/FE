import { Directory, File, Paths } from "expo-file-system";
import { Platform } from "react-native";
import type { MonthlyExpenditureResponse } from "@/services/api/expenditureApi";
import type { ReportResponse } from "@/services/api/reportApi";

const CACHE_DIR = "receipiti";
const CACHE_FILE = "monthlyReportCache.json";
const WEB_STORAGE_KEY = "receipiti.monthlyReportCache.v1";
const CACHE_VERSION = 1;

export type CachedMonthlyReport = {
  report: ReportResponse;
  expenditureSignature: string;
  generatedAt: string;
};

type CacheEntries = Record<string, CachedMonthlyReport>;
type CacheFileShape = { version: number; entries: CacheEntries };

let memory: CacheEntries | null = null;

function cacheFile(): File {
  const directory = new Directory(Paths.document, CACHE_DIR);
  if (!directory.exists) {
    directory.create({ intermediates: true, idempotent: true });
  }
  return new File(directory, CACHE_FILE);
}

function readRaw(): string | null {
  if (Platform.OS === "web") {
    return globalThis.localStorage?.getItem(WEB_STORAGE_KEY) ?? null;
  }

  const file = cacheFile();
  return file.exists ? file.textSync() : null;
}

function writeRaw(value: string): void {
  if (Platform.OS === "web") {
    globalThis.localStorage?.setItem(WEB_STORAGE_KEY, value);
    return;
  }

  cacheFile().write(value);
}

function load(): CacheEntries {
  if (memory) return memory;

  try {
    const raw = readRaw();
    if (!raw) return (memory = {});
    const parsed = JSON.parse(raw) as Partial<CacheFileShape>;
    memory = parsed.version === CACHE_VERSION ? (parsed.entries ?? {}) : {};
  } catch {
    memory = {};
  }

  return memory;
}

function persist(entries: CacheEntries): void {
  memory = entries;
  try {
    writeRaw(JSON.stringify({ version: CACHE_VERSION, entries }));
  } catch (error) {
    console.warn("[monthlyReportCache] 저장 실패", error);
  }
}

function hash(value: string): string {
  let result = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    result ^= value.charCodeAt(index);
    result = Math.imul(result, 16777619);
  }
  return (result >>> 0).toString(36);
}

export function expenditureSignature(data: MonthlyExpenditureResponse): string {
  const items = data.dailyExpenditures
    .flatMap((day) => day.list)
    .map((item) => ({
      id: item.expenditureId,
      store: item.storeName,
      amount: item.amount,
      date: item.expenditureDate,
      category: item.categoryName,
      memo: item.memo ?? "",
    }))
    .sort((a, b) => a.id - b.id);

  const serialized = JSON.stringify(items);
  return `v1:${items.length}:${hash(serialized)}`;
}

export function getCachedMonthlyReport(month: string): CachedMonthlyReport | null {
  return load()[month] ?? null;
}

export function setCachedMonthlyReport(
  month: string,
  value: CachedMonthlyReport
): void {
  persist({ ...load(), [month]: value });
}

export function clearMonthlyReportCache(): void {
  persist({});
}
