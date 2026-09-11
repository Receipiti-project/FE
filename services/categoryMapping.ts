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
