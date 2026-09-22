import { parseKakaoPayCapture } from "@/services/parsers/kakaoPayParser";
import {
  fromManualText,
  RecognizedText,
} from "@/services/textRecognition";
import {
  analyzeCardNotification,
  ocrReceipt,
  createExpenditure,
  formatIsoToKorean,
  nowLocalIso,
} from "@/services/api/expenditureApi";
import { isApiConfigured } from "@/services/api/config";

export type PaymentMethod = "카드" | "현금" | "간편결제" | "계좌이체";

export type ReceiptOcrResult = {
  storeName: string;
  purchasedAt: string;
  purchasedAtIso?: string;
  totalAmount: number;
  paymentMethod: PaymentMethod;
  location?: { lat: number; lng: number; address: string };
  isManualEntry?: boolean;
};

export type CapturePayment = {
  store: string;
  amount: number;
  paidAt?: string;
  paidAtIso?: string;
  method?: PaymentMethod;
  confidence?: number;
  address?: string;
};

export type CaptureSource = "kakao" | "sms" | "push" | "unknown";

export type CaptureOcrResult = {
  source: CaptureSource;
  sourceLabel: string;
  payments: CapturePayment[];
};

function emptyReceiptResult(): ReceiptOcrResult {
  return {
    storeName: "",
    purchasedAt: "",
    totalAmount: 0,
    paymentMethod: "카드",
    isManualEntry: true,
  };
}

export async function parseReceipt(uri: string): Promise<ReceiptOcrResult> {
  if (!isApiConfigured()) {
    return emptyReceiptResult();
  }
  const ocr = await ocrReceipt(uri);
  return {
    storeName: ocr.storeName ?? "",
    purchasedAt: ocr.paymentDate ? formatIsoToKorean(ocr.paymentDate) : "",
    purchasedAtIso: ocr.paymentDate || undefined,
    totalAmount: ocr.amount ?? 0,
    paymentMethod: "카드",
  };
}

function captureSource(cardCompany?: string): CaptureSource {
  if (!cardCompany) return "push";
  if (/카카오|kakao/i.test(cardCompany)) return "kakao";
  return "sms";
}

function captureDate(value?: string): { paidAt?: string; paidAtIso?: string } {
  const raw = value?.trim();
  if (!raw) return {};

  const shortDateTime = raw.match(
    /^(\d{1,2})[./-](\d{1,2})\s+(\d{1,2}):(\d{2})$/
  );
  const withYear = shortDateTime
    ? `${new Date().getFullYear()}-${shortDateTime[1].padStart(2, "0")}-${shortDateTime[2].padStart(2, "0")}T${shortDateTime[3].padStart(2, "0")}:${shortDateTime[4]}:00`
    : raw;
  const normalized = withYear.replace(
    /^(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2})/,
    "$1T$2"
  );
  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) return { paidAt: raw };

  const hour = parsed.getHours();
  const period = hour < 12 ? "오전" : "오후";
  const displayHour = hour % 12 || 12;
  const minute = String(parsed.getMinutes()).padStart(2, "0");

  return {
    paidAt: `${parsed.getMonth() + 1}월 ${parsed.getDate()}일 ${period} ${displayHour}시 ${minute}분`,
    paidAtIso: normalized,
  };
}

export async function parseCapture(uri: string): Promise<CaptureOcrResult> {
  if (!isApiConfigured()) {
    throw new Error("카드 결제 이미지 분석 서버가 연결되지 않았어요.");
  }

  const analysis = await analyzeCardNotification(uri);
  if (typeof analysis.paymentNotification !== "boolean") {
    throw new Error("카드 결제 이미지 분석 서버 응답 형식이 올바르지 않아요.");
  }
  const rejected = /취소|거절|실패|cancel|declin|reject|fail/i.test(
    analysis.approvalStatus ?? ""
  );
  const source = captureSource(analysis.cardCompany);
  if (!analysis.paymentNotification || rejected) {
    return {
      source,
      sourceLabel: analysis.cardCompany
        ? `${analysis.cardCompany} 결제 알림`
        : "카드 결제 알림",
      payments: [],
    };
  }

  const storeName = analysis.storeName?.trim() ?? "";
  const date = captureDate(analysis.paymentDateTime);
  return {
    source,
    sourceLabel: analysis.cardCompany
      ? `${analysis.cardCompany} 결제 알림`
      : "카드 결제 알림",
    payments: [{
      store: storeName,
      amount: analysis.amount ?? 0,
      ...date,
      method: "카드",
      confidence: analysis.confidence ?? 0,
    }],
  };
}

export function parseCaptureFromText(text: string): CaptureOcrResult {
  const recognized: RecognizedText = fromManualText(text);
  return parseKakaoPayCapture({ recognized });
}

export type SavedDraft = {
  id: string;
  createdAt: string;
  source: "receipt" | "capture" | "voice" | "sms" | "manual";
  data: unknown;
  expenditureId?: number;
};

type SaveTransactionOptions = {
  requireServerSave?: boolean;
};

function inputTypeForSource(
  source: SavedDraft["source"]
): "OCR" | "VOICE" | "MANUAL" | "SMS" | "CAPTURE" {
  if (source === "receipt") return "OCR";
  if (source === "capture") return "CAPTURE";
  if (source === "voice") return "VOICE";
  if (source === "sms") return "SMS";
  return "MANUAL";
}

const _drafts: SavedDraft[] = [];

type ReceiptSavePayload = {
  storeName: string;
  purchasedAt: string;
  purchasedAtIso?: string;
  totalAmount: number;
  categoryId?: number;
  defaultCategoryId?: number;
  memo?: string;
  [key: string]: unknown;
};

type CaptureSavePayload = {
  store: string;
  amount: number;
  paidAt?: string;
  paidAtIso?: string;
  categoryId?: number;
  defaultCategoryId?: number;
  memo?: string;
  placeId?: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  [key: string]: unknown;
};

export async function saveTransaction(
  source: SavedDraft["source"],
  data: unknown,
  options: SaveTransactionOptions = {}
): Promise<SavedDraft> {
  let expenditureId: number | undefined;

  if (options.requireServerSave && !isApiConfigured()) {
    throw new Error("가계부 서버가 연결되지 않아 저장할 수 없어요.");
  }

  if (isApiConfigured()) {
    try {
      const d = data as ReceiptSavePayload;
      const expenditureDate = d.purchasedAtIso ?? (d.purchasedAt
        ? (() => {
            try { return new Date(d.purchasedAt).toISOString(); } catch { return nowLocalIso(); }
          })()
        : nowLocalIso());

      const res = await createExpenditure(
        {
          categoryId: d.categoryId,
          defaultCategoryId: d.defaultCategoryId,
          storeName: d.storeName ?? "",
          amount: d.totalAmount ?? 0,
          expenditureDate,
          memo: d.memo ?? "",
          currency: "KRW",
        },
        inputTypeForSource(source)
      );
      expenditureId = res.expenditureId;
    } catch (e) {
      if (options.requireServerSave) throw e;
      console.warn("[saveTransaction] API 저장 실패, 로컬 저장으로 폴백:", e);
    }
  }

  if (options.requireServerSave && !expenditureId) {
    throw new Error("서버에서 저장 결과를 확인하지 못했어요.");
  }

  const draft: SavedDraft = {
    id: expenditureId ? `server_${expenditureId}` : `local_${Date.now()}`,
    createdAt: new Date().toISOString(),
    source,
    data,
    expenditureId,
  };
  _drafts.push(draft);
  return draft;
}

export async function saveTransactions(
  source: SavedDraft["source"],
  items: unknown[],
  options: SaveTransactionOptions = {}
): Promise<SavedDraft[]> {
  const created: SavedDraft[] = [];

  if (options.requireServerSave && !isApiConfigured()) {
    throw new Error("가계부 서버가 연결되지 않아 저장할 수 없어요.");
  }

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    let expenditureId: number | undefined;

    if (isApiConfigured()) {
      try {
        const d = item as CaptureSavePayload;
        const expenditureDate = d.paidAtIso ?? (d.paidAt
          ? (() => {
              try { return new Date(d.paidAt).toISOString(); } catch { return nowLocalIso(); }
            })()
          : nowLocalIso());

        const res = await createExpenditure(
          {
            categoryId: d.categoryId,
            defaultCategoryId: d.defaultCategoryId,
            storeName: d.store ?? "",
            amount: d.amount ?? 0,
            expenditureDate,
            memo: d.memo ?? "",
            currency: "KRW",
            placeId: d.placeId,
            address: d.address,
            latitude: d.latitude,
            longitude: d.longitude,
          },
          inputTypeForSource(source)
        );
        expenditureId = res.expenditureId;
      } catch (e) {
        if (options.requireServerSave) throw e;
        console.warn(`[saveTransactions] 항목 ${i} API 저장 실패:`, e);
      }
    }

    if (options.requireServerSave && !expenditureId) {
      throw new Error(`서버에서 ${i + 1}번째 저장 결과를 확인하지 못했어요.`);
    }

    created.push({
      id: expenditureId ? `server_${expenditureId}` : `local_${Date.now()}_${i}`,
      createdAt: new Date().toISOString(),
      source,
      data: item,
      expenditureId,
    });
  }

  _drafts.push(...created);
  return created;
}

/** 디버깅/검증용 */
export function _peekDrafts(): SavedDraft[] {
  return [..._drafts];
}
