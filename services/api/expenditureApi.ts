import {
  API_OCR_TIMEOUT_MS,
  apiUrl,
  buildAuthHeaders,
  isApiConfigured,
} from "@/services/api/config";
import { prepareImageForUpload } from "@/services/imageUpload";

/* ─── 응답/요청 타입 ─── */

/** POST /api/v1/expenditures/ocr 응답 */
export type OcrApiResponse = {
  storeName: string;
  amount: number;
  paymentDate: string; // ISO 8601
};

/** POST /api/v1/expenditures/card-notification/analyze 응답 */
export type CardNotificationAnalysisResponse = {
  paymentNotification: boolean;
  cardCompany?: string;
  storeName?: string;
  amount?: number;
  paymentDateTime?: string;
  currency?: string;
  approvalStatus?: string;
  confidence?: number;
};

type ApiErrorBody = {
  message?: string;
  error?: string;
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
  /** 사용자가 직접 카테고리를 선택한 경우에만 전달 */
  categoryId?: number;
  storeName: string;
  businessCategory?: string;
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
  categoryId: number;
  categoryName: string;
  classificationType: "USER_SELECTED" | "PERSONALIZED_AUTO" | "SYSTEM_DEFAULT";
  confidence?: number;
  recommendationReason?: "SAME_STORE" | "SAME_BRAND" | "SAME_BUSINESS_CATEGORY";
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

/* ─── API 함수 ─── */

async function postExpenditureImage<T>(
  path: string,
  uri: string,
  label: string
): Promise<T> {
  const url = apiUrl(path);
  const headers = buildAuthHeaders();
  const upload = await prepareImageForUpload(uri).catch((error) => {
    throw new Error(
      `${label} 이미지 최적화 실패: ${(error as Error)?.message ?? "이미지를 처리할 수 없어요."}`
    );
  });

  const form = new FormData();
  form.append("file", {
    uri: upload.uri,
    name: upload.fileName,
    type: upload.mimeType,
  } as unknown as Blob);

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
        ? `${label} 요청이 ${Math.round(API_OCR_TIMEOUT_MS / 1000)}초를 초과했어요.`
        : `${label} 요청 실패: ${(e as Error)?.message ?? "네트워크 오류"}`;
    throw new Error(msg);
  }
  clearTimeout(timer);

  if (res.redirected || res.url.includes("/oauth2/authorization/")) {
    throw new Error(
      "AUTH_EXPIRED:로그인 토큰이 만료됐어요. 새 토큰으로 갱신한 뒤 앱을 재시작해주세요."
    );
  }

  if (!res.ok) {
    if (res.status === 401 || res.status === 403) {
      throw new Error(`AUTH_EXPIRED:토큰이 만료됐어요. .env의 토큰을 갱신하고 앱을 재시작해주세요. (HTTP ${res.status})`);
    }
    if (res.status === 413) {
      throw new Error(
        `${label} 이미지 용량이 서버 제한을 초과했어요. 이미지를 잘라서 다시 시도해주세요.`
      );
    }
    const raw = await res.text().catch(() => "");
    let serverMessage = "";
    if (raw) {
      try {
        const body = JSON.parse(raw) as ApiErrorBody;
        serverMessage = body.message?.trim() || body.error?.trim() || "";
      } catch {
        serverMessage = raw.trim();
      }
    }
    throw new Error(
      `${label} 실패 (HTTP ${res.status})${serverMessage ? `: ${serverMessage}` : ""}`
    );
  }

  const contentType = res.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    throw new Error(
      `${label} 서버가 JSON이 아닌 응답을 반환했어요. API 주소와 인증 토큰을 확인해주세요.`
    );
  }

  const json = await res.json().catch(() => {
    throw new Error(`${label} 서버 응답을 해석할 수 없어요.`);
  });

  // 서버가 HTTP 200이지만 status:-404 같은 오류 응답을 보낼 때
  if (json && typeof json.status === "number" && json.status < 0) {
    throw new Error(`AUTH_EXPIRED:토큰이 만료됐거나 인증에 실패했어요. .env의 토큰을 갱신하고 앱을 재시작해주세요. (status: ${json.status})`);
  }

  return json as T;
}

/**
 * POST /api/v1/expenditures/ocr
 * 영수증 이미지를 서버로 전송 → 상호명·금액·날짜 추출
 */
export function ocrReceipt(uri: string): Promise<OcrApiResponse> {
  return postExpenditureImage("/api/v1/expenditures/ocr", uri, "OCR");
}

/**
 * POST /api/v1/expenditures/card-notification/analyze
 * 카드 결제 알림 이미지를 서버로 전송 → 결제 정보 분석
 */
export function analyzeCardNotification(
  uri: string
): Promise<CardNotificationAnalysisResponse> {
  return postExpenditureImage(
    "/api/v1/expenditures/card-notification/analyze",
    uri,
    "카드 결제 이미지 분석"
  );
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
