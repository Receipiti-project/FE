import { OPENAI_API_KEY } from "../constants/config";
import { CategoryType, Currency, InputType } from './types';
import { hasAllRequired } from './smsLexer';

console.log("API KEY:", OPENAI_API_KEY);

const CATEGORIES: CategoryType[] = ['FOOD', 'TRANSPORT', 'SHOPPING', 'CULTURE', 'HEALTH', 'ETC'];
const CURRENCIES: Currency[] = ['KRW', 'USD', 'EUR', 'JPY'];

export interface ParsedVoiceExpense {
  amount: number | null;
  storeName: string | null;
  paymentDate: string | null;
  category: CategoryType | null;
  memo: string | null;
  inputType: InputType;
  currency: Currency | null;
  transcript: string;
}

export interface VoicePipelineResult {
  data: ParsedVoiceExpense;
  llmCalled: boolean;
  confidence: 'medium' | 'low';
  elapsedMs: number;
}

function fillPaymentDateFallback(p: ParsedVoiceExpense): ParsedVoiceExpense {
  if (p.paymentDate) return p;
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const iso = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
            + `T${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
  return { ...p, paymentDate: iso };
}

export async function processVoice(file: any): Promise<VoicePipelineResult> {
  const t0 = Date.now();
  const text = await transcribeAudio(file);
  const raw = await parseExpense(text);

  const sanitized = sanitize(raw, text);
  const final = fillPaymentDateFallback(sanitized);
  const confidence: 'medium' | 'low' = hasAllRequired(final) ? 'medium' : 'low';

  return {
    data: final,
    llmCalled: true,
    confidence,
    elapsedMs: Date.now() - t0,
  };
}

async function transcribeAudio(file: any): Promise<string> {
  console.log("파일 uri:", file.uri);

  const formData = new FormData();
  formData.append("file", {
    uri: file.uri,
    name: "audio.m4a",
    type: "audio/m4a",
  } as any);
  formData.append("model", "whisper-1");

  const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${OPENAI_API_KEY}` },
    body: formData,
  });

  const data = await res.json();
  console.log("STT 응답:", data);
  if (!data.text) throw new Error(JSON.stringify(data));
  return data.text;
}

async function parseExpense(text: string): Promise<any> {
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const year = now.getFullYear();

  const prompt = `너는 한국어 소비 내역 음성을 JSON으로 변환하는 파서다.
설명 없이 JSON만 출력.

필드:
- amount: 정수(원). 추론 가능하면 추론.
  · "사천오백원"/"사촌오백원" → 4500
  · "삼촌" → 3000, "오천" → 5000
  · 금액 못 찾으면 null
- storeName: 상호명. 없으면 null.
- paymentDate: "YYYY-MM-DDTHH:mm:ss" 형식.
  · 연도 없으면 ${year}, 날짜 없고 시간만 있으면 ${today}, 시간 없으면 "00:00:00"
  · 날짜·시간 모두 없으면 null
- category: FOOD/TRANSPORT/SHOPPING/CULTURE/HEALTH/ETC 중 하나.
  · 카페/식당/배달 → FOOD
  · 버스/지하철/택시/주유 → TRANSPORT
  · 쇼핑몰/마트/온라인쇼핑 → SHOPPING
  · 영화/공연/게임 → CULTURE
  · 병원/약국 → HEALTH
  · 애매하면 → ETC
- memo: 한 줄 요약. 없으면 null.
- currency: KRW/USD/EUR/JPY 중 하나.
  · "달러" → USD, "유로" → EUR, "엔" → JPY
  · 명시적 통화 언급 없으면 null

형식:
{
  "amount": number | null,
  "storeName": string | null,
  "paymentDate": string | null,
  "category": "FOOD" | "TRANSPORT" | "SHOPPING" | "CULTURE" | "HEALTH" | "ETC" | null,
  "memo": string | null,
  "currency": "KRW" | "USD" | "EUR" | "JPY" | null
}

입력: ${text}`;

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: "gpt-4.1-mini",
      response_format: { type: 'json_object' },
      messages: [
        { role: "system", content: "JSON 파서" },
        { role: "user", content: prompt },
      ],
      temperature: 0,
    }),
  });

  const data = await res.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error("LLM 응답 없음");

  try {
    return JSON.parse(content);
  } catch {
    const fixed = content.replace(/```json/g, "").replace(/```/g, "").trim();
    return JSON.parse(fixed);
  }
}

function sanitize(p: any, transcript: string): ParsedVoiceExpense {
  const amount =
    typeof p?.amount === 'number' && p.amount > 0 ? Math.round(p.amount) : null;

  const paymentDate =
    typeof p?.paymentDate === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(p.paymentDate)
      ? p.paymentDate
      : null;

  const storeName =
    typeof p?.storeName === 'string' && p.storeName.trim().length > 0
      ? p.storeName.trim()
      : null;

  const category = CATEGORIES.includes(p?.category) ? (p.category as CategoryType) : null;

  const memo =
    typeof p?.memo === 'string' && p.memo.trim().length > 0
      ? p.memo.trim()
      : null;

  const currency = CURRENCIES.includes(p?.currency) ? (p.currency as Currency) : null;

  return {
    amount,
    storeName,
    paymentDate,
    category,
    memo,
    currency,
    inputType: 'VOICE',
    transcript,
  };
}