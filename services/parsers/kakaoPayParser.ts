import type { CategoryId } from "@/constants/mockData";
import type {
  CapturePayment,
  CaptureSource,
  CaptureOcrResult,
  PaymentMethod,
} from "@/services/ocr";
import type { RecognizedText } from "@/services/textRecognition";

const HEADER_RE =
  /\[(Web발신|카카오페이|카카오뱅크|토스|토스뱅크|페이코|네이버페이|삼성페이|NH페이|신한카드|KB국민카드|국민카드|삼성카드|현대카드|롯데카드|우리카드|하나카드|BC카드|NH카드|농협카드|씨티카드|카카오뱅크카드)\]/i;

/* 금액 라인 */
const AMOUNT_RE =
  /(\d{1,3}(?:,\d{3})+|\d{2,7})\s*원\s*(?:일시불|할부|결제|승인|완료)?/;

/* 날짜·시각 */
const DATETIME_RE =
  /\b(?:(20\d{2})[.\-/년 ]\s*)?(\d{1,2})[.\-/월 ]\s*(\d{1,2})(?:일)?(?:\s+(\d{1,2})\s*[:시]\s*(\d{1,2})(?:\s*분)?)?\b/;

const KEYWORD_TO_SOURCE: Array<[CaptureSource, RegExp]> = [
  ["kakao", /카카오\s*페이|카카오\s*뱅크|\[카카오/i],
  [
    "sms",
    /Web발신|\[(신한|KB|국민|삼성|현대|롯데|우리|하나|BC|NH|농협|씨티|카카오뱅크)\s*카드\]|\[토스\]|\[페이코\]|\[네이버페이\]/i,
  ],
  ["push", /결제\s*알림|승인\s*완료|결제\s*완료/i],
];

const PAYMENT_METHOD_HINTS: Array<[PaymentMethod, RegExp]> = [
  ["카드", /(신한|KB|국민|삼성|현대|롯데|우리|하나|BC|NH|농협|씨티)\s*카드|카드\s*승인|일시불|할부/i],
  [
    "간편결제",
    /카카오\s*페이|네이버\s*페이|토스(?!뱅크)|페이코|삼성페이|애플페이|제로페이/i,
  ],
  ["계좌이체", /계좌\s*이체|이체|입금/i],
  ["현금", /현금/i],
];

const NOISE_LINES = [
  /^누적/,
  /^잔액/,
  /^한도/,
  /^승인번호/,
  /^승인일시/,
  /^혜택/,
  /^포인트/,
  /^https?:\/\//,
  /고객센터/,
  /^[\-_=*~]+$/,
  /^[ㄱ-ㅎㅏ-ㅣ가-힣]\*+[ㄱ-ㅎㅏ-ㅣ가-힣]*님$/, // "홍*동님"
];

/* 카테고리 키워드 */
const CATEGORY_KEYWORDS: Array<{ id: CategoryId; words: RegExp }> = [
  {
    id: "cafe",
    words:
      /스타벅스|투썸|이디야|커피빈|할리스|폴바셋|메가커피|컴포즈|빽다방|커피|카페|파리바게뜨|뚜레쥬르/i,
  },
  {
    id: "food",
    words:
      /식당|분식|국밥|김밥|버거|치킨|피자|돈까스|초밥|스시|라멘|족발|보쌈|곱창|삼겹|갈비|냉면|덮밥|배달의민족|쿠팡이츠|요기요/i,
  },
  {
    id: "transport",
    words: /지하철|버스|택시|카카오\s*T|티머니|주유|GS칼텍스|SK에너지|S-OIL/i,
  },
  {
    id: "shopping",
    words: /이마트|홈플러스|롯데마트|코스트코|올리브영|다이소|쿠팡|11번가|G마켓|SSG|교보문고|예스24/i,
  },
  {
    id: "culture",
    words: /CGV|메가박스|롯데시네마|넷플릭스|왓챠|티빙|디즈니|콘서트|공연/i,
  },
  {
    id: "living",
    words: /약국|병원|의원|치과|GS25|CU|세븐일레븐|이마트24/i,
  },
];

/* 메인 파서 */

export type CaptureParseInput = {
  recognized: RecognizedText;
};

export function parseKakaoPayCapture(
  input: CaptureParseInput
): CaptureOcrResult {
  const { recognized } = input;
  const lines = recognized.lines.map((l) => l.text).filter(Boolean);

  // 1) 헤더 위치 기준으로 블록 분리
  const blocks = splitByHeader(lines);

  const payments: CapturePayment[] = [];
  let detectedSource: CaptureSource = "unknown";
  let detectedSourceLabel = "";

  for (const block of blocks) {
    const blockText = block.join("\n");
    const src = detectSource(blockText);
    if (src.source !== "unknown" && detectedSource === "unknown") {
      detectedSource = src.source;
      detectedSourceLabel = src.label;
    }
    const payment = parseSingleBlock(block);
    if (payment) payments.push(payment);
  }

  // 어떤 블록도 헤더가 없었으면 전체 텍스트 한 덩어리에서 한 번 더 시도
  if (payments.length === 0 && lines.length > 0) {
    const fallback = parseSingleBlock(lines);
    if (fallback) payments.push(fallback);
    if (detectedSource === "unknown") {
      const src = detectSource(recognized.text);
      detectedSource = src.source;
      detectedSourceLabel = src.label;
    }
  }

  return {
    source: detectedSource,
    sourceLabel:
      detectedSourceLabel ||
      labelForSource(detectedSource) ||
      "결제 알림",
    payments,
  };
}

/* 블록 단위 파싱 */

function splitByHeader(lines: string[]): string[][] {
  const blocks: string[][] = [];
  let cur: string[] = [];
  for (const ln of lines) {
    if (HEADER_RE.test(ln)) {
      if (cur.length > 0) blocks.push(cur);
      cur = [ln];
    } else {
      cur.push(ln);
    }
  }
  if (cur.length > 0) blocks.push(cur);
  return blocks.filter((b) => b.length > 0);
}

function parseSingleBlock(block: string[]): CapturePayment | null {
  const text = block.join("\n");

  // 금액 
  const amountMatch = text.match(AMOUNT_RE);
  if (!amountMatch) return null;
  const amount = parsePrice(amountMatch[1]);
  if (amount === null || amount <= 0) return null;

  // 일시
  const paidAt = pickDateTime(text);

  // 가맹점
  const store = pickStore(block, amountMatch[0]);

  // 결제 수단
  const method = pickMethod(text);

  // 카테고리 추정
  const category = guessCategoryFromText(`${store ?? ""}\n${text}`);

  // 신뢰도 
  let confidence = 0.6;
  if (store) confidence += 0.2;
  if (paidAt) confidence += 0.1;
  confidence = Math.min(0.97, confidence);

  return {
    store: store ?? "(가맹점명 없음)",
    amount,
    paidAt,
    method,
    category,
    confidence,
  };
}

function pickStore(block: string[], amountRawLine: string): string | null {
  const filtered = block
    .map((l) => l.trim())
    .filter((l) => {
      if (!l) return false;
      if (HEADER_RE.test(l)) return false;
      if (l.includes(amountRawLine.trim())) return false;
      if (AMOUNT_RE.test(l) && l.length < 18) return false;
      if (DATETIME_RE.test(l) && l.length < 18) return false;
      if (NOISE_LINES.some((re) => re.test(l))) return false;
      return true;
    });
  if (filtered.length === 0) return null;

  // "결제 완료", "승인", "님" 같은 부수 문구는 후보에서 한 번 더 제거
  const refined = filtered.filter(
    (l) => !/^결제\s*완료$|^승인$|^승인\s*완료$|^완료$|^결제$/i.test(l)
  );
  const pool = refined.length > 0 ? refined : filtered;

  // 보통 가맹점명은 짧고, 한글이 포함되어 있음
  pool.sort((a, b) => {
    const ah = /[가-힣]/.test(a) ? 0 : 1;
    const bh = /[가-힣]/.test(b) ? 0 : 1;
    if (ah !== bh) return ah - bh;
    return Math.abs(a.length - 10) - Math.abs(b.length - 10);
  });
  return pool[0];
}

function pickDateTime(text: string): string | undefined {
  const m = text.match(DATETIME_RE);
  if (!m) return undefined;
  const yyyy =
    m[1] ?? new Date().getFullYear().toString();
  const mm = m[2].padStart(2, "0");
  const dd = m[3].padStart(2, "0");
  if (m[4] && m[5]) {
    const HH = m[4].padStart(2, "0");
    const MM = m[5].padStart(2, "0");
    return `${yyyy}-${mm}-${dd} ${HH}:${MM}`;
  }
  return `${yyyy}-${mm}-${dd}`;
}

function pickMethod(text: string): PaymentMethod {
  for (const [m, re] of PAYMENT_METHOD_HINTS) {
    if (re.test(text)) return m;
  }
  return "카드";
}

function detectSource(text: string): {
  source: CaptureSource;
  label: string;
} {
  // 카드사명 우선 추출
  const cardMatch = text.match(
    /\[?(신한|KB국민|국민|삼성|현대|롯데|우리|하나|BC|NH|농협|씨티)\s*카드\]?/
  );
  if (cardMatch) {
    return { source: "sms", label: `${cardMatch[1]}카드 결제 알림` };
  }
  if (/\[?카카오\s*페이\]?/.test(text)) {
    return { source: "kakao", label: "카카오페이 결제 알림" };
  }
  if (/\[?토스\]?/.test(text)) {
    return { source: "kakao", label: "토스 결제 알림" };
  }
  if (/\[?페이코\]?/.test(text)) {
    return { source: "kakao", label: "페이코 결제 알림" };
  }
  if (/\[?네이버\s*페이\]?/.test(text)) {
    return { source: "kakao", label: "네이버페이 결제 알림" };
  }
  for (const [src, re] of KEYWORD_TO_SOURCE) {
    if (re.test(text)) {
      return { source: src, label: labelForSource(src) };
    }
  }
  return { source: "unknown", label: "" };
}

function labelForSource(src: CaptureSource): string {
  switch (src) {
    case "kakao":
      return "카카오 결제 알림";
    case "sms":
      return "문자 결제 알림";
    case "push":
      return "앱 결제 알림";
    default:
      return "결제 알림";
  }
}

function guessCategoryFromText(haystack: string): CategoryId {
  for (const c of CATEGORY_KEYWORDS) {
    if (c.words.test(haystack)) return c.id;
  }
  return "etc";
}

function parsePrice(token: string): number | null {
  if (!token) return null;
  const cleaned = token.replace(/[^\d]/g, "");
  if (!cleaned) return null;
  const v = parseInt(cleaned, 10);
  return Number.isNaN(v) ? null : v;
}
