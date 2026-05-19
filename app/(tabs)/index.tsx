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
import {
  ACTIVITY_ZONES,
  AI_INSIGHTS,
  AI_SUGGESTED_QUESTIONS,
  CATEGORIES,
  CATEGORIZATION_STATS,
  MONTHLY_BUDGET,
  formatKRW,
  formatDateLabel,
  formatTime,
  getCategory,
  monthlyTotal,
  recentTransactions,
  todayTotal,
  IoniconName,
} from "@/constants/mockData";

const BLUE = "#3B82F6";

const QUICK_ACTIONS: {
  icon: IoniconName;
  label: string;
  route: any;
  bg: string;
  fg: string;
}[] = [
  {
    icon: "receipt-outline",
    label: "영수증",
    route: "/register/receipt",
    bg: "#EFF6FF",
    fg: "#3B82F6",
  },
  {
    icon: "image-outline",
    label: "캡처",
    route: "/register/capture",
    bg: "#F5F3FF",
    fg: "#7C3AED",
  },
  {
    icon: "mic-outline",
    label: "음성",
    route: "/register/voice",
    bg: "#FEF2F2",
    fg: "#EF4444",
  },
  {
    icon: "chatbox-outline",
    label: "문자",
    route: "/register/sms",
    bg: "#FFFBEB",
    fg: "#F59E0B",
  },
  {
    icon: "create-outline",
    label: "직접",
    route: "/register/manual",
    bg: "#F0FDF4",
    fg: "#10B981",
  },
];

export default function HomeScreen() {
  const total = monthlyTotal();
  const today = todayTotal();
  const recent = recentTransactions(4);
  const usedRatio = Math.min(total / MONTHLY_BUDGET, 1);
  const remaining = Math.max(MONTHLY_BUDGET - total, 0);
  const insight = AI_INSIGHTS[0];

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* 헤더 */}
        <View style={styles.headerRow}>
          {/* <View>
            <Text style={styles.greeting}>안녕하세요, 민서님 👋</Text>
            <Text style={styles.greetingSub}>오늘은 4월 29일 수요일이에요</Text>
          </View> */}
          <TouchableOpacity style={styles.bellBtn}>
            <Ionicons name="notifications-outline" size={22} color="#374151" />
          </TouchableOpacity>
        </View>

        {/* 이번 달 지출 카드 */}
        <View style={styles.spendCard}>
          <Text style={styles.spendLabel}>이번 달 지출</Text>
          <Text style={styles.spendAmount}>{formatKRW(total)}</Text>
          <View style={styles.budgetRow}>
            <Text style={styles.budgetText}>
              예산 {formatKRW(MONTHLY_BUDGET)}
            </Text>
            <View style={styles.deltaPill}>
              <Ionicons name="arrow-down" size={11} color="#10B981" />
              <Text style={styles.deltaText}>전월 대비 8.3%</Text>
            </View>
          </View>
          <View style={styles.progressTrack}>
            <View
              style={[styles.progressFill, { width: `${usedRatio * 100}%` }]}
            />
          </View>
          <Text style={styles.progressMeta}>
            남은 예산 {formatKRW(remaining)} · 일평균 12,800원 권장
          </Text>
        </View>

        {/* 빠른 등록 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>빠른 등록</Text>
          <View style={styles.quickRow}>
            {QUICK_ACTIONS.map((q) => (
              <TouchableOpacity
                key={q.label}
                style={styles.quickItem}
                onPress={() => router.push(q.route)}
              >
                <View style={[styles.quickIconWrap, { backgroundColor: q.bg }]}>
                  <Ionicons name={q.icon} size={22} color={q.fg} />
                </View>
                <Text style={styles.quickLabel}>{q.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* 오늘 요약 */}
        <View style={styles.section}>
          <View style={styles.todayCard}>
            <View style={{ flex: 1 }}>
              <Text style={styles.todayLabel}>오늘의 지출</Text>
              <Text style={styles.todayAmount}>{formatKRW(today)}</Text>
              <Text style={styles.todayMeta}>
                결제{" "}
                {recent.filter((t) => t.datetime.startsWith("2026-04-29")).length}
                건 · 평균 8,400원
              </Text>
            </View>
            <View style={styles.todayIconWrap}>
              <Ionicons name="today-outline" size={28} color={BLUE} />
            </View>
          </View>
        </View>

        {/* AI 어시스턴트 배너 */}
        <View style={styles.section}>
          <View style={styles.aiBanner}>
            <View style={styles.aiAvatar}>
              <Ionicons name="sparkles" size={18} color="#FFFFFF" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.aiBannerTitle}>
                AI에게 내 소비를 물어보세요
              </Text>
              <Text style={styles.aiBannerSub}>
                자연어 질문 · 영수증·캡처 자동 학습 · 카테고리 자동분류
              </Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 6, paddingTop: 10 }}
              >
                {AI_SUGGESTED_QUESTIONS.slice(0, 3).map((q) => (
                  <View key={q} style={styles.aiPrompt}>
                    <Text style={styles.aiPromptText} numberOfLines={1}>
                      {q}
                    </Text>
                  </View>
                ))}
              </ScrollView>
            </View>
          </View>
        </View>

        {/* AI 인사이트 미리보기 */}
        <View style={styles.section}>
          <View style={styles.sectionHead}>
            <Text style={[styles.sectionTitle, { marginBottom: 0 }]}>
              AI 인사이트
            </Text>
            <TouchableOpacity onPress={() => router.push("/(tabs)/report" as any)}>
              <Text style={styles.linkText}>리포트 보기 ›</Text>
            </TouchableOpacity>
          </View>
          <View style={[styles.insightCard, { borderLeftColor: insight.accent }]}>
            <View
              style={[
                styles.insightIcon,
                { backgroundColor: `${insight.accent}1A` },
              ]}
            >
              <Ionicons name={insight.icon} size={20} color={insight.accent} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.insightTitle}>{insight.title}</Text>
              <Text style={styles.insightBody}>{insight.body}</Text>
            </View>
          </View>
        </View>

        {/* 최근 거래 */}
        <View style={styles.section}>
          <View style={styles.sectionHead}>
            <Text style={[styles.sectionTitle, { marginBottom: 0 }]}>
              최근 거래
            </Text>
            <TouchableOpacity onPress={() => router.push("/(tabs)/budget" as any)}>
              <Text style={styles.linkText}>전체 보기 ›</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.txList}>
            {recent.map((t, idx) => {
              const cat = getCategory(t.category);
              const isLast = idx === recent.length - 1;
              return (
                <View
                  key={t.id}
                  style={[
                    styles.txRow,
                    isLast && { borderBottomWidth: 0 },
                  ]}
                >
                  <View
                    style={[styles.txIcon, { backgroundColor: `${cat.color}1A` }]}
                  >
                    <Ionicons name={cat.icon} size={18} color={cat.color} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.txStore} numberOfLines={1}>
                      {t.store}
                    </Text>
                    <Text style={styles.txMeta}>
                      {formatDateLabel(t.datetime)} {formatTime(t.datetime)} ·{" "}
                      {cat.label} · {t.method}
                    </Text>
                  </View>
                  <Text style={styles.txAmount}>{formatKRW(t.amount)}</Text>
                </View>
              );
            })}
          </View>
        </View>

        {/* 생활권 미리보기 */}
        <View style={styles.section}>
          <View style={styles.sectionHead}>
            <Text style={[styles.sectionTitle, { marginBottom: 0 }]}>
              나의 소비 생활권
            </Text>
            <TouchableOpacity onPress={() => router.push("/(tabs)/map" as any)}>
              <Text style={styles.linkText}>지도에서 보기 ›</Text>
            </TouchableOpacity>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 10 }}
          >
            {ACTIVITY_ZONES.map((z) => (
              <View key={z.id} style={styles.zoneCard}>
                <View
                  style={[
                    styles.zoneAccent,
                    { backgroundColor: z.color },
                  ]}
                />
                <View style={styles.zoneHead}>
                  <Ionicons name="location" size={14} color={z.color} />
                  <Text style={styles.zoneLabel}>{z.label}</Text>
                </View>
                <Text style={styles.zoneRole}>{z.role}</Text>
                <Text style={styles.zoneSpend}>{formatKRW(z.totalSpend)}</Text>
                <Text style={styles.zoneMeta}>
                  {z.visitCount}회 · {z.radius}
                </Text>
              </View>
            ))}
          </ScrollView>
        </View>

        {/* 자동분류 학습 상태 */}
        <View style={styles.section}>
          <View style={styles.learnCard}>
            <View style={styles.learnIconWrap}>
              <Ionicons name="bulb-outline" size={20} color="#7C3AED" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.learnTitle}>카테고리 자동분류 학습 중</Text>
              <Text style={styles.learnSub}>
                자동 매칭 {CATEGORIZATION_STATS.autoMatched}건 · 사용자 수정{" "}
                {CATEGORIZATION_STATS.userCorrected}건
              </Text>
              <View style={styles.learnBarTrack}>
                <View
                  style={[
                    styles.learnBarFill,
                    { width: `${CATEGORIZATION_STATS.accuracy * 100}%` },
                  ]}
                />
              </View>
              <Text style={styles.learnPct}>
                정확도 {Math.round(CATEGORIZATION_STATS.accuracy * 100)}% · 매장
                {CATEGORIZATION_STATS.pending}곳 분류 대기 중
              </Text>
            </View>
          </View>
        </View>

        {/* Top 카테고리 미리보기 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>카테고리 한눈에</Text>
          <View style={styles.catGrid}>
            {CATEGORIES.slice(0, 6).map((c) => (
              <View key={c.id} style={styles.catChip}>
                <View
                  style={[styles.catChipIcon, { backgroundColor: `${c.color}1A` }]}
                >
                  <Ionicons name={c.icon} size={16} color={c.color} />
                </View>
                <Text style={styles.catChipLabel}>{c.label}</Text>
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
    marginBottom: 20,
  },
  greeting: { fontSize: 18, fontWeight: "700", color: "#111827" },
  greetingSub: { fontSize: 13, color: "#6B7280", marginTop: 2 },
  bellBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#F3F4F6",
  },
  spendCard: {
    backgroundColor: "#111827",
    borderRadius: 20,
    padding: 20,
  },
  spendLabel: { color: "#9CA3AF", fontSize: 13, fontWeight: "600" },
  spendAmount: {
    color: "#FFFFFF",
    fontSize: 30,
    fontWeight: "800",
    marginTop: 6,
  },
  budgetRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 8,
  },
  budgetText: { color: "#9CA3AF", fontSize: 13 },
  deltaPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(16,185,129,0.15)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    gap: 4,
  },
  deltaText: { color: "#10B981", fontSize: 11, fontWeight: "700" },
  progressTrack: {
    height: 8,
    backgroundColor: "rgba(255,255,255,0.12)",
    borderRadius: 999,
    marginTop: 16,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: "#3B82F6",
    borderRadius: 999,
  },
  progressMeta: { color: "#9CA3AF", fontSize: 12, marginTop: 8 },
  section: { marginTop: 24 },
  sectionHead: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 12,
  },
  linkText: { color: "#3B82F6", fontWeight: "600", fontSize: 13 },
  quickRow: { flexDirection: "row", justifyContent: "space-between" },
  quickItem: { alignItems: "center", width: "18%" },
  quickIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 6,
  },
  quickLabel: { fontSize: 12, fontWeight: "600", color: "#374151" },
  aiBanner: {
    flexDirection: "row",
    backgroundColor: "#1E1B4B",
    borderRadius: 18,
    padding: 16,
    gap: 12,
    alignItems: "flex-start",
  },
  aiAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#7C3AED",
    alignItems: "center",
    justifyContent: "center",
  },
  aiBannerTitle: { color: "#FFFFFF", fontWeight: "700", fontSize: 14 },
  aiBannerSub: { color: "#A5B4FC", fontSize: 11, marginTop: 4, lineHeight: 16 },
  aiPrompt: {
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  aiPromptText: { color: "#E0E7FF", fontSize: 11, fontWeight: "600" },
  zoneCard: {
    width: 160,
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: "#F3F4F6",
    overflow: "hidden",
  },
  zoneAccent: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 4,
  },
  zoneHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 4,
  },
  zoneLabel: { color: "#111827", fontWeight: "700", fontSize: 13 },
  zoneRole: { color: "#9CA3AF", fontSize: 11, marginTop: 2 },
  zoneSpend: {
    color: "#111827",
    fontWeight: "800",
    fontSize: 16,
    marginTop: 8,
  },
  zoneMeta: { color: "#6B7280", fontSize: 11, marginTop: 4 },
  learnCard: {
    flexDirection: "row",
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#F3F4F6",
    gap: 12,
    alignItems: "flex-start",
  },
  learnIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: "#F5F3FF",
    alignItems: "center",
    justifyContent: "center",
  },
  learnTitle: { color: "#111827", fontWeight: "700", fontSize: 14 },
  learnSub: { color: "#6B7280", fontSize: 11, marginTop: 2 },
  learnBarTrack: {
    height: 6,
    backgroundColor: "#F3F4F6",
    borderRadius: 999,
    marginTop: 10,
    overflow: "hidden",
  },
  learnBarFill: {
    height: "100%",
    backgroundColor: "#7C3AED",
    borderRadius: 999,
  },
  learnPct: { color: "#9CA3AF", fontSize: 11, marginTop: 8 },
  todayCard: {
    flexDirection: "row",
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 18,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#F3F4F6",
  },
  todayLabel: { color: "#6B7280", fontSize: 13, fontWeight: "600" },
  todayAmount: {
    color: "#111827",
    fontSize: 22,
    fontWeight: "800",
    marginTop: 4,
  },
  todayMeta: { color: "#9CA3AF", fontSize: 12, marginTop: 4 },
  todayIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: "#EFF6FF",
    alignItems: "center",
    justifyContent: "center",
  },
  insightCard: {
    flexDirection: "row",
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#F3F4F6",
    borderLeftWidth: 4,
    gap: 12,
  },
  insightIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  insightTitle: {
    color: "#111827",
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 4,
  },
  insightBody: { color: "#4B5563", fontSize: 12, lineHeight: 18 },
  txList: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#F3F4F6",
    overflow: "hidden",
  },
  txRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
    gap: 12,
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
  catGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  catChip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#F3F4F6",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
    gap: 8,
  },
  catChipIcon: {
    width: 24,
    height: 24,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  catChipLabel: { color: "#374151", fontWeight: "600", fontSize: 12 },
});
