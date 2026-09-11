const DEFAULT_API_BASE_URL = "http://receipiti.store";

export const API_BASE_URL: string =
  process.env.EXPO_PUBLIC_API_BASE_URL?.trim() || DEFAULT_API_BASE_URL;

export const API_AUTH_TOKEN: string =
  process.env.EXPO_PUBLIC_API_AUTH_TOKEN?.trim() ?? "";

let sessionAuthToken: string | null | undefined;

export const API_OCR_TIMEOUT_MS = 25_000;

export function isApiConfigured(): boolean {
  return API_BASE_URL.length > 0;
}

export function buildAuthHeaders(extra?: Record<string, string>): Record<string, string> {
  const h: Record<string, string> = {
    Accept: "application/json",
    "X-Client": "receipiti-mobile",
    ...(extra ?? {}),
  };
  const token = sessionAuthToken === undefined ? API_AUTH_TOKEN : sessionAuthToken;
  if (token) h.Authorization = `Bearer ${token}`;
  return h;
}

export function setSessionAuthToken(token: string | null): void {
  sessionAuthToken = token?.trim() || null;
}

export function apiUrl(path: string): string {
  if (!API_BASE_URL) {
    throw new Error(
      "API_BASE_URL 이 설정되지 않았습니다."
    );
  }
  const base = API_BASE_URL.replace(/\/+$/, "");
  const tail = path.startsWith("/") ? path : `/${path}`;
  return `${base}${tail}`;
}
