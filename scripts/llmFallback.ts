import { ParsedExpense } from './smsLexer';
import { CategoryType } from './types';

interface LlmParseResponse {
  amount: number | null;
  storeName: string | null;
  paymentDate: string | null;
  category: string | null;
  memo: string | null;
}

export async function parseWithLLM(sms: string): Promise<LlmParseResponse> {
  void sms;
  throw new Error('서버 측 SMS 분석 API가 연결되지 않았습니다.');
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
