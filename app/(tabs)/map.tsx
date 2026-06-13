import {
  ACTIVITY_ZONES,
  formatKRW,
  formatTime,
  getCategory,
  todayRoute,
  topStores,
  Transaction,
  TRANSACTIONS,
} from "@/constants/mockData";
import { Ionicons } from "@expo/vector-icons";
import React, { useMemo, useRef, useState } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import MapView, { Circle, Heatmap, Marker, Polyline, PROVIDER_GOOGLE } from "react-native-maps";
import { SafeAreaView } from "react-native-safe-area-context";

const MODES = [
  { id: "today", label: "오늘 동선" },
  { id: "heatmap", label: "히트맵" },
  { id: "zones", label: "생활권" },
] as const;
type Mode = (typeof MODES)[number]["id"];

const TIME_RANGES = [
  { id: "all", label: "전체", from: 0, to: 24 },
  { id: "morning", label: "오전", from: 6, to: 12 },
  { id: "afternoon", label: "오후", from: 12, to: 18 },
  { id: "evening", label: "저녁", from: 18, to: 24 },
] as const;
type TimeRangeId = (typeof TIME_RANGES)[number]["id"];

const INITIAL_REGION = {
  latitude: 37.530,
  longitude: 126.998,
  latitudeDelta: 0.13,
  longitudeDelta: 0.10,
};

const MAP_COORDS: Record<string, { latitude: number; longitude: number }> = {
  t1: { latitude: 37.5012, longitude: 127.0237 },
  t2: { latitude: 37.5703, longitude: 126.9770 },
  t3: { latitude: 37.5340, longitude: 127.0041 },
  t4: { latitude: 37.4979, longitude: 127.0276 },
  t5: { latitude: 37.5007, longitude: 127.0365 },
  t6: { latitude: 37.5296, longitude: 126.9649 },
  t7: { latitude: 37.5010, longitude: 127.0360 },
  t9: { latitude: 37.4990, longitude: 127.0275 },
};

const ZONE_COORDS = [
  { id: "gangnam",     label: "강남",  color: "#3B82F6", latitude: 37.5002, longitude: 127.0363, radiusMeters: 480 },
  { id: "gwanghwamun", label: "광화문", color: "#A855F7", latitude: 37.5703, longitude: 126.9768, radiusMeters: 320 },
  { id: "yongsan",     label: "용산",  color: "#10B981", latitude: 37.5296, longitude: 126.9651, radiusMeters: 180 },
];

export default function MapScreen() {
  const [mode, setMode] = useState<Mode>("today");
  const [selected, setSelected] = useState<Transaction | null>(null);
  const [timeRange, setTimeRange] = useState<TimeRangeId>("all");
  const [latitudeDelta, setLatitudeDelta] = useState(INITIAL_REGION.latitudeDelta);
  const mapRef = useRef<MapView>(null);

  const ZONE_LABEL_ZOOM_THRESHOLD = 0.05;
  const showZoneLabels = latitudeDelta < ZONE_LABEL_ZOOM_THRESHOLD;

  const route = todayRoute();
  const allPins = useMemo(
    () => TRANSACTIONS.filter((t) => t.location !== undefined),
    []
  );
  const activeRange = TIME_RANGES.find((t) => t.id === timeRange) ?? TIME_RANGES[0];
  const pins = useMemo(() => {
    const base = mode === "today" ? route : allPins;
    if (timeRange === "all") return base;
    return base.filter((t) => {
      const h = new Date(t.datetime).getHours();
      return h >= activeRange.from && h < activeRange.to;
    });
  }, [mode, timeRange, route, allPins, activeRange]);
  const stores = topStores(3);
  const dayTotal = route.reduce((s, t) => s + t.amount, 0);
  const distanceKm = 4.8; // mock 거리
  const movingMin = 42; // mock 이동시간
  const visiblePins =
    mode === "today" ? pins : allPins.filter((t) => {
      if (timeRange === "all") return true;
      const h = new Date(t.datetime).getHours();
      return h >= activeRange.from && h < activeRange.to;
    });

  const heatmapPoints = useMemo(() => {
    return allPins
      .filter((t) => {
        if (!MAP_COORDS[t.id]) return false;
        if (timeRange === "all") return true;
        const h = new Date(t.datetime).getHours();
        return h >= activeRange.from && h < activeRange.to;
      })
      .map((t) => ({
        latitude: MAP_COORDS[t.id].latitude,
        longitude: MAP_COORDS[t.id].longitude,
        weight: Math.log10(t.amount + 1),
      }));
  }, [allPins, timeRange, activeRange]);

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* 헤더 */}
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.headerTitle}>지도</Text>
            <Text style={styles.headerSub}>2026년 4월 30일 · 강남 일대</Text>
          </View>
          <TouchableOpacity style={styles.iconBtn}>
            <Ionicons name="options-outline" size={20} color="#374151" />
          </TouchableOpacity>
        </View>

        {/* 모드 탭 */}
        <View style={styles.modeRow}>
          {MODES.map((m) => {
            const active = m.id === mode;
            return (
              <TouchableOpacity
                key={m.id}
                onPress={() => {
                  setMode(m.id);
                  setSelected(null);
                }}
                style={[styles.modeChip, active && styles.modeChipActive]}
              >
                <Text
                  style={[
                    styles.modeChipText,
                    active && styles.modeChipTextActive,
                  ]}
                >
                  {m.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* 시간 필터 */}
        <View style={styles.timeRow}>
          <Ionicons name="time-outline" size={14} color="#6B7280" />
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 6, paddingRight: 8 }}
          >
            {TIME_RANGES.map((r) => {
              const active = r.id === timeRange;
              return (
                <TouchableOpacity
                  key={r.id}
                  onPress={() => setTimeRange(r.id)}
                  style={[
                    styles.timeChip,
                    active && styles.timeChipActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.timeChipText,
                      active && styles.timeChipTextActive,
                    ]}
                  >
                    {r.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
          <View style={styles.tzPill}>
            <Ionicons name="globe-outline" size={11} color="#374151" />
            <Text style={styles.tzText}>KST</Text>
          </View>
        </View>

        {/* 지도 영역 (mock) */}
        <View style={styles.mapWrap}>
          <MapView
            ref={mapRef}
            style={StyleSheet.absoluteFillObject}
            provider={PROVIDER_GOOGLE}
            initialRegion={INITIAL_REGION}
            onRegionChangeComplete={(region) => setLatitudeDelta(region.latitudeDelta)}
          >
            <React.Fragment key={`${mode}-${timeRange}`}>
            {mode !== "zones" &&
              pins.map((t, idx) => {
                const coords = MAP_COORDS[t.id];
                if (!coords) return null;
                const cat = getCategory(t.category);
                const isActive = selected?.id === t.id;
                return (
                  <Marker
                    key={t.id}
                    coordinate={coords}
                    onPress={() => setSelected(t)}
                    tracksViewChanges={false}
                  >
                    <View
                      style={[
                        styles.pinDot,
                        {
                          backgroundColor: cat.color,
                          transform: [{ scale: isActive ? 1.15 : 1 }],
                          borderColor: "#FFFFFF",
                          borderWidth: isActive ? 3 : 2,
                        },
                      ]}
                    >
                      {mode === "today" ? (
                        <Text style={styles.pinNum}>{idx + 1}</Text>
                      ) : (
                        <Ionicons name={cat.icon} size={12} color="#FFFFFF" />
                      )}
                    </View>
                  </Marker>
                );
              })}

            {mode === "today" && route.length >= 2 && (
              <>
                <Polyline
                  coordinates={route
                    .filter((t) => MAP_COORDS[t.id] !== undefined)
                    .map((t) => MAP_COORDS[t.id]!)}
                  strokeColor="#3B82F6"
                  strokeWidth={3}
                />
                {route.slice(0, -1).map((t, idx) => {
                  const a = MAP_COORDS[t.id];
                  const b = MAP_COORDS[route[idx + 1].id];
                  if (!a || !b) return null;
                  const midLat = (a.latitude + b.latitude) / 2;
                  const midLng = (a.longitude + b.longitude) / 2;
                  const bearing =
                    (Math.atan2(
                      b.longitude - a.longitude,
                      b.latitude - a.latitude
                    ) *
                      180) /
                    Math.PI;
                  return (
                    <Marker
                      key={`arrow-${idx}`}
                      coordinate={{ latitude: midLat, longitude: midLng }}
                      anchor={{ x: 0.5, y: 0.5 }}
                      tracksViewChanges={false}
                    >
                      <View style={{ transform: [{ rotate: `${bearing}deg` }] }}>
                        <Ionicons name="caret-up" size={22} color="#3B82F6" />
                      </View>
                    </Marker>
                  );
                })}
              </>
            )}

            {mode === "heatmap" && heatmapPoints.length > 0 && (
              <Heatmap
                points={heatmapPoints}
                radius={50}
                opacity={0.7}
                gradient={{
                  colors: ["#3B82F6", "#A855F7", "#F97316", "#EF4444"],
                  startPoints: [0.1, 0.3, 0.6, 0.9],
                  colorMapSize: 256,
                }}
              />
            )}

            {mode === "zones" &&
              ZONE_COORDS.map((z) => (
                <React.Fragment key={z.id}>
                  <Circle
                    center={{ latitude: z.latitude, longitude: z.longitude }}
                    radius={z.radiusMeters}
                    strokeColor={z.color}
                    strokeWidth={2}
                    fillColor={`${z.color}30`}
                  />
                  {showZoneLabels && (
                    <Marker
                      coordinate={{ latitude: z.latitude, longitude: z.longitude }}
                      anchor={{ x: 0.5, y: 0.5 }}
                    >
                      <View style={styles.zoneTag}>
                        <Text style={[styles.zoneTagText, { color: z.color }]}>
                          {z.label}
                        </Text>
                      </View>
                    </Marker>
                  )}
                </React.Fragment>
              ))}
            </React.Fragment>
          </MapView>

          <View style={styles.zoomCol}>
            <TouchableOpacity
              style={styles.zoomBtn}
              onPress={async () => {
                const cam = await mapRef.current?.getCamera();
                if (cam) mapRef.current?.animateCamera({ ...cam, zoom: (cam.zoom ?? 14) + 1 });
              }}
            >
              <Ionicons name="add" size={18} color="#374151" />
            </TouchableOpacity>
            <View style={styles.zoomDivider} />
            <TouchableOpacity
              style={styles.zoomBtn}
              onPress={async () => {
                const cam = await mapRef.current?.getCamera();
                if (cam) mapRef.current?.animateCamera({ ...cam, zoom: (cam.zoom ?? 14) - 1 });
              }}
            >
              <Ionicons name="remove" size={18} color="#374151" />
            </TouchableOpacity>
          </View>
          <TouchableOpacity
            style={styles.locateBtn}
            onPress={() => mapRef.current?.animateToRegion(INITIAL_REGION, 500)}
          >
            <Ionicons name="locate" size={18} color="#3B82F6" />
          </TouchableOpacity>

          {/* 모드별 요약 오버레이 */}
          <View style={styles.summaryOverlay}>
            {mode === "today" && (
              <>
                <View style={styles.summaryItem}>
                  <Ionicons name="walk-outline" size={14} color="#3B82F6" />
                  <Text style={styles.summaryText}>{distanceKm}km</Text>
                </View>
                <View style={styles.summaryDivider} />
                <View style={styles.summaryItem}>
                  <Ionicons name="time-outline" size={14} color="#3B82F6" />
                  <Text style={styles.summaryText}>{movingMin}분</Text>
                </View>
                <View style={styles.summaryDivider} />
                <View style={styles.summaryItem}>
                  <Ionicons name="card-outline" size={14} color="#3B82F6" />
                  <Text style={styles.summaryText}>{formatKRW(dayTotal)}</Text>
                </View>
              </>
            )}
            {mode === "heatmap" && (
              <View style={styles.summaryItem}>
                <Ionicons name="flame" size={14} color="#F97316" />
                <Text style={styles.summaryText}>
                  소비 {visiblePins.length}건 · {activeRange.label}
                </Text>
              </View>
            )}
            {mode === "zones" && (
              <View style={styles.summaryItem}>
                <Ionicons name="location" size={14} color="#3B82F6" />
                <Text style={styles.summaryText}>
                  생활권 {ACTIVITY_ZONES.length}곳 추적 중
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* 선택된 핀 디테일 */}
        {selected && selected.location && (
          <View style={styles.detailCard}>
            <View
              style={[
                styles.detailIcon,
                {
                  backgroundColor: `${getCategory(selected.category).color}1A`,
                },
              ]}
            >
              <Ionicons
                name={getCategory(selected.category).icon}
                size={20}
                color={getCategory(selected.category).color}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.detailStore}>{selected.store}</Text>
              <Text style={styles.detailMeta}>
                {formatTime(selected.datetime)} · {selected.location.address}
              </Text>
              {selected.memo && (
                <Text style={styles.detailMemo}>{selected.memo}</Text>
              )}
            </View>
            <Text style={styles.detailAmount}>{formatKRW(selected.amount)}</Text>
          </View>
        )}

        {/* 오늘 동선 타임라인 */}
        {mode === "today" && (
          <View style={styles.section}>
            <View style={styles.sectionHead}>
              <Text style={styles.sectionTitle}>오늘 소비 동선</Text>
              <Text style={styles.metaTinyLabel}>총 {route.length}개 지점</Text>
            </View>
            <View style={styles.timeline}>
              {route.map((t, idx) => {
                const cat = getCategory(t.category);
                const isLast = idx === route.length - 1;
                return (
                  <View key={t.id} style={styles.tlRow}>
                    <View style={styles.tlAxis}>
                      <View style={[styles.tlDot, { backgroundColor: cat.color }]}>
                        <Text style={styles.tlDotNum}>{idx + 1}</Text>
                      </View>
                      {!isLast && <View style={styles.tlLine} />}
                    </View>
                    <View style={styles.tlBody}>
                      <View style={styles.tlHead}>
                        <Text style={styles.tlTime}>
                          {formatTime(t.datetime)}
                        </Text>
                        <Text style={styles.tlAmount}>
                          {formatKRW(t.amount)}
                        </Text>
                      </View>
                      <Text style={styles.tlStore}>{t.store}</Text>
                      <Text style={styles.tlAddr}>
                        {t.location?.address ?? ""}
                      </Text>
                    </View>
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {/* 생활권 상세 */}
        {mode === "zones" && (
          <View style={styles.section}>
            <View style={styles.sectionHead}>
              <Text style={styles.sectionTitle}>나의 소비 생활권</Text>
              <Text style={styles.metaTinyLabel}>
                반경 기준 자동 그룹핑
              </Text>
            </View>
            <View style={{ gap: 10 }}>
              {ACTIVITY_ZONES.map((z) => (
                <View key={z.id} style={styles.zoneDetailCard}>
                  <View
                    style={[
                      styles.zoneDetailDot,
                      { backgroundColor: z.color },
                    ]}
                  />
                  <View style={{ flex: 1 }}>
                    <View style={styles.zoneDetailHead}>
                      <Text style={styles.zoneDetailLabel}>{z.label}</Text>
                      <Text style={styles.zoneDetailRole}>{z.role}</Text>
                    </View>
                    <Text style={styles.zoneDetailMeta}>
                      이번 달 {z.visitCount}회 방문 · {z.radius}
                    </Text>
                  </View>
                  <Text style={styles.zoneDetailAmount}>
                    {formatKRW(z.totalSpend)}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* 자주 가는 곳 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>자주 가는 곳</Text>
          <View style={styles.storeList}>
            {stores.map((s, i) => (
              <View
                key={s.store}
                style={[
                  styles.storeRow,
                  i === stores.length - 1 && { borderBottomWidth: 0 },
                ]}
              >
                <View style={styles.rankBadge}>
                  <Ionicons name="location" size={14} color="#3B82F6" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.storeName}>{s.store}</Text>
                  <Text style={styles.storeMeta}>
                    이번 달 {s.count}회 · 총 {formatKRW(s.total)}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color="#9CA3AF" />
              </View>
            ))}
          </View>
        </View>

        <View style={{ height: 24 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F9FAFB" },
  scroll: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 20 },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  headerTitle: { fontSize: 22, fontWeight: "700", color: "#111827" },
  headerSub: { fontSize: 12, color: "#6B7280", marginTop: 2 },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#F3F4F6",
  },
  modeRow: {
    flexDirection: "row",
    backgroundColor: "#F3F4F6",
    borderRadius: 12,
    padding: 4,
    marginBottom: 14,
  },
  modeChip: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: "center",
  },
  modeChipActive: { backgroundColor: "#FFFFFF" },
  modeChipText: { fontSize: 13, color: "#6B7280", fontWeight: "600" },
  modeChipTextActive: { color: "#111827", fontWeight: "700" },
  mapWrap: {
    height: 320,
    borderRadius: 20,
    overflow: "hidden",
    backgroundColor: "#E0F2FE",
    position: "relative",
    borderWidth: 1,
    borderColor: "#F3F4F6",
  },
  pinDot: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  pinNum: { color: "#FFFFFF", fontSize: 11, fontWeight: "800" },
  zoomCol: {
    position: "absolute",
    right: 12,
    top: 12,
    backgroundColor: "#FFFFFF",
    borderRadius: 10,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#F3F4F6",
  },
  zoomBtn: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  zoomDivider: { height: 1, backgroundColor: "#F3F4F6" },
  locateBtn: {
    position: "absolute",
    right: 12,
    bottom: 12,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#F3F4F6",
  },
  detailCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 14,
    marginTop: 12,
    borderWidth: 1,
    borderColor: "#F3F4F6",
    gap: 12,
  },
  detailIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  detailStore: { color: "#111827", fontWeight: "700", fontSize: 14 },
  detailMeta: { color: "#9CA3AF", fontSize: 11, marginTop: 2 },
  detailMemo: { color: "#6B7280", fontSize: 12, marginTop: 4 },
  detailAmount: { color: "#111827", fontWeight: "800", fontSize: 14 },
  section: { marginTop: 24 },
  sectionHead: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  sectionTitle: { fontSize: 15, fontWeight: "700", color: "#111827" },
  metaTinyLabel: { color: "#9CA3AF", fontSize: 11 },
  timeline: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#F3F4F6",
  },
  tlRow: { flexDirection: "row", gap: 12 },
  tlAxis: { width: 24, alignItems: "center" },
  tlDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1,
  },
  tlDotNum: { color: "#FFFFFF", fontWeight: "800", fontSize: 11 },
  tlLine: { width: 2, flex: 1, backgroundColor: "#E5E7EB", marginTop: 2 },
  tlBody: { flex: 1, paddingBottom: 16 },
  tlHead: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  tlTime: { color: "#6B7280", fontSize: 12, fontWeight: "600" },
  tlAmount: { color: "#111827", fontWeight: "700", fontSize: 13 },
  tlStore: { color: "#111827", fontWeight: "600", fontSize: 14, marginTop: 2 },
  tlAddr: { color: "#9CA3AF", fontSize: 11, marginTop: 2 },
  storeList: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#F3F4F6",
    overflow: "hidden",
  },
  storeRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
    gap: 12,
  },
  rankBadge: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: "#EFF6FF",
    alignItems: "center",
    justifyContent: "center",
  },
  storeName: { color: "#111827", fontWeight: "600", fontSize: 14 },
  storeMeta: { color: "#9CA3AF", fontSize: 11, marginTop: 2 },
  timeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
  },
  timeChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  timeChipActive: {
    backgroundColor: "#111827",
    borderColor: "#111827",
  },
  timeChipText: { color: "#6B7280", fontSize: 12, fontWeight: "600" },
  timeChipTextActive: { color: "#FFFFFF" },
  tzPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#F3F4F6",
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 999,
  },
  tzText: { color: "#374151", fontSize: 10, fontWeight: "700" },
  zoneTag: {
    backgroundColor: "rgba(255,255,255,0.92)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  zoneTagText: { fontSize: 11, fontWeight: "700" },
  summaryOverlay: {
    position: "absolute",
    left: 12,
    bottom: 12,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.95)",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    gap: 8,
    borderWidth: 1,
    borderColor: "#F3F4F6",
  },
  summaryItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  summaryText: { color: "#111827", fontSize: 12, fontWeight: "700" },
  summaryDivider: { width: 1, height: 12, backgroundColor: "#E5E7EB" },
  zoneDetailCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: "#F3F4F6",
    gap: 12,
  },
  zoneDetailDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  zoneDetailHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  zoneDetailLabel: { color: "#111827", fontWeight: "700", fontSize: 14 },
  zoneDetailRole: {
    color: "#6B7280",
    fontSize: 11,
    backgroundColor: "#F3F4F6",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    overflow: "hidden",
  },
  zoneDetailMeta: { color: "#9CA3AF", fontSize: 11, marginTop: 4 },
  zoneDetailAmount: { color: "#111827", fontWeight: "800", fontSize: 14 },
});
