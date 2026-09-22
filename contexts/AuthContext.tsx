import { createContext, PropsWithChildren, useContext, useEffect, useMemo, useState } from "react";
import {
  clearAuthToken,
  exchangeLoginCode,
  restoreAuthToken,
} from "@/services/auth";
import { clearMonthlyReportCache } from "@/services/monthlyReportCache";

type AuthContextValue = {
  ready: boolean;
  signedIn: boolean;
  completeSignIn: (loginCode: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: PropsWithChildren) {
  const [ready, setReady] = useState(false);
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    restoreAuthToken()
      .then((token) => setSignedIn(Boolean(token)))
      .finally(() => setReady(true));
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      ready,
      signedIn,
      completeSignIn: async (loginCode: string) => {
        await exchangeLoginCode(loginCode);
        setSignedIn(true);
      },
      signOut: async () => {
        await clearAuthToken();
        clearMonthlyReportCache();
        setSignedIn(false);
      },
    }),
    [ready, signedIn]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside AuthProvider");
  return value;
}
