import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  CategoryId,
  formatKRW,
  getCategory,
  getCategoryByName,
} from '../../constants/mockData';
import { CategoryPicker } from '../../components/category-picker';
import { useCategories } from '../../contexts/CategoryContext';
import {
  getCategoryRecommendation,
  resolveCategoryRecommendation,
} from '../../services/api/categoryApi';
import { enumCategoryId } from '../../scripts/storeCategory';
import { formatPaymentDate } from '../../scripts/dateDisplay';
import { expenditureDateParam } from '../../services/api/expenditureApi';
import { smsToExpense } from '../../scripts/smsPipeline';
import { useSharedSms } from '../../scripts/useSharedSms';
import { useAndroidSms } from '../../scripts/useAndroidSms';
import {
  missingRequiredFields,
  registerExpense,
  resolveExpensePlace,
  ResolvedPlace,
} from '../../scripts/expenseRegister';
import {
  isSmsRegistered,
  markSmsRegistered,
} from '../../scripts/registeredSms';
import PlacePicker from '../../components/location/PlacePicker';
import { canonicalStoreName } from '../../scripts/locationPipeline';
import { Place } from '../../scripts/placeSearch';

const HITSLOP = { top: 12, bottom: 12, left: 12, right: 12 } as const;
const ACCENT = '#F59E0B';

const FEATURES = [
  { icon: 'chatbox-ellipses-outline', label: '결제 문자' },
  { icon: 'scan-outline', label: '자동 스캔' },
  { icon: 'sparkles-outline', label: 'AI 분류' },
] as const;

const IOS_FEATURES = [
  { icon: 'chatbox-ellipses-outline', label: '결제 문자' },
  { icon: 'clipboard-outline', label: '붙여넣기' },
  { icon: 'sparkles-outline', label: 'AI 분류' },
] as const;

type Step = 'input' | 'scan' | 'review';

type Draft = {
  amount: number | null;
  storeName: string | null;
  paymentDate: string | null;
  category: string | null;
  memo: string | null;
  categoryId?: number | null;
};

type ScanEdit = {
  storeName?: string | null;
  amount?: number | null;
  category?: string | null;
  categoryId?: number | null;
  memo?: string | null;
  place?: ResolvedPlace | null;
  placeLoading?: boolean;
  placeDropped?: boolean;
  baseName?: string | null;
  include?: boolean;
  expanded?: boolean;
  removed?: boolean;
};

type ScanItem = {
  id: string;
  body: string;
  draft: Draft;
  baseName: string | null;
  place: ResolvedPlace | null | undefined;
  placeLoading: boolean;
  placeDropped: boolean;
  issuer: string | null;
  parsing: boolean;
  failed: boolean;
  done: boolean;
  include: boolean;
  expanded: boolean;
};

export default function SmsScreen() {
  const { categories } = useCategories();
  const [step, setStep] = useState<Step>('input');
  const [input, setInput] = useState('');
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const [recommendedCategoryId, setRecommendedCategoryId] = useState<number | null>(null);
  const [categoryAutoApplied, setCategoryAutoApplied] = useState(false);
  const [userEditedCategory, setUserEditedCategory] = useState(false);
  const [matchedCount, setMatchedCount] = useState(0);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [place, setPlace] = useState<ResolvedPlace | null>(null);
  const [placeDropped, setPlaceDropped] = useState(false);
  const [baseName, setBaseName] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [bulkSaving, setBulkSaving] = useState(false);
  const [registeredIds, setRegisteredIds] = useState<string[]>([]);
  const [sourceSmsId, setSourceSmsId] = useState<string | null>(null);
  const [scanEdits, setScanEdits] = useState<Record<string, ScanEdit>>({});
  const [scanPickerFor, setScanPickerFor] = useState<string | null>(null);

  const classifyRunRef = useRef(0);
  const userEditedRef = useRef(false);

  const { messages: scanned, scanning, scan } = useAndroidSms();

  useSharedSms((text) => {
    setInput(text);
    setSourceSmsId(null);
    runParse(text);
  });

  const runParse = async (text: string) => {
    const t = text.trim();
    if (!t) {
      Alert.alert('입력이 비어 있어요');
      return;
    }
    setLoading(true);
    setDraft(null);
    setBaseName(null);
    setPlace(null);
    setPlaceDropped(false);
    setRecommendedCategoryId(null);
    setCategoryAutoApplied(false);
    setUserEditedCategory(false);
    userEditedRef.current = false;
    setMatchedCount(0);
    try {
      const r = await smsToExpense(t);
      const found = r.data.storeName
        ? await resolveExpensePlace(r.data.storeName, t)
        : null;

      const storeName =
        found && r.data.storeName
          ? canonicalStoreName(r.data.storeName, found.placeName)
          : r.data.storeName;
      setPlace(found);
      setBaseName(r.data.storeName);
      setDraft({
        amount: r.data.amount,
        storeName,
        paymentDate: r.data.paymentDate,
        category: r.data.category,
        memo: r.data.memo,
        categoryId: null,
      });
      setPasteOpen(false);
      setStep('review');
      if (storeName) void classifyStore(storeName);
    } catch (e: any) {
      Alert.alert('파싱 실패', e?.message ?? String(e));
    } finally {
      setLoading(false);
    }
  };

  const classifyStore = async (storeName: string) => {
    const name = storeName.trim();
    if (!name) return;

    const runId = ++classifyRunRef.current;
    const recommendation = await getCategoryRecommendation(name).catch(() => null);
    if (runId !== classifyRunRef.current) return;

    const decision = resolveCategoryRecommendation(recommendation, categories);
    setRecommendedCategoryId(decision.recommendedCategoryId);
    setMatchedCount(decision.matchedCount);
    if (userEditedRef.current) return;

    setDraft((prev) =>
      prev ? { ...prev, categoryId: decision.selectedCategoryId } : prev
    );
    setCategoryAutoApplied(decision.selectedCategoryId != null);
  };

  const openPaste = () => {
    setPasteText(input);
    setPasteOpen(true);
  };

  const goScan = () => {
    setScanEdits({});
    setStep('scan');
    scan();
  };

  const rescan = () => {
    setScanEdits({});
    scan();
  };

  const updateDraft = (patch: Partial<Draft>) => {
    setDraft((prev) => (prev ? { ...prev, ...patch } : prev));
  };

  const clearResult = () => {
    setDraft(null);
    setPlace(null);
    setPlaceDropped(false);
    setBaseName(null);
    setRecommendedCategoryId(null);
    setCategoryAutoApplied(false);
    setUserEditedCategory(false);
    userEditedRef.current = false;
    setMatchedCount(0);
    setStep('input');
  };

  const pickerQuery =
    draft?.storeName && draft.storeName !== place?.placeName
      ? draft.storeName
      : (baseName ?? draft?.storeName ?? '');

  const applyPlace = (picked: Place) => {
    if (draft?.storeName && draft.storeName !== place?.placeName) {
      setBaseName(draft.storeName);
    }
    setPlace({
      placeId: picked.id,
      placeName: picked.name,
      address: picked.roadAddress || picked.address,
      latitude: picked.latitude,
      longitude: picked.longitude,
    });
    updateDraft({ storeName: picked.name });
    setPlaceDropped(false);
    setPickerOpen(false);
  };

  const dropPlace = () => {
    if (baseName && draft?.storeName === place?.placeName) {
      updateDraft({ storeName: baseName });
    }
    setPlace(null);
    setPlaceDropped(true);
    setPickerOpen(false);
  };

  const onRegister = async () => {
    if (!draft) return;

    const blanks = missingRequiredFields(draft);
    if (blanks.length > 0) {
      Alert.alert('입력 확인', `${blanks.join(', ')}을(를) 채워주세요.`);
      return;
    }

    setSaving(true);
    try {
      await registerExpense(
        {
          ...draft,
          categoryId: userEditedCategory ? draft.categoryId : null,
          defaultCategoryId:
            !userEditedCategory && categoryAutoApplied ? draft.categoryId : null,
        },
        input,
        placeDropped ? null : (place ?? undefined),
        { inputType: 'SMS' }
      );
      if (sourceSmsId) {
        markSmsRegistered(sourceSmsId);
        setRegisteredIds((prev) => [...prev, sourceSmsId]);
      }
      Alert.alert('등록 완료', '가계부에 추가되었어요.', [
        {
          text: '확인',
          onPress: () =>
            router.replace({
              pathname: '/(tabs)/budget',
              params: { date: expenditureDateParam(draft.paymentDate ?? undefined) },
            }),
        },
      ]);
    } catch (e) {
      Alert.alert('저장 실패', (e as Error)?.message ?? '잠시 후 다시 시도해주세요.');
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    setRegisteredIds(
      scanned.filter((m) => isSmsRegistered(m.id)).map((m) => m.id)
    );
  }, [scanned]);

  const scanItems: ScanItem[] = useMemo(
    () =>
      scanned
        .filter((m) => !scanEdits[m.id]?.removed)
        .map((m) => {
          const e = scanEdits[m.id] ?? {};
          const base = m.result?.data;
          const draft: Draft = {
            amount: 'amount' in e ? e.amount ?? null : base?.amount ?? null,
            storeName:
              'storeName' in e ? e.storeName ?? null : base?.storeName ?? null,
            paymentDate: base?.paymentDate ?? null,
            category:
              'category' in e ? e.category ?? null : base?.category ?? null,
            memo: 'memo' in e ? e.memo ?? null : base?.memo ?? null,
            categoryId: e.categoryId ?? null,
          };
          const done = registeredIds.includes(m.id);
          const ready = !m.parsing && !m.error && base != null;
          const complete = ready && missingRequiredFields(draft).length === 0;

          return {
            id: m.id,
            body: m.body,
            draft,
            baseName:
              'baseName' in e ? (e.baseName ?? null) : (base?.storeName ?? null),
            place: e.place,
            placeLoading: e.placeLoading ?? false,
            placeDropped: e.placeDropped ?? false,
            issuer:
              typeof base?._raw?.issuer === 'string' ? base._raw.issuer : null,
            parsing: m.parsing,
            failed: !!m.error,
            done,
            include: !done && ready && (e.include ?? complete),
            expanded: e.expanded ?? false,
          };
        }),
    [scanned, scanEdits, registeredIds]
  );

  const selectedScans = scanItems.filter((s) => s.include);
  const selectedScanTotal = selectedScans.reduce(
    (sum, s) => sum + (s.draft.amount ?? 0),
    0
  );

  const updateScan = (id: string, patch: ScanEdit) =>
    setScanEdits((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));

  const lookupScanPlace = async (s: ScanItem) => {
    const name = s.draft.storeName?.trim();
    if (!name) {
      updateScan(s.id, { place: null });
      return null;
    }

    updateScan(s.id, { placeLoading: true });
    const found = await resolveExpensePlace(name, s.body, {
      useCurrentLocation: false,
    });
    updateScan(s.id, {
      place: found,
      placeLoading: false,
      ...(found && { storeName: canonicalStoreName(name, found.placeName) }),
    });
    return found;
  };

  const toggleScanExpand = (s: ScanItem) => {
    const opening = !s.expanded;
    updateScan(s.id, { expanded: opening });
    if (opening && s.place === undefined && !s.placeLoading) {
      lookupScanPlace(s);
    }
  };

  const scanPickerItem = scanItems.find((s) => s.id === scanPickerFor) ?? null;

  const scanPickerQuery =
    scanPickerItem?.draft.storeName &&
    scanPickerItem.draft.storeName !== scanPickerItem.place?.placeName
      ? scanPickerItem.draft.storeName
      : (scanPickerItem?.baseName ?? scanPickerItem?.draft.storeName ?? '');

  const applyScanPlace = (picked: Place) => {
    if (scanPickerItem) {
      const ownName =
        scanPickerItem.draft.storeName &&
        scanPickerItem.draft.storeName !== scanPickerItem.place?.placeName
          ? scanPickerItem.draft.storeName
          : null;
      updateScan(scanPickerItem.id, {
        ...(ownName ? { baseName: ownName } : {}),
        place: {
          placeId: picked.id,
          placeName: picked.name,
          address: picked.roadAddress || picked.address,
          latitude: picked.latitude,
          longitude: picked.longitude,
        },
        storeName: picked.name,
        placeDropped: false,
      });
    }
    setScanPickerFor(null);
  };

  const dropScanPlace = () => {
    if (scanPickerItem) {
      const revert =
        !!scanPickerItem.baseName &&
        scanPickerItem.draft.storeName === scanPickerItem.place?.placeName;
      updateScan(scanPickerItem.id, {
        place: null,
        placeDropped: true,
        ...(revert ? { storeName: scanPickerItem.baseName } : {}),
      });
    }
    setScanPickerFor(null);
  };

  const onRegisterSelected = async () => {
    if (selectedScans.length === 0) {
      Alert.alert('선택 필요', '등록할 문자를 1건 이상 선택해주세요.');
      return;
    }

    const incomplete = selectedScans.find(
      (s) => missingRequiredFields(s.draft).length > 0
    );
    if (incomplete) {
      updateScan(incomplete.id, { expanded: true });
      Alert.alert(
        '입력 확인',
        `${incomplete.draft.storeName ?? '가맹점명 없음'}: ${missingRequiredFields(
          incomplete.draft
        ).join(', ')}을(를) 채워주세요.`
      );
      return;
    }

    setBulkSaving(true);
    const saved: string[] = [];
    let latestDate: string | null = null;
    let failed = 0;

    for (const s of selectedScans) {
      try {
        const place = s.placeDropped
          ? null
          : (s.place ?? (await lookupScanPlace(s)));
        await registerExpense(
          s.draft,
          s.body,
          place,
          { useCurrentLocation: false, inputType: 'SMS' }
        );
        markSmsRegistered(s.id);
        saved.push(s.id);
        if (
          s.draft.paymentDate &&
          (latestDate == null || s.draft.paymentDate > latestDate)
        ) {
          latestDate = s.draft.paymentDate;
        }
      } catch (e) {
        console.warn('[sms] 선택 등록 실패', s.id, e);
        failed += 1;
      }
    }

    setRegisteredIds((prev) => [...prev, ...saved]);
    setBulkSaving(false);

    if (failed === 0) {
      Alert.alert('등록 완료', `${saved.length}건이 가계부에 추가되었어요.`, [
        {
          text: '확인',
          onPress: () =>
            router.replace({
              pathname: '/(tabs)/budget',
              params: { date: expenditureDateParam(latestDate ?? undefined) },
            }),
        },
      ]);
    } else {
      Alert.alert('일부 실패', `${saved.length}건 등록, ${failed}건 실패`);
    }
  };

  if (step === 'scan') {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1 }}
        >
          <View style={styles.topBar}>
            <TouchableOpacity
              onPress={() => setStep('input')}
              style={styles.iconBtn}
              hitSlop={HITSLOP}
            >
              <Ionicons name="chevron-back" size={22} color="#111827" />
            </TouchableOpacity>
            <Text style={styles.topTitle}>문자 자동 스캔</Text>
            <TouchableOpacity
              onPress={rescan}
              style={styles.iconBtn}
              hitSlop={HITSLOP}
              disabled={scanning}
            >
              <Ionicons name="refresh" size={20} color="#111827" />
            </TouchableOpacity>
          </View>

          <ScrollView
            contentContainerStyle={styles.scroll}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.sourceCard}>
              <View style={styles.sourceIcon}>
                <Ionicons name="scan-outline" size={20} color={ACCENT} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.sourceTitle}>문자 자동 스캔</Text>
                <Text style={styles.sourceMeta}>
                  결제 {scanItems.length}건 감지 · {selectedScans.length}건 선택됨
                </Text>
              </View>
              <View style={styles.aiBadge}>
                <Ionicons name="sparkles" size={11} color="#FFFFFF" />
                <Text style={styles.aiBadgeText}>AI</Text>
              </View>
            </View>

            <View style={styles.helperRow}>
              <Ionicons
                name="information-circle-outline"
                size={14}
                color="#6B7280"
              />
              <Text style={styles.helperText}>
                체크된 항목만 가계부에 등록됩니다. 잘못 인식된 항목은 카드를
                눌러 수정할 수 있어요.
              </Text>
            </View>

            {scanning && scanItems.length === 0 && (
              <View style={styles.placeholder}>
                <ActivityIndicator color={ACCENT} />
                <Text style={styles.placeholderText}>SMS를 읽어오는 중...</Text>
              </View>
            )}

            {!scanning && scanItems.length === 0 && (
              <View style={styles.placeholder}>
                <Ionicons
                  name="chatbox-ellipses-outline"
                  size={28}
                  color="#D1D5DB"
                />
                <Text style={styles.placeholderText}>감지된 거래가 없어요</Text>
              </View>
            )}

            <View style={{ gap: 10, marginTop: 12 }}>
              {scanItems.map((s) => (
                <ScanCard
                  key={s.id}
                  item={s}
                  onToggleInclude={() =>
                    updateScan(s.id, { include: !s.include })
                  }
                  onToggleExpand={() => toggleScanExpand(s)}
                  onPickPlace={() => setScanPickerFor(s.id)}
                  onChange={(patch) => updateScan(s.id, patch)}
                  onRemove={() => updateScan(s.id, { removed: true })}
                />
              ))}
            </View>

            <View style={{ height: 100 }} />
          </ScrollView>

          <View style={styles.bottomBar}>
            <View style={{ flex: 1 }}>
              <Text style={styles.bottomMeta}>
                선택 {selectedScans.length}건 · 합계
              </Text>
              <Text style={styles.bottomTotal}>
                {formatKRW(selectedScanTotal)}
              </Text>
            </View>
            <TouchableOpacity
              onPress={onRegisterSelected}
              disabled={bulkSaving || selectedScans.length === 0}
              style={[
                styles.saveBtn,
                (bulkSaving || selectedScans.length === 0) && {
                  opacity: 0.6,
                },
              ]}
            >
              {bulkSaving ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <>
                  <Ionicons
                    name="checkmark-circle"
                    size={16}
                    color="#FFFFFF"
                  />
                  <Text style={styles.saveBtnText}>
                    {selectedScans.length}건 등록
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>

        <PlacePicker
          visible={scanPickerFor !== null}
          storeName={scanPickerQuery}
          onConfirm={applyScanPlace}
          onOnlinePurchase={dropScanPlace}
          onSkip={dropScanPlace}
          onClose={() => setScanPickerFor(null)}
        />
      </SafeAreaView>
    );
  }

  const missing = draft ? missingRequiredFields(draft) : [];
  const features = Platform.OS === 'android' ? FEATURES : IOS_FEATURES;
  const selectedCategoryId =
    draft?.categoryId ?? enumCategoryId(categories, draft?.category);

  if (step === 'review' && draft) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1 }}
        >
          <View style={styles.topBar}>
            <TouchableOpacity
              onPress={clearResult}
              style={styles.iconBtn}
              hitSlop={HITSLOP}
            >
              <Ionicons name="chevron-back" size={22} color="#111827" />
            </TouchableOpacity>
            <Text style={styles.topTitle}>문자 검토</Text>
            <TouchableOpacity
              onPress={clearResult}
              style={styles.iconBtn}
              hitSlop={HITSLOP}
            >
              <Ionicons name="refresh" size={20} color="#111827" />
            </TouchableOpacity>
          </View>

          <ScrollView
            contentContainerStyle={styles.scroll}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.aiNotice}>
              <View style={styles.aiBadge}>
                <Ionicons name="sparkles" size={11} color="#FFFFFF" />
                <Text style={styles.aiBadgeText}>AI 분석</Text>
              </View>
              <Text style={styles.aiNoticeText}>
                잘못 인식된 부분은 직접 수정해주세요. 수정 내용은 자동분류
                학습에 반영됩니다.
              </Text>
            </View>

            {missing.length > 0 && (
              <View style={styles.warnNotice}>
                <Ionicons name="warning-outline" size={14} color="#B45309" />
                <Text style={styles.warnText}>
                  비어 있는 항목: {missing.join(', ')}
                </Text>
              </View>
            )}

            <View style={styles.card}>
              <Text style={styles.fieldLabel}>가맹점명</Text>
              <TextInput
                style={styles.input}
                value={draft.storeName ?? ''}
                onChangeText={(v) => updateDraft({ storeName: v || null })}
                onEndEditing={() => classifyStore(draft.storeName ?? '')}
                placeholder="가맹점명을 입력하세요"
                placeholderTextColor="#9CA3AF"
              />

              <Text style={[styles.fieldLabel, { marginTop: 14 }]}>결제일시</Text>
              <View style={styles.readonlyRow}>
                <Ionicons name="time-outline" size={16} color="#6B7280" />
                <Text style={styles.readonlyText}>
                  {formatPaymentDate(draft.paymentDate) ||
                    '결제일시를 인식하지 못했어요'}
                </Text>
              </View>

              <Text style={[styles.fieldLabel, { marginTop: 14 }]}>
                가맹점 위치
              </Text>
              <Pressable
                style={({ pressed }) => [
                  place ? styles.placeRow : styles.placeEmptyRow,
                  pressed && { opacity: 0.7 },
                ]}
                onPress={() => setPickerOpen(true)}
              >
                <Ionicons
                  name={place ? 'location' : 'location-outline'}
                  size={14}
                  color={place ? '#3B82F6' : '#9CA3AF'}
                />
                <Text
                  style={place ? styles.placeText : styles.placeEmptyText}
                  numberOfLines={2}
                >
                  {place
                    ? (place.address ?? '위치를 찾았어요')
                    : '위치가 지정되지 않았어요'}
                </Text>
                <Text style={styles.placeAction}>{place ? '변경' : '지정'}</Text>
              </Pressable>
            </View>

            <View style={styles.card}>
              <Text style={styles.cardLabel}>카테고리</Text>
              <CategoryPicker
                selectedId={selectedCategoryId}
                recommendedCategoryId={recommendedCategoryId}
                onSelect={(categoryId) => {
                  userEditedRef.current = true;
                  updateDraft({ categoryId });
                  setCategoryAutoApplied(false);
                  setUserEditedCategory(true);
                }}
              />
              {recommendedCategoryId != null && !userEditedCategory && (
                <Text style={styles.inputHint}>
                  {categoryAutoApplied
                    ? `선택 이력 ${matchedCount}회 · 자동 적용`
                    : `선택 이력 ${matchedCount}회 · 추천 카테고리를 확인해 주세요.`}
                </Text>
              )}
              {userEditedCategory && draft.categoryId !== recommendedCategoryId && (
                <View style={styles.feedbackBox}>
                  <Ionicons name="bulb-outline" size={14} color="#7C3AED" />
                  <Text style={styles.feedbackText}>
                    수정한 분류(
                    {categories.find((c) => c.categoryId === draft.categoryId)?.name}
                    )를 기억하고 같은 매장에 자동 적용해요.
                  </Text>
                </View>
              )}
            </View>

            <View style={[styles.card, styles.totalCard]}>
              <Text style={styles.totalLabel}>총 결제금액</Text>
              <TextInput
                style={styles.totalInput}
                value={draft.amount != null ? String(draft.amount) : ''}
                onChangeText={(v) =>
                  updateDraft({
                    amount:
                      v === ''
                        ? null
                        : parseInt(v.replace(/[^0-9]/g, ''), 10) || 0,
                  })
                }
                keyboardType="number-pad"
                placeholder="0"
                placeholderTextColor="#D1D5DB"
              />
              <Text style={styles.totalSuffix}>원</Text>
            </View>

            <View style={styles.card}>
              <Text style={styles.cardLabel}>메모 (선택)</Text>
              <TextInput
                style={[styles.input, styles.memoInput]}
                value={draft.memo ?? ''}
                onChangeText={(v) => updateDraft({ memo: v || null })}
                multiline
                placeholder="이 결제와 관련된 메모를 남겨두세요"
                placeholderTextColor="#9CA3AF"
                textAlignVertical="top"
              />
            </View>

            <View style={{ height: 100 }} />
          </ScrollView>

          <View style={styles.reviewBottomBar}>
            <TouchableOpacity
              onPress={onRegister}
              disabled={saving}
              style={[styles.reviewSaveBtn, saving && { opacity: 0.6 }]}
            >
              {saving ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <>
                  <Ionicons name="checkmark-circle" size={18} color="#FFFFFF" />
                  <Text style={styles.saveBtnText}>
                    {draft.amount ? `${formatKRW(draft.amount)} 등록` : '등록'}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>

        <PlacePicker
          visible={pickerOpen}
          storeName={pickerQuery}
          onConfirm={applyPlace}
          onOnlinePurchase={dropPlace}
          onSkip={dropPlace}
          onClose={() => setPickerOpen(false)}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.topBar}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.iconBtn}
          hitSlop={HITSLOP}
        >
          <Ionicons name="chevron-back" size={22} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.topTitle}>문자로 등록</Text>
        <View style={styles.iconBtn} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 20 }}>
        <Text style={styles.emptyTitle}>
          카드 결제 문자를 읽어 자동으로 입력해드려요
        </Text>
        <Text style={styles.emptySub}>
          카드 결제 문자를 입력하면 가맹점·금액·결제 일시를 채워드려요.
        </Text>

        <View style={styles.featureRow}>
          {features.map((f) => (
            <View key={f.label} style={styles.featureItem}>
              <View style={styles.featureIconWrap}>
                <Ionicons name={f.icon} size={18} color={ACCENT} />
              </View>
              <Text style={styles.featureLabel}>{f.label}</Text>
            </View>
          ))}
        </View>

        {Platform.OS === 'android' ? (
          <>
            <TouchableOpacity style={styles.bigPrimary} onPress={goScan}>
              <Ionicons name="scan-outline" size={20} color="#FFFFFF" />
              <Text style={styles.bigPrimaryText}>문자 자동 스캔</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.bigSecondary} onPress={openPaste}>
              <Ionicons name="clipboard-outline" size={20} color={ACCENT} />
              <Text style={styles.bigSecondaryText}>문자 텍스트로 등록</Text>
            </TouchableOpacity>
          </>
        ) : (
          <TouchableOpacity style={styles.bigPrimary} onPress={openPaste}>
            <Ionicons name="clipboard-outline" size={20} color="#FFFFFF" />
            <Text style={styles.bigPrimaryText}>문자 텍스트로 등록</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={styles.bigGhost}
          onPress={() => Linking.openURL('sms:')}
        >
          <Ionicons name="chatbox-outline" size={18} color="#6B7280" />
          <Text style={styles.bigGhostText}>문자 앱에서 가져오기</Text>
        </TouchableOpacity>

        <View style={styles.tipBox}>
          <Ionicons
            name="information-circle-outline"
            size={16}
            color="#6B7280"
          />
          <Text style={styles.tipBoxText}>
            카드사에서 받은 승인 문자를 그대로 붙여넣으면 가장 정확해요.
          </Text>
        </View>
      </ScrollView>

      <PasteSmsModal
        open={pasteOpen}
        value={pasteText}
        loading={loading}
        onChangeText={setPasteText}
        onClose={() => setPasteOpen(false)}
        onConfirm={() => {
          setInput(pasteText);
          setSourceSmsId(null);
          runParse(pasteText);
        }}
      />
    </SafeAreaView>
  );
}

function PasteSmsModal({
  open,
  value,
  loading,
  onChangeText,
  onClose,
  onConfirm,
}: {
  open: boolean;
  value: string;
  loading: boolean;
  onChangeText: (v: string) => void;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <Modal
      visible={open}
      transparent
      animationType="slide"
      onRequestClose={() => {
        if (!loading) onClose();
      }}
    >
      <View style={styles.modalBackdrop}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalCard}
        >
          <View style={styles.grabber} />
          <View style={styles.modalHead}>
            <Text style={styles.modalTitle}>결제 문자 붙여넣기</Text>
            <TouchableOpacity onPress={onClose} hitSlop={HITSLOP} disabled={loading}>
              <Ionicons name="close" size={22} color="#111827" />
            </TouchableOpacity>
          </View>
          <Text style={styles.modalSub}>
            카드사에서 받은 승인 문자를 그대로 붙여넣으면 가맹점·금액·결제 일시를
            찾아드려요.
          </Text>
          <TextInput
            multiline
            value={value}
            onChangeText={onChangeText}
            placeholder={
              '예)\n[Web발신]\n신한카드 승인\n홍*동님\n12,500원 일시불\n05/11 14:32\n스타벅스 강남R점'
            }
            placeholderTextColor="#9CA3AF"
            style={styles.modalInput}
            textAlignVertical="top"
          />
          <TouchableOpacity
            onPress={onConfirm}
            disabled={loading}
            style={[styles.modalConfirm, loading && { opacity: 0.6 }]}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <Ionicons name="sparkles" size={16} color="#FFFFFF" />
                <Text style={styles.modalConfirmText}>분석해서 채우기</Text>
              </>
            )}
          </TouchableOpacity>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

function ScanCard({
  item,
  onToggleInclude,
  onToggleExpand,
  onPickPlace,
  onChange,
  onRemove,
}: {
  item: ScanItem;
  onToggleInclude: () => void;
  onToggleExpand: () => void;
  onPickPlace: () => void;
  onChange: (patch: ScanEdit) => void;
  onRemove: () => void;
}) {
  const { categories } = useCategories();
  const { draft } = item;
  const ready = !item.parsing && !item.failed;
  const selectedCategoryId =
    draft.categoryId ?? enumCategoryId(categories, draft.category);
  const selectedCategory = categories.find(
    (c) => c.categoryId === selectedCategoryId
  );
  const cat = selectedCategory
    ? getCategoryByName(selectedCategory.name)
    : draft.category
      ? getCategory(draft.category.toLowerCase() as CategoryId)
      : null;
  const catLabel = selectedCategory?.name ?? cat?.label;
  const dateText = formatPaymentDate(draft.paymentDate);

  return (
    <View
      style={[
        styles.payCard,
        !item.include && { opacity: 0.5 },
        item.expanded && { borderColor: '#3B82F6' },
      ]}
    >
      <View style={styles.payHead}>
        <TouchableOpacity
          onPress={onToggleInclude}
          style={styles.checkbox}
          disabled={!ready || item.done}
        >
          {item.include ? (
            <View style={styles.checkboxOn}>
              <Ionicons name="checkmark" size={14} color="#FFFFFF" />
            </View>
          ) : (
            <View style={styles.checkboxOff} />
          )}
        </TouchableOpacity>

        <TouchableOpacity
          onPress={onToggleExpand}
          style={{ flex: 1 }}
          disabled={!ready || item.done}
        >
          <View style={styles.payRow}>
            <Text style={styles.payStore} numberOfLines={1}>
              {item.parsing
                ? '문자를 읽는 중...'
                : item.failed
                  ? '인식 실패'
                  : draft.storeName || '(가맹점명 없음)'}
            </Text>
            {ready && (
              <Text style={styles.payAmount}>
                {draft.amount != null ? formatKRW(draft.amount) : '-'}
              </Text>
            )}
          </View>

          {ready && (
            <View style={styles.tagRow}>
              {cat ? (
                <View
                  style={[styles.payTag, { backgroundColor: `${cat.color}1A` }]}
                >
                  <Ionicons name={cat.icon} size={11} color={cat.color} />
                  <Text style={[styles.payTagText, { color: cat.color }]}>
                    {catLabel}
                  </Text>
                </View>
              ) : (
                <View style={[styles.payTag, { backgroundColor: '#FFF7ED' }]}>
                  <Text style={[styles.payTagText, { color: '#D97706' }]}>
                    카테고리 없음
                  </Text>
                </View>
              )}
              {item.issuer && (
                <View style={styles.payTag}>
                  <Text style={styles.payTagText}>{item.issuer}</Text>
                </View>
              )}
              {item.done && (
                <View style={[styles.payTag, { backgroundColor: '#ECFDF5' }]}>
                  <Text style={[styles.payTagText, { color: '#059669' }]}>
                    등록됨
                  </Text>
                </View>
              )}
              {dateText && <Text style={styles.payTime}>{dateText}</Text>}
            </View>
          )}
          {ready && item.place?.address && (
            <View style={styles.addrRow}>
              <Ionicons name="location-outline" size={12} color="#9CA3AF" />
              <Text style={styles.addrText} numberOfLines={1}>
                {item.place.address}
              </Text>
            </View>
          )}
        </TouchableOpacity>

        {ready && !item.done && (
          <Ionicons
            name={item.expanded ? 'chevron-up' : 'chevron-down'}
            size={18}
            color="#9CA3AF"
          />
        )}
      </View>

      {item.expanded && (
        <View style={styles.expandBody}>
          <View style={{ marginBottom: 10 }}>
            <Text style={styles.fieldLabel}>가맹점명</Text>
            <TextInput
              style={styles.payInput}
              value={draft.storeName ?? ''}
              onChangeText={(v) => onChange({ storeName: v || null })}
              placeholder="가맹점명"
              placeholderTextColor="#9CA3AF"
            />
          </View>
          <View style={{ marginBottom: 10 }}>
            <Text style={styles.fieldLabel}>금액</Text>
            <TextInput
              style={styles.payInput}
              value={draft.amount != null ? String(draft.amount) : ''}
              onChangeText={(v) =>
                onChange({
                  amount:
                    v === ''
                      ? null
                      : parseInt(v.replace(/[^0-9]/g, ''), 10) || 0,
                })
              }
              keyboardType="number-pad"
              placeholder="0"
              placeholderTextColor="#9CA3AF"
            />
          </View>
          <View>
            <Text style={styles.fieldLabel}>카테고리</Text>
            <CategoryPicker
              compact
              selectedId={selectedCategoryId}
              onSelect={(categoryId) => onChange({ categoryId })}
            />
          </View>
          <View style={{ marginTop: 10 }}>
            <Text style={styles.fieldLabel}>메모</Text>
            <TextInput
              style={[
                styles.payInput,
                { minHeight: 60, textAlignVertical: 'top' },
              ]}
              value={draft.memo ?? ''}
              onChangeText={(v) => onChange({ memo: v || null })}
              placeholder="(선택)"
              placeholderTextColor="#9CA3AF"
              multiline
            />
          </View>

          <Pressable
            style={({ pressed }) => [
              item.place ? styles.placeRow : styles.placeEmptyRow,
              { marginTop: 10 },
              !item.place && { backgroundColor: '#FFFFFF' },
              pressed && { opacity: 0.7 },
            ]}
            onPress={onPickPlace}
            disabled={item.placeLoading}
          >
            {item.placeLoading ? (
              <ActivityIndicator size="small" color="#3B82F6" />
            ) : (
              <Ionicons
                name={item.place ? 'location' : 'location-outline'}
                size={13}
                color={item.place ? '#3B82F6' : '#9CA3AF'}
              />
            )}
            <Text
              style={item.place ? styles.placeText : styles.placeEmptyText}
              numberOfLines={2}
            >
              {item.placeLoading
                ? '위치를 찾는 중...'
                : item.place
                  ? (item.place.address ?? '위치를 찾았어요')
                  : '위치가 지정되지 않았어요'}
            </Text>
            {!item.placeLoading && (
              <Text style={styles.placeAction}>
                {item.place ? '변경' : '지정'}
              </Text>
            )}
          </Pressable>

          <TouchableOpacity onPress={onRemove} style={styles.removeRow}>
            <Ionicons name="trash-outline" size={14} color="#EF4444" />
            <Text style={styles.removeText}>이 문자 제외</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}


const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },

  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingVertical: 14,
    minHeight: 56,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  iconBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topTitle: { fontSize: 16, fontWeight: '700', color: '#111827' },

  scroll: { padding: 16, paddingBottom: 24 },


  bigPrimary: {
    flexDirection: 'row',
    gap: 10,
    backgroundColor: ACCENT,
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bigPrimaryText: { color: '#FFFFFF', fontWeight: '800', fontSize: 15 },

  bigSecondary: {
    flexDirection: 'row',
    gap: 10,
    backgroundColor: '#FFFBEB',
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
  },
  bigSecondaryText: { color: ACCENT, fontWeight: '800', fontSize: 15 },

  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#F3F4F6',
    marginTop: 12,
  },
  cardLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 12,
  },
  cardLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  cardSubLabel: { color: '#9CA3AF', fontSize: 12 },

  textarea: {
    height: 180,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    padding: 12,
    textAlignVertical: 'top',
    backgroundColor: '#F9FAFB',
    color: '#111827',
    fontSize: 13,
  },

  parseBtn: {
    flexDirection: 'row',
    gap: 8,
    backgroundColor: '#3B82F6',
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
  },

  fieldLabel: {
    fontSize: 11,
    color: '#6B7280',
    fontWeight: '600',
    marginBottom: 6,
  },
  catChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  input: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#111827',
  },

  warnBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    marginTop: 12,
  },
  warnText: { color: '#B45309', fontSize: 11, lineHeight: 16, flex: 1 },

  registerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#3B82F6',
    paddingVertical: 14,
    borderRadius: 14,
    marginTop: 12,
  },

  countRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 10,
  },

  helperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  helperText: { color: '#6B7280', fontSize: 11, flex: 1, lineHeight: 16 },
  payCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#F3F4F6',
    overflow: 'hidden',
  },
  payHead: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 10,
  },
  checkbox: { width: 24, height: 24 },
  checkboxOn: {
    width: 24,
    height: 24,
    borderRadius: 6,
    backgroundColor: '#3B82F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxOff: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: '#D1D5DB',
    backgroundColor: '#FFFFFF',
  },
  payRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  payStore: { color: '#111827', fontWeight: '700', fontSize: 14, flex: 1 },
  payAmount: {
    color: '#111827',
    fontWeight: '800',
    fontSize: 16,
    marginLeft: 8,
  },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 6,
    alignItems: 'center',
  },
  payTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  payTagText: { color: '#374151', fontSize: 11, fontWeight: '600' },
  payTime: { color: '#9CA3AF', fontSize: 11, marginLeft: 4 },
  addrRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 },
  addrText: { color: '#9CA3AF', fontSize: 11, flex: 1 },
  expandBody: {
    paddingHorizontal: 14,
    paddingTop: 6,
    paddingBottom: 14,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    backgroundColor: '#F9FAFB',
  },
  payInput: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#111827',
  },
  removeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-end',
    marginTop: 12,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  removeText: { color: '#EF4444', fontSize: 12, fontWeight: '700' },
  bottomBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 24,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    gap: 12,
  },
  bottomMeta: { color: '#6B7280', fontSize: 11 },
  bottomTotal: { color: '#111827', fontSize: 18, fontWeight: '800' },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#3B82F6',
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderRadius: 14,
  },
  saveBtnText: { color: '#FFFFFF', fontWeight: '800', fontSize: 14 },

  placeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#EFF6FF',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  placeText: { color: '#1D4ED8', fontSize: 11, flex: 1, lineHeight: 15 },
  placeEmptyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F9FAFB',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  placeEmptyText: { color: '#9CA3AF', fontSize: 11, flex: 1, lineHeight: 15 },
  placeAction: { color: '#3B82F6', fontSize: 11, fontWeight: '800' },
  placeholder: {
    backgroundColor: '#FFFFFF',
    padding: 32,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#F3F4F6',
    alignItems: 'center',
    marginBottom: 12,
  },
  placeholderText: { color: '#9CA3AF', fontSize: 13, marginTop: 8 },

  emptyTitle: { fontSize: 22, fontWeight: '800', color: '#111827', marginTop: 8 },
  emptySub: { color: '#6B7280', fontSize: 13, lineHeight: 20, marginTop: 8 },

  featureRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 24,
    marginBottom: 24,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  featureItem: { alignItems: 'center', flex: 1 },
  featureIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#FFFBEB',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  featureLabel: { color: '#374151', fontSize: 12, fontWeight: '600' },

  bigGhost: {
    flexDirection: 'row',
    gap: 10,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
  },
  bigGhostText: { color: '#374151', fontWeight: '700', fontSize: 14 },

  tipBox: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'flex-start',
    backgroundColor: '#F3F4F6',
    padding: 12,
    borderRadius: 12,
    marginTop: 16,
  },
  tipBoxText: { color: '#6B7280', fontSize: 12, lineHeight: 18, flex: 1 },

  aiNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
  },
  aiBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#7C3AED',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  aiBadgeText: { color: '#FFFFFF', fontSize: 10, fontWeight: '700' },
  aiNoticeText: { color: '#3730A3', fontSize: 11, lineHeight: 16, flex: 1 },

  warnNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    marginTop: 10,
  },

  readonlyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: 42,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#F9FAFB',
  },
  readonlyText: { color: '#111827', fontSize: 14, fontWeight: '600' },
  inputHint: { marginTop: 6, color: '#9CA3AF', fontSize: 11, lineHeight: 16 },
  memoInput: { minHeight: 60 },
  feedbackBox: {
    flexDirection: 'row',
    gap: 6,
    backgroundColor: '#F5F3FF',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    marginTop: 10,
    alignItems: 'center',
  },
  feedbackText: { color: '#6D28D9', fontSize: 11, flex: 1, lineHeight: 16 },
  sourceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#FFFFFF',
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  sourceIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#FFFBEB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sourceTitle: { color: '#111827', fontWeight: '700', fontSize: 14 },
  sourceMeta: { color: '#6B7280', fontSize: 12, marginTop: 2 },

  totalCard: { flexDirection: 'row', alignItems: 'center', paddingVertical: 18 },
  totalLabel: { color: '#6B7280', fontWeight: '600', fontSize: 13 },
  totalInput: {
    flex: 1,
    marginLeft: 12,
    fontSize: 22,
    fontWeight: '800',
    color: '#111827',
    textAlign: 'right',
  },
  totalSuffix: {
    color: '#111827',
    fontWeight: '700',
    fontSize: 16,
    marginLeft: 4,
  },

  reviewBottomBar: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 24,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  reviewSaveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#3B82F6',
    paddingVertical: 14,
    borderRadius: 14,
  },

  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingTop: 12,
    paddingBottom: 32,
  },
  grabber: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#D1D5DB',
    marginBottom: 20,
  },
  modalHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modalTitle: { fontSize: 16, fontWeight: '800', color: '#111827' },
  modalSub: { color: '#6B7280', fontSize: 12, marginTop: 6, lineHeight: 17 },
  modalInput: {
    marginTop: 14,
    minHeight: 180,
    maxHeight: 260,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    padding: 12,
    fontSize: 13,
    color: '#111827',
    backgroundColor: '#F9FAFB',
  },
  modalConfirm: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 14,
    backgroundColor: ACCENT,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalConfirmText: { color: '#FFFFFF', fontWeight: '800', fontSize: 14 },
});
