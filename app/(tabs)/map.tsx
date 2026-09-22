import MapCanvas from "@/components/map/MapCanvas";
import MapControls from "@/components/map/MapControls";
import ModeTabs from "@/components/map/ModeTabs";
import RouteTimeline from "@/components/map/RouteTimeline";
import SelectedPinCard from "@/components/map/SelectedPinCard";
import SummaryOverlay from "@/components/map/SummaryOverlay";
import TimeRangeFilter from "@/components/map/TimeRangeFilter";
import TopStoreList from "@/components/map/TopStoreList";
import ZoneList from "@/components/map/ZoneList";
import { getTimeRange, Mode, TimeRangeId } from "@/constants/mapConfig";
import PlacePicker from "@/components/location/PlacePicker";
import StoreSheet from "@/components/map/StoreSheet";
import UnmappedSheet from "@/components/map/UnmappedSheet";
import { stripBranchName } from "@/scripts/locationPipeline";
import { LatLng } from "@/scripts/mapGeo";
import { markNoLocation } from "@/scripts/noLocationExpenses";
import { Place } from "@/scripts/placeSearch";
import {
  getMonthlyExpenditures,
  updateExpenditure,
} from "@/services/api/expenditureApi";
import {
  localDate,
  MapPin,
  MapZone,
  TopStore,
  UnmappedExpense,
  useMapData,
} from "@/scripts/useMapData";
import { Ionicons } from "@expo/vector-icons";
import { Calendar } from "react-native-calendars";
import { useFocusEffect } from "expo-router";
import React, { useCallback, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import MapView from "react-native-maps";
import { SafeAreaView } from "react-native-safe-area-context";

export default function MapScreen() {
  const [mode, setMode] = useState<Mode>("today");
  const [timeRange, setTimeRange] = useState<TimeRangeId>("all");
  const [selected, setSelected] = useState<MapPin | null>(null);
  const [dateKey, setDateKey] = useState(() => localDate(new Date()));
  const [pickerOpen, setPickerOpen] = useState(false);
  const [openedStore, setOpenedStore] = useState<TopStore | null>(null);
  const mapRef = useRef<MapView>(null);
  const scrollRef = useRef<ScrollView>(null);

  const {
    pins,
    route,
    zones,
    heatmapPoints,
    stores,
    unmapped,
    spentDates,
    summary,
    loading,
    reload,
  } = useMapData(mode, timeRange, dateKey);

  const [monthDots, setMonthDots] = useState<Record<string, string[]>>({});

  const loadMonthDots = useCallback(
    async (year: number, month: number) => {
      const key = `${year}-${String(month).padStart(2, "0")}`;
      if (monthDots[key]) return;
      try {
        const list = await getMonthlyExpenditures(year, month);
        const dates = list.dailyExpenditures.map((d) => d.date);
        setMonthDots((prev) => ({ ...prev, [key]: dates }));
      } catch (e) {
        console.warn("[map] 달력 소비 날짜 조회 실패", e);
      }
    },
    [monthDots]
  );

  const markedDates = useMemo(() => {
    const marks: Record<string, any> = {};
    const dates = [...spentDates, ...Object.values(monthDots).flat()];
    dates.forEach((date) => {
      marks[date] = { marked: true, dotColor: "#3B82F6" };
    });
    marks[dateKey] = {
      ...(marks[dateKey] ?? {}),
      selected: true,
      selectedColor: "#3B82F6",
    };
    return marks;
  }, [spentDates, monthDots, dateKey]);

  const focusedOnce = useRef(false);
  useFocusEffect(
    useCallback(() => {
      if (!focusedOnce.current) {
        focusedOnce.current = true;
        return;
      }
      reload();
    }, [reload])
  );

  const [editing, setEditing] = useState<{
    id: string;
    storeName: string;
    near?: LatLng;
  } | null>(null);
  const [saving, setSaving] = useState(false);
  const [unmappedOpen, setUnmappedOpen] = useState(false);

  const applyLocation = async (place: Place) => {
    if (!editing) return;

    setSaving(true);
    try {
      await updateExpenditure(Number(editing.id), {
        storeName: place.name,
        placeId: place.id,
        address: place.roadAddress || place.address,
        latitude: place.latitude,
        longitude: place.longitude,
      });
      setEditing(null);
      setSelected(null);
      reload();
    } catch (e) {
      Alert.alert(
        "저장 실패",
        (e as Error)?.message ?? "잠시 후 다시 시도해주세요."
      );
    } finally {
      setSaving(false);
    }
  };

  const [year, month, day] = dateKey.split("-").map(Number);
  const dateLabel = `${year}년 ${month}월 ${day}일`;
  const periodLabel =
    mode === "today" ? dateLabel : `${year}년 ${month}월 전체`;
  const topZone = zones.reduce<(typeof zones)[number] | null>(
    (best, z) => (best == null || z.visitCount > best.visitCount ? z : best),
    null
  );

  const onModeChange = (next: Mode) => {
    setMode(next);
    setSelected(null);
  };

  const onTimeRangeChange = (next: TimeRangeId) => {
    setTimeRange(next);
    setSelected(null);
  };

  const revealMap = () => scrollRef.current?.scrollTo({ y: 0, animated: true });


  const focusPin = (pin: MapPin) => {
    setSelected(pin);
    revealMap();
    mapRef.current?.animateToRegion(
      {
        latitude: pin.latitude,
        longitude: pin.longitude,
        latitudeDelta: 0.008,
        longitudeDelta: 0.008,
      },
      500
    );
  };

  const focusZone = (zone: MapZone) => {
    const delta = Math.max((zone.radiusMeters * 4) / 111000, 0.01);
    revealMap();
    mapRef.current?.animateToRegion(
      {
        latitude: zone.latitude,
        longitude: zone.longitude,
        latitudeDelta: delta,
        longitudeDelta: delta,
      },
      500
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <ScrollView ref={scrollRef} contentContainerStyle={styles.scroll}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.headerTitle}>지도</Text>
            <Text style={styles.headerSub}>
              {mode === "zones" && topZone
                ? `${periodLabel} · ${topZone.shortLabel} 일대`
                : periodLabel}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.iconBtn}
            onPress={() => setPickerOpen(true)}
          >
            <Ionicons name="calendar-outline" size={20} color="#374151" />
          </TouchableOpacity>
        </View>

        <ModeTabs mode={mode} onChange={onModeChange} />

        <TimeRangeFilter timeRange={timeRange} onChange={onTimeRangeChange} />

        <MapCanvas
          ref={mapRef}
          mode={mode}
          pins={pins}
          route={route}
          zones={zones}
          heatmapPoints={heatmapPoints}
          selectedId={selected?.id}
          onSelectPin={setSelected}
          layerRemountKey={`${mode}-${timeRange}`}
        >
          <MapControls mapRef={mapRef} />
          {loading && (
            <View style={styles.loadingPill}>
              <ActivityIndicator size="small" color="#3B82F6" />
              <Text style={styles.loadingText}>위치 확인 중</Text>
            </View>
          )}
          <SummaryOverlay
            mode={mode}
            summary={summary}
            zoneCount={zones.length}
            rangeLabel={getTimeRange(timeRange).label}
          />
        </MapCanvas>

        {unmapped.length > 0 && (
          <TouchableOpacity
            style={styles.unmappedBar}
            onPress={() => setUnmappedOpen(true)}
          >
            <Ionicons name="help-circle" size={16} color="#B45309" />
            <Text style={styles.unmappedText}>
              위치 미지정 {unmapped.length}건
            </Text>
            <Ionicons name="chevron-forward" size={15} color="#B45309" />
          </TouchableOpacity>
        )}

        {selected && (
          <SelectedPinCard
            pin={selected}
            onEditLocation={(pin) =>
              setEditing({
                id: pin.id,
                storeName: pin.storeName,
                near: { latitude: pin.latitude, longitude: pin.longitude },
              })
            }
          />
        )}

        {mode === "today" && (
          <RouteTimeline
            route={route}
            selectedId={selected?.id}
            onSelect={focusPin}
          />
        )}

        {mode === "zones" && <ZoneList zones={zones} onSelect={focusZone} />}

        <TopStoreList stores={stores} onSelect={setOpenedStore} />

        <View style={{ height: 24 }} />
      </ScrollView>

      <UnmappedSheet
        visible={unmappedOpen}
        items={unmapped}
        onSelect={(item: UnmappedExpense) => {
          setUnmappedOpen(false);
          setEditing({ id: item.id, storeName: item.storeName });
        }}
        onClose={() => setUnmappedOpen(false)}
      />

      <PlacePicker
        visible={editing !== null}
        busy={saving}
        storeName={stripBranchName(editing?.storeName ?? "")}
        near={editing?.near ?? null}
        rememberDefault={false}
        onConfirm={applyLocation}
        onOnlinePurchase={() => {
          if (editing) markNoLocation(editing.id);
          setEditing(null);
          reload();
        }}
        onSkip={() => setEditing(null)}
        onClose={() => setEditing(null)}
      />

      <StoreSheet
        store={openedStore}
        year={year}
        month={month}
        onClose={() => setOpenedStore(null)}
      />

      <Modal
        visible={pickerOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setPickerOpen(false)}
      >
        <Pressable
          style={styles.backdrop}
          onPress={() => setPickerOpen(false)}
        >
          <Pressable style={styles.sheet}>
            <Text style={styles.sheetTitle}>
              {mode === "today" ? "날짜 선택" : "기준 월 선택"}
            </Text>
            <Calendar
              current={dateKey}
              maxDate={localDate(new Date())}
              markedDates={markedDates}
              onMonthChange={(m: { year: number; month: number }) =>
                loadMonthDots(m.year, m.month)
              }
              onDayPress={(d: { dateString: string }) => {
                setDateKey(d.dateString);
                setSelected(null);
                setPickerOpen(false);
              }}
              theme={{
                todayTextColor: "#3B82F6",
                selectedDayBackgroundColor: "#3B82F6",
                arrowColor: "#374151",
                textDayFontWeight: "500",
                textMonthFontWeight: "700",
                textMonthFontSize: 17,
                textDayHeaderFontWeight: "600",
                textSectionTitleColor: "#6B7280",
              }}
              monthFormat={"yyyy년 MM월"}
            />
            <Text style={styles.sheetHint}>
              {mode === "today"
                ? "소비 동선은 선택한 날짜의 결제 순서로 표시됩니다."
                : "월 안의 날짜를 누르면 해당 월 전체 소비를 기준으로 표시됩니다."}
            </Text>
          </Pressable>
        </Pressable>
      </Modal>
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
  unmappedBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#FFFBEB",
    borderWidth: 1,
    borderColor: "#FDE68A",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
    marginTop: 12,
  },
  unmappedText: {
    flex: 1,
    color: "#B45309",
    fontSize: 12,
    fontWeight: "700",
  },
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(17,24,39,0.35)",
    justifyContent: "center",
    paddingHorizontal: 20,
  },
  sheet: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    paddingTop: 16,
    paddingBottom: 14,
    overflow: "hidden",
  },
  sheetTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#111827",
    paddingHorizontal: 20,
    marginBottom: 4,
  },
  sheetHint: {
    fontSize: 11,
    color: "#9CA3AF",
    paddingHorizontal: 20,
    marginTop: 8,
    lineHeight: 16,
  },
  loadingPill: {
    position: "absolute",
    top: 12,
    left: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(255,255,255,0.95)",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#F3F4F6",
  },
  loadingText: { fontSize: 11, color: "#374151", fontWeight: "700" },
});
