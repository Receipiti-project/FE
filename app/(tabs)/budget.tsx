import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Pressable,
} from "react-native";
import { Calendar } from "react-native-calendars";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";

const BLUE = "#3B82F6";

const INPUT_METHODS = [
  { icon: "receipt-outline" as const, label: "영수증", route: "/register/receipt" as const, bg: "#EFF6FF", fg: "#3B82F6" },
  { icon: "image-outline" as const, label: "캡처", route: "/register/capture" as const, bg: "#F5F3FF", fg: "#7C3AED" },
  { icon: "mic-outline" as const, label: "음성", route: "/register/voice" as const, bg: "#FEF2F2", fg: "#EF4444" },
  { icon: "chatbox-outline" as const, label: "문자", route: "/register/sms" as const, bg: "#FFFBEB", fg: "#F59E0B" },
  { icon: "create-outline" as const, label: "직접", route: "/register/manual" as const, bg: "#F0FDF4", fg: "#10B981" },
];

export default function LedgerScreen() {
  const today = new Date().toISOString().split("T")[0];
  const [selected, setSelected] = useState(today);
  const [showModal, setShowModal] = useState(false);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>가계부</Text>
        <TouchableOpacity onPress={() => setShowModal(true)}>
          <Ionicons name="add-circle" size={32} color={BLUE} />
        </TouchableOpacity>
      </View>

      <Calendar
        markedDates={{
          [selected]: { selected: true, selectedColor: BLUE },
        }}
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
  methodGrid: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  methodItem: {
    alignItems: "center",
    width: "18%",
  },
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