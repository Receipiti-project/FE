import { InputType, Currency, CategoryType } from './types';

export type TokenType =
  | 'header'
  | 'amount'
  | 'amountTotal'
  | 'date'
  | 'time'
  | 'storeName'
  | 'issuer'
  | 'cardTail'
  | 'userName'
  | 'installment'
  | 'discount';


export interface ParsedExpense {
  amount: number | null;
  storeName: string | null;
  paymentDate: string | null;
  category: string | null;
  memo: string | null;
  inputType: InputType;
  currency: Currency | null;
  _raw: Record<string, string | number>;
}

const RESERVED = new Set([
  '누적', '잔액', '승인', '취소', '사용', '일시불', '할부',
  '결제', '출금', '입금', '체크', '신용',
  'ZERO', 'PLATINUM', 'GOLD', 'CHECK',
]);

const isReserved = (s: string) => RESERVED.has(s.replace(/님$/, ''));

const toNum = (s: string): number => {
  const n = Number(s.replace(/[^\d-]/g, ''));
  return Number.isFinite(n) ? n : 0;
};

const ISSUER_KEYWORDS = [
  '신한', '삼성', '현대', 'KB국민', '국민', '롯데', '하나', 'BC', '비씨', '농협', 'NH', '우리', '씨티',
] as const;

const ISSUER_RE = new RegExp(
  `^(${ISSUER_KEYWORDS.join('|')})(\\s?(카드|체크카드))?(\\s?(ZERO|PLATINUM|GOLD|M\\d+|[A-Z]+\\d*))?(\\(\\d{4}\\)|[\\d\\*]{3,8})?`
);

const normalizeIssuer = (m: string): string => {
  const base = ISSUER_KEYWORDS.find(k => m.startsWith(k)) ?? m;
  return base === '국민' || base === 'KB국민' ? 'KB국민카드' : `${base}카드`;
};

const stripStoreSuffix = (s: string): string =>
  s.replace(/\s*(사용|일시불|취소|승인)\s*$/g, '').trim();

type Rule = [RegExp, ((m: string) => { type: TokenType; value: string | number } | null) | null];

const RULES: Rule[] = [
  [/^\[Web발신\]/,                                    () => ({ type: 'header', value: '' })],
  [/^\(Web발신\)/,                                    () => ({ type: 'header', value: '' })],
  [/^체크카드출금/,                                    () => ({ type: 'header', value: '' })],

  [/^[가-힣\*]{2,4}님(?![가-힣])/, m => ({
    type: 'userName',
    value: m.replace(/님$/, ''),
  })],

  [/^[가-힣]\*[가-힣](?![가-힣])/, m => ({ type: 'userName', value: m })],
  [/^\*{2,3}(?![가-힣A-Za-z])/,    m => ({ type: 'userName', value: m })],

  [/^누적[\s:\-]?[\d,\-]+원/,                          m => ({ type: 'amountTotal', value: toNum(m) })],
  [/^잔액[\d,\-]+원?/,                                 m => ({ type: 'amountTotal', value: toNum(m) })],
  [/^[\d,]+원/,                                        m => ({ type: 'amount',      value: toNum(m) })],

  [/^\(?일시불\)?/,                                    () => ({ type: 'installment', value: '일시불' })],
  [/^\d+(\.\d+)?%\s*할인/,                             m => ({ type: 'discount',    value: m })],

  [/^\d{2}\/\d{2}/,                                    m => ({ type: 'date', value: m })],
  [/^\d{2}:\d{2}/,                                     m => ({ type: 'time', value: m })],

  [/^\S+은행/,                                          m => ({ type: 'storeName', value: m })],

  [ISSUER_RE, m => ({ type: 'issuer', value: normalizeIssuer(m) })],

  [/^[가-힣]*?(승인|출금|입금|취소|결제)(?![가-힣])/, () => null],

  [/^\(([\d\*]{4})\)/, m => ({ type: 'cardTail', value: m.slice(1, -1) })],

  [/^[\d\*]{3,8}(?=\s|$|[가-힣])/, m => {
    if (!/\*/.test(m)) return null;
    return { type: 'cardTail', value: m };
  }],

  [/^\[[가-힣A-Za-z0-9]+\]/,                          m => {
    const inner = m.slice(1, -1);
    const hit = ISSUER_KEYWORDS.find(k => inner.startsWith(k));
    return hit ? { type: 'issuer', value: normalizeIssuer(inner) } : null;
  }],

  [/^\(\d{4}\)/,                                       m => ({ type: 'cardTail', value: m.slice(1, 5) })],
  [/^승인/,                                            null],

  [/^\(주\)[가-힣A-Za-z0-9]+/,                         m => ({ type: 'storeName', value: stripStoreSuffix(m.slice(3)) })],
  [/^주식회사[가-힣A-Za-z0-9]+/,                       m => ({ type: 'storeName', value: stripStoreSuffix(m.slice(4)) })],

  [/^[가-힣A-Za-z0-9]+/, m => {
    const v = stripStoreSuffix(m);
    if (isReserved(v)) return null;
    if (/^[\d\*]+$/.test(v)) return null;
    if (v.length < 2) return null;
    return { type: 'storeName', value: v };
  }],

  [/^[\s\n\r]+/,                                       null],
  [/^[^\s]/,                                           null],
];

export function lex(sms: string): Record<string, string | number> {
  const result: Record<string, string | number> = {};
  let rest = sms;
  let guard = 0;

  while (rest.length && guard++ < 10000) {
    let matched = false;
    for (const [re, fn] of RULES) {
      const m = rest.match(re);
      if (m && m.index === 0) {
        if (fn) {
          const tok = fn(m[0]);
          if (tok) {
            if (tok.type === 'storeName') {
              if (result.storeName == null) result.storeName = tok.value;
            } else {
              result[tok.type] = tok.value;
            }
          }
        }
        rest = rest.slice(m[0].length);
        matched = true;
        break;
      }
    }
    if (!matched) rest = rest.slice(1);
  }
  return result;
}

export function parseSms(sms: string, now: Date = new Date()): ParsedExpense {
  const h = lex(sms);

  let paymentDate: string | null = null;
  const hasDate = typeof h.date === 'string';
  const hasTime = typeof h.time === 'string';

  if (hasDate || hasTime) {
    const [mm, dd] = hasDate
        ? (h.date as string).split('/')
        : [
            String(now.getMonth() + 1).padStart(2, '0'),
            String(now.getDate()).padStart(2, '0'),
        ];
    const [hh, mi] = hasTime ? (h.time as string).split(':') : ['00', '00'];
    paymentDate = `${now.getFullYear()}-${mm}-${dd}T${hh}:${mi}:00`;
  }

  return {
    amount:      typeof h.amount === 'number' ? h.amount : null,
    storeName:   typeof h.storeName === 'string' ? h.storeName : null,
    paymentDate,
    category:    null,
    memo:        null,
    inputType:   'SMS',
    currency:    null,
    _raw:        h,
  };
}

export function hasAllRequired(p: {
  amount: number | null;
  storeName: string | null;
  paymentDate: string | null;
  category: string | null;
}): boolean {
  return p.amount != null
    && !!p.storeName
    && !!p.category
    && !!p.paymentDate;
}
