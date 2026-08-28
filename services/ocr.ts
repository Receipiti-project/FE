import { CategoryId } from "@/constants/mockData";
import { parseKakaoPayCapture } from "@/services/parsers/kakaoPayParser";
import {
  fromManualText,
  isServerOcrConfigured,
  isOnDeviceOcrAvailable,
  ApiNotConfiguredError,
  MLKitUnavailableError,
  OcrServerError,
  RecognizedText,
} from "@/services/textRecognition";
import {
  ocrReceipt,
  createExpenditure,
  guessCategoryFromStoreName,
  formatIsoToKorean,
  nowLocalIso,
} from "@/services/api/expenditureApi";
import { getServerCategoryId } from "@/services/categoryMapping";
import { isApiConfigured } from "@/services/api/config";

export {
  ApiNotConfiguredError,
  OcrServerError,
  isServerOcrConfigured,
  MLKitUnavailableError,
  isOnDeviceOcrAvailable,
};

export type PaymentMethod = "카드" | "현금" | "간편결제" | "계좌이체";

export type ReceiptOcrResult = {
  storeName: string;
  purchasedAt: string;
  purchasedAtIso?: string;
  totalAmount: number;
  paymentMethod: PaymentMethod;
  suggestedCategory: CategoryId;
  categoryConfidence: number;
  location?: { lat: number; lng: number; address: string };
  isManualEntry?: boolean;
};

export type CapturePayment = {
  store: string;
  amount: number;
  paidAt?: string;
  paidAtIso?: string;
  method?: PaymentMethod;
  category?: CategoryId;
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
    suggestedCategory: "etc",
    categoryConfidence: 0,
    isManualEntry: true,
  };
}

export async function parseReceipt(uri: string): Promise<ReceiptOcrResult> {
  if (!isApiConfigured()) {
    return emptyReceiptResult();
  }
  try {
    const ocr = await ocrReceipt(uri);
    const category = guessCategoryFromStoreName(ocr.storeName ?? "");
    return {
      storeName: ocr.storeName ?? "",
      purchasedAt: ocr.paymentDate ? formatIsoToKorean(ocr.paymentDate) : "",
      purchasedAtIso: ocr.paymentDate || undefined,
      totalAmount: ocr.amount ?? 0,
      paymentMethod: "카드",
      suggestedCategory: category,
      categoryConfidence: 0.65,
    };
  } catch (e) {
    if (e instanceof ApiNotConfiguredError) {
      return emptyReceiptResult();
    }
    throw e;
  }
}

export async function parseCapture(uri: string): Promise<CaptureOcrResult> {
  if (!isApiConfigured()) {
    return { source: "unknown", sourceLabel: "캡처 이미지", payments: [] };
  }
  try {
    const ocr = await ocrReceipt(uri);
    if (ocr.storeName && ocr.amount > 0) {
      const category = guessCategoryFromStoreName(ocr.storeName);
      return {
        source: "unknown",
        sourceLabel: "캡처 이미지",
        payments: [
          {
            store: ocr.storeName,
            amount: ocr.amount,
            paidAt: ocr.paymentDate ? formatIsoToKorean(ocr.paymentDate) : undefined,
            paidAtIso: ocr.paymentDate || undefined,
            method: "카드",
            category,
            confidence: 0.7,
          },
        ],
      };
    }
    return { source: "unknown", sourceLabel: "캡처 이미지", payments: [] };
  } catch (e) {
    if (e instanceof ApiNotConfiguredError) {
      return { source: "unknown", sourceLabel: "캡처 이미지", payments: [] };
    }
    throw e;
  }
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

const _drafts: SavedDraft[] = [];

type ReceiptSavePayload = {
  storeName: string;
  purchasedAt: string;
  purchasedAtIso?: string;
  totalAmount: number;
  category: CategoryId;
  memo?: string;
  [key: string]: unknown;
};

type CaptureSavePayload = {
  store: string;
  amount: number;
  paidAt?: string;
  paidAtIso?: string;
  category: CategoryId;
  memo?: string;
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
      const categoryId = getServerCategoryId(d.category ?? "etc");
      const expenditureDate = d.purchasedAtIso ?? (d.purchasedAt
        ? (() => {
            try { return new Date(d.purchasedAt).toISOString(); } catch { return nowLocalIso(); }
          })()
        : nowLocalIso());

      const res = await createExpenditure({
        categoryId,
        storeName: d.storeName ?? "",
        amount: d.totalAmount ?? 0,
        expenditureDate,
        memo: d.memo ?? "",
        currency: "KRW",
      });
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
  items: unknown[]
): Promise<SavedDraft[]> {
  const created: SavedDraft[] = [];

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    let expenditureId: number | undefined;

    if (isApiConfigured()) {
      try {
        const d = item as CaptureSavePayload;
        const categoryId = getServerCategoryId(d.category ?? "etc");
        const expenditureDate = d.paidAtIso ?? (d.paidAt
          ? (() => {
              try { return new Date(d.paidAt).toISOString(); } catch { return nowLocalIso(); }
            })()
          : nowLocalIso());

        const res = await createExpenditure({
          categoryId,
          storeName: d.store ?? "",
          amount: d.amount ?? 0,
          expenditureDate,
          memo: d.memo ?? "",
          currency: "KRW",
        });
        expenditureId = res.expenditureId;
      } catch (e) {
        console.warn(`[saveTransactions] 항목 ${i} API 저장 실패:`, e);
      }
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
