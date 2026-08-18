import { CategoryId } from "@/constants/mockData";
import {
  API_OCR_TIMEOUT_MS,
  apiUrl,
  buildAuthHeaders,
  isApiConfigured,
} from "@/services/api/config";

export const CATEGORY_ID_MAP: Record<CategoryId, number> = {
  food:      1,
  transport: 2,
  shopping:  3,
  culture:   4,
  health:    5,
  etc:       6,
};

export const CATEGORY_ID_REVERSE: Record<number, CategoryId> = {
  1: "food",
  2: "transport",
  3: "shopping",
  4: "culture",
  5: "health",
  6: "etc",
};

/* ─── 응답/요청 타입 ─── */

/** POST /api/v1/expenditures/ocr 응답 */
export type OcrApiResponse = {
  storeName: string;
  amount: number;
  paymentDate: string; // ISO 8601
};

/* ─── GET /api/v1/expenditures (월별 목록) 타입 ─── */

/** 지출 목록 항목 */
export type ExpenditureListItem = {
  expenditureId: number;
  categoryName: string;
  storeName: string;
  amount: number;
  expenditureDate: string; // ISO 8601
  memo?: string;
  currency: string;
};

/** 일별 지출 묶음 */
export type DailyExpenditure = {
  date: string; // "YYYY-MM-DD"
  dailyTotalAmount: number;
  list: ExpenditureListItem[];
};

/** GET /api/v1/expenditures 응답 전체 */
export type MonthlyExpenditureResponse = {
  totalAmount: number;
  dailyExpenditures: DailyExpenditure[];
};

/* ─── POST /api/v1/expenditures 타입 ─── */

/** POST /api/v1/expenditures 요청 */
export type CreateExpenditureDto = {
  categoryId: number;
  storeName: string;
  amount: number;
  expenditureDate: string; // ISO 8601
  memo?: string;
  currency?: string; // 기본 "KRW"
};

/** POST /api/v1/expenditures 응답 */
export type CreateExpenditureResponse = {
  expenditureId: number;
  storeName: string;
  amount: number;
  expenditureDate: string;
  memo?: string;
  currency: string;
};

/** GET /api/v1/expenditures/{id} 응답 */
export type ExpenditureDetail = {
  expenditureId: number;
  categoryId: number;
  categoryName: string;
  storeName: string;
  amount: number;
  expenditureDate: string;
  memo?: string;
  currency: string;
  inputType: "OCR" | "MANUAL" | "CAPTURE";
  createdAt: string;
  address?: string;
  imageUrl?: string;
};

/** PATCH /api/v1/expenditures/{id} 요청 */
export type UpdateExpenditureDto = {
  categoryId?: number;
  storeName?: string;
  amount?: number;
  expenditureDate?: string;
  memo?: string;
  currency?: string;
};

/* ─── 카테고리 타입 ─── */

export type CategoryApiItem = {
  categoryId: number;
  name: string;
  categoryType: string;
  custom: boolean;
};

/* ─── API 함수 ─── */

/**
 * GET /api/v1/categories
 * 공통 + 유저 커스텀 카테고리 목록 조회
 */
export async function getCategories(): Promise<CategoryApiItem[]> {
  if (!isApiConfigured()) return [];
  const url = apiUrl("/api/v1/categories");
  const res = await fetch(url, { headers: buildAuthHeaders() });
  if (!res.ok) throw new Error(`카테고리 조회 실패 (HTTP ${res.status})`);
  return res.json();
}

/**
 * POST /api/v1/categories
 * 커스텀 카테고리 생성
 */
export async function createCategory(name: string): Promise<CategoryApiItem> {
  if (!isApiConfigured()) throw new Error("API_BASE_URL 미설정");
  const url = apiUrl("/api/v1/categories");
  const res = await fetch(url, {
    method: "POST",
    headers: buildAuthHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ name }),
  });
  if (!res.ok) throw new Error(`카테고리 생성 실패 (HTTP ${res.status})`);
  return res.json();
}

/**
 * PATCH /api/v1/categories/rules/{id}
 * 커스텀 카테고리 이름 수정
 */
export async function updateCategoryRule(id: number, name: string): Promise<CategoryApiItem> {
  if (!isApiConfigured()) throw new Error("API_BASE_URL 미설정");
  const url = apiUrl(`/api/v1/categories/rules/${id}`);
  const res = await fetch(url, {
    method: "PATCH",
    headers: buildAuthHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ name }),
  });
  if (!res.ok) throw new Error(`카테고리 수정 실패 (HTTP ${res.status})`);
  return res.json();
}

/**
 * DELETE /api/v1/categories/rules/{id}
 * 커스텀 카테고리 삭제 (사용 중인 카테고리는 삭제 불가)
 */
export async function deleteCategoryRule(id: number): Promise<void> {
  if (!isApiConfigured()) throw new Error("API_BASE_URL 미설정");
  const url = apiUrl(`/api/v1/categories/rules/${id}`);
  const res = await fetch(url, { method: "DELETE", headers: buildAuthHeaders() });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`카테고리 삭제 실패 (HTTP ${res.status})${text ? `: ${text}` : ""}`);
  }
}

/**
 * POST /api/v1/expenditures/ocr
 * 영수증/캡처 이미지를 서버로 전송 → 상호명·금액·날짜 추출
 */
export async function ocrReceipt(uri: string): Promise<OcrApiResponse> {
  const url = apiUrl("/api/v1/expenditures/ocr");
  const headers = buildAuthHeaders();

  const form = new FormData();
  const raw = uri.split("?")[0];
  const fileName = raw.substring(raw.lastIndexOf("/") + 1) || `upload_${Date.now()}.jpg`;
  const ext = fileName.toLowerCase().split(".").pop() ?? "jpg";
  const mime =
    ext === "png" ? "image/png"
    : ext === "heic" ? "image/heic"
    : "image/jpeg";

  form.append("file", { uri, name: fileName, type: mime } as unknown as Blob);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), API_OCR_TIMEOUT_MS);

  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers,
      body: form as unknown as BodyInit,
      signal: controller.signal,
    });
  } catch (e) {
    clearTimeout(timer);
    const msg =
      (e as Error)?.name === "AbortError"
        ? `OCR 요청이 ${Math.round(API_OCR_TIMEOUT_MS / 1000)}초를 초과했어요.`
        : `OCR 요청 실패: ${(e as Error)?.message ?? "네트워크 오류"}`;
    throw new Error(msg);
  }
  clearTimeout(timer);

  if (!res.ok) {
    if (res.status === 401 || res.status === 403) {
      throw new Error(`AUTH_EXPIRED:토큰이 만료됐어요. .env의 토큰을 갱신하고 앱을 재시작해주세요. (HTTP ${res.status})`);
    }
    throw new Error(`OCR 서버 오류 (HTTP ${res.status})`);
  }

  const json = await res.json();
  console.log("[ocrReceipt] 서버 응답:", JSON.stringify(json));

  // 서버가 HTTP 200이지만 status:-404 같은 오류 응답을 보낼 때
  if (json && typeof json.status === "number" && json.status < 0) {
    throw new Error(`AUTH_EXPIRED:토큰이 만료됐거나 인증에 실패했어요. .env의 토큰을 갱신하고 앱을 재시작해주세요. (status: ${json.status})`);
  }

  return json as OcrApiResponse;
}

/**
 * POST /api/v1/expenditures
 * 지출 내역 저장 (직접 입력 / OCR 리뷰 확인 후)
 */
export async function createExpenditure(
  dto: CreateExpenditureDto
): Promise<CreateExpenditureResponse> {
  if (!isApiConfigured()) {
    throw new Error("API_BASE_URL 이 설정되지 않았습니다.");
  }

  const url = apiUrl("/api/v1/expenditures");
  const headers = buildAuthHeaders({ "Content-Type": "application/json" });

  const body: CreateExpenditureDto = {
    currency: "KRW",
    ...dto,
  };

  const res = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`지출 저장 실패 (HTTP ${res.status})${text ? `: ${text}` : ""}`);
  }

  return res.json() as Promise<CreateExpenditureResponse>;
}

/**
 * GET /api/v1/expenditures/{id}
 * 특정 지출 상세 조회
 */
export async function getExpenditure(id: number): Promise<ExpenditureDetail> {
  const url = apiUrl(`/api/v1/expenditures/${id}`);
  const headers = buildAuthHeaders();

  const res = await fetch(url, { headers });

  if (!res.ok) {
    throw new Error(`지출 조회 실패 (HTTP ${res.status})`);
  }

  return res.json() as Promise<ExpenditureDetail>;
}

/**
 * DELETE /api/v1/expenditures/{id}
 * 지출 내역 삭제
 */
export async function deleteExpenditure(id: number): Promise<void> {
  const url = apiUrl(`/api/v1/expenditures/${id}`);
  const headers = buildAuthHeaders();

  const res = await fetch(url, { method: "DELETE", headers });

  if (!res.ok) {
    throw new Error(`지출 삭제 실패 (HTTP ${res.status})`);
  }
}

/**
 * PATCH /api/v1/expenditures/{id}
 * 지출 내역 부분 수정
 */
export async function updateExpenditure(
  id: number,
  dto: UpdateExpenditureDto
): Promise<CreateExpenditureResponse> {
  const url = apiUrl(`/api/v1/expenditures/${id}`);
  const headers = buildAuthHeaders({ "Content-Type": "application/json" });

  const res = await fetch(url, {
    method: "PATCH",
    headers,
    body: JSON.stringify(dto),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`지출 수정 실패 (HTTP ${res.status})${text ? `: ${text}` : ""}`);
  }

  return res.json() as Promise<CreateExpenditureResponse>;
}

/* ─── 유틸 ─── */

/** ISO 날짜 문자열 → 화면 표시용 한국어 포맷 */
export function formatIsoToKorean(iso: string): string {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleString("ko-KR", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

/**
 * 현재 시각을 로컬 ISO 문자열로 반환 ("YYYY-MM-DDTHH:mm:ss", 타임존 없음)
 * → 서버가 로컬 시간으로 저장하고 반환해서 날짜가 밀리는 문제 방지
 */
export function nowLocalIso(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    `T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
  );
}

/** "YYYY-MM-DDTHH:mm" 형식의 datetime-local 값 → ISO 문자열 */
export function datetimeLocalToIso(val: string): string {
  if (!val) return nowLocalIso();
  try {
    // 타임존 없는 문자열은 그대로 반환 (로컬 시간으로 서버에 전달)
    if (!val.endsWith("Z") && !/[+-]\d{2}:\d{2}$/.test(val)) return val;
    return new Date(val).toISOString();
  } catch {
    return nowLocalIso();
  }
}

/** 현재 시각을 "YYYY-MM-DDTHH:mm" 형식으로 반환 */
export function nowAsDatetimeLocal(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}` +
    `T${pad(now.getHours())}:${pad(now.getMinutes())}`
  );
}

/**
 * GET /api/v1/expenditures?year=YYYY&month=MM
 * 특정 년/월의 지출 내역 목록 조회
 */
export async function getMonthlyExpenditures(
  year: number,
  month: number
): Promise<MonthlyExpenditureResponse> {
  if (!isApiConfigured()) {
    throw new Error("API_BASE_URL 이 설정되지 않았습니다.");
  }

  const url = apiUrl(`/api/v1/expenditures?year=${year}&month=${month}`);
  const headers = buildAuthHeaders();

  const res = await fetch(url, { headers });

  if (!res.ok) {
    throw new Error(`지출 목록 조회 실패 (HTTP ${res.status})`);
  }

  return res.json() as Promise<MonthlyExpenditureResponse>;
}

/** 가맹점명 기반 카테고리 추측 — 서버 6개 카테고리 기준 */
export function guessCategoryFromStoreName(storeName: string): CategoryId {
  const name = storeName.toLowerCase();
  if (/지하철|버스|택시|카카오t|주유|ktx|기차|항공|공항|교통|티머니|주차/.test(name)) return "transport";
  if (/스타벅스|커피|cafe|카페|이디야|투썸|빽다방|할리스|식당|마트|편의점|gs25|cu|세븐|맥도날드|버거|치킨|pizza|피자|분식|삼겹|고기|한식|중식|일식|국밥/.test(name)) return "food";
  if (/쿠팡|올리브영|다이소|이마트|롯데마트|홈플러스|쇼핑|패션|의류|신발/.test(name)) return "shopping";
  if (/cgv|영화|롯데시네마|메가박스|게임|여행|숙박|호텔|공연|전시/.test(name)) return "culture";
  if (/병원|약국|헬스|gym|의원|클리닉|한의원|치과|안과/.test(name)) return "health";
  return "etc";
}
