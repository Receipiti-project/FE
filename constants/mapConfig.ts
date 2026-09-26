export const MODES = [
  { id: "today", label: "소비 동선" },
  { id: "heatmap", label: "히트맵" },
  { id: "zones", label: "생활권" },
] as const;

export type Mode = (typeof MODES)[number]["id"];

export const TIME_RANGES = [
  { id: "all", label: "전체", from: 0, to: 24 },
  { id: "dawn", label: "새벽", from: 0, to: 6 },
  { id: "morning", label: "오전", from: 6, to: 12 },
  { id: "afternoon", label: "오후", from: 12, to: 18 },
  { id: "evening", label: "저녁", from: 18, to: 24 },
] as const;

export type TimeRangeId = (typeof TIME_RANGES)[number]["id"];
export type TimeRange = (typeof TIME_RANGES)[number];

export const getTimeRange = (id: TimeRangeId): TimeRange =>
  TIME_RANGES.find((r) => r.id === id) ?? TIME_RANGES[0];

export const INITIAL_REGION = {
  latitude: 37.53,
  longitude: 126.998,
  latitudeDelta: 0.13,
  longitudeDelta: 0.1,
};

export const ZONE_LABEL_ZOOM_THRESHOLD = 0.05;

export const ZONE_COLORS = [
  "#3B82F6",
  "#A855F7",
  "#10B981",
  "#F97316",
  "#EF4444",
  "#0EA5E9",
];

export const ROUTE_COLOR = "#3B82F6";

export const HEATMAP_GRADIENT = {
  colors: ["#3B82F6", "#A855F7", "#F97316", "#EF4444"],
  startPoints: [0.05, 0.35, 0.7, 1],
  colorMapSize: 256,
};
