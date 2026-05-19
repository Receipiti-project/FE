import React from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";

type InputMethodId = "receipt" | "capture" | "voice" | "sms" | "manual";

type InputMethod = {
  id: InputMethodId;
  title: string;
  description: string;
  icon: keyof typeof import("@expo/vector-icons").Ionicons.glyphMap;
  route:
    | "/register/receipt"
    | "/register/capture"
    | "/register/voice"
    | "/register/sms"
    | "/register/manual";
  tone: string;
  badge?: { label: string; color: string; bg: string };
  comingSoon?: boolean;
};

const PRIMARY_METHODS: InputMethod[] = [
  {
    id: "receipt",
    title: "영수증 OCR",
    description: "사진 한 장으로 가맹점·품목·총액까지 자동 인식",
    icon: "scan-outline",
    route: "/register/receipt",
    tone: "#3B82F6",
    badge: { label: "AI 추출", color: "#FFFFFF", bg: "#7C3AED" },
  },
  {
    id: "capture",
    title: "캡처 이미지",
    description: "카톡·문자 결제 알림 캡처에서 결제 여러 건을 한 번에",
    icon: "images-outline",
    route: "/register/capture",
    tone: "#7C3AED",
    badge: { label: "AI 추출", color: "#FFFFFF", bg: "#7C3AED" },
  },
];

const SECONDARY_METHODS: InputMethod[] = [
  {
    id: "voice",
    title: "음성 입력",
    description: "말로 빠르게 — “스타벅스 6800원”",
    icon: "mic-outline",
    route: "/register/voice",
    tone: "#10B981",
    comingSoon: true,
  },
  {
    id: "sms",
    title: "SMS 파싱",
    description: "결제 문자에서 자동으로 금액·가맹점 추출",
    icon: "chatbox-ellipses-outline",
    route: "/register/sms",
    tone: "#F59E0B",
    comingSoon: true,
  },
  {
    id: "manual",
    title: "직접 입력",
    description: "원하는 항목을 직접 채워 등록",
    icon: "create-outline",
    route: "/register/manual",
    tone: "#6B7280",
    comingSoon: true,
  },
];

export default function RegisterScreen() {
  const onSelect = (m: InputMethod) => {
    if (m.comingSoon) return;
    router.push(m.route);
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.topBar}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.iconBtn}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Ionicons name="chevron-back" size={22} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.topTitle}>지출 등록</Text>
        <View style={styles.iconBtn} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.heading}>어떻게 등록할까요?</Text>
        <Text style={styles.subheading}>
          영수증이나 결제 알림 캡처가 있다면 AI가 알아서 채워드려요.
        </Text>

        {/* 1차: AI 자동 추출 흐름 */}
        <View style={styles.sectionHead}>
          <View style={styles.sectionDot} />
          <Text style={styles.sectionTitle}>AI 자동 추출</Text>
        </View>

        <View style={{ gap: 12 }}>
          {PRIMARY_METHODS.map((m) => (
            <PrimaryCard key={m.id} method={m} onPress={() => onSelect(m)} />
          ))}
        </View>

        {/* 2차: 직접/보조 입력 */}
        <View style={[styles.sectionHead, { marginTop: 28 }]}>
          <View style={[styles.sectionDot, { backgroundColor: "#9CA3AF" }]} />
          <Text style={styles.sectionTitle}>직접 입력 / 보조</Text>
        </View>

        <View style={styles.secondaryGrid}>
          {SECONDARY_METHODS.map((m) => (
            <SecondaryCard
              key={m.id}
              method={m}
              onPress={() => onSelect(m)}
            />
          ))}
        </View>

        <View style={styles.tipBox}>
          <Ionicons
            name="information-circle-outline"
            size={16}
            color="#6B7280"
          />
          <Text style={styles.tipBoxText}>
            AI 추출 결과는 예시 데이터로 보여지며, 
            서버가 연결되면 실제 인식 결과로 바뀝니다.
          </Text>
        </View>

        <View style={{ height: 24 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function PrimaryCard({
  method,
  onPress,
}: {
  method: InputMethod;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={onPress}
      style={[styles.primaryCard, { borderColor: `${method.tone}33` }]}
    >
      <View style={[styles.primaryIcon, { backgroundColor: `${method.tone}1A` }]}>
        <Ionicons name={method.icon} size={24} color={method.tone} />
      </View>
      <View style={{ flex: 1 }}>
        <View style={styles.primaryTitleRow}>
          <Text style={styles.primaryTitle}>{method.title}</Text>
          {method.badge && (
            <View
              style={[
                styles.badge,
                { backgroundColor: method.badge.bg },
              ]}
            >
              <Ionicons name="sparkles" size={10} color={method.badge.color} />
              <Text style={[styles.badgeText, { color: method.badge.color }]}>
                {method.badge.label}
              </Text>
            </View>
          )}
        </View>
        <Text style={styles.primaryDesc}>{method.description}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
    </TouchableOpacity>
  );
}

function SecondaryCard({
  method,
  onPress,
}: {
  method: InputMethod;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      activeOpacity={method.comingSoon ? 1 : 0.85}
      onPress={onPress}
      style={[
        styles.secondaryCard,
        method.comingSoon && { opacity: 0.55 },
      ]}
    >
      <View
        style={[
          styles.secondaryIcon,
          { backgroundColor: `${method.tone}14` },
        ]}
      >
        <Ionicons name={method.icon} size={18} color={method.tone} />
      </View>
      <Text style={styles.secondaryTitle}>{method.title}</Text>
      <Text style={styles.secondaryDesc} numberOfLines={2}>
        {method.description}
      </Text>
      {method.comingSoon && (
        <View style={styles.comingPill}>
          <Text style={styles.comingPillText}>준비중</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F9FAFB" },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 8,
    paddingVertical: 14,
    minHeight: 56,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  iconBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  topTitle: { fontSize: 16, fontWeight: "700", color: "#111827" },

  scroll: { padding: 20, paddingBottom: 24 },

  heading: {
    fontSize: 22,
    fontWeight: "800",
    color: "#111827",
  },
  subheading: {
    color: "#6B7280",
    fontSize: 13,
    lineHeight: 20,
    marginTop: 6,
  },

  sectionHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 22,
    marginBottom: 12,
  },
  sectionDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#3B82F6",
  },
  sectionTitle: {
    color: "#374151",
    fontSize: 13,
    fontWeight: "700",
  },

  primaryCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1.5,
  },
  primaryIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  primaryTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: "#111827",
  },
  primaryDesc: {
    color: "#6B7280",
    fontSize: 12,
    marginTop: 4,
    lineHeight: 17,
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 999,
  },
  badgeText: { fontSize: 10, fontWeight: "700" },

  secondaryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  secondaryCard: {
    width: "31.5%",
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#F3F4F6",
    paddingVertical: 14,
    paddingHorizontal: 10,
    alignItems: "center",
  },
  secondaryIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  secondaryTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: "#111827",
  },
  secondaryDesc: {
    fontSize: 10,
    color: "#9CA3AF",
    textAlign: "center",
    marginTop: 4,
    lineHeight: 14,
  },
  comingPill: {
    marginTop: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
    backgroundColor: "#F3F4F6",
    borderRadius: 999,
  },
  comingPillText: {
    fontSize: 9,
    fontWeight: "700",
    color: "#6B7280",
  },

  /* tip */
  tipBox: {
    flexDirection: "row",
    gap: 8,
    alignItems: "flex-start",
    backgroundColor: "#F3F4F6",
    padding: 12,
    borderRadius: 12,
    marginTop: 24,
  },
  tipBoxText: { color: "#6B7280", fontSize: 11, lineHeight: 16, flex: 1 },
});
