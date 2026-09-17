const ONLINE_KEYWORDS = [
  '쿠팡', '쿠팡이츠', '배달의민족', '우아한형제', '우아한형제들', '요기요', '배민',
  '네이버페이', '네이버', '카카오페이', '카카오T', '카카오모빌리티',
  'G마켓', '지마켓', '옥션', '11번가', '티몬', '위메프', '인터파크',
  'SSG', '쓱', '마켓컬리', '컬리', '올웨이즈', '알리익스프레스', '알리',
  '테무', '무신사', '에이블리', '지그재그', '브랜디', '오늘의집',
  '토스', '토스페이먼츠', 'PAYPAL', '페이팔', 'KG이니시스', '이니시스',
  'NHN KCP', 'KCP', '다날', '스마트로', 'NICE페이',
] as const;

const SUBSCRIPTION_KEYWORDS = [
  '넷플릭스', 'NETFLIX', '유튜브', 'YOUTUBE', '왓챠', '웨이브', '티빙',
  '디즈니', '디즈니플러스', 'DISNEY', '스포티파이', 'SPOTIFY', '멜론', '지니뮤직', '플로',
  'APPLE', '애플', 'GOOGLE', '구글', 'MICROSOFT', 'OPENAI', 'CHATGPT',
  'AWS', '아마존', 'AMAZON', '어도비', 'ADOBE', '노션', 'NOTION',
] as const;

const TELECOM_UTILITY_KEYWORDS = [
  '에스케이텔레콤', 'SKT', 'SK텔레콤', 'KT', '케이티', 'LG유플러스', 'LGU',
  '유플러스', '알뜰폰', '한국전력', '한전', '도시가스', '수도요금',
  '국민건강보험', '건강보험', '국민연금', '보험료', '카드론', '현금서비스',
] as const;

const NON_PLACE_KEYWORDS: readonly string[] = [
  ...ONLINE_KEYWORDS,
  ...SUBSCRIPTION_KEYWORDS,
  ...TELECOM_UTILITY_KEYWORDS,
];

export type NonPlaceReason = 'online' | 'subscription' | 'utility' | null;

const ONLINE_SMS_SIGNALS = [
  '카드번호입력승인',
  '카드번호입력',
  '온라인승인',
  '인터넷승인',
  '전화승인',
  '해외승인',
  '해외이용',
] as const;

export function hasOnlineSignal(rawSms: string): boolean {
  const t = rawSms.replace(/\s+/g, '');
  return ONLINE_SMS_SIGNALS.some((k) => t.includes(k));
}

const normalize = (s: string): string =>
  s.replace(/\s+/g, ' ').trim().toUpperCase();

const HANGUL = /[가-힣]/;
const WORD_CHAR = /[A-Z0-9&]/;
const ALLOWED_SUFFIXES = [
  '주식회사', '코리아', '페이먼츠', '페이', '파이낸셜', '모바일',
  '닷컴', '요금', '결제', '이용료', '공사', '공단',
];

function matchesKeyword(name: string, keyword: string): boolean {
  if (!keyword) return false;
  const hangulKeyword = HANGUL.test(keyword[0]);

  for (
    let i = name.indexOf(keyword);
    i >= 0;
    i = name.indexOf(keyword, i + 1)
  ) {
    const before = name[i - 1];
    const after = name[i + keyword.length];
    const rest = name.slice(i + keyword.length);

    const ok = hangulKeyword
      ? (!before || !HANGUL.test(before)) &&
        (!after ||
          !HANGUL.test(after) ||
          ALLOWED_SUFFIXES.some((s) => rest.startsWith(s)))
      : (!before || !WORD_CHAR.test(before)) &&
        (!after || !WORD_CHAR.test(after));

    if (ok) return true;
  }
  return false;
}

export function classifyNonPlace(storeName: string): NonPlaceReason {
  const n = normalize(storeName);
  if (!n) return null;

  const compact = n.replace(/ /g, '');
  const hit = (list: readonly string[]) =>
    list.some((k) => {
      const nk = normalize(k);
      return matchesKeyword(n, nk) || matchesKeyword(compact, nk.replace(/ /g, ''));
    });

  if (hit(TELECOM_UTILITY_KEYWORDS)) return 'utility';
  if (hit(SUBSCRIPTION_KEYWORDS)) return 'subscription';
  if (hit(ONLINE_KEYWORDS)) return 'online';
  return null;
}

export function isNonPlaceMerchant(storeName: string): boolean {
  return classifyNonPlace(storeName) !== null;
}

export { NON_PLACE_KEYWORDS };
