import type { CategoryId } from "@/constants/mockData";
import type { OcrItem, PaymentMethod, ReceiptOcrResult } from "@/services/ocr";
import type { RecognizedText } from "@/services/textRecognition";

/* 가격으로 보이는 토큰 */
const PRICE_TOKEN_RE = /(?<![\d.])(\d{1,3}(?:,\d{3})+|\d{2,7})(?:\s*원)?(?![\d%])/;

/* 줄 마지막에 가격이 오는 품목 라인 */
const ITEM_LINE_RE =
  /^(.+?)\s+(\d{1,3}(?:,\d{3})+|\d{2,7})(?:\s*원)?\s*$/;

/* 일시 — 다양한 포맷 */
const DATE_RE =
  /\b(20\d{2}|\d{2})[.\-/년 ]\s*(\d{1,2})[.\-/월 ]\s*(\d{1,2})(?:일)?(?:[ T]\s*(\d{1,2})\s*[:시]\s*(\d{1,2})(?:\s*분)?)?\b/;

/* 합계/총액 키워드 */
const TOTAL_KEYWORDS = [
  "합계금액",
  "결제금액",
  "총결제금액",
  "총액",
  "총 액",
  "총합",
  "합 계",
  "합계",
  "총계",
];

/* 합계 후보에서 제외해야 하는 라인 */
const EXCLUDE_TOTAL_KEYWORDS = [
  "공급가액",
  "부가세",
  "VAT",
  "소계",
  "할인",
  "면세",
  "포인트",
  "잔액",
];

const PAYMENT_METHOD_KEYWORDS: Array<[PaymentMethod, RegExp]> = [
  // 간편결제 — 정확한 브랜드 토큰만 매칭 (다른 단어 부분일치 방지)
  [
    "간편결제",
    /카카오\s*페이|네이버\s*페이|페이코|토스\s*페이|삼성\s*페이|애플\s*페이|제로\s*페이|간편\s*결제/iu,
  ],
  ["계좌이체", /계좌\s*이체|무통장\s*입금|자동\s*이체/iu],
  ["현금", /현금영수증|현금\s*결제|^현금$|\s현금\s/iu],
  // 카드 — 카드사명+카드, 또는 "결제수단: 카드" 같은 명시적 키워드
  [
    "카드",
    /(신용|체크|법인|BC|국민|신한|삼성|현대|롯데|우리|하나|NH|농협|씨티|카카오뱅크)\s*카드|카드\s*승인|카드\s*결제|일시불|할부|결제\s*수단\s*[:：]?\s*카드|지불\s*수단\s*[:：]?\s*카드|결제\s*[:：]\s*카드|VISA|MASTER|AMEX/iu,
  ],
];

/* 카테고리 키워드 — 매장명이 매칭되면 그 카테고리를 강하게 제안 */
const CATEGORY_KEYWORDS: Array<{ id: CategoryId; words: RegExp; weight: number }> = [
  {
    id: "cafe",
    words:
      /스타벅스|투썸|이디야|커피빈|할리스|폴바셋|블루보틀|메가커피|컴포즈|빽다방|커피|카페|디저트|베이커리|파리바게뜨|뚜레쥬르/iu,
    weight: 1,
  },
  {
    id: "food",
    words:
      /식당|분식|국밥|김밥|버거|치킨|피자|돈까스|초밥|스시|라멘|족발|보쌈|곱창|삼겹|갈비|냉면|국수|탕|찌개|덮밥|뷔페|레스토랑|배달의민족|쿠팡이츠|요기요/iu,
    weight: 1,
  },
  {
    id: "transport",
    words:
      /지하철|버스|택시|카카오\s*T|티머니|교통|주유|GS칼텍스|SK에너지|S-OIL|현대오일뱅크|주차/iu,
    weight: 1,
  },
  {
    id: "shopping",
    words:
      /이마트|홈플러스|롯데마트|코스트코|올리브영|다이소|무신사|29CM|쿠팡|11번가|G마켓|옥션|SSG|교보문고|예스24|알라딘/iu,
    weight: 0.9,
  },
  {
    id: "culture",
    words:
      /CGV|메가박스|롯데시네마|영화|콘서트|공연|뮤지엄|박물관|YES24|인터파크\s*티켓|넷플릭스|왓챠|티빙|디즈니/iu,
    weight: 0.9,
  },
  {
    id: "living",
    words:
      /약국|병원|의원|치과|편의점|GS25|CU|세븐일레븐|이마트24|미니스톱|세탁|마트|관리비/iu,
    weight: 0.7,
  },
];

/* 메인 파서 */

export type ReceiptParseInput = {
  recognized: RecognizedText;
  /* 이미지 URI */
  imageUri?: string;
};

export function parseReceiptText(input: ReceiptParseInput): ReceiptOcrResult {
  const { recognized } = input;
  const rawText = recognized.text;
  const lines = recognized.lines.map((l) => l.text).filter(Boolean);

  const storeName = pickStoreName(lines);
  const purchasedAt = pickPurchasedAt(rawText);
  const paymentMethod = pickPaymentMethod(rawText);
  const items = pickItems(lines);
  const totalAmount = pickTotalAmount(lines, items);
  const { suggestedCategory, categoryConfidence } = guessCategory(
    storeName,
    rawText
  );

  return {
    storeName: storeName ?? "",
    purchasedAt: purchasedAt ?? "",
    totalAmount,
    paymentMethod,
    items,
    suggestedCategory,
    categoryConfidence,
    rawText,
  };
}

/* 필드별 추출 함수 */

function pickStoreName(lines: string[]): string | null {
  // 영수증 상단 1~5번째 줄에서 가맹점명을 찾음
  const candidates = lines.slice(0, 6).filter((l) => {
    if (!l) return false;
    if (/^[\d\s\-.,/]+$/.test(l)) return false;
    if (/사업자|등록번호|대표자|TEL|전화|주소|영수증|매출전표/i.test(l))
      return false;
    if (l.length < 2) return false;
    return true;
  });
  if (candidates.length === 0) return null;
  // 가장 긴 것은 보통 주소 
  const sorted = candidates.sort((a, b) => a.length - b.length);
  return sorted[0];
}

function pickPurchasedAt(text: string): string | null {
  const m = text.match(DATE_RE);
  if (!m) return null;
  const yyyy = m[1].length === 2 ? `20${m[1]}` : m[1];
  const mm = m[2].padStart(2, "0");
  const dd = m[3].padStart(2, "0");
  if (m[4] && m[5]) {
    const HH = m[4].padStart(2, "0");
    const MM = m[5].padStart(2, "0");
    return `${yyyy}-${mm}-${dd} ${HH}:${MM}`;
  }
  return `${yyyy}-${mm}-${dd}`;
}

function pickPaymentMethod(text: string): PaymentMethod {
  for (const [method, re] of PAYMENT_METHOD_KEYWORDS) {
    if (re.test(text)) return method;
  }
  return "카드";
}

function pickItems(lines: string[]): OcrItem[] {
  const items: OcrItem[] = [];
  for (const ln of lines) {
    // 합계/공급가액 같은 라인은 제외
    if (
      TOTAL_KEYWORDS.some((k) => ln.includes(k)) ||
      EXCLUDE_TOTAL_KEYWORDS.some((k) => ln.includes(k))
    ) {
      continue;
    }
    const m = ln.match(ITEM_LINE_RE);
    if (!m) continue;
    const name = m[1].trim();
    const price = parsePrice(m[2]);
    if (!name || price === null) continue;
    if (price < 100) continue; // 1자리 수량 등을 가격으로 잘못 잡는 경우 거름
    if (/^\d+$/.test(name)) continue;
    items.push({ name, price });
  }
  return items;
}

function pickTotalAmount(lines: string[], items: OcrItem[]): number {
  // 1) "합계 / 총액 / 결제금액"이 들어간 라인에서 금액 추출
  for (const keyword of TOTAL_KEYWORDS) {
    for (const ln of lines) {
      if (!ln.includes(keyword)) continue;
      if (EXCLUDE_TOTAL_KEYWORDS.some((k) => ln.includes(k))) continue;
      const m = ln.match(PRICE_TOKEN_RE);
      if (m) {
        const v = parsePrice(m[1]);
        if (v !== null) return v;
      }
    }
  }
  // 2) 키워드를 못 찾았으면 품목 합계 사용
  if (items.length > 0) {
    return items.reduce((s, it) => s + it.price * (it.quantity ?? 1), 0);
  }
  // 3) 마지막 fallback — 텍스트 내에서 가장 큰 금액
  let max = 0;
  for (const ln of lines) {
    const m = ln.match(PRICE_TOKEN_RE);
    if (m) {
      const v = parsePrice(m[1]);
      if (v !== null && v > max) max = v;
    }
  }
  return max;
}

function guessCategory(
  store: string | null,
  text: string
): { suggestedCategory: CategoryId; categoryConfidence: number } {
  // 가맹점명에 매칭되는 카테고리는 본문 텍스트보다 강하게 가중 
  const storeStr = store ?? "";
  let best: { id: CategoryId; weight: number } | null = null;
  for (const c of CATEGORY_KEYWORDS) {
    let weight = 0;
    if (storeStr && c.words.test(storeStr)) {
      weight = c.weight + 0.5; // store 매칭 가산점
    } else if (c.words.test(text)) {
      weight = c.weight;
    }
    if (weight > 0 && (!best || weight > best.weight)) {
      best = { id: c.id, weight };
    }
  }
  if (best) {
    return {
      suggestedCategory: best.id,
      categoryConfidence: Math.min(0.95, 0.6 + best.weight * 0.2),
    };
  }
  return { suggestedCategory: "etc", categoryConfidence: 0.4 };
}

/* 유틸 */

function parsePrice(token: string): number | null {
  if (!token) return null;
  const cleaned = token.replace(/[^\d]/g, "");
  if (!cleaned) return null;
  const v = parseInt(cleaned, 10);
  if (Number.isNaN(v)) return null;
  return v;
}
