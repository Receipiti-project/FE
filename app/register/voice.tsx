import { Ionicons } from '@expo/vector-icons';
import {
  useAudioRecorder,
  AudioModule,
  RecordingPresets,
  setAudioModeAsync,
} from 'expo-audio';
import {
  CATEGORIES,
  formatCurrency,
  formatCurrencyAmount,
} from '../../constants/mockData';
import { processVoice } from '../../scripts/voicePipeline';
import {
  missingRequiredFields,
  registerExpense,
  resolveExpensePlace,
  ResolvedPlace,
} from '../../scripts/expenseRegister';
import { formatIsoToKorean } from '../../services/api/expenditureApi';
import PlacePicker from '../../components/location/PlacePicker';
import { Place } from '../../scripts/placeSearch';
import {
  Alert,
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState, useEffect } from 'react';
import { router } from 'expo-router';

const HITSLOP = { top: 12, bottom: 12, left: 12, right: 12 } as const;
const ACCENT = '#EF4444';
const CURRENCY_OPTIONS = ['KRW', 'USD', 'EUR', 'JPY'] as const;
type Currency = (typeof CURRENCY_OPTIONS)[number];

function normalizeCurrency(value?: string | null): Currency {
  const normalized = value?.toUpperCase();
  return CURRENCY_OPTIONS.includes(normalized as Currency)
    ? (normalized as Currency)
    : 'KRW';
}

type VoiceData = {
  amount: number | null;
  storeName: string | null;
  paymentDate: string | null;
  category: string | null;
  memo: string | null;
  currency: Currency;
};

export default function VoiceScreen() {
  const [recording, setRecording] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [voiceData, setVoiceData] = useState<VoiceData | null>(null);
  const [errMsg, setErrMsg] = useState('');
  const [saving, setSaving] = useState(false);
  const [place, setPlace] = useState<ResolvedPlace | null>(null);
  const [placeDropped, setPlaceDropped] = useState(false);
  const [baseName, setBaseName] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [permissionGranted, setPermissionGranted] = useState(false);
  const audioRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);

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
      await audioRecorder.prepareToRecordAsync();
    })().catch((e) => {
      if (alive) setErrMsg(e?.message ?? '녹음을 준비하지 못했어요');
    });

    return () => {
      alive = false;
    };
  }, [audioRecorder]);

  const handleMic = async () => {
    if (recording) {
      setRecording(false);
      setProcessing(true);
      setVoiceData(null);
      setPlace(null);
      setPlaceDropped(false);
      setErrMsg('');
      try {
        await audioRecorder.stop();
        const uri = audioRecorder.uri;
        const file = { uri, name: 'audio.m4a', type: 'audio/m4a' };
        const pipe = await processVoice(file);
        const found = pipe.data.storeName
          ? await resolveExpensePlace(pipe.data.storeName)
          : null;

        setPlace(found);
        setBaseName(pipe.data.storeName);
        setVoiceData({
          ...(pipe.data as VoiceData),
          storeName: found?.placeName ?? pipe.data.storeName,
          currency: normalizeCurrency(pipe.data.currency),
        });
        await audioRecorder.prepareToRecordAsync();
      } catch (e: any) {
        setErrMsg(e?.message ?? '인식 실패');
      } finally {
        setProcessing(false);
      }
    } else {
      if (!permissionGranted) {
        setErrMsg('마이크 권한이 필요해요');
        return;
      }
      try {
        setVoiceData(null);
        setPlace(null);
        setPlaceDropped(false);
        setErrMsg('');
        await setAudioModeAsync({
          allowsRecording: true,
          playsInSilentMode: true,
        });
        audioRecorder.record();
        setRecording(true);
      } catch (e: any) {
        setErrMsg(e?.message ?? '녹음을 시작할 수 없어요');
      }
    }
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
        voiceData,
        undefined,
        placeDropped ? null : (place ?? undefined),
        { inputType: 'VOICE' }
      );
      Alert.alert('등록 완료', '가계부에 추가되었어요.', [
        { text: '확인', onPress: () => router.back() },
      ]);
    } catch (e) {
      Alert.alert('저장 실패', (e as Error)?.message ?? '잠시 후 다시 시도해주세요.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn} hitSlop={HITSLOP}>
          <Ionicons name="chevron-back" size={22} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.topTitle}>음성으로 등록</Text>
        <View style={styles.iconBtn} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.heading}>음성 입력</Text>
        <Text style={styles.subheading}>
          마이크 버튼을 눌러 지출 정보를 말해주세요
        </Text>

        <View style={styles.micCard}>
          <Pressable
            style={[
              styles.mic,
              recording && styles.micRecording,
              processing && { opacity: 0.6 },
            ]}
            onPress={handleMic}
            disabled={processing}
          >
            {processing ? (
              <ActivityIndicator color="#FFFFFF" size="large" />
            ) : (
              <Ionicons
                name={recording ? 'stop' : 'mic'}
                size={48}
                color="#FFFFFF"
              />
            )}
          </Pressable>
          <Text style={styles.status}>
            {recording
              ? '녹음 중... 탭해서 중지'
              : processing
                ? 'AI가 처리 중...'
                : '탭해서 시작'}
          </Text>
        </View>

        {errMsg !== '' && (
          <View style={styles.errorBox}>
            <Ionicons name="alert-circle-outline" size={14} color="#B91C1C" />
            <Text style={styles.errorText}>{errMsg}</Text>
          </View>
        )}

        {voiceData && (
          <View style={styles.card}>
            <Text style={styles.cardLabel}>인식 결과</Text>
            <View style={styles.fieldBlock}>
              <Text style={styles.fieldLabel}>결제금액</Text>
              <TextInput
                style={styles.input}
                value={
                  voiceData.amount != null
                    ? formatCurrencyAmount(voiceData.amount, voiceData.currency)
                    : ''
                }
                onChangeText={(value) => {
                  const digits = value.replace(/[^0-9]/g, '');
                  updateVoiceData({ amount: digits ? Number(digits) : null });
                }}
                placeholder="0"
                placeholderTextColor="#9CA3AF"
                keyboardType="number-pad"
              />
              <View style={styles.currencyRow}>
                {CURRENCY_OPTIONS.map((currency) => {
                  const active = voiceData.currency === currency;
                  return (
                    <TouchableOpacity
                      key={currency}
                      onPress={() => updateVoiceData({ currency })}
                      style={[styles.currencyChip, active && styles.currencyChipActive]}
                    >
                      <Text
                        style={[
                          styles.currencyText,
                          active && styles.currencyTextActive,
                        ]}
                      >
                        {currency}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              {voiceData.amount != null && voiceData.amount > 0 && (
                <Text style={styles.amountPreview}>
                  {formatCurrency(voiceData.amount, voiceData.currency)}
                </Text>
              )}
            </View>
            <FieldEditable
              label="가게명"
              value={voiceData.storeName ?? ''}
              onChange={(v) => updateVoiceData({ storeName: v || null })}
              placeholder="가게명"
            />
            <View style={styles.fieldBlock}>
              <Text style={styles.fieldLabel}>결제일시</Text>
              <View style={styles.paymentDateRow}>
                <Ionicons name="time-outline" size={17} color="#6B7280" />
                <Text style={styles.paymentDateText}>
                  {voiceData.paymentDate
                    ? formatIsoToKorean(voiceData.paymentDate)
                    : '결제일시를 인식하지 못했어요'}
                </Text>
              </View>
            </View>
            <View style={{ marginBottom: 12 }}>
              <Text style={styles.fieldLabel}>카테고리</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 8 }}
              >
                {CATEGORIES.map((c) => {
                  const active = voiceData.category?.toLowerCase() === c.id;
                  return (
                    <TouchableOpacity
                      key={c.id}
                      onPress={() =>
                        updateVoiceData({ category: c.id.toUpperCase() })
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
              value={voiceData.memo ?? ''}
              onChange={(v) => updateVoiceData({ memo: v || null })}
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

        {missing.length > 0 && (
          <View style={styles.warnBox}>
            <Ionicons name="warning-outline" size={14} color="#B45309" />
            <Text style={styles.warnText}>
              비어 있는 항목: {missing.join(', ')}
              {'\n'}위 칸에서 채워주세요.
            </Text>
          </View>
        )}

        {voiceData && (
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
  subheading: { color: '#6B7280', fontSize: 13, lineHeight: 20, marginTop: 6 },

  micCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#F3F4F6',
    paddingVertical: 32,
    alignItems: 'center',
    marginTop: 20,
  },
  mic: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: ACCENT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  micRecording: {
    backgroundColor: '#6B7280',
  },
  status: {
    color: '#6B7280',
    fontSize: 13,
    marginTop: 18,
    fontWeight: '600',
  },

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
  fieldBlock: { marginBottom: 12 },
  currencyRow: {
    flexDirection: 'row',
    gap: 6,
    flexWrap: 'wrap',
    marginTop: 8,
  },
  currencyChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  currencyChipActive: {
    backgroundColor: '#EFF6FF',
    borderColor: '#3B82F6',
  },
  currencyText: { color: '#6B7280', fontSize: 12, fontWeight: '600' },
  currencyTextActive: { color: '#3B82F6', fontWeight: '700' },
  amountPreview: {
    textAlign: 'right',
    color: '#3B82F6',
    fontWeight: '700',
    fontSize: 13,
    marginTop: 6,
  },
  paymentDateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: 44,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#F9FAFB',
  },
  paymentDateText: {
    color: '#111827',
    fontSize: 14,
    fontWeight: '600',
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

  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    marginTop: 12,
  },
  errorText: { color: '#B91C1C', fontSize: 12, flex: 1 },

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
    marginTop: 10,
  },
  warnText: { color: '#B45309', fontSize: 11, lineHeight: 16, flex: 1 },

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
});
