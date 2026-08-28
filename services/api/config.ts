export const API_BASE_URL: string =
  ((process.env as any).EXPO_PUBLIC_API_BASE_URL as string | undefined)?.trim() ??
  "";

export const API_AUTH_TOKEN: string =
  ((process.env as any).EXPO_PUBLIC_API_AUTH_TOKEN as string | undefined)?.trim() ??
  "";

export const API_OCR_TIMEOUT_MS = 25_000;

export function isApiConfigured(): boolean {
  return API_BASE_URL.length > 0;
}

/* 백엔드 OCR 엔드포인트 임시 설정 */
export const OCR_ENDPOINTS = {
  receipt: "/ocr/receipt",
  capture: "/ocr/capture",
} as const;

export function buildAuthHeaders(extra?: Record<string, string>): Record<string, string> {
  const h: Record<string, string> = {
    Accept: "application/json",
    "X-Client": "receipiti-mobile",
    "ngrok-skip-browser-warning": "true",
    ...(extra ?? {}),
  };
  if (API_AUTH_TOKEN) h.Authorization = `Bearer ${API_AUTH_TOKEN}`;
  return h;
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
