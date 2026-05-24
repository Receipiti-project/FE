export type InputType = 'OCR' | 'VOICE' | 'MANUAL' | 'SMS';
export type Currency = 'KRW' | 'USD' | 'EUR' | 'JPY';
export type CategoryType = 'FOOD' | 'TRANSPORT' | 'SHOPPING' | 'CULTURE' | 'HEALTH' | 'ETC';

export const CATEGORY_LABEL: Record<CategoryType, string> = {
  FOOD: '식비',
  TRANSPORT: '교통',
  SHOPPING: '쇼핑',
  CULTURE: '문화/여가',
  HEALTH: '건강/의료',
  ETC: '기타',
};