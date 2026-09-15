import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Linking,
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
  CATEGORIES,
  CategoryId,
  formatKRW,
  getCategory,
} from '../../constants/mockData';
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
import { Place } from '../../scripts/placeSearch';

const HITSLOP = { top: 12, bottom: 12, left: 12, right: 12 } as const;
const ACCENT = '#F59E0B';

type Step = 'input' | 'scan';

type Draft = {
  amount: number | null;
  storeName: string | null;
  paymentDate: string | null;
  category: string | null;
  memo: string | null;
};

type ScanEdit = {
  storeName?: string | null;
  amount?: number | null;
  category?: string | null;
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
  const [step, setStep] = useState<Step>('input');
  const [input, setInput] = useState('');
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
    try {
      const r = await smsToExpense(t);
      const found = r.data.storeName
        ? await resolveExpensePlace(r.data.storeName, t)
        : null;

      setPlace(found);
      setBaseName(r.data.storeName);
      setDraft({
        amount: r.data.amount,
        storeName: found?.placeName ?? r.data.storeName,
        paymentDate: r.data.paymentDate,
        category: r.data.category,
        memo: r.data.memo,
      });
    } catch (e: any) {
      Alert.alert('파싱 실패', e?.message ?? String(e));
    } finally {
      setLoading(false);
    }
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
        draft,
        input,
        placeDropped ? null : (place ?? undefined)
      );
      if (sourceSmsId) {
        markSmsRegistered(sourceSmsId);
        setRegisteredIds((prev) => [...prev, sourceSmsId]);
      }
      Alert.alert('등록 완료', '가계부에 추가되었어요.', [
        { text: '확인', onPress: () => router.back() },
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
      ...(found && { storeName: found.placeName }),
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
          { useCurrentLocation: false }
        );
        markSmsRegistered(s.id);
        saved.push(s.id);
      } catch (e) {
        console.warn('[sms] 선택 등록 실패', s.id, e);
        failed += 1;
      }
    }

    setRegisteredIds((prev) => [...prev, ...saved]);
    setBulkSaving(false);

    if (failed === 0) {
      Alert.alert('등록 완료', `${saved.length}건이 가계부에 추가되었어요.`, [
        { text: '확인', onPress: () => router.back() },
      ]);
    } else {
      Alert.alert('일부 실패', `${saved.length}건 등록, ${failed}건 실패`);
    }
  };

  // ─── scan ───
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
            <Text style={styles.heading}>감지된 거래</Text>

            <View style={styles.countRow}>
              <Text style={styles.countText}>총 {scanItems.length}건</Text>
              <Text style={styles.countText}>
                {selectedScans.length}건 선택됨
              </Text>
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

  // ─── input (default) ───
  const missing = draft ? missingRequiredFields(draft) : [];

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn} hitSlop={HITSLOP}>
          <Ionicons name="chevron-back" size={22} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.topTitle}>문자로 등록</Text>
        <View style={styles.iconBtn} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Text style={styles.heading}>문자 파싱</Text>
        <Text style={styles.subheading}>
          카드 결제 문자를 붙여넣으면 가맹점·금액·결제일시를 자동으로 채워드려요.
        </Text>

        <View style={styles.card}>
          <Text style={styles.cardLabel}>SMS 입력</Text>
          <TextInput
            style={styles.textarea}
            multiline
            placeholder="SMS 본문을 붙여넣어주세요"
            placeholderTextColor="#9CA3AF"
            value={input}
            onChangeText={setInput}
          />
        </View>

        {Platform.OS === 'android' && (
          <TouchableOpacity style={styles.bigPrimary} onPress={goScan}>
            <Ionicons name="scan-outline" size={20} color="#FFFFFF" />
            <Text style={styles.bigPrimaryText}>문자 자동 스캔</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={[
            styles.bigSecondary,
            Platform.OS !== 'android' && { marginTop: 12 },
          ]}
          onPress={() => Linking.openURL('sms:')}
        >
          <Ionicons name="chatbox-outline" size={20} color={ACCENT} />
          <Text style={styles.bigSecondaryText}>문자 앱에서 가져오기</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.parseBtn, loading && { opacity: 0.6 }]}
          onPress={() => runParse(input)}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <>
              <Ionicons name="sparkles" size={16} color="#FFFFFF" />
              <Text style={styles.parseBtnText}>거래 내역 파싱</Text>
            </>
          )}
        </TouchableOpacity>

        {draft && (
          <View style={styles.card}>
            <View style={styles.cardLabelRow}>
              <Text style={styles.cardLabel}>인식 결과</Text>
              <Pressable onPress={clearResult} hitSlop={HITSLOP}>
                <Text style={styles.clearText}>지우기</Text>
              </Pressable>
            </View>

            <FieldEditable
              label="결제금액"
              value={draft.amount != null ? String(draft.amount) : ''}
              onChange={(v) =>
                updateDraft({
                  amount: v === '' ? null : parseInt(v.replace(/[^0-9]/g, ''), 10) || 0,
                })
              }
              placeholder="0"
              keyboardType="number-pad"
            />
            <FieldEditable
              label="가게명"
              value={draft.storeName ?? ''}
              onChange={(v) => updateDraft({ storeName: v || null })}
              placeholder="가게명"
            />
            <FieldEditable
              label="결제일시"
              value={draft.paymentDate ?? ''}
              onChange={(v) => updateDraft({ paymentDate: v || null })}
              placeholder="YYYY-MM-DDTHH:mm:ss"
            />
            <View style={{ marginBottom: 12 }}>
              <Text style={styles.fieldLabel}>카테고리</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 8 }}
              >
                {CATEGORIES.map((c) => {
                  const active = draft.category?.toLowerCase() === c.id;
                  return (
                    <TouchableOpacity
                      key={c.id}
                      onPress={() =>
                        updateDraft({ category: c.id.toUpperCase() })
                      }
                      style={[
                        styles.catChip,
                        active && {
                          backgroundColor: `${c.color}1A`,
                          borderColor: c.color,
                        },
                      ]}
                    >
                      <Ionicons
                        name={c.icon}
                        size={14}
                        color={active ? c.color : '#6B7280'}
                      />
                      <Text
                        style={[
                          styles.catChipText,
                          active && { color: c.color, fontWeight: '700' },
                        ]}
                      >
                        {c.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
            <FieldEditable
              label="메모"
              value={draft.memo ?? ''}
              onChange={(v) => updateDraft({ memo: v || null })}
              placeholder="(선택)"
              multiline
            />

            <Pressable
              style={({ pressed }) => [
                place ? styles.placeRow : styles.placeEmptyRow,
                pressed && { opacity: 0.7 },
              ]}
              onPress={() => setPickerOpen(true)}
            >
              <Ionicons
                name={place ? 'location' : 'location-outline'}
                size={13}
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
              <Text style={styles.placeAction}>
                {place ? '변경' : '지정'}
              </Text>
            </Pressable>
          </View>
        )}

        {draft && missing.length > 0 && (
          <View style={styles.warnBox}>
            <Ionicons name="warning-outline" size={14} color="#B45309" />
            <Text style={styles.warnText}>
              비어 있는 항목: {missing.join(', ')}
            </Text>
          </View>
        )}

        {draft && (
          <TouchableOpacity
            style={[styles.registerBtn, saving && { opacity: 0.6 }]}
            onPress={onRegister}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <Ionicons name="checkmark-circle" size={18} color="#FFFFFF" />
                <Text style={styles.registerBtnText}>등록</Text>
              </>
            )}
          </TouchableOpacity>
        )}

        <View style={{ height: 24 }} />
      </ScrollView>

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
  const { draft } = item;
  const ready = !item.parsing && !item.failed;
  const cat = draft.category
    ? getCategory(draft.category.toLowerCase() as CategoryId)
    : null;
  const dateText = draft.paymentDate?.slice(5, 16).replace('T', ' ');

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
                    {cat.label}
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
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 6 }}
            >
              {CATEGORIES.map((c) => {
                const active = draft.category?.toLowerCase() === c.id;
                return (
                  <TouchableOpacity
                    key={c.id}
                    onPress={() => onChange({ category: c.id.toUpperCase() })}
                    style={[
                      styles.catChip,
                      { backgroundColor: '#FFFFFF' },
                      active && {
                        backgroundColor: `${c.color}1A`,
                        borderColor: c.color,
                      },
                    ]}
                  >
                    <Ionicons
                      name={c.icon}
                      size={12}
                      color={active ? c.color : '#6B7280'}
                    />
                    <Text
                      style={[
                        styles.catChipText,
                        active && { color: c.color, fontWeight: '700' },
                      ]}
                    >
                      {c.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
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

function FieldEditable({
  label,
  value,
  onChange,
  placeholder,
  multiline,
  keyboardType,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  multiline?: boolean;
  keyboardType?: 'default' | 'number-pad';
}) {
  return (
    <View style={{ marginBottom: 12 }}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        style={[
          styles.input,
          multiline && { minHeight: 60, textAlignVertical: 'top' },
        ]}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor="#9CA3AF"
        multiline={multiline}
        keyboardType={keyboardType ?? 'default'}
      />
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

  heading: { fontSize: 22, fontWeight: '800', color: '#111827', marginTop: 8 },
  subheading: { color: '#6B7280', fontSize: 13, lineHeight: 20, marginTop: 6, marginBottom: 16 },

  bigPrimary: {
    flexDirection: 'row',
    gap: 10,
    backgroundColor: ACCENT,
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
  },
  bigPrimaryText: { color: '#FFFFFF', fontWeight: '800', fontSize: 15 },

  bigSecondary: {
    flexDirection: 'row',
    gap: 10,
    backgroundColor: '#FEF3C7',
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
  clearText: { color: '#9CA3AF', fontSize: 13 },

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
  parseBtnText: { color: '#FFFFFF', fontWeight: '800', fontSize: 15 },

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
  catChipText: { color: '#6B7280', fontSize: 12, fontWeight: '600' },
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
  registerBtnText: { color: '#FFFFFF', fontWeight: '800', fontSize: 15 },

  countRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 10,
  },
  countText: { color: '#374151', fontSize: 13, fontWeight: '700' },

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
});
