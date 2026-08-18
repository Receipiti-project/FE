import React, { useState, useMemo, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Pressable,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { Calendar } from "react-native-calendars";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useFocusEffect } from "expo-router";
import { formatKRW, getCategory } from "@/constants/mockData";
import { useExpenditures, formatTimeReal } from "@/hooks/useExpenditures";

const BLUE = "#3B82F6";

const INPUT_METHODS = [
  { icon: "receipt-outline" as const, label: "영수증", route: "/register/receipt" as const, bg: "#EFF6FF", fg: "#3B82F6" },
  { icon: "image-outline" as const,   label: "캡처",   route: "/register/capture" as const, bg: "#F5F3FF", fg: "#7C3AED" },
  { icon: "mic-outline" as const,     label: "음성",   route: "/register/voice"   as const, bg: "#FEF2F2", fg: "#EF4444" },
  { icon: "chatbox-outline" as const, label: "문자",   route: "/register/sms"     as const, bg: "#FFFBEB", fg: "#F59E0B" },
  { icon: "create-outline" as const,  label: "직접",   route: "/register/manual"  as const, bg: "#F0FDF4", fg: "#10B981" },
];

function localDateStr(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function formatSelectedDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  const todayStr = localDateStr();
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yStr = localDateStr(yesterday);

  if (dateStr === todayStr) return "오늘";
  if (dateStr === yStr) return "어제";

  return `${d.getMonth() + 1}월 ${d.getDate()}일`;
}

export default function LedgerScreen() {
  const today = localDateStr();
  const [selected, setSelected] = useState(today);
  const [showModal, setShowModal] = useState(false);

  const { loading, allItems, refetch } = useExpenditures();

  // 화면 포커스될 때마다 최신 데이터 가져오기 
  useFocusEffect(
    useCallback(() => {
      refetch();
    }, [refetch])
  );

  // 거래 있는 날짜에 dot 표시 
  const markedDates = useMemo(() => {
    const marks: Record<string, any> = {};
    allItems.forEach((item) => {
      const date = localDateStr(new Date(item.datetime)); // UTC → 로컬 날짜
      if (!marks[date]) marks[date] = { marked: true, dotColor: BLUE };
    });
    marks[selected] = {
      ...(marks[selected] ?? {}),
      selected: true,
      selectedColor: BLUE,
    };
    return marks;
  }, [allItems, selected]);

  // 선택 날짜 거래 필터 
  const dayItems = useMemo(
    () => allItems.filter((item) => localDateStr(new Date(item.datetime)) === selected),
    [allItems, selected]
  );

  const dayTotal = dayItems.reduce((s, i) => s + i.amount, 0);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>가계부</Text>
        <TouchableOpacity onPress={() => setShowModal(true)}>
          <Ionicons name="add-circle" size={32} color={BLUE} />
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        <Calendar
          markedDates={markedDates}
          onDayPress={(day: any) => setSelected(day.dateString)}
          theme={{
            todayTextColor: BLUE,
            arrowColor: "#374151",
            textDayFontWeight: "500",
            textMonthFontWeight: "700",
            textMonthFontSize: 17,
            textDayHeaderFontWeight: "600",
            textSectionTitleColor: "#6B7280",
          }}
          monthFormat={"yyyy년 MM월"}
        />

        {/* 날짜별 거래 목록 */}
        <View style={styles.daySection}>
          <View style={styles.daySectionHead}>
            <Text style={styles.daySectionDate}>{formatSelectedDate(selected)}</Text>
            {dayItems.length > 0 && (
              <Text style={styles.daySectionTotal}>- {formatKRW(dayTotal)}</Text>
            )}
          </View>

          {loading ? (
            <View style={styles.centerBox}>
              <ActivityIndicator color={BLUE} />
            </View>
          ) : dayItems.length === 0 ? (
            <View style={styles.centerBox}>
              <Ionicons name="receipt-outline" size={36} color="#D1D5DB" />
              <Text style={styles.emptyText}>이 날의 지출이 없어요</Text>
              <TouchableOpacity
                style={styles.addBtn}
                onPress={() => setShowModal(true)}
              >
                <Ionicons name="add" size={14} color={BLUE} />
                <Text style={styles.addBtnText}>지출 추가</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.txList}>
              {dayItems.map((item, idx) => {
                const cat = getCategory(item.category);
                const isLast = idx === dayItems.length - 1;
                return (
                  <TouchableOpacity
                    key={item.id}
                    style={[styles.txRow, isLast && { borderBottomWidth: 0 }]}
                    onPress={() => {
                      if (item.expenditureId) {
                        router.push(`/expenditure/${item.expenditureId}` as any);
                      }
                    }}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.txIcon, { backgroundColor: `${cat.color}1A` }]}>
                      <Ionicons name={cat.icon} size={18} color={cat.color} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.txStore} numberOfLines={1}>
                        {item.store || "—"}
                      </Text>
                      <Text style={styles.txMeta}>
                        {formatTimeReal(item.datetime)} · {cat.label}
                        {item.memo ? ` · ${item.memo}` : ""}
                      </Text>
                    </View>
                    <View style={styles.txRight}>
                      <Text style={styles.txAmount}>{formatKRW(item.amount)}</Text>
                      <Ionicons name="chevron-forward" size={14} color="#D1D5DB" />
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </View>

        <View style={{ height: 32 }} />
      </ScrollView>

      {/* 지출 등록 모달 */}
      <Modal
        visible={showModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowModal(false)}
      >
        <Pressable style={styles.overlay} onPress={() => setShowModal(false)}>
          <Pressable style={styles.bottomSheet} onPress={() => {}}>
            <View style={styles.handle} />
            <Text style={styles.sheetTitle}>지출 등록</Text>
            <Text style={styles.sheetSub}>
              원하는 방식으로 결제 정보를 추가하세요
            </Text>
            <View style={styles.methodGrid}>
              {INPUT_METHODS.map((m) => (
                <TouchableOpacity
                  key={m.label}
                  style={styles.methodItem}
                  onPress={() => {
                    setShowModal(false);
                    router.push(m.route);
                  }}
                >
                  <View style={[styles.methodIcon, { backgroundColor: m.bg }]}>
                    <Ionicons name={m.icon} size={26} color={m.fg} />
                  </View>
                  <Text style={styles.methodLabel}>{m.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FFFFFF" },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
  },
  headerTitle: { fontSize: 22, fontWeight: "700", color: "#111827" },

  daySection: { paddingHorizontal: 20, paddingTop: 16 },
  daySectionHead: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  daySectionDate: { fontSize: 16, fontWeight: "700", color: "#111827" },
  daySectionTotal: { fontSize: 16, fontWeight: "700", color: "#EF4444" },

  centerBox: { alignItems: "center", paddingVertical: 32, gap: 8 },
  emptyText: { color: "#9CA3AF", fontSize: 13 },
  addBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 4,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: BLUE,
  },
  addBtnText: { color: BLUE, fontSize: 12, fontWeight: "600" },

  txList: {
    backgroundColor: "#F9FAFB",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#F3F4F6",
    overflow: "hidden",
  },
  txRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
    gap: 12,
    backgroundColor: "#FFFFFF",
  },
  txIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  txStore: { color: "#111827", fontWeight: "600", fontSize: 14 },
  txMeta: { color: "#9CA3AF", fontSize: 11, marginTop: 2 },
  txAmount: { color: "#111827", fontWeight: "700", fontSize: 14 },
  txRight: { flexDirection: "row", alignItems: "center", gap: 4 },

  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "flex-end",
  },
  bottomSheet: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 24,
    paddingBottom: 40,
    paddingTop: 12,
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: "#D1D5DB",
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 20,
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 4,
    textAlign: "center",
  },
  sheetSub: {
    fontSize: 12,
    color: "#9CA3AF",
    marginBottom: 22,
    textAlign: "center",
  },
  methodGrid: { flexDirection: "row", justifyContent: "space-between" },
  methodItem: { alignItems: "center", width: "18%" },
  methodIcon: {
    width: 56,
    height: 56,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  methodLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#374151",
    textAlign: "center",
  },
});