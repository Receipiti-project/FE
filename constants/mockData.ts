/* 와이어프레임 단계용 공용 더미 데이터 */

import { Ionicons } from "@expo/vector-icons";

export type IoniconName = keyof typeof Ionicons.glyphMap;

export type CategoryId =
  | "food"
  | "cafe"
  | "transport"
  | "shopping"
  | "culture"
  | "living"
  | "etc";

export type Category = {
  id: CategoryId;
  label: string;
  color: string;
  icon: IoniconName;
};

export const CATEGORIES: Category[] = [
  { id: "food", label: "식비", color: "#F97316", icon: "restaurant-outline" },
  { id: "cafe", label: "카페/간식", color: "#A855F7", icon: "cafe-outline" },
  { id: "transport", label: "교통", color: "#3B82F6", icon: "bus-outline" },
  { id: "shopping", label: "쇼핑", color: "#EC4899", icon: "bag-handle-outline" },
  { id: "culture", label: "문화/여가", color: "#10B981", icon: "film-outline" },
  { id: "living", label: "생활", color: "#F59E0B", icon: "home-outline" },
  { id: "etc", label: "기타", color: "#6B7280", icon: "ellipsis-horizontal" },
];

export const getCategory = (id: CategoryId): Category =>
  CATEGORIES.find((c) => c.id === id) ?? CATEGORIES[CATEGORIES.length - 1];

export type Transaction = {
  id: string;
  store: string;
  amount: number;
  category: CategoryId;
  datetime: string;
  method: string;
  location?: {
    /* 실제 위경도 대신 임시 사용 */
    x: number;
    y: number;
    address: string;
  };
  /* 입력 방식 - 영수증/음성/문자/직접/캡처 */
  source: "receipt" | "voice" | "sms" | "manual" | "capture";
  memo?: string;
};

/* 더미 데이터 */
export const TRANSACTIONS: Transaction[] = [
  {
    id: "t1",
    store: "스타벅스 강남R점",
    amount: 6800,
    category: "cafe",
    datetime: "2026-04-29T18:42:00",
    method: "카드",
    source: "receipt",
    location: { x: 0.62, y: 0.48, address: "서울 강남구 테헤란로 152" },
    memo: "아메리카노 T, 카야토스트",
  },
  {
    id: "t2",
    store: "교보문고 광화문점",
    amount: 32400,
    category: "shopping",
    datetime: "2026-04-29T15:10:00",
    method: "카드",
    source: "receipt",
    location: { x: 0.34, y: 0.27, address: "서울 종로구 종로 1" },
    memo: "디자인 서적 2권",
  },
  {
    id: "t3",
    store: "지하철 (강남 → 광화문)",
    amount: 1550,
    category: "transport",
    datetime: "2026-04-29T14:20:00",
    method: "간편결제",
    source: "sms",
    location: { x: 0.5, y: 0.36, address: "서울 지하철 2호선" },
  },
  {
    id: "t4",
    store: "백소정 강남점",
    amount: 14500,
    category: "food",
    datetime: "2026-04-29T12:48:00",
    method: "카드",
    source: "receipt",
    location: { x: 0.6, y: 0.5, address: "서울 강남구 강남대로 396" },
    memo: "들기름 막국수",
  },
  {
    id: "t5",
    store: "GS25 역삼점",
    amount: 4200,
    category: "living",
    datetime: "2026-04-29T09:05:00",
    method: "간편결제",
    source: "capture",
    location: { x: 0.66, y: 0.55, address: "서울 강남구 역삼동" },
    memo: "생수, 바나나",
  },
  {
    id: "t6",
    store: "CGV 용산아이파크몰",
    amount: 16000,
    category: "culture",
    datetime: "2026-04-28T20:30:00",
    method: "카드",
    source: "manual",
    location: { x: 0.28, y: 0.58, address: "서울 용산구 한강대로 23길" },
    memo: "영화 관람",
  },
  {
    id: "t7",
    store: "이디야 회사앞",
    amount: 4500,
    category: "cafe",
    datetime: "2026-04-28T11:12:00",
    method: "카드",
    source: "receipt",
    location: { x: 0.62, y: 0.46, address: "서울 강남구 역삼동" },
  },
  {
    id: "t8",
    store: "카카오T 택시",
    amount: 8700,
    category: "transport",
    datetime: "2026-04-27T23:18:00",
    method: "간편결제",
    source: "sms",
  },
  {
    id: "t9",
    store: "올리브영 강남",
    amount: 27800,
    category: "shopping",
    datetime: "2026-04-27T19:02:00",
    method: "카드",
    source: "receipt",
    location: { x: 0.6, y: 0.49, address: "서울 강남구" },
  },
  {
    id: "t10",
    store: "버거킹 신논현",
    amount: 9300,
    category: "food",
    datetime: "2026-04-27T13:40:00",
    method: "카드",
    source: "capture",
  },
  {
    id: "t11",
    store: "쿠팡",
    amount: 38900,
    category: "shopping",
    datetime: "2026-04-26T22:05:00",
    method: "간편결제",
    source: "sms",
    memo: "생필품 정기배송",
  },
  {
    id: "t12",
    store: "아워홈 구내식당",
    amount: 6500,
    category: "food",
    datetime: "2026-04-26T12:30:00",
    method: "카드",
    source: "manual",
  },
];

/* 이번 달 카테고리별 합계 */
export const monthlyByCategory = (): { id: CategoryId; total: number }[] => {
  const map = new Map<CategoryId, number>();
  TRANSACTIONS.forEach((t) => {
    if (t.datetime.startsWith("2026-04")) {
      map.set(t.category, (map.get(t.category) ?? 0) + t.amount);
    }
  });
  return CATEGORIES.map((c) => ({
    id: c.id,
    total: map.get(c.id) ?? 0,
  })).sort((a, b) => b.total - a.total);
};

/* 이번 달 총합 */
export const monthlyTotal = (): number =>
  TRANSACTIONS.filter((t) => t.datetime.startsWith("2026-04")).reduce(
    (sum, t) => sum + t.amount,
    0
  );

/* 오늘 합계 */
export const todayTotal = (): number =>
  TRANSACTIONS.filter((t) => t.datetime.startsWith("2026-04-29")).reduce(
    (sum, t) => sum + t.amount,
    0
  );

/* 최근 N건 */
export const recentTransactions = (n = 5): Transaction[] =>
  [...TRANSACTIONS]
    .sort((a, b) => b.datetime.localeCompare(a.datetime))
    .slice(0, n);

/* 오늘 소비 동선 (시간 오름차순) */
export const todayRoute = (): Transaction[] =>
  TRANSACTIONS.filter(
    (t) => t.datetime.startsWith("2026-04-29") && t.location !== undefined
  ).sort((a, b) => a.datetime.localeCompare(b.datetime));

/* 최근 7일 일자별 합계 */
export const weeklySpending = (): { date: string; label: string; total: number }[] => {
  const days = [
    { date: "2026-04-23", label: "목" },
    { date: "2026-04-24", label: "금" },
    { date: "2026-04-25", label: "토" },
    { date: "2026-04-26", label: "일" },
    { date: "2026-04-27", label: "월" },
    { date: "2026-04-28", label: "화" },
    { date: "2026-04-29", label: "오늘" },
  ];
  return days.map((d) => ({
    ...d,
    total: TRANSACTIONS.filter((t) => t.datetime.startsWith(d.date)).reduce(
      (s, t) => s + t.amount,
      0
    ),
  }));
};

/* 자주 가는 매장 Top N (이번 달) */
export const topStores = (n = 3): { store: string; count: number; total: number }[] => {
  const map = new Map<string, { count: number; total: number }>();
  TRANSACTIONS.filter((t) => t.datetime.startsWith("2026-04")).forEach((t) => {
    const cur = map.get(t.store) ?? { count: 0, total: 0 };
    map.set(t.store, { count: cur.count + 1, total: cur.total + t.amount });
  });
  return [...map.entries()]
    .map(([store, v]) => ({ store, ...v }))
    .sort((a, b) => b.count - a.count || b.total - a.total)
    .slice(0, n);
};

/* 시간대별 소비 패턴 (이번 달) */
export const timeOfDayPattern = (): {
  id: string;
  label: string;
  range: string;
  total: number;
  icon: IoniconName;
}[] => {
  const buckets = [
    { id: "morning", label: "아침", range: "06–11시", icon: "sunny-outline" as IoniconName, hours: [6, 7, 8, 9, 10] },
    { id: "lunch", label: "점심", range: "11–14시", icon: "restaurant-outline" as IoniconName, hours: [11, 12, 13] },
    { id: "afternoon", label: "오후", range: "14–18시", icon: "partly-sunny-outline" as IoniconName, hours: [14, 15, 16, 17] },
    { id: "evening", label: "저녁", range: "18–22시", icon: "moon-outline" as IoniconName, hours: [18, 19, 20, 21] },
    { id: "night", label: "야간", range: "22–06시", icon: "bed-outline" as IoniconName, hours: [22, 23, 0, 1, 2, 3, 4, 5] },
  ];
  return buckets.map((b) => ({
    id: b.id,
    label: b.label,
    range: b.range,
    icon: b.icon,
    total: TRANSACTIONS.filter((t) => {
      if (!t.datetime.startsWith("2026-04")) return false;
      const h = new Date(t.datetime).getHours();
      return b.hours.includes(h);
    }).reduce((s, t) => s + t.amount, 0),
  }));
};

/* 요일별 패턴 (이번 달) */
export const dayOfWeekPattern = (): {
  label: string;
  total: number;
  isWeekend: boolean;
}[] => {
  const days = ["일", "월", "화", "수", "목", "금", "토"];
  const totals = new Array(7).fill(0);
  TRANSACTIONS.filter((t) => t.datetime.startsWith("2026-04")).forEach((t) => {
    const d = new Date(t.datetime).getDay();
    totals[d] += t.amount;
  });
  return days.map((label, i) => ({
    label,
    total: totals[i],
    isWeekend: i === 0 || i === 6,
  }));
};

/* 생활권 정보 */
export const ACTIVITY_ZONES = [
  {
    id: "gangnam",
    label: "강남 / 역삼",
    role: "회사 동선",
    visitCount: 18,
    totalSpend: 184500,
    color: "#3B82F6",
    radius: "반경 480m",
  },
  {
    id: "gwanghwamun",
    label: "광화문 / 종로",
    role: "주말 외출",
    visitCount: 4,
    totalSpend: 47200,
    color: "#A855F7",
    radius: "반경 320m",
  },
  {
    id: "yongsan",
    label: "용산",
    role: "여가 / 영화관",
    visitCount: 2,
    totalSpend: 16000,
    color: "#10B981",
    radius: "반경 180m",
  },
];

/* AI 어시스턴트가 제안하는 추천 질문 */
export const AI_SUGGESTED_QUESTIONS = [
  "이번 달 카페 지출이 평소보다 많아?",
  "지난 주말에 가장 많이 쓴 곳은?",
  "외식비 줄이려면 어떻게 해야 할까?",
  "회사 주변 점심 평균값은?",
];

/* 카테고리 자동학습 상태 */
export const CATEGORIZATION_STATS = {
  autoMatched: 42,
  userCorrected: 6,
  pending: 2,
  accuracy: 0.87,
};

/* AI 인사이트 더미 */
export const AI_INSIGHTS = [
  {
    title: "이번 주 카페 지출이 늘었어요",
    body: "지난 주 대비 카페/간식 카테고리가 38% 증가했어요. 평일 오후 2~4시 사이 결제가 잦은 편이에요.",
    icon: "cafe-outline" as IoniconName,
    accent: "#A855F7",
  },
  {
    title: "강남역 부근에서 가장 많이 쓰셨어요",
    body: "이번 달 결제의 47%가 반경 500m 이내에서 발생했어요. 회사 동선과 일치해요.",
    icon: "location-outline" as IoniconName,
    accent: "#3B82F6",
  },
  {
    title: "예산까지 78% 소진",
    body: "월 예산 60만원 중 약 47만원 사용했어요. 남은 일수 대비 일평균 12,800원 이내로 사용하면 안전해요.",
    icon: "trending-up-outline" as IoniconName,
    accent: "#F97316",
  },
];

/* 이번 달 예산 */
export const MONTHLY_BUDGET = 600000;

export const formatKRW = (n: number) => `${n.toLocaleString("ko-KR")}원`;

export const formatTime = (iso: string) => {
  const d = new Date(iso);
  const hh = `${d.getHours()}`.padStart(2, "0");
  const mm = `${d.getMinutes()}`.padStart(2, "0");
  return `${hh}:${mm}`;
};

export const formatDateLabel = (iso: string) => {
  const d = new Date(iso);
  const today = new Date("2026-04-29");
  const yesterday = new Date("2026-04-28");
  if (d.toDateString() === today.toDateString()) return "오늘";
  if (d.toDateString() === yesterday.toDateString()) return "어제";
  return `${d.getMonth() + 1}월 ${d.getDate()}일`;
};
