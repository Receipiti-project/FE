import { useCallback, useEffect, useState } from "react";
import {
  getMonthlyExpenditures,
  ExpenditureListItem,
} from "@/services/api/expenditureApi";
import { isApiConfigured } from "@/services/api/config";
import {
  CategoryId,
  CATEGORIES,
  IoniconName,
  TRANSACTIONS,
} from "@/constants/mockData";

export type DisplayTransaction = {
  id: string;
  expenditureId?: number;
  store: string;
  amount: number;
  category: CategoryId;
  categoryName: string;
  datetime: string;
  method: string;
  memo?: string;
  currency: string;
};

export type DailySpending = {
  date: string; // "YYYY-MM-DD"
  label: string; // "월", "오늘" 등
  total: number;
};

export type CategorySpending = {
  id: CategoryId;
  name: string;
  total: number;
};

export type StoreRanking = {
  store: string;
  count: number;
  total: number;
};

export type TimeOfDayItem = {
  id: string;
  label: string;
  range: string;
  icon: IoniconName;
  total: number;
};

export type DayOfWeekItem = {
  label: string;
  total: number;
  isWeekend: boolean;
};

export type UseExpendituresResult = {
  loading: boolean;
  error: string | null;
  refetch: () => void;
  totalAmount: number;
  txCount: number;
  todayTotal: number;
  todayCount: number;
  dailyAvg: number;
  allItems: DisplayTransaction[];
  recentItems: DisplayTransaction[];
  todayItems: DisplayTransaction[];
  weeklySpending: DailySpending[];
  byCategoryReport: CategorySpending[];
  topStores: StoreRanking[];
  timeOfDayPattern: TimeOfDayItem[];
  dayOfWeekPattern: DayOfWeekItem[];
};

function toCategoryId(name: string): CategoryId {
  if (!name) return "etc";
  const n = name.trim();
  const MAP: Record<string, CategoryId> = {
    "식비": "food",      food: "food",
    "교통": "transport", transport: "transport",
    "쇼핑": "shopping",  shopping: "shopping",
    "문화/여가": "culture", "문화": "culture", "여가": "culture", culture: "culture",
    "건강/의료": "health",  "건강": "health", "의료": "health", health: "health",
    "기타": "etc",       etc: "etc",
  };
  return MAP[n] ?? MAP[n.toLowerCase()] ?? "etc";
}

function toDisplay(item: ExpenditureListItem): DisplayTransaction {
  return {
    id: `server_${item.expenditureId}`,
    expenditureId: item.expenditureId,
    store: item.storeName,
    amount: item.amount,
    category: toCategoryId(item.categoryName),
    categoryName: item.categoryName,
    datetime: item.expenditureDate,
    method: "카드",
    memo: item.memo,
    currency: item.currency ?? "KRW",
  };
}

function mockToDisplay(t: (typeof TRANSACTIONS)[number]): DisplayTransaction {
  const cat = CATEGORIES.find((c) => c.id === t.category);
  return {
    id: t.id,
    store: t.store,
    amount: t.amount,
    category: t.category,
    categoryName: cat?.label ?? t.category,
    datetime: t.datetime,
    method: t.method,
    memo: t.memo,
    currency: "KRW",
  };
}

function localDateStr(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function todayStr(): string {
  return localDateStr();
}

function last7Days(): { date: string; label: string }[] {
  const days: { date: string; label: string }[] = [];
  const DAY_LABELS = ["일", "월", "화", "수", "목", "금", "토"];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = localDateStr(d);
    const label = i === 0 ? "오늘" : DAY_LABELS[d.getDay()];
    days.push({ date: dateStr, label });
  }
  return days;
}

function buildWeeklySpending(items: DisplayTransaction[]): DailySpending[] {
  const days = last7Days();
  return days.map((d) => ({
    date: d.date,
    label: d.label,
    total: items
      .filter((t) => t.datetime.startsWith(d.date))
      .reduce((s, t) => s + t.amount, 0),
  }));
}

function buildByCategoryReport(
  items: DisplayTransaction[],
  totalAmount: number
): CategorySpending[] {
  const map = new Map<CategoryId, { name: string; total: number }>();
  for (const item of items) {
    const cur = map.get(item.category);
    if (cur) {
      cur.total += item.amount;
    } else {
      map.set(item.category, { name: item.categoryName, total: item.amount });
    }
  }
  return [...map.entries()]
    .map(([id, v]) => ({ id, name: v.name, total: v.total }))
    .filter((c) => c.total > 0)
    .sort((a, b) => b.total - a.total);
}

function buildTopStores(items: DisplayTransaction[], n = 3): StoreRanking[] {
  const map = new Map<string, { count: number; total: number }>();
  for (const item of items) {
    const cur = map.get(item.store) ?? { count: 0, total: 0 };
    map.set(item.store, { count: cur.count + 1, total: cur.total + item.amount });
  }
  return [...map.entries()]
    .map(([store, v]) => ({ store, ...v }))
    .sort((a, b) => b.count - a.count || b.total - a.total)
    .slice(0, n);
}

const TOD_BUCKETS: TimeOfDayItem[] = [
  { id: "morning", label: "아침", range: "06–11시", icon: "sunny-outline", total: 0 },
  { id: "lunch", label: "점심", range: "11–14시", icon: "restaurant-outline", total: 0 },
  { id: "afternoon", label: "오후", range: "14–18시", icon: "partly-sunny-outline", total: 0 },
  { id: "evening", label: "저녁", range: "18–22시", icon: "moon-outline", total: 0 },
  { id: "night", label: "야간", range: "22–06시", icon: "bed-outline", total: 0 },
];

const TOD_HOURS: Record<string, number[]> = {
  morning: [6, 7, 8, 9, 10],
  lunch: [11, 12, 13],
  afternoon: [14, 15, 16, 17],
  evening: [18, 19, 20, 21],
  night: [22, 23, 0, 1, 2, 3, 4, 5],
};

function buildTimeOfDayPattern(items: DisplayTransaction[]): TimeOfDayItem[] {
  return TOD_BUCKETS.map((b) => ({
    ...b,
    total: items
      .filter((t) => {
        const h = new Date(t.datetime).getHours();
        return TOD_HOURS[b.id].includes(h);
      })
      .reduce((s, t) => s + t.amount, 0),
  }));
}

const DOW_LABELS = ["일", "월", "화", "수", "목", "금", "토"];

function buildDayOfWeekPattern(items: DisplayTransaction[]): DayOfWeekItem[] {
  const totals = new Array(7).fill(0);
  for (const item of items) {
    totals[new Date(item.datetime).getDay()] += item.amount;
  }
  return DOW_LABELS.map((label, i) => ({
    label,
    total: totals[i],
    isWeekend: i === 0 || i === 6,
  }));
}

function processItems(items: DisplayTransaction[], totalAmount: number) {
  const today = todayStr();
  const sorted = [...items].sort((a, b) =>
    b.datetime.localeCompare(a.datetime)
  );
  const todayItems = sorted.filter((t) => localDateStr(new Date(t.datetime)) === today);
  const todayTotalAmt = todayItems.reduce((s, t) => s + t.amount, 0);
  const daysInMonth = new Date().getDate();
  return {
    allItems: sorted,
    recentItems: sorted.slice(0, 5),
    todayItems,
    todayTotal: todayTotalAmt,
    todayCount: todayItems.length,
    txCount: items.length,
    dailyAvg: daysInMonth > 0 ? Math.round(totalAmount / daysInMonth) : 0,
    weeklySpending: buildWeeklySpending(items),
    byCategoryReport: buildByCategoryReport(items, totalAmount),
    topStores: buildTopStores(items),
    timeOfDayPattern: buildTimeOfDayPattern(items),
    dayOfWeekPattern: buildDayOfWeekPattern(items),
  };
}

export function useExpenditures(recentCount = 5): UseExpendituresResult {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<Omit<UseExpendituresResult, "loading" | "error" | "refetch"> | null>(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (isApiConfigured()) {
        const res = await getMonthlyExpenditures(year, month);
        const allApiItems = res.dailyExpenditures.flatMap((d) =>
          d.list.map(toDisplay)
        );
        const processed = processItems(allApiItems, res.totalAmount);
        setData({ totalAmount: res.totalAmount, ...processed });
      } else {
        const mockItems = TRANSACTIONS.map(mockToDisplay);
        const mockTotal = mockItems.reduce((s, t) => s + t.amount, 0);
        const processed = processItems(mockItems, mockTotal);
        setData({ totalAmount: mockTotal, ...processed });
      }
    } catch (e) {
      const msg = (e as Error)?.message ?? "데이터를 불러오지 못했어요.";
      setError(msg);
      const mockItems = TRANSACTIONS.map(mockToDisplay);
      const mockTotal = mockItems.reduce((s, t) => s + t.amount, 0);
      const processed = processItems(mockItems, mockTotal);
      setData({ totalAmount: mockTotal, ...processed });
    } finally {
      setLoading(false);
    }
  }, [year, month]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  const empty: Omit<UseExpendituresResult, "loading" | "error" | "refetch"> = {
    totalAmount: 0, txCount: 0, todayTotal: 0, todayCount: 0, dailyAvg: 0,
    allItems: [], recentItems: [], todayItems: [],
    weeklySpending: [], byCategoryReport: [], topStores: [],
    timeOfDayPattern: TOD_BUCKETS.map((b) => ({ ...b, total: 0 })),
    dayOfWeekPattern: DOW_LABELS.map((l, i) => ({ label: l, total: 0, isWeekend: i === 0 || i === 6 })),
  };

  return {
    loading,
    error,
    refetch: fetch,
    ...(data ?? empty),
  };
}

export function formatDateLabelReal(iso: string): string {
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const d = new Date(iso);
  if (d.toDateString() === today.toDateString()) return "오늘";
  if (d.toDateString() === yesterday.toDateString()) return "어제";
  return `${d.getMonth() + 1}월 ${d.getDate()}일`;
}

export function formatTimeReal(iso: string): string {
  const d = new Date(iso);
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}
