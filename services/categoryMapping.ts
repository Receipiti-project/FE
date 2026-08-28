/**
 * 서버 카테고리 (고정):
 *  1: 식비 (FOOD)
 *  2: 교통 (TRANSPORT)
 *  3: 쇼핑 (SHOPPING)
 *  4: 문화/여가 (CULTURE)
 *  5: 건강/의료 (HEALTH)
 *  6: 기타 (ETC)
 */

import { CategoryId } from "@/constants/mockData";

export function nameToLocalCategoryId(name: string): CategoryId {
  if (!name) return "etc";
  const n = name.trim();
  const MAP: Record<string, CategoryId> = {
    "식비": "food",      "food": "food",
    "교통": "transport", "transport": "transport",
    "쇼핑": "shopping",  "shopping": "shopping",
    "문화/여가": "culture", "문화": "culture", "여가": "culture", "culture": "culture",
    "건강/의료": "health",  "건강": "health", "의료": "health", "health": "health",
    "기타": "etc",       "etc": "etc",
  };
  return MAP[n] ?? MAP[n.toLowerCase()] ?? "etc";
}

const LOCAL_TO_SERVER: Record<CategoryId, number> = {
  food: 1, transport: 2, shopping: 3, culture: 4, health: 5, etc: 6,
};
const SERVER_TO_LOCAL: Record<number, CategoryId> = {
  1: "food", 2: "transport", 3: "shopping", 4: "culture", 5: "health", 6: "etc",
};

export async function initCategoryMapping(): Promise<void> {
}

export function getServerCategoryId(localId: CategoryId): number {
  return LOCAL_TO_SERVER[localId] ?? 6;
}

export function getLocalCategoryId(serverId: number): CategoryId {
  return SERVER_TO_LOCAL[serverId] ?? "etc";
}
