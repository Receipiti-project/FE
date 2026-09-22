import { CategoryApiItem } from '@/services/api/categoryApi';
import { CategoryType } from './types';

export function enumCategoryId(
  categories: CategoryApiItem[],
  category: string | null | undefined
): number | null {
  if (!category) return null;
  const type = category.toUpperCase();
  return (
    categories.find((c) => !c.custom && c.categoryType === type)?.categoryId ??
    null
  );
}

export function guessCategory(storeName: string): CategoryType | null {
  const name = storeName.toLowerCase();
  if (/지하철|버스|택시|카카오t|주유|ktx|기차|항공|공항|교통|티머니|주차/.test(name)) return 'TRANSPORT';
  if (/쿠팡|올리브영|다이소|이마트|롯데마트|홈플러스|쇼핑|패션|의류|신발/.test(name)) return 'SHOPPING';
  if (/스타벅스|커피|cafe|카페|이디야|투썸|빽다방|할리스|식당|마트|편의점|gs25|cu|세븐|맥도날드|버거|치킨|pizza|피자|분식|삼겹|고기|한식|중식|일식|국밥/.test(name)) return 'FOOD';
  if (/cgv|영화|롯데시네마|메가박스|게임|여행|숙박|호텔|공연|전시/.test(name)) return 'CULTURE';
  if (/병원|약국|헬스|gym|의원|클리닉|한의원|치과|안과/.test(name)) return 'HEALTH';
  return null;
}
