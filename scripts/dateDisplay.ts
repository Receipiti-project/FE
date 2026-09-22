export function formatPaymentDate(value: string | null): string {
  if (!value) return '';

  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})[T\s](\d{2}):(\d{2})/);
  if (!match) return value;

  const [, year, month, day, rawHour, minute] = match;
  const hour = Number(rawHour);
  const period = hour < 12 ? '오전' : '오후';
  const displayHour = hour % 12 || 12;

  return `${Number(year)}년 ${Number(month)}월 ${Number(day)}일 ${period} ${displayHour}시 ${minute}분`;
}
