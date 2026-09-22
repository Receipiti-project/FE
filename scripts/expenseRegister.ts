import { CATEGORIES, CategoryId } from '@/constants/mockData';
import { getCategories } from '@/services/api/categoryApi';
import {
  CreateExpenditureDto,
  createExpenditure,
  datetimeLocalToIso,
} from '@/services/api/expenditureApi';
import { ClientExpenditureInputType } from '@/services/expenditureMetadata';
import { getLocationHint } from './currentLocation';
import {
  canonicalStoreName,
  namesRelated,
  resolveLocation,
} from './locationPipeline';
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

const isValidAmount = (amount: number | null): amount is number =>
  amount != null && Number.isFinite(amount) && amount > 0;

export function missingRequiredFields(draft: ExpenseDraft): string[] {
  return [
    !isValidAmount(draft.amount) && '결제금액',
    !draft.storeName?.trim() && '가게명',
    !draft.paymentDate?.trim() && '결제일시',
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
      loc.longitude != null &&
      namesRelated(storeName, loc.placeName)
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
      if (pick && namesRelated(storeName, pick.name)) {
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

async function serverCategoryId(categoryId: CategoryId): Promise<number> {
  const type = categoryId.toUpperCase();
  const categories = await getCategories();
  const match = categories.find((c) => !c.custom && c.categoryType === type);
  if (!match) throw new Error('카테고리를 찾지 못했어요.');
  return match.categoryId;
}

export type RegisterOptions = PlaceLookupOptions & {
  inputType: ClientExpenditureInputType;
};

export async function registerExpense(
  draft: ExpenseDraft,
  rawSms: string | undefined,
  known: ResolvedPlace | null | undefined,
  options: RegisterOptions
): Promise<string> {
  const categoryId = toCategoryId(draft.category);
  const amount = draft.amount;
  const storeName = draft.storeName?.trim();
  const paymentDate = draft.paymentDate?.trim();

  if (!isValidAmount(amount) || !storeName || !paymentDate || !categoryId) {
    throw new Error('필수 항목이 비어 있습니다.');
  }

  const expenditureDate = datetimeLocalToIso(paymentDate);

  const place =
    known === null
      ? null
      : known && known.placeName === storeName
        ? known
        : await resolveExpensePlace(storeName, rawSms, options);

  const savedName = place
    ? canonicalStoreName(storeName, place.placeName)
    : storeName;

  await createExpenditure(
    {
      categoryId: await serverCategoryId(categoryId),
      storeName: savedName,
      amount,
      expenditureDate,
      memo: draft.memo?.trim() || undefined,
      currency: 'KRW',
      ...(place && {
        placeId: place.placeId,
        address: place.address,
        latitude: place.latitude,
        longitude: place.longitude,
      }),
    },
    options.inputType
  );

  return savedName;
}
