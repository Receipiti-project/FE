import { mergeParsed, parseWithLLM } from './llmFallback';
import { ParsedExpense, parseSms, hasAllRequired } from './smsLexer';

export interface PipelineResult {
  data: ParsedExpense;
  source: 'regex' | 'llm' | 'hybrid';
  llmCalled: boolean;
  confidence: 'high' | 'medium' | 'low';
  elapsedMs: number;
}

function fillPaymentDateFallback(p: ParsedExpense, now: Date): ParsedExpense {
  if (p.paymentDate) return p;
  const pad = (n: number) => String(n).padStart(2, '0');
  const iso = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
            + `T${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
  return { ...p, paymentDate: iso };
}

export async function smsToExpense(
  sms: string,
  receivedAt?: Date
): Promise<PipelineResult> {
  const t0 = Date.now();
  const now = receivedAt ?? new Date();
  const regex = parseSms(sms, now);

  if (hasAllRequired(regex)) {
    return {
      data: regex,
      source: 'regex',
      llmCalled: false,
      confidence: 'high',
      elapsedMs: Date.now() - t0,
    };
  }

  try {
    const llm = await parseWithLLM(sms, now);
    const merged = mergeParsed(regex, llm);
    const withDate = fillPaymentDateFallback(merged, now);

    const allFromLlm =
      regex.amount == null && regex.storeName == null && regex.paymentDate == null;

    const confidence: 'medium' | 'low' = hasAllRequired(withDate) ? 'medium' : 'low';

    return {
      data: withDate,
      source: allFromLlm ? 'llm' : 'hybrid',
      llmCalled: true,
      confidence,
      elapsedMs: Date.now() - t0,
    };
  } catch (e) {
    console.warn('[LLM fallback failed]', e);
    return {
      data: fillPaymentDateFallback(regex, now),
      source: 'regex',
      llmCalled: false,
      confidence: 'low',
      elapsedMs: Date.now() - t0,
    };
  }
}