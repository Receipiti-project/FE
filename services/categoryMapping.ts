import { getCategoryByName } from "@/constants/mockData";

export function categoryKeyFromName(name: string): string {
  return getCategoryByName(name).id;
}
