import { apiUrl, buildAuthHeaders } from "@/services/api/config";

export type CategoryApiItem = {
  categoryId: number;
  name: string;
  categoryType: string;
  custom: boolean;
};

export type CategoryRecommendation = {
  categoryId: number;
  categoryName: string;
  categoryType: string;
  custom: boolean;
  matchedCount: number;
  score: number;
  confidence: number;
  autoApplicable: boolean;
  reason: "SAME_STORE" | "SAME_BRAND" | "SAME_BUSINESS_CATEGORY";
};

/** 서버가 추천한 카테고리가 현재 사용자의 카테고리 목록에 있으면 선택합니다. */
export function resolveRecommendedCategoryId(
  recommendation: CategoryRecommendation | null,
  categories: CategoryApiItem[]
): number | null {
  if (!recommendation) return null;
  return categories.some(
    (category) => category.categoryId === recommendation.categoryId
  )
    ? recommendation.categoryId
    : null;
}

async function errorMessage(response: Response, fallback: string): Promise<string> {
  const body = await response.json().catch(() => null) as { message?: string } | null;
  return body?.message || `${fallback} (HTTP ${response.status})`;
}

export async function getCategories(): Promise<CategoryApiItem[]> {
  const response = await fetch(apiUrl("/api/v1/categories"), {
    headers: buildAuthHeaders(),
  });
  if (!response.ok) throw new Error(await errorMessage(response, "카테고리 조회 실패"));
  return response.json();
}

export async function createCategory(name: string): Promise<CategoryApiItem> {
  const response = await fetch(apiUrl("/api/v1/categories"), {
    method: "POST",
    headers: buildAuthHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ name }),
  });
  if (!response.ok) throw new Error(await errorMessage(response, "카테고리 생성 실패"));
  return response.json();
}

export async function updateCategory(id: number, name: string): Promise<CategoryApiItem> {
  const response = await fetch(apiUrl(`/api/v1/categories/rules/${id}`), {
    method: "PATCH",
    headers: buildAuthHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ name }),
  });
  if (!response.ok) throw new Error(await errorMessage(response, "카테고리 수정 실패"));
  return response.json();
}

export async function deleteCategory(id: number): Promise<void> {
  const response = await fetch(apiUrl(`/api/v1/categories/rules/${id}`), {
    method: "DELETE",
    headers: buildAuthHeaders(),
  });
  if (!response.ok) throw new Error(await errorMessage(response, "카테고리 삭제 실패"));
}

export async function getCategoryRecommendation(
  storeName: string,
  businessCategory?: string
): Promise<CategoryRecommendation> {
  const params = new URLSearchParams({ storeName });
  if (businessCategory) params.set("businessCategory", businessCategory);
  const response = await fetch(apiUrl(`/api/v1/categories/recommendation?${params}`), {
    headers: buildAuthHeaders(),
  });
  if (!response.ok) throw new Error(await errorMessage(response, "카테고리 추천 실패"));
  return response.json();
}
