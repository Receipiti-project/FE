import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Pressable,
    ScrollView,
    StyleSheet,
    Text, TextInput,
    TouchableOpacity,
    View,
} from 'react-native';

const HITSLOP = { top: 12, bottom: 12, left: 12, right: 12 } as const;
import { SafeAreaView } from 'react-native-safe-area-context';
import { parseSms, hasAllRequired } from '../../scripts/smsLexer';
import { PipelineResult, smsToExpense } from '../../scripts/smsPipeline';
import { useSharedSms } from '../../scripts/useSharedSms';
import { Linking } from 'react-native';

const SAMPLES: Array<{ label: string; sms: string }> = [
  { label: '신한1', sms: '신한카드(1234)승인 홍*동\n12,345원(일시불)05/16 12:55 쿠팡\n누적123,456원' },
  { label: '신한2', sms: '[Web발신]\n신한카드(1234)승인 홍*동 12,345원\n(일시불)05/16 12:55 쿠팡\n누적123,456원' },
  { label: '신한3', sms: '신한 카드번호입력승인 홍길동님(1234) 05/16 12:55 12,345원 에스케이텔레콤' },
  { label: '삼성',  sms: '[Web발신]\n삼성1234승인 홍*동\n12,345원 일시불\n05/16 12:55 쿠팡\n누적123,456원' },
  { label: '현대1', sms: '[Web발신]\n현대ZERO승인 홍*동\n12,345원 일시불\n05/16 12:55\n쿠팡\n누적123,456원\n0.7% 할인' },
  { label: '현대2', sms: '[Web발신]\n[현대카드M2]-승인\n***님\n12,345원(일시불)\n쿠팡\n누적:123,456원' },
  { label: '현대3', sms: '[Web발신]\n[현대카드] 승인\n홍*동님\n05/16 12:55\n12,345원\n쿠팡' },
  { label: 'KB',    sms: '[Web발신]\nKB국민카드1*3*승인\n홍*동님\n12,345원 일시불\n05/16 12:55\n(주)우아한형제\n누적123,456원' },
];

export default function SmsTestScreen() {
  const [input, setInput] = useState('');
  const [regexResult, setRegexResult] = useState<ReturnType<typeof parseSms> | null>(null);
  const [pipe, setPipe] = useState<PipelineResult | null>(null);
  const [loading, setLoading] = useState(false);

  const runRegex = () => {
    const t = input.trim();
    if (!t) { Alert.alert('입력이 비어있어요'); return; }
    setRegexResult(parseSms(t));
    setPipe(null);
  };

  const runPipeline = async () => {
    const t = input.trim();
    if (!t) { Alert.alert('입력이 비어있어요'); return; }
    setLoading(true);
    setRegexResult(null);
    try {
      const r = await smsToExpense(t);
      setPipe(r);
    } catch (e: any) {
      Alert.alert('LLM 호출 실패', e?.message ?? String(e));
    } finally {
      setLoading(false);
    }
  };

  const pickSample = (sms: string) => {
    setInput(sms);
    setRegexResult(null);
    setPipe(null);
  };

  const data = pipe?.data ?? regexResult;

  useSharedSms((text) => {
    setInput(text);
    smsToExpense(text).then(setPipe).catch(e => Alert.alert('실패', e.message));
  });

  return (
    <SafeAreaView style={styles.container}>
      <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn} hitSlop={HITSLOP}>
        <Ionicons name="chevron-back" size={22} color="#111827" />
      </TouchableOpacity>

      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        <Text style={styles.title}>문자 파싱</Text>
        <Text style={styles.sub}>정규식 1차 + LLM fallback 파이프라인</Text>

        <View style={styles.card}>
          <Text style={styles.section}>SMS 입력</Text>
          <TextInput
            style={styles.textarea}
            multiline
            placeholder="SMS 본문을 붙여넣어주세요"
            placeholderTextColor="#aaa"
            value={input}
            onChangeText={setInput}
          />
        </View>

        <Pressable
          style={[styles.scanBtn, { backgroundColor: '#6B7280' }]}
          onPress={() => Linking.openURL('sms:')}
        >
          <Text style={styles.scanText}>📱 문자 앱에서 가져오기</Text>
        </Pressable>

        <View style={styles.card}>
          <View style={styles.rowBetween}>
            <Text style={styles.section}>샘플</Text>
            <Text style={styles.selectAll}>{SAMPLES.length}개</Text>
          </View>
          <View style={styles.chipRow}>
            {SAMPLES.map(s => (
              <Pressable key={s.label} style={styles.chip} onPress={() => pickSample(s.sms)}>
                <Text style={styles.chipText}>{s.label}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        <Pressable
          style={[styles.scanBtn, loading && { opacity: 0.6 }]}
          onPress={async () => {
            const t = input.trim();
            if (!t) { Alert.alert('입력이 비어 있어요'); return; }
            setLoading(true);
            try {
              const r = await smsToExpense(t);
              setPipe(r);
            } catch (e: any) {
              Alert.alert('파싱 실패', e?.message ?? String(e));
            } finally {
              setLoading(false);
            }
          }}
          disabled={loading}
        >
          {loading
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.scanText}>거래 내역 파싱</Text>}
        </Pressable>

        {pipe && (
          <View style={styles.totalBox}>
            <Text style={styles.totalLabel}>
              신뢰도: {pipe.confidence} · source: {pipe.source} · {pipe.elapsedMs}ms · llm={String(pipe.llmCalled)}
            </Text>
          </View>
        )}

        {data && (
          <View style={styles.card}>
            <Text style={styles.section}>결과</Text>
            <View style={{ height: 8 }} />
            <Row k="amount"      v={fmt(data.amount)} highlight />
            <Row k="storeName"   v={fmt(data.storeName)} />
            <Row k="paymentDate" v={fmt(data.paymentDate)} />
            <Row k="category"    v={fmt(data.category)} />
            <Row k="memo"        v={fmt(data.memo)} />
          </View>
        )}

        {pipe && !hasAllRequired(pipe.data) && (
          <View style={[styles.card, { backgroundColor: '#FFF4E5' }]}>
            <Text style={{ color: '#B45309', fontWeight: '600', marginBottom: 4 }}>
              ⚠️ 일부 항목이 비어 있어요
            </Text>
            <Text style={{ color: '#92400E', fontSize: 13 }}>
              {[
                pipe.data.amount == null && 'amount',
                !pipe.data.storeName    && 'storeName',
                !pipe.data.category     && 'category',
                !pipe.data.paymentDate  && 'paymentDate',
              ].filter(Boolean).join(', ')} 가 없어요.
              직접 입력 화면에서 채워주세요.
            </Text>
  </View>
)}

        {data?._raw && (
          <View style={styles.card}>
            <Text style={styles.section}>_raw tokens</Text>
            <View style={{ height: 8 }} />
            <Text style={styles.mono}>{JSON.stringify(data._raw, null, 2)}</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const fmt = (v: unknown): string => (v == null ? 'null' : String(v));

const Row = ({ k, v, highlight }: { k: string; v: string; highlight?: boolean }) => (
  <View style={kvStyles.row}>
    <Text style={kvStyles.k}>{k}</Text>
    <Text style={[kvStyles.v, highlight && kvStyles.vAccent]}>{v}</Text>
  </View>
);

const kvStyles = StyleSheet.create({
  row: { flexDirection: 'row', paddingVertical: 6 },
  k:   { width: 110, color: '#888' },
  v:   { flex: 1, color: '#333' },
  vAccent: { color: '#5B8CCB', fontWeight: '600' },
});

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: '#F7F8FA' },
  title:     { fontSize: 28, fontWeight: '700', textAlign: 'center', marginTop: 10 },
  sub:       { textAlign: 'center', color: '#777', marginTop: 10, marginBottom: 20 },

  section:   { fontSize: 18, fontWeight: '600' },
  selectAll: { color: '#5B8CCB' },
  rowBetween:{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },

  card: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 14,
    marginBottom: 12,
  },

  iconBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },

  textarea: {
    marginTop: 10,
    height: 200,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    padding: 12,
    textAlignVertical: 'top',
    color: '#333',
  },

  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    backgroundColor: '#ECEFF3',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
  },
  chipText: { color: '#333', fontSize: 13 },

  scanBtn: {
    backgroundColor: '#5B8CCB',
    padding: 18,
    borderRadius: 14,
    alignItems: 'center',
  },
  scanText: { color: '#fff', fontSize: 16, fontWeight: '600' },

  totalBox: {
    backgroundColor: '#ECEFF3',
    padding: 16,
    borderRadius: 14,
    alignItems: 'center',
    marginVertical: 12,
  },
  totalLabel: { color: '#555' },

  mono: { fontFamily: 'Menlo', fontSize: 12, color: '#333' },
});