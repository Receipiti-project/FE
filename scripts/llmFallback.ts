import { OPENAI_API_KEY } from '../constants/config';
import { ParsedExpense } from './smsLexer';
import { CategoryType, Currency } from './types';

interface LlmParseResponse {
  amount: number | null;
  storeName: string | null;
  paymentDate: string | null;
  category: string | null;
  memo: string | null;
}

const CATEGORIES: CategoryType[] = ['FOOD', 'TRANSPORT', 'SHOPPING', 'CULTURE', 'HEALTH', 'ETC'];

function buildPrompt(sms: string): string {
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const year = now.getFullYear();
  return `다음 한국어 결제 SMS에서 가계부 항목을 추출해 JSON으로만 답하라.

필드:
- amount: 결제금액(정수, 원). 누적/잔액 금액은 절대 쓰지 말 것. 없으면 null.
- storeName: 상호명. 없으면 null.
- paymentDate: 결제일시 ISO8601 형식 "YYYY-MM-DDTHH:mm:ss".
  · 연도가 SMS에 없으면 ${year} 사용.
  · 날짜(월/일)가 SMS에 없고 시간만 있으면 오늘 날짜 ${today} 사용.
  · 시간이 없으면 "00:00:00" 사용.
  · 날짜와 시간 둘 다 없으면 null.
- category: FOOD/TRANSPORT/SHOPPING/CULTURE/HEALTH/ETC 중 하나.
  · 카페/식당/배달 → FOOD
  · 버스/지하철/택시/주유 → TRANSPORT
  · 쇼핑몰/마트/온라인쇼핑 → SHOPPING
  · 영화/공연/게임 → CULTURE
  · 병원/약국 → HEALTH
  · 애매하면 → ETC
- memo: 한 줄 요약

설명·코드블록 없이 JSON 객체만 출력.

SMS:
${sms}`;
}

export async function parseWithLLM(sms: string): Promise<LlmParseResponse> {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: "gpt-4.1-mini",
      temperature: 0,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: '너는 한국어 결제 SMS를 JSON으로 구조화하는 추출기다.' },
        { role: 'user',   content: buildPrompt(sms) },
      ],
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`OpenAI ${res.status}: ${errText}`);
  }

  const body = await res.json();
  const content: string = body.choices?.[0]?.message?.content ?? '{}';
  const parsed = JSON.parse(content) as Partial<LlmParseResponse>;

  return sanitize(parsed);
}

function sanitize(p: Partial<LlmParseResponse>): LlmParseResponse {
  const amount =
    typeof p.amount === 'number' && p.amount > 0 ? Math.round(p.amount) : null;

  const paymentDate =
    typeof p.paymentDate === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(p.paymentDate)
      ? p.paymentDate
      : null;

  const storeName =
    typeof p.storeName === 'string' && p.storeName.trim().length > 0
      ? p.storeName.trim()
      : null;

  const category = CATEGORIES.includes(p.category as CategoryType)
    ? p.category as CategoryType
    : null;

  return { amount, storeName, paymentDate, category, memo: null };
}

export function mergeParsed(
  regex: ParsedExpense,
  llm: LlmParseResponse,
): ParsedExpense {
  return {
    amount:      regex.amount      ?? llm.amount,
    storeName:   regex.storeName   ?? llm.storeName,
    paymentDate: regex.paymentDate ?? llm.paymentDate,
    category:    regex.category    ?? llm.category,
    memo:        regex.memo        ?? llm.memo,
    inputType:   regex.inputType,
    currency:    regex.currency,
    _raw:        regex._raw,
  };
}
