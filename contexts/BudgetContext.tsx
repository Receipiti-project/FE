import {
  createContext,
  PropsWithChildren,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import * as SecureStore from "expo-secure-store";

export const DEFAULT_MONTHLY_BUDGET = 600_000;

const BUDGET_STORAGE_KEY = "receipiti.monthly-budget";

type BudgetContextValue = {
  monthlyBudget: number;
  setMonthlyBudget: (amount: number) => Promise<void>;
};

const BudgetContext = createContext<BudgetContextValue | null>(null);

export function BudgetProvider({ children }: PropsWithChildren) {
  const [monthlyBudget, setMonthlyBudgetState] = useState(DEFAULT_MONTHLY_BUDGET);

  useEffect(() => {
    void SecureStore.getItemAsync(BUDGET_STORAGE_KEY)
      .then((stored) => {
        const amount = Number(stored);
        if (Number.isSafeInteger(amount) && amount > 0) {
          setMonthlyBudgetState(amount);
        }
      })
      .catch(() => undefined);
  }, []);

  const value = useMemo<BudgetContextValue>(() => ({
    monthlyBudget,
    setMonthlyBudget: async (amount) => {
      if (!Number.isSafeInteger(amount) || amount <= 0) {
        throw new Error("월 예산은 1원 이상으로 입력해 주세요.");
      }
      await SecureStore.setItemAsync(BUDGET_STORAGE_KEY, String(amount));
      setMonthlyBudgetState(amount);
    },
  }), [monthlyBudget]);

  return <BudgetContext.Provider value={value}>{children}</BudgetContext.Provider>;
}

export function useBudget(): BudgetContextValue {
  const value = useContext(BudgetContext);
  if (!value) throw new Error("useBudget must be used inside BudgetProvider");
  return value;
}
