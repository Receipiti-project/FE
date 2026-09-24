import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";
import { apiUrl, setSessionAuthToken } from "@/services/api/config";

const TOKEN_STORAGE_KEY = "receipiti.accessToken";
const KAKAO_LOGIN_PATH = "/oauth2/authorization/kakao";
const LOGIN_CODE_EXCHANGE_PATH = "/api/v1/auth/exchange";

type KakaoLoginResponse = {
  isSuccess: boolean;
  code?: string;
  message?: string;
  result?: { accessToken?: string };
};

type LoginCodeExchange = {
  loginCode: string;
  request: Promise<string>;
};

let loginCodeExchange: LoginCodeExchange | null = null;

function tokenIsExpired(token: string): boolean {
  try {
    const encoded = token.split(".")[1];
    if (!encoded) return true;
    const normalized = encoded.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
    const payload = JSON.parse(globalThis.atob(padded)) as { exp?: number };
    return typeof payload.exp !== "number" || payload.exp * 1000 <= Date.now();
  } catch {
    return true;
  }
}

async function readStoredToken(): Promise<string | null> {
  if (Platform.OS === "web") {
    return globalThis.localStorage?.getItem(TOKEN_STORAGE_KEY) ?? null;
  }
  return SecureStore.getItemAsync(TOKEN_STORAGE_KEY);
}

async function writeStoredToken(token: string | null): Promise<void> {
  if (Platform.OS === "web") {
    if (token) globalThis.localStorage?.setItem(TOKEN_STORAGE_KEY, token);
    else globalThis.localStorage?.removeItem(TOKEN_STORAGE_KEY);
    return;
  }

  if (token) await SecureStore.setItemAsync(TOKEN_STORAGE_KEY, token);
  else await SecureStore.deleteItemAsync(TOKEN_STORAGE_KEY);
}

export async function restoreAuthToken(): Promise<string | null> {
  const storedToken = await readStoredToken();
  const token = storedToken;

  if (!token || tokenIsExpired(token)) {
    if (storedToken) await writeStoredToken(null);
    setSessionAuthToken(null);
    return null;
  }

  setSessionAuthToken(token);
  return token;
}

export async function clearAuthToken(): Promise<void> {
  loginCodeExchange = null;
  setSessionAuthToken(null);
  await writeStoredToken(null);
}

export function getKakaoLoginUrl(): string {
  return apiUrl(KAKAO_LOGIN_PATH);
}

async function requestLoginCodeExchange(loginCode: string): Promise<string> {
  const response = await fetch(apiUrl(LOGIN_CODE_EXCHANGE_PATH), {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ loginCode }),
  });
  const body = (await response.json().catch(() => null)) as KakaoLoginResponse | null;
  const accessToken = body?.result?.accessToken?.trim();

  if (!response.ok || !body?.isSuccess || !accessToken) {
    throw new Error(body?.message || `로그인 서버 오류 (HTTP ${response.status})`);
  }

  setSessionAuthToken(accessToken);
  await writeStoredToken(accessToken);
  return accessToken;
}

export function exchangeLoginCode(loginCode: string): Promise<string> {
  if (loginCodeExchange?.loginCode === loginCode) {
    return loginCodeExchange.request;
  }

  const request = requestLoginCodeExchange(loginCode).catch((error) => {
    if (loginCodeExchange?.request === request) {
      loginCodeExchange = null;
    }
    throw error;
  });

  loginCodeExchange = { loginCode, request };
  return request;
}
