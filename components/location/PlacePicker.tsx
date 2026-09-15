import { getLocationHint } from '@/scripts/currentLocation';
import { confirmLocation, hasBranchToken } from '@/scripts/locationPipeline';
import { haversineKm, LatLng } from '@/scripts/mapGeo';
import { Place, searchPlaces } from '@/scripts/placeSearch';
import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
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

type Props = {
  visible: boolean;
  storeName: string;
  near?: LatLng | null;
  rememberDefault?: boolean;
  busy?: boolean;
  initialCandidates?: Place[];
  suggested?: Place | null;
  onConfirm: (place: Place) => void;
  onOnlinePurchase: () => void;
  onSkip: () => void;
  onClose: () => void;
};

const formatMeters = (m: number): string =>
  m < 1000 ? `${Math.round(m)}m` : `${(m / 1000).toFixed(1)}km`;

function topicParticle(word: string): string {
  const code = word.trim().slice(-1).charCodeAt(0) - 0xac00;
  if (Number.isNaN(code) || code < 0 || code > 11171) return '은(는)';
  return code % 28 === 0 ? '는' : '은';
}

function distanceLabel(
  place: Place,
  gps: LatLng | null,
  near: LatLng | null
): string | null {
  if (near) return formatMeters(haversineKm(near, place) * 1000);
  if (place.distanceMeters != null) return formatMeters(place.distanceMeters);
  if (!gps) return null;
  return formatMeters(haversineKm(gps, place) * 1000);
}

export default function PlacePicker({
  visible,
  storeName,
  near = null,
  rememberDefault = false,
  busy = false,
  initialCandidates = [],
  suggested = null,
  onConfirm,
  onOnlinePurchase,
  onSkip,
  onClose,
}: Props) {
  const [query, setQuery] = useState(storeName);
  const [places, setPlaces] = useState<Place[]>(initialCandidates);
  const [totalCount, setTotalCount] = useState(initialCandidates.length);
  const [selectedId, setSelectedId] = useState<string | null>(
    suggested?.id ?? initialCandidates[0]?.id ?? null
  );
  const [loading, setLoading] = useState(false);
  const [gps, setGps] = useState<LatLng | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [remember, setRemember] = useState(false);
  const requestRef = useRef(0);
  const initialRef = useRef({
    initialCandidates,
    suggested,
    near,
    rememberDefault,
  });
  initialRef.current = { initialCandidates, suggested, near, rememberDefault };

  const branchFixed = hasBranchToken(storeName);

  const search = async (q: string, center: LatLng | null) => {
    const term = q.trim();
    if (!term) return;
    const requestId = ++requestRef.current;
    setLoading(true);
    setError(null);
    try {
      const result = await searchPlaces(term, center ?? undefined);
      if (requestId !== requestRef.current) return;
      const origin = initialRef.current.near;
      const sorted = origin
        ? [...result.places].sort(
            (a, b) => haversineKm(origin, a) - haversineKm(origin, b)
          )
        : result.places;
      setPlaces(sorted);
      setTotalCount(result.totalCount);
      setSelectedId(sorted[0]?.id ?? null);
      if (sorted.length === 0) {
        setError('기준 위치 20km 안에서 찾지 못했어요. 이름을 바꿔 다시 검색해보세요');
      }
    } catch (e: any) {
      if (requestId !== requestRef.current) return;
      setError(e?.message ?? '검색에 실패했어요');
    } finally {
      if (requestId === requestRef.current) setLoading(false);
    }
  };

  useEffect(() => {
    if (!visible) return;

    const {
      initialCandidates: candidates,
      suggested: pick,
      near: origin,
      rememberDefault: rememberOn,
    } = initialRef.current;

    let alive = true;
    requestRef.current += 1;
    setQuery(storeName);
    setPlaces(candidates);
    setTotalCount(candidates.length);
    setSelectedId(pick?.id ?? candidates[0]?.id ?? null);
    setError(null);
    setLoading(false);
    setRemember(rememberOn);

    getLocationHint().then((hint) => {
      if (!alive) return;
      setGps(hint);
      if (candidates.length === 0 && storeName.trim()) {
        search(storeName, origin ?? hint);
      }
    });
    return () => {
      alive = false;
    };
  }, [visible, storeName]);

  const selected = places.find((p) => p.id === selectedId) ?? null;

  const confirm = () => {
    if (!selected) return;
    if (branchFixed || remember) confirmLocation(storeName, selected);
    onConfirm(selected);
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={() => {
        if (!busy) onClose();
      }}
    >
      <KeyboardAvoidingView
        style={styles.backdrop}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title}>위치 선택</Text>
            <TouchableOpacity onPress={onClose} hitSlop={12} disabled={busy}>
              <Ionicons name="close" size={22} color="#6B7280" />
            </TouchableOpacity>
          </View>

          <View style={styles.searchRow}>
            <TextInput
              style={styles.searchInput}
              value={query}
              onChangeText={setQuery}
              placeholder="가맹점명을 고쳐서 다시 찾아보세요"
              placeholderTextColor="#9CA3AF"
              returnKeyType="search"
              onSubmitEditing={() => search(query, near ?? gps)}
            />
            <TouchableOpacity
              style={styles.searchBtn}
              onPress={() => search(query, near ?? gps)}
              disabled={loading}
            >
              <Ionicons name="search" size={16} color="#FFFFFF" />
            </TouchableOpacity>
          </View>

          <Text style={styles.metaLine}>
            {totalCount > places.length
              ? `${totalCount.toLocaleString()}곳 중 ${places.length}곳`
              : `${places.length}곳`}
            {near ? ' · 기존 위치에서 가까운 순' : gps ? ' · 가까운 순' : ''}
          </Text>

          {loading && <ActivityIndicator style={{ marginTop: 20 }} color="#3B82F6" />}
          {error && <Text style={styles.errorText}>{error}</Text>}

          <ScrollView style={styles.list} contentContainerStyle={{ gap: 8 }}>
            {places.map((place) => {
              const active = place.id === selectedId;
              const distance = distanceLabel(place, gps, near);
              return (
                <Pressable
                  key={place.id}
                  style={[styles.card, active && styles.cardActive]}
                  onPress={() => setSelectedId(place.id)}
                >
                  <View style={[styles.radio, active && styles.radioActive]}>
                    {active && <View style={styles.radioDot} />}
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={styles.cardHead}>
                      <Text style={styles.placeName} numberOfLines={1}>
                        {place.name}
                      </Text>
                      {distance && (
                        <Text style={styles.distance}>{distance}</Text>
                      )}
                    </View>
                    <Text style={styles.address} numberOfLines={1}>
                      {place.roadAddress || place.address}
                    </Text>
                    {!!place.categoryName && (
                      <Text style={styles.category} numberOfLines={1}>
                        {place.categoryName.split('>').pop()?.trim()}
                      </Text>
                    )}
                  </View>
                </Pressable>
              );
            })}
          </ScrollView>

          {branchFixed ? (
            <Text style={styles.hint}>
              다음부터 이 가게는 자동으로 등록돼요
            </Text>
          ) : (
            <Pressable
              style={styles.rememberRow}
              onPress={() => setRemember((v) => !v)}
              hitSlop={8}
            >
              <View
                style={[styles.checkbox, remember && styles.checkboxOn]}
              >
                {remember && (
                  <Ionicons name="checkmark" size={13} color="#FFFFFF" />
                )}
              </View>
              <Text style={styles.rememberText}>
                다음부터 &apos;{storeName}&apos;{topicParticle(storeName)} 자동으로 여기로
              </Text>
            </Pressable>
          )}

          <TouchableOpacity
            style={styles.onlineBtn}
            onPress={onOnlinePurchase}
            disabled={busy}
          >
            <Ionicons name="globe-outline" size={15} color="#6B7280" />
            <Text style={styles.onlineBtnText}>온라인 구매였어요</Text>
          </TouchableOpacity>

          <View style={styles.footer}>
            <TouchableOpacity
              style={styles.skipBtn}
              onPress={onSkip}
              disabled={busy}
            >
              <Text style={styles.skipBtnText}>위치 없이 저장</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.confirmBtn,
                (!selected || busy) && styles.confirmBtnOff,
              ]}
              onPress={confirm}
              disabled={!selected || busy}
            >
              {busy ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.confirmBtnText}>이 위치로</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(17,24,39,0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#F9FAFB',
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 24,
    height: '88%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  title: { fontSize: 17, fontWeight: '700', color: '#111827' },
  searchRow: { flexDirection: 'row', gap: 8 },
  searchInput: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#111827',
  },
  searchBtn: {
    width: 44,
    borderRadius: 10,
    backgroundColor: '#111827',
    alignItems: 'center',
    justifyContent: 'center',
  },
  metaLine: { fontSize: 11, color: '#9CA3AF', marginTop: 10, marginBottom: 8 },
  errorText: { fontSize: 12, color: '#EF4444', marginTop: 10 },
  list: { flex: 1 },
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  cardActive: { borderColor: '#111827', borderWidth: 2 },
  radio: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: '#D1D5DB',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  radioActive: { borderColor: '#111827' },
  radioDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#111827',
  },
  cardHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  placeName: { flex: 1, fontSize: 14, fontWeight: '700', color: '#111827' },
  distance: { fontSize: 11, color: '#3B82F6', fontWeight: '700' },
  address: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  category: { fontSize: 11, color: '#9CA3AF', marginTop: 2 },
  hint: { fontSize: 11, color: '#9CA3AF', marginTop: 12, textAlign: 'center' },
  rememberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 12,
  },
  checkbox: {
    width: 19,
    height: 19,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: '#D1D5DB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxOn: { backgroundColor: '#111827', borderColor: '#111827' },
  rememberText: { fontSize: 12, color: '#374151', fontWeight: '600' },
  onlineBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    marginTop: 8,
  },
  onlineBtnText: { fontSize: 13, color: '#6B7280', fontWeight: '600' },
  footer: { flexDirection: 'row', gap: 8, marginTop: 4 },
  skipBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 12,
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  skipBtnText: { color: '#374151', fontWeight: '600', fontSize: 14 },
  confirmBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 12,
    alignItems: 'center',
    backgroundColor: '#111827',
  },
  confirmBtnOff: { backgroundColor: '#D1D5DB' },
  confirmBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 14 },
});
