import { CategoryType, Currency, InputType } from './types';
import { hasAllRequired } from './smsLexer';


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
  void file;
  throw new Error("서버 측 음성 분석 API가 연결되지 않았습니다.");
}

async function parseExpense(text: string): Promise<any> {
  void text;
  throw new Error("서버 측 지출 분석 API가 연결되지 않았습니다.");
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
