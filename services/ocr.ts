import { CategoryId } from "@/constants/mockData";
import { parseReceiptText } from "@/services/parsers/receiptParser";
import { parseKakaoPayCapture } from "@/services/parsers/kakaoPayParser";
import {
  recognizeText,
  fromManualText,
  isServerOcrConfigured,
  isOnDeviceOcrAvailable, 
  ApiNotConfiguredError,
  MLKitUnavailableError, 
  OcrServerError,
  RecognizedText,
} from "@/services/textRecognition";

export {
  ApiNotConfiguredError,
  OcrServerError,
  isServerOcrConfigured,
  MLKitUnavailableError,
  isOnDeviceOcrAvailable,
};

export type PaymentMethod = "카드" | "현금" | "간편결제" | "계좌이체";

export type OcrItem = {
  name: string;
  price: number;
  quantity?: number;
};

export type ReceiptOcrResult = {
  storeName: string;
  purchasedAt: string;
  totalAmount: number;
  paymentMethod: PaymentMethod;
  items: OcrItem[];
  suggestedCategory: CategoryId;
  categoryConfidence: number;
  rawText: string;
  location?: { lat: number; lng: number; address: string };
};

export type CapturePayment = {
  store: string;
  amount: number;
  paidAt?: string;
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

/* 영수증 이미지 → 필드 추출 */
export async function parseReceipt(uri: string): Promise<ReceiptOcrResult> {
  const recognized = await recognizeText(uri, "receipt");
  return enrichReceipt(parseReceiptText({ recognized, imageUri: uri }));
}

/* 캡처 이미지 → 결제 N건 추출 */
export async function parseCapture(uri: string): Promise<CaptureOcrResult> {
  const recognized = await recognizeText(uri, "capture");
  return parseKakaoPayCapture({ recognized });
}

/* 사용자가 직접 붙여넣은 텍스트로부터 영수증 결과를 만든다 */
export function parseReceiptFromText(text: string): ReceiptOcrResult {
  const recognized: RecognizedText = fromManualText(text);
  return enrichReceipt(parseReceiptText({ recognized }));
}

/* 사용자가 직접 붙여넣은 텍스트로부터 캡처 결과를 만든다 */
export function parseCaptureFromText(text: string): CaptureOcrResult {
  const recognized: RecognizedText = fromManualText(text);
  return parseKakaoPayCapture({ recognized });
}

function enrichReceipt(r: ReceiptOcrResult): ReceiptOcrResult {
  // 파싱 결과가 비어있는 필드는 화면 단에서 사용자가 직접 채워넣을 수 있도록 빈 값으로 그대로 둔다
  return r;
}

/* 로컬 임시 저장 */
export type SavedDraft = {
  id: string;
  createdAt: string;
  source: "receipt" | "capture" | "voice" | "sms" | "manual";
  data: unknown;
};

const _drafts: SavedDraft[] = [];

/* 단건 저장 */
export async function saveTransaction(
  source: SavedDraft["source"],
  data: unknown
): Promise<SavedDraft> {
  await delay(420);
  const draft: SavedDraft = {
    id: `local_${Date.now()}`,
    createdAt: new Date().toISOString(),
    source,
    data,
  };
  _drafts.push(draft);
  return draft;
}

/* 다건 일괄 저장. 캡처 결과 같이 N건 동시 등록할 때 사용 */
export async function saveTransactions(
  source: SavedDraft["source"],
  items: unknown[]
): Promise<SavedDraft[]> {
  await delay(520);
  const created = items.map((data, i) => ({
    id: `local_${Date.now()}_${i}`,
    createdAt: new Date().toISOString(),
    source,
    data,
  }));
  _drafts.push(...created);
  return created;
}

/** 디버깅/검증용 */
export function _peekDrafts(): SavedDraft[] {
  return [..._drafts];
}

function delay(ms: number) {
  return new Promise<void>((res) => setTimeout(res, ms));
}
