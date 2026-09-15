import { CATEGORIES, CategoryId } from '@/constants/mockData';
import {
  CreateExpenditureDto,
  createExpenditure,
  datetimeLocalToIso,
} from '@/services/api/expenditureApi';
import { getServerCategoryId } from '@/services/categoryMapping';
import { getLocationHint } from './currentLocation';
import { resolveLocation } from './locationPipeline';
import { haversineKm, LatLng } from './mapGeo';
import { Place } from './placeSearch';

const AUTO_PICK_RADIUS_KM = 0.5;

export type ExpenseDraft = {
  amount: number | null;
  storeName: string | null;
  paymentDate: string | null;
  category: string | null;
  memo: string | null;
};

const CATEGORY_IDS: CategoryId[] = CATEGORIES.map((c) => c.id);

export function toCategoryId(category: string | null): CategoryId | null {
  if (!category) return null;
  const id = category.trim().toLowerCase() as CategoryId;
  return CATEGORY_IDS.includes(id) ? id : null;
}

export function missingRequiredFields(draft: ExpenseDraft): string[] {
  return [
    draft.amount == null && '결제금액',
    !draft.storeName && '가게명',
    !draft.paymentDate && '결제일시',
    !toCategoryId(draft.category) && '카테고리',
  ].filter(Boolean) as string[];
}

export type ResolvedPlace = Pick<
  CreateExpenditureDto,
  'placeId' | 'address' | 'latitude' | 'longitude'
> & { placeName: string };

function nearestWithin(
  candidates: Place[],
  center: LatLng,
  radiusKm: number
): Place | null {
  if (candidates.length === 0) return null;
  const nearest = candidates.reduce((best, p) =>
    haversineKm(center, p) < haversineKm(center, best) ? p : best
  );
  return haversineKm(center, nearest) <= radiusKm ? nearest : null;
}

export type PlaceLookupOptions = { useCurrentLocation?: boolean };

export async function resolveExpensePlace(
  storeName: string,
  rawSms?: string,
  { useCurrentLocation = true }: PlaceLookupOptions = {}
): Promise<ResolvedPlace | null> {
  try {
    const near = useCurrentLocation
      ? ((await getLocationHint()) ?? undefined)
      : undefined;
    const loc = await resolveLocation(storeName, { near, rawSms });

    if (
      loc.status === 'resolved' &&
      loc.placeId != null &&
      loc.placeName != null &&
      loc.latitude != null &&
      loc.longitude != null
    ) {
      return {
        placeId: loc.placeId,
        placeName: loc.placeName,
        latitude: loc.latitude,
        longitude: loc.longitude,
        address: loc.address ?? undefined,
      };
    }

    if (loc.status === 'ambiguous' && near) {
      const pick = nearestWithin(loc.candidates, near, AUTO_PICK_RADIUS_KM);
      if (pick) {
        return {
          placeId: pick.id,
          placeName: pick.name,
          latitude: pick.latitude,
          longitude: pick.longitude,
          address: pick.roadAddress || pick.address,
        };
      }
    }

    return null;
  } catch (e) {
    console.warn('[expenseRegister] 위치 확인 실패', e);
    return null;
  }
}

export async function registerExpense(
  draft: ExpenseDraft,
  rawSms?: string,
  known?: ResolvedPlace | null,
  options: PlaceLookupOptions = {}
): Promise<string> {
  const categoryId = toCategoryId(draft.category);

  if (
    draft.amount == null ||
    !draft.storeName ||
    !draft.paymentDate ||
    !categoryId
  ) {
    throw new Error('필수 항목이 비어 있습니다.');
  }

  const storeName = draft.storeName.trim();
  const expenditureDate = datetimeLocalToIso(draft.paymentDate);

  const place =
    known === null
      ? null
      : known && known.placeName === storeName
        ? known
        : await resolveExpensePlace(storeName, rawSms, options);

  const savedName = place?.placeName ?? storeName;

  await createExpenditure({
    categoryId: getServerCategoryId(categoryId),
    storeName: savedName,
    amount: draft.amount,
    expenditureDate,
    memo: draft.memo?.trim() || undefined,
    ...(place && {
      placeId: place.placeId,
      address: place.address,
      latitude: place.latitude,
      longitude: place.longitude,
    }),
  });

  return savedName;
}
