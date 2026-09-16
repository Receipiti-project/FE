import type { DisplayTransaction } from "@/hooks/useExpenditures";

function won(amount: number): string {
  return `${Math.round(amount).toLocaleString("ko-KR")}원`;
}

function total(items: DisplayTransaction[]): number {
  return items.reduce((sum, item) => sum + item.amount, 0);
}

function rankBy(
  items: DisplayTransaction[],
  keyOf: (item: DisplayTransaction) => string
): { name: string; amount: number; count: number }[] {
  const grouped = new Map<string, { amount: number; count: number }>();
  items.forEach((item) => {
    const key = keyOf(item) || "미분류";
    const current = grouped.get(key) ?? { amount: 0, count: 0 };
    grouped.set(key, {
      amount: current.amount + item.amount,
      count: current.count + 1,
    });
  });
  return [...grouped.entries()]
    .map(([name, value]) => ({ name, ...value }))
    .sort((a, b) => b.amount - a.amount || b.count - a.count);
}

function dateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function previousWeekend(): { saturday: string; sunday: string } {
  const now = new Date();
  const daysSinceSaturday = ((now.getDay() + 1) % 7) || 7;
  const saturday = new Date(now);
  saturday.setHours(0, 0, 0, 0);
  saturday.setDate(now.getDate() - daysSinceSaturday);
  const sunday = new Date(saturday);
  sunday.setDate(saturday.getDate() + 1);
  return { saturday: dateKey(saturday), sunday: dateKey(sunday) };
}

const CAFE_WORDS = ["카페", "커피", "스타벅스", "이디야", "투썸", "메가커피", "컴포즈"];
const FOOD_WORDS = ["식비", "외식", "음식", "식당", "카페"];

function includesAny(value: string, words: string[]): boolean {
  return words.some((word) => value.includes(word));
}

export function answerReportQuestion(
  rawQuestion: string,
  items: DisplayTransaction[],
  periodLabel: string
): string {
  const question = rawQuestion.trim();
  const normalized = question.replace(/\s+/g, "").toLocaleLowerCase("ko-KR");

  if (!question) return "궁금한 내용을 입력해 주세요.";
  if (items.length === 0) return `${periodLabel}에 분석할 지출 내역이 없어요.`;

  const periodTotal = total(items);

  if (normalized.includes("지난주말") || (normalized.includes("주말") && normalized.includes("곳"))) {
    const weekend = previousWeekend();
    const weekendItems = items.filter((item) => {
      const date = item.datetime.slice(0, 10);
      return date === weekend.saturday || date === weekend.sunday;
    });
    const top = rankBy(weekendItems, (item) => item.store)[0];
    return top
      ? `지난 주말에는 ${top.name}에서 ${won(top.amount)}으로 가장 많이 썼어요. 총 ${top.count}건 결제했어요.`
      : "지난 주말 지출 내역이 현재 조회 데이터에 없어요.";
  }

  if (normalized.includes("카페")) {
    const cafeItems = items.filter((item) =>
      includesAny(`${item.categoryName} ${item.store}`, CAFE_WORDS)
    );
    const cafeTotal = total(cafeItems);
    const share = periodTotal > 0 ? Math.round((cafeTotal / periodTotal) * 100) : 0;
    if (cafeItems.length === 0) return `${periodLabel} 카페 지출은 없어요.`;
    return `${periodLabel} 카페 지출은 ${won(cafeTotal)}, ${cafeItems.length}건으로 전체의 ${share}%예요. 평소보다 많은지 비교하려면 이전 기간 데이터가 추가로 필요해요.`;
  }

  if (normalized.includes("외식") || normalized.includes("식비") || normalized.includes("줄이") || normalized.includes("절약")) {
    const foodItems = items.filter((item) =>
      includesAny(`${item.categoryName} ${item.store}`, FOOD_WORDS)
    );
    const foodTotal = total(foodItems);
    const topStore = rankBy(foodItems, (item) => item.store)[0];
    if (!topStore) return `${periodLabel}에는 식비로 분류된 지출이 없어 구체적인 절약안을 계산하기 어려워요.`;
    const target = Math.round(foodTotal * 0.1);
    return `${periodLabel} 식비는 ${won(foodTotal)}이에요. 가장 많이 쓴 ${topStore.name} 이용을 한두 번 줄이면 우선 ${won(target)} 정도를 절약 목표로 잡을 수 있어요.`;
  }

  if (normalized.includes("점심") || normalized.includes("회사주변")) {
    const lunchItems = items.filter((item) => {
      const hour = new Date(item.datetime).getHours();
      return hour >= 11 && hour < 14;
    });
    if (lunchItems.length === 0) return `${periodLabel} 점심 시간대 결제 내역이 없어요.`;
    const average = total(lunchItems) / lunchItems.length;
    return `${periodLabel} 오전 11시~오후 2시 결제는 ${lunchItems.length}건, 건당 평균 ${won(average)}이에요. 회사 주변 여부는 위치 데이터가 없어 구분하지 못했어요.`;
  }

  if (normalized.includes("카테고리") || normalized.includes("분야")) {
    const top = rankBy(items, (item) => item.categoryName)[0];
    const share = Math.round((top.amount / periodTotal) * 100);
    return `${periodLabel} 가장 많이 쓴 카테고리는 ${top.name}으로 ${won(top.amount)}, 전체의 ${share}%예요.`;
  }

  if (normalized.includes("매장") || normalized.includes("가게") || normalized.includes("어디")) {
    const top = rankBy(items, (item) => item.store)[0];
    return `${periodLabel} 가장 많이 쓴 매장은 ${top.name}이에요. ${top.count}건, 총 ${won(top.amount)}을 결제했어요.`;
  }

  if (normalized.includes("요일") || normalized.includes("주말")) {
    const labels = ["일요일", "월요일", "화요일", "수요일", "목요일", "금요일", "토요일"];
    const top = rankBy(items, (item) => labels[new Date(item.datetime).getDay()])[0];
    return `${periodLabel} 지출이 가장 큰 요일은 ${top.name}으로 총 ${won(top.amount)}이에요.`;
  }

  if (normalized.includes("시간") || normalized.includes("언제")) {
    const buckets = [
      { name: "아침 6~11시", test: (hour: number) => hour >= 6 && hour < 11 },
      { name: "점심 11~14시", test: (hour: number) => hour >= 11 && hour < 14 },
      { name: "오후 14~18시", test: (hour: number) => hour >= 14 && hour < 18 },
      { name: "저녁 18~22시", test: (hour: number) => hour >= 18 && hour < 22 },
      { name: "야간 22~6시", test: (hour: number) => hour >= 22 || hour < 6 },
    ];
    const ranked = buckets
      .map((bucket) => ({
        name: bucket.name,
        amount: total(items.filter((item) => bucket.test(new Date(item.datetime).getHours()))),
      }))
      .sort((a, b) => b.amount - a.amount);
    return `${periodLabel} 지출이 가장 큰 시간대는 ${ranked[0].name}로 총 ${won(ranked[0].amount)}이에요.`;
  }

  if (normalized.includes("평균")) {
    return `${periodLabel} 결제 ${items.length}건의 건당 평균은 ${won(periodTotal / items.length)}이에요.`;
  }

  if (normalized.includes("가장큰") || normalized.includes("최대") || normalized.includes("제일큰")) {
    const largest = [...items].sort((a, b) => b.amount - a.amount)[0];
    return `${periodLabel} 가장 큰 결제는 ${largest.store}의 ${won(largest.amount)}이에요.`;
  }

  if (normalized.includes("총") || normalized.includes("얼마") || normalized.includes("몇건")) {
    return `${periodLabel} 총 지출은 ${won(periodTotal)}, 결제 건수는 ${items.length}건이에요.`;
  }

  return "현재는 총액, 평균, 카테고리, 매장, 요일, 시간대, 카페·식비 절약 질문을 분석할 수 있어요. 질문에 관련 단어를 포함해 다시 물어봐 주세요.";
}
