import { createContext, PropsWithChildren, useCallback, useContext, useEffect, useMemo, useState } from "react";
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
  addCategory: (name: string) => Promise<void>;
  renameCategory: (id: number, name: string) => Promise<void>;
  removeCategory: (id: number) => Promise<void>;
};

const CategoryContext = createContext<CategoryContextValue | null>(null);

export function CategoryProvider({ children }: PropsWithChildren) {
  const { signedIn } = useAuth();
  const [categories, setCategories] = useState<CategoryApiItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    if (!signedIn) return;
    setLoading(true);
    setError(null);
    try {
      setCategories(await getCategories());
    } catch (e) {
      setError((e as Error)?.message ?? "카테고리를 불러오지 못했어요.");
    } finally {
      setLoading(false);
    }
  }, [signedIn]);

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
      await createCategory(name);
      await refetch();
    },
    renameCategory: async (id, name) => {
      await updateCategory(id, name);
      await refetch();
    },
    removeCategory: async (id) => {
      await deleteCategory(id);
      await refetch();
    },
  }), [categories, error, loading, refetch]);

  return <CategoryContext.Provider value={value}>{children}</CategoryContext.Provider>;
}

export function useCategories(): CategoryContextValue {
  const value = useContext(CategoryContext);
  if (!value) throw new Error("useCategories must be used inside CategoryProvider");
  return value;
}
