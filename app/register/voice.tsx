import { Ionicons } from '@expo/vector-icons';
import {
  useAudioRecorder,
  AudioModule,
  RecordingPresets,
  setAudioModeAsync,
} from 'expo-audio';
import { formatKRW } from '../../constants/mockData';
import { processVoice } from '../../scripts/voicePipeline';
import {
  missingRequiredFields,
  registerExpense,
  resolveExpensePlace,
  ResolvedPlace,
} from '../../scripts/expenseRegister';
import { expenditureDateParam } from '../../services/api/expenditureApi';
import { formatPaymentDate } from '../../scripts/dateDisplay';
import {
  getCategoryRecommendation,
  resolveCategoryRecommendation,
} from '../../services/api/categoryApi';
import { useCategories } from '../../contexts/CategoryContext';
import { enumCategoryId } from '../../scripts/storeCategory';
import { CategoryPicker } from '../../components/category-picker';
import PlacePicker from '../../components/location/PlacePicker';
import { canonicalStoreName } from '../../scripts/locationPipeline';
import { Place } from '../../scripts/placeSearch';
import {
  Alert,
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useEffect, useRef, useState } from 'react';
import { router } from 'expo-router';

const HITSLOP = { top: 12, bottom: 12, left: 12, right: 12 } as const;
const ACCENT = '#EF4444';
const ACCENT_SOFT = '#FEF2F2';

const ANALYSIS_STEPS = [
  { id: 'stt', label: '음성 변환' },
  { id: 'parse', label: '지출 정보 추출' },
  { id: 'category', label: '카테고리 자동 분류' },
];

const FEATURES = [
  { icon: 'mic-outline', label: '음성 인식' },
  { icon: 'sparkles-outline', label: 'AI 분석' },
  { icon: 'create-outline', label: '수정 가능' },
] as const;

type Step = 'idle' | 'analyzing' | 'review';

type VoiceData = {
  amount: number | null;
  storeName: string | null;
  paymentDate: string | null;
  category: string | null;
  memo: string | null;
  categoryId: number | null;
};

const formatDuration = (seconds: number): string => {
  const mm = String(Math.floor(seconds / 60)).padStart(2, '0');
  const ss = String(seconds % 60).padStart(2, '0');
  return `${mm}:${ss}`;
};

export default function VoiceScreen() {
  const { categories } = useCategories();
  const [step, setStep] = useState<Step>('idle');
  const [recordingOpen, setRecordingOpen] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [analysisStep, setAnalysisStep] = useState(0);
  const [voiceData, setVoiceData] = useState<VoiceData | null>(null);
  const [recommendedCategoryId, setRecommendedCategoryId] = useState<number | null>(null);
  const [categoryAutoApplied, setCategoryAutoApplied] = useState(false);
  const [userEditedCategory, setUserEditedCategory] = useState(false);
  const [matchedCount, setMatchedCount] = useState(0);
  const [saving, setSaving] = useState(false);
  const [place, setPlace] = useState<ResolvedPlace | null>(null);
  const [placeDropped, setPlaceDropped] = useState(false);
  const [baseName, setBaseName] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [permissionGranted, setPermissionGranted] = useState(false);
  const audioRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const runRef = useRef(0);
  const classifyRunRef = useRef(0);
  const userEditedRef = useRef(false);

  useEffect(() => {
    let alive = true;

    (async () => {
      const { granted } = await AudioModule.requestRecordingPermissionsAsync();
      if (!alive) return;
      setPermissionGranted(granted);
      if (!granted) return;

      await setAudioModeAsync({
        allowsRecording: true,
        playsInSilentMode: true,
      });
    })().catch((e) => {
      if (alive) Alert.alert('녹음 준비 실패', e?.message ?? '잠시 후 다시 시도해주세요.');
    });

    return () => {
      alive = false;
    };
  }, [audioRecorder]);

  useEffect(
    () => () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (tickRef.current) clearInterval(tickRef.current);
    },
    []
  );

  const stopTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const reset = () => {
    runRef.current += 1;
    classifyRunRef.current += 1;
    userEditedRef.current = false;
    setStep('idle');
    setVoiceData(null);
    setPlace(null);
    setPlaceDropped(false);
    setBaseName(null);
    setRecommendedCategoryId(null);
    setCategoryAutoApplied(false);
    setUserEditedCategory(false);
    setMatchedCount(0);
    setAnalysisStep(0);
  };

  const startRecording = async () => {
    if (!permissionGranted) {
      Alert.alert('마이크 권한 필요', '설정에서 마이크 권한을 허용해주세요.');
      return;
    }

    try {
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await audioRecorder.prepareToRecordAsync();
      audioRecorder.record();
      setElapsed(0);
      setRecordingOpen(true);
      timerRef.current = setInterval(() => setElapsed((v) => v + 1), 1000);
    } catch (e: any) {
      Alert.alert('녹음 시작 실패', e?.message ?? '잠시 후 다시 시도해주세요.');
    }
  };

  const cancelRecording = async () => {
    stopTimer();
    setRecordingOpen(false);
    await audioRecorder.stop().catch(() => undefined);
  };

  const finishRecording = async () => {
    stopTimer();
    setRecordingOpen(false);
    reset();
    const runId = runRef.current;
    setStep('analyzing');

    if (tickRef.current) clearInterval(tickRef.current);
    tickRef.current = setInterval(() => {
      setAnalysisStep((p) => Math.min(p + 1, ANALYSIS_STEPS.length - 1));
    }, 700);

    try {
      await audioRecorder.stop();
      const uri = audioRecorder.uri;
      const file = { uri, name: 'audio.m4a', type: 'audio/m4a' };
      const pipe = await processVoice(file);
      const found = pipe.data.storeName
        ? await resolveExpensePlace(pipe.data.storeName)
        : null;

      if (tickRef.current) {
        clearInterval(tickRef.current);
        tickRef.current = null;
      }
      if (runId !== runRef.current) return;
      setAnalysisStep(ANALYSIS_STEPS.length - 1);

      const storeName =
        found && pipe.data.storeName
          ? canonicalStoreName(pipe.data.storeName, found.placeName)
          : pipe.data.storeName;
      setPlace(found);
      setBaseName(pipe.data.storeName);
      setVoiceData({
        amount: pipe.data.amount,
        storeName,
        paymentDate: pipe.data.paymentDate,
        category: pipe.data.category,
        memo: pipe.data.memo,
        categoryId: null,
      });
      setStep('review');
      if (storeName) void classifyStore(storeName);
    } catch (e: any) {
      if (tickRef.current) {
        clearInterval(tickRef.current);
        tickRef.current = null;
      }
      if (runId !== runRef.current) return;
      Alert.alert('분석 실패', e?.message ?? '다시 시도해주세요.', [
        { text: '확인', onPress: reset },
      ]);
      setStep('idle');
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

    setVoiceData((prev) =>
      prev ? { ...prev, categoryId: decision.selectedCategoryId } : prev
    );
    setCategoryAutoApplied(decision.selectedCategoryId != null);
  };

  const updateVoiceData = (patch: Partial<VoiceData>) => {
    setVoiceData((prev) => (prev ? { ...prev, ...patch } : prev));
  };

  const applyPlace = (picked: Place) => {
    if (voiceData?.storeName && voiceData.storeName !== place?.placeName) {
      setBaseName(voiceData.storeName);
    }
    setPlace({
      placeId: picked.id,
      placeName: picked.name,
      address: picked.roadAddress || picked.address,
      latitude: picked.latitude,
      longitude: picked.longitude,
    });
    updateVoiceData({ storeName: picked.name });
    setPlaceDropped(false);
    setPickerOpen(false);
  };

  const dropPlace = () => {
    if (baseName && voiceData?.storeName === place?.placeName) {
      updateVoiceData({ storeName: baseName });
    }
    setPlace(null);
    setPlaceDropped(true);
    setPickerOpen(false);
  };

  const missing = voiceData ? missingRequiredFields(voiceData) : [];

  const pickerQuery =
    voiceData?.storeName && voiceData.storeName !== place?.placeName
      ? voiceData.storeName
      : (baseName ?? voiceData?.storeName ?? '');

  const onRegister = async () => {
    if (!voiceData) return;

    if (missing.length > 0) {
      Alert.alert('입력 확인', `${missing.join(', ')}을(를) 채워주세요.`);
      return;
    }

    setSaving(true);
    try {
      await registerExpense(
        {
          ...voiceData,
          categoryId: userEditedCategory ? voiceData.categoryId : null,
          defaultCategoryId:
            !userEditedCategory && categoryAutoApplied ? voiceData.categoryId : null,
        },
        undefined,
        placeDropped ? null : (place ?? undefined),
        { inputType: 'VOICE' }
      );
      Alert.alert('등록 완료', '가계부에 추가되었어요.', [
        {
          text: '확인',
          onPress: () =>
            router.replace({
              pathname: '/(tabs)/budget',
              params: { date: expenditureDateParam(voiceData.paymentDate ?? undefined) },
            }),
        },
      ]);
    } catch (e) {
      Alert.alert('저장 실패', (e as Error)?.message ?? '잠시 후 다시 시도해주세요.');
    } finally {
      setSaving(false);
    }
  };

  if (step === 'idle') {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.topBar}>
          <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn} hitSlop={HITSLOP}>
            <Ionicons name="chevron-back" size={22} color="#111827" />
          </TouchableOpacity>
          <Text style={styles.topTitle}>음성으로 등록</Text>
          <View style={styles.iconBtn} />
        </View>

        <ScrollView contentContainerStyle={{ padding: 20 }}>
          <Text style={styles.emptyTitle}>
            지출 내역을 말하면 자동으로 입력해드려요
          </Text>
          <Text style={styles.emptySub}>
            음성을 텍스트로 변환하고 AI가 가맹점·금액·결제 일시를 추출해 자동으로
            입력합니다.
          </Text>

          <View style={styles.featureRow}>
            {FEATURES.map((f) => (
              <View key={f.label} style={styles.featureItem}>
                <View style={styles.featureIconWrap}>
                  <Ionicons name={f.icon} size={18} color={ACCENT} />
                </View>
                <Text style={styles.featureLabel}>{f.label}</Text>
              </View>
            ))}
          </View>

          <TouchableOpacity style={styles.bigPrimary} onPress={startRecording}>
            <Ionicons name="mic" size={20} color="#FFFFFF" />
            <Text style={styles.bigPrimaryText}>녹음 시작</Text>
          </TouchableOpacity>

          <View style={styles.tipBox}>
            <Ionicons name="information-circle-outline" size={16} color="#6B7280" />
            <Text style={styles.tipBoxText}>
              조용한 곳에서 가맹점 이름과 금액을 또박또박 말해주세요.
            </Text>
          </View>
        </ScrollView>

        <RecordingModal
          open={recordingOpen}
          elapsed={elapsed}
          onCancel={cancelRecording}
          onFinish={finishRecording}
        />
      </SafeAreaView>
    );
  }

  if (step === 'analyzing') {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.topBar}>
          <TouchableOpacity onPress={reset} style={styles.iconBtn} hitSlop={HITSLOP}>
            <Ionicons name="close" size={22} color="#111827" />
          </TouchableOpacity>
          <Text style={styles.topTitle}>분석 중</Text>
          <View style={styles.iconBtn} />
        </View>

        <View style={{ padding: 20, alignItems: 'center' }}>
          <View style={styles.analyzeCircle}>
            <ActivityIndicator color="#FFFFFF" size="large" />
          </View>
          <Text style={styles.analyzeHeading}>말씀하신 내용을 분석하고 있어요</Text>

          <View style={styles.stepList}>
            {ANALYSIS_STEPS.map((s, i) => {
              const done = i < analysisStep;
              const active = i === analysisStep;
              return (
                <View key={s.id} style={styles.stepRow}>
                  <View
                    style={[
                      styles.stepBadge,
                      done && { backgroundColor: '#10B981', borderColor: '#10B981' },
                      active && { backgroundColor: ACCENT, borderColor: ACCENT },
                    ]}
                  >
                    {done ? (
                      <Ionicons name="checkmark" size={14} color="#FFFFFF" />
                    ) : active ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <Text style={styles.stepBadgeNum}>{i + 1}</Text>
                    )}
                  </View>
                  <Text
                    style={[
                      styles.stepLabel,
                      (done || active) && { color: '#111827', fontWeight: '700' },
                    ]}
                  >
                    {s.label}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn} hitSlop={HITSLOP}>
          <Ionicons name="chevron-back" size={22} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.topTitle}>음성 검토</Text>
        <TouchableOpacity onPress={reset} style={styles.iconBtn} hitSlop={HITSLOP}>
          <Ionicons name="refresh" size={20} color="#111827" />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.aiNotice}>
          <View style={styles.aiBadge}>
            <Ionicons name="sparkles" size={11} color="#FFFFFF" />
            <Text style={styles.aiBadgeText}>AI 분석</Text>
          </View>
          <Text style={styles.aiNoticeText}>
            잘못 인식된 부분은 직접 수정해주세요. 수정 내용은 자동분류 학습에
            반영됩니다.
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
            value={voiceData?.storeName ?? ''}
            onChangeText={(v) => updateVoiceData({ storeName: v || null })}
            onEndEditing={() => classifyStore(voiceData?.storeName ?? '')}
            placeholder="가맹점명을 입력하세요"
            placeholderTextColor="#9CA3AF"
          />

          <Text style={[styles.fieldLabel, { marginTop: 14 }]}>결제일시</Text>
          <View style={styles.readonlyRow}>
            <Ionicons name="time-outline" size={16} color="#6B7280" />
            <Text style={styles.readonlyText}>
              {formatPaymentDate(voiceData?.paymentDate ?? null) ||
                '결제일시를 인식하지 못했어요'}
            </Text>
          </View>

          <Text style={[styles.fieldLabel, { marginTop: 14 }]}>가맹점 위치</Text>
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
              {place ? (place.address ?? '위치를 찾았어요') : '위치가 지정되지 않았어요'}
            </Text>
            <Text style={styles.placeAction}>{place ? '변경' : '지정'}</Text>
          </Pressable>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardLabel}>카테고리</Text>
          <CategoryPicker
            selectedId={
              voiceData?.categoryId ?? enumCategoryId(categories, voiceData?.category)
            }
            recommendedCategoryId={recommendedCategoryId}
            onSelect={(categoryId) => {
              userEditedRef.current = true;
              updateVoiceData({ categoryId });
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
          {userEditedCategory && voiceData?.categoryId !== recommendedCategoryId && (
            <View style={styles.feedbackBox}>
              <Ionicons name="bulb-outline" size={14} color="#7C3AED" />
              <Text style={styles.feedbackText}>
                수정한 분류(
                {categories.find((c) => c.categoryId === voiceData?.categoryId)?.name}
                )를 기억하고 같은 매장에 자동 적용해요.
              </Text>
            </View>
          )}
        </View>

        <View style={[styles.card, styles.totalCard]}>
          <Text style={styles.totalLabel}>총 결제금액</Text>
          <TextInput
            style={styles.totalInput}
            value={voiceData?.amount != null ? String(voiceData.amount) : ''}
            onChangeText={(v) =>
              updateVoiceData({
                amount: v === '' ? null : parseInt(v.replace(/[^0-9]/g, ''), 10) || 0,
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
            value={voiceData?.memo ?? ''}
            onChangeText={(v) => updateVoiceData({ memo: v || null })}
            multiline
            placeholder="이 결제와 관련된 메모를 남겨두세요"
            placeholderTextColor="#9CA3AF"
            textAlignVertical="top"
          />
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>

      <View style={styles.bottomBar}>
        <TouchableOpacity
          onPress={onRegister}
          disabled={saving}
          style={[styles.saveBtn, saving && { opacity: 0.6 }]}
        >
          {saving ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <>
              <Ionicons name="checkmark-circle" size={18} color="#FFFFFF" />
              <Text style={styles.saveBtnText}>
                {voiceData?.amount ? `${formatKRW(voiceData.amount)} 등록` : '등록'}
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

function RecordingModal({
  open,
  elapsed,
  onCancel,
  onFinish,
}: {
  open: boolean;
  elapsed: number;
  onCancel: () => void;
  onFinish: () => void;
}) {
  return (
    <Modal visible={open} transparent animationType="slide" onRequestClose={onCancel}>
      <View style={styles.modalBackdrop}>
        <View style={styles.modalCard}>
          <View style={styles.grabber} />
          <Text style={styles.modalTitle}>녹음 중</Text>
          <Text style={styles.modalSub}>
            가맹점 이름과 금액을 말한 뒤 완료를 눌러주세요.
          </Text>

          <View style={styles.micWrap}>
            <View style={styles.micCircle}>
              <Ionicons name="mic" size={44} color="#FFFFFF" />
            </View>
            <Text style={styles.timerText}>{formatDuration(elapsed)}</Text>
          </View>

          <View style={styles.modalFooter}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onCancel}>
              <Text style={styles.cancelBtnText}>취소</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.finishBtn} onPress={onFinish}>
              <Ionicons name="checkmark" size={18} color="#FFFFFF" />
              <Text style={styles.finishBtnText}>완료</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
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
    backgroundColor: ACCENT_SOFT,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  featureLabel: { color: '#374151', fontSize: 12, fontWeight: '600' },

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

  analyzeCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: ACCENT,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 24,
  },
  analyzeHeading: {
    marginTop: 20,
    fontSize: 17,
    fontWeight: '700',
    color: '#111827',
  },
  stepList: { width: '100%', marginTop: 20, gap: 12 },
  stepRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  stepBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  stepBadgeNum: { color: '#9CA3AF', fontSize: 12, fontWeight: '700' },
  stepLabel: { color: '#9CA3AF', fontSize: 14 },

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
  warnText: { color: '#B45309', fontSize: 11, lineHeight: 16, flex: 1 },

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
  fieldLabel: {
    fontSize: 11,
    color: '#6B7280',
    fontWeight: '600',
    marginBottom: 6,
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
  memoInput: { minHeight: 60 },
  inputHint: { marginTop: 6, color: '#9CA3AF', fontSize: 11, lineHeight: 16 },
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

  placeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#EFF6FF',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  placeText: { color: '#1D4ED8', fontSize: 12, flex: 1, lineHeight: 16 },
  placeEmptyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F9FAFB',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  placeEmptyText: { color: '#9CA3AF', fontSize: 12, flex: 1, lineHeight: 16 },
  placeAction: { color: '#3B82F6', fontSize: 11, fontWeight: '800' },

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

  bottomBar: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 24,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#3B82F6',
    paddingVertical: 14,
    borderRadius: 14,
  },
  saveBtnText: { color: '#FFFFFF', fontWeight: '800', fontSize: 15 },

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
  modalTitle: { fontSize: 16, fontWeight: '800', color: '#111827' },
  modalSub: { color: '#6B7280', fontSize: 12, marginTop: 6, lineHeight: 17 },
  micWrap: { alignItems: 'center', marginTop: 24, marginBottom: 24 },
  micCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: ACCENT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timerText: {
    marginTop: 16,
    fontSize: 24,
    fontWeight: '800',
    color: '#111827',
  },
  modalFooter: { flexDirection: 'row', gap: 8 },
  cancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  cancelBtnText: { color: '#374151', fontWeight: '700', fontSize: 14 },
  finishBtn: {
    flex: 1,
    flexDirection: 'row',
    gap: 6,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: ACCENT,
  },
  finishBtnText: { color: '#FFFFFF', fontWeight: '800', fontSize: 14 },
});
