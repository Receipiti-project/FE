import { createContext, PropsWithChildren, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import * as SecureStore from "expo-secure-store";
import { useAuth } from "@/contexts/AuthContext";
import {
  CategoryApiItem,
  createCategory,
  deleteCategory,
  getCategories,
  updateCategory,
} from "@/services/api/categoryApi";

type CategoryContextValue = {
  categories: CategoryApiItem[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  addCategory: (name: string) => Promise<CategoryApiItem>;
  renameCategory: (id: number, name: string) => Promise<void>;
  removeCategory: (id: number) => Promise<void>;
  reorderCategories: (orderedIds: number[]) => void;
};

const CategoryContext = createContext<CategoryContextValue | null>(null);
const CATEGORY_ORDER_STORAGE_KEY = "receipiti.category-order.v1";

function sortCategories(categories: CategoryApiItem[], orderedIds: number[]) {
  const positions = new Map(orderedIds.map((id, index) => [id, index]));
  return [...categories].sort((a, b) => {
    const aPosition = positions.get(a.categoryId) ?? Number.MAX_SAFE_INTEGER;
    const bPosition = positions.get(b.categoryId) ?? Number.MAX_SAFE_INTEGER;
    return aPosition - bPosition;
  });
}

async function loadCategoryOrder(): Promise<number[]> {
  const stored = await SecureStore.getItemAsync(CATEGORY_ORDER_STORAGE_KEY);
  if (!stored) return [];
  try {
    const parsed = JSON.parse(stored) as unknown;
    return Array.isArray(parsed)
      ? parsed.filter((id): id is number => typeof id === "number")
      : [];
  } catch {
    return [];
  }
}

export function CategoryProvider({ children }: PropsWithChildren) {
  const { signedIn } = useAuth();
  const [categories, setCategories] = useState<CategoryApiItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const categoryOrderRef = useRef<number[] | null>(null);

  const refetch = useCallback(async () => {
    if (!signedIn) return;
    setLoading(true);
    setError(null);
    try {
      const [items, storedOrder] = await Promise.all([
        getCategories(),
        categoryOrderRef.current === null ? loadCategoryOrder() : Promise.resolve(categoryOrderRef.current),
      ]);
      categoryOrderRef.current = storedOrder;
      setCategories(sortCategories(items, storedOrder));
    } catch (e) {
      setError((e as Error)?.message ?? "카테고리를 불러오지 못했어요.");
    } finally {
      setLoading(false);
    }
  }, [signedIn]);

  const reorderCategories = useCallback((orderedIds: number[]) => {
    categoryOrderRef.current = orderedIds;
    setCategories((current) => sortCategories(current, orderedIds));
    void SecureStore.setItemAsync(CATEGORY_ORDER_STORAGE_KEY, JSON.stringify(orderedIds));
  }, []);

  useEffect(() => {
    if (signedIn) void refetch();
    else setCategories([]);
  }, [refetch, signedIn]);

  const value = useMemo<CategoryContextValue>(() => ({
    categories,
    loading,
    error,
    refetch,
    addCategory: async (name) => {
      const created = await createCategory(name);
      setCategories((current) => {
        const withoutDuplicate = current.filter(
          (category) => category.categoryId !== created.categoryId
        );
        return [...withoutDuplicate, created];
      });
      return created;
    },
    renameCategory: async (id, name) => {
      await updateCategory(id, name);
      await refetch();
    },
    removeCategory: async (id) => {
      await deleteCategory(id);
      await refetch();
    },
    reorderCategories,
  }), [categories, error, loading, refetch, reorderCategories]);

  return <CategoryContext.Provider value={value}>{children}</CategoryContext.Provider>;
}

export function useCategories(): CategoryContextValue {
  const value = useContext(CategoryContext);
  if (!value) throw new Error("useCategories must be used inside CategoryProvider");
  return value;
}
