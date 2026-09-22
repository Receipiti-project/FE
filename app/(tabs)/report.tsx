import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import {
  AI_SUGGESTED_QUESTIONS,
  formatKRW,
  getCategory,
} from "@/constants/mockData";
import { useExpendituresForRange } from "@/hooks/useExpenditures";
import { answerReportQuestion } from "@/services/reportAssistant";

function dateKey(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function datesBetween(startDate: string, endDate: string): string[] {
  const dates: string[] = [];
  const cursor = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T00:00:00`);
  while (cursor <= end) {
    dates.push(dateKey(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return dates;
}

function shortDateLabel(value: string): string {
  const [, month, day] = value.split("-").map(Number);
  return `${month}/${day}`;
}

function monthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(date: Date): string {
  return `${date.getFullYear()}년 ${date.getMonth() + 1}월`;
}

function moveMonth(date: Date, amount: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + amount, 1);
}

function monthDateRange(selectedMonth: Date, currentMonth: Date): {
  startDate: string;
  endDate: string;
} {
  const start = new Date(selectedMonth.getFullYear(), selectedMonth.getMonth(), 1);
  const isCurrent = monthKey(selectedMonth) === monthKey(currentMonth);
  const end = isCurrent
    ? new Date()
    : new Date(selectedMonth.getFullYear(), selectedMonth.getMonth() + 1, 0);
  return { startDate: dateKey(start), endDate: dateKey(end) };
}

function formatTrendAmount(amount: number): string {
  if (amount >= 10_000) {
    const value = Math.round((amount / 10_000) * 10) / 10;
    return `${value.toLocaleString("ko-KR")}만원`;
  }
  if (amount >= 1_000) {
    const value = Math.round((amount / 1_000) * 10) / 10;
    return `${value.toLocaleString("ko-KR")}천원`;
  }
  return `${Math.round(amount).toLocaleString("ko-KR")}원`;
}

export default function ReportScreen() {
  const currentMonth = useMemo(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  }, []);
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<string | null>(null);
  const { startDate, endDate } = useMemo(
    () => monthDateRange(selectedMonth, currentMonth),
    [selectedMonth, currentMonth]
  );
  const today = dateKey(new Date());
  const isCurrentMonth = monthKey(selectedMonth) === monthKey(currentMonth);

  const { loading, error, items: filteredItems, refetch } =
    useExpendituresForRange(startDate, endDate);

  const selectedDates = useMemo(
    () => datesBetween(startDate, endDate),
    [startDate, endDate]
  );

  const filteredTotal = useMemo(
    () => filteredItems.reduce((s, t) => s + t.amount, 0),
    [filteredItems]
  );
  const filteredCount = filteredItems.length;
  const displayTotal = filteredTotal;
  const displayCount = filteredCount;
  const displayAvg = selectedDates.length > 0
    ? Math.round(filteredTotal / selectedDates.length)
    : 0;

  const chartDaily = useMemo(() => {
    const totals = new Map<string, number>();
    filteredItems.forEach((item) => {
      const date = item.datetime.slice(0, 10);
      totals.set(date, (totals.get(date) ?? 0) + item.amount);
    });
    return selectedDates.map((date) => ({
      date,
      label: date === today ? "오늘" : shortDateLabel(date),
      total: totals.get(date) ?? 0,
    }));
  }, [filteredItems, selectedDates, today]);

  const chartCategory = useMemo(() => {
    const map = new Map<string, { name: string; total: number }>();
    filteredItems.forEach((t) => {
      const current = map.get(t.category) ?? { name: t.categoryName, total: 0 };
      current.total += t.amount;
      map.set(t.category, current);
    });
    return [...map.entries()]
      .map(([id, value]) => ({ id, ...value }))
      .sort((a, b) => b.total - a.total);
  }, [filteredItems]);

  const chartStores = useMemo(() => {
    const map = new Map<string, { count: number; total: number }>();
    filteredItems.forEach((t) => {
      const cur = map.get(t.store) ?? { count: 0, total: 0 };
      map.set(t.store, { count: cur.count + 1, total: cur.total + t.amount });
    });
    return [...map.entries()]
      .map(([store, v]) => ({ store, ...v }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 3);
  }, [filteredItems]);

  const tod = useMemo(() => {
    const buckets = [
      { id: "morning", label: "아침", range: "06–11시", icon: "sunny-outline" as const, hours: [6, 7, 8, 9, 10] },
      { id: "lunch", label: "점심", range: "11–14시", icon: "restaurant-outline" as const, hours: [11, 12, 13] },
      { id: "afternoon", label: "오후", range: "14–18시", icon: "partly-sunny-outline" as const, hours: [14, 15, 16, 17] },
      { id: "evening", label: "저녁", range: "18–22시", icon: "moon-outline" as const, hours: [18, 19, 20, 21] },
      { id: "night", label: "야간", range: "22–06시", icon: "bed-outline" as const, hours: [22, 23, 0, 1, 2, 3, 4, 5] },
    ];
    return buckets.map((bucket) => ({
      ...bucket,
      total: filteredItems
        .filter((item) => bucket.hours.includes(new Date(item.datetime).getHours()))
        .reduce((sum, item) => sum + item.amount, 0),
    }));
  }, [filteredItems]);

  const dow = useMemo(() => {
    const labels = ["일", "월", "화", "수", "목", "금", "토"];
    const totals = new Array(7).fill(0) as number[];
    filteredItems.forEach((item) => {
      totals[new Date(item.datetime).getDay()] += item.amount;
    });
    return labels.map((label, index) => ({
      label,
      total: totals[index],
      isWeekend: index === 0 || index === 6,
    }));
  }, [filteredItems]);

  const maxWeek = Math.max(...chartDaily.map((d) => d.total), 1);
  const maxCat = Math.max(...chartCategory.map((c) => c.total), 1);
  const maxTod = Math.max(...tod.map((t) => t.total), 1);
  const maxDow = Math.max(...dow.map((d) => d.total), 1);
  const peakTod = tod.reduce((a, b) => (a.total > b.total ? a : b));

  const rangeLabel = monthLabel(selectedMonth);

  const selectMonth = (amount: number) => {
    setSelectedMonth((previous) => moveMonth(previous, amount));
    setAnswer(null);
  };

  const askQuestion = (nextQuestion = question) => {
    const trimmed = nextQuestion.trim();
    if (!trimmed) return;
    setQuestion(trimmed);
    setAnswer(answerReportQuestion(trimmed, filteredItems, rangeLabel));
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* 헤더 */}
        <View style={styles.headerRow}>
          <Text style={styles.headerTitle}>리포트</Text>
          <TouchableOpacity style={styles.iconBtn} onPress={refetch}>
            <Ionicons name="refresh-outline" size={20} color="#374151" />
          </TouchableOpacity>
        </View>

        {/* 월간 AI 리포트 진입 */}
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="월간 소비 리포트 열기"
          onPress={() => router.push("/report/monthly-ai")}
          style={styles.aiReportHero}
        >
          <View style={styles.aiReportHeroIcon}>
            <Ionicons name="sparkles" size={21} color="#FFFFFF" />
          </View>
          <View style={styles.aiReportHeroCopy}>
            <Text style={styles.aiReportHeroTitle}>월간 소비 리포트</Text>
            <Text style={styles.aiReportHeroDescription}>
              원하는 월을 선택해 소비 패턴과 인사이트를 확인하세요
            </Text>
          </View>
          <View style={styles.aiReportHeroAction}>
            <Ionicons name="chevron-forward" size={19} color="#FFFFFF" />
          </View>
        </TouchableOpacity>

        <View style={styles.statisticsHeader}>
          <Text style={styles.statisticsTitle}>월별 소비 통계</Text>
          <Text style={styles.statisticsDescription}>조회할 월을 선택하세요</Text>
        </View>

        {/* 조회 월 선택 */}
        <View style={styles.monthCard}>
          <Text style={styles.monthHint}>조회할 월을 선택하세요</Text>
          <View style={styles.monthSelector}>
            <TouchableOpacity
              accessibilityLabel="이전 달"
              hitSlop={10}
              onPress={() => selectMonth(-1)}
              style={styles.monthButton}
            >
              <Ionicons name="chevron-back" size={21} color="#374151" />
            </TouchableOpacity>
            <View style={styles.monthLabelGroup}>
              <Text style={styles.monthTitle}>{rangeLabel}</Text>
              {isCurrentMonth && (
                <View style={styles.currentMonthBadge}>
                  <Text style={styles.currentMonthBadgeText}>이번 달</Text>
                </View>
              )}
            </View>
            <TouchableOpacity
              accessibilityLabel="다음 달"
              hitSlop={10}
              disabled={isCurrentMonth}
              onPress={() => selectMonth(1)}
              style={[styles.monthButton, isCurrentMonth && styles.monthButtonDisabled]}
            >
              <Ionicons
                name="chevron-forward"
                size={21}
                color={isCurrentMonth ? "#D1D5DB" : "#374151"}
              />
            </TouchableOpacity>
          </View>
        </View>

        {!!error && (
          <View style={styles.errorBox}>
            <Ionicons name="alert-circle-outline" size={15} color="#B91C1C" />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {/* 총 지출 카드 */}
        <View style={styles.totalCard}>
          <Text style={styles.totalLabel}>{rangeLabel} 총 지출</Text>
          {loading ? (
            <ActivityIndicator color="#111827" style={{ marginTop: 10 }} />
          ) : (
            <Text style={styles.totalAmount}>{formatKRW(displayTotal)}</Text>
          )}
          <View style={styles.totalMetaRow}>
            <View style={styles.metaItem}>
              <Text style={styles.metaLabel}>일평균</Text>
              <Text style={styles.metaValue}>{formatKRW(displayAvg)}</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.metaItem}>
              <Text style={styles.metaLabel}>결제 건수</Text>
              <Text style={styles.metaValue}>{displayCount}건</Text>
            </View>
          </View>
        </View>

        {/* 주간/일별 트렌드 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>일별 추이</Text>
          <View style={styles.trendCard}>
            {loading ? (
              <View style={{ height: 160, justifyContent: "center", alignItems: "center" }}>
                <ActivityIndicator color="#3B82F6" />
              </View>
            ) : (
              <ScrollView
                horizontal
                nestedScrollEnabled
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.dailyBarRow}
              >
                {chartDaily.map((d) => {
                  const ratio = d.total / maxWeek;
                  const isToday = d.label === "오늘";
                  return (
                    <View key={d.date} style={styles.dailyBarCol}>
                      <Text
                        style={styles.barValue}
                        numberOfLines={1}
                        adjustsFontSizeToFit
                        minimumFontScale={0.72}
                        accessibilityLabel={d.total > 0 ? formatKRW(d.total) : undefined}
                      >
                        {d.total > 0 ? formatTrendAmount(d.total) : ""}
                      </Text>
                      <View style={styles.barTrack}>
                        <View
                          style={[
                            styles.bar,
                            {
                              height: `${Math.max(ratio * 100, 4)}%`,
                              backgroundColor: isToday ? "#3B82F6" : "#DBEAFE",
                            },
                          ]}
                        />
                      </View>
                      <Text style={[styles.barLabel, isToday && { color: "#3B82F6", fontWeight: "700" }]}>
                        {d.label}
                      </Text>
                    </View>
                  );
                })}
              </ScrollView>
            )}
          </View>
        </View>

        {/* 카테고리별 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>카테고리별 지출</Text>
          <View style={styles.catCard}>
            {loading ? (
              <ActivityIndicator color="#3B82F6" />
            ) : chartCategory.length === 0 ? (
              <Text style={styles.emptyText}>지출 내역이 없어요</Text>
            ) : (
              chartCategory.map((c) => {
                const cat = getCategory(c.id, c.name);
                const ratio = c.total / maxCat;
                const pct = displayTotal > 0 ? Math.round((c.total / displayTotal) * 100) : 0;
                return (
                  <View key={c.id} style={styles.catRow}>
                    <View style={styles.catHead}>
                      <View style={[styles.catIcon, { backgroundColor: `${cat.color}1A` }]}>
                        <Ionicons name={cat.icon} size={16} color={cat.color} />
                      </View>
                      <Text style={styles.catLabel}>{cat.label}</Text>
                      <Text style={styles.catPct}>{pct}%</Text>
                      <Text style={styles.catAmt}>{formatKRW(c.total)}</Text>
                    </View>
                    <View style={styles.catBarTrack}>
                      <View style={[styles.catBarFill, { width: `${ratio * 100}%`, backgroundColor: cat.color }]} />
                    </View>
                  </View>
                );
              })
            )}
          </View>
        </View>

        {/* 시간대별 패턴 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>시간대별 소비 패턴</Text>
          <View style={styles.todCard}>
            {tod.map((t) => {
              const ratio = t.total / maxTod;
              const isPeak = t.id === peakTod.id && peakTod.total > 0;
              return (
                <View key={t.id} style={styles.todRow}>
                  <View style={styles.todHead}>
                    <View style={[styles.todIcon, { backgroundColor: isPeak ? "#3B82F6" : "#EFF6FF" }]}>
                      <Ionicons name={t.icon} size={14} color={isPeak ? "#FFFFFF" : "#3B82F6"} />
                    </View>
                    <Text style={styles.todLabel}>{t.label}</Text>
                    <Text style={styles.todRange}>{t.range}</Text>
                    <Text style={styles.todAmt}>{t.total > 0 ? formatKRW(t.total) : "—"}</Text>
                  </View>
                  <View style={styles.todBarTrack}>
                    <View style={[styles.todBarFill, { width: `${Math.max(ratio * 100, 2)}%`, backgroundColor: isPeak ? "#3B82F6" : "#BFDBFE" }]} />
                  </View>
                </View>
              );
            })}
            {peakTod.total > 0 && (
              <View style={styles.todFooter}>
                <Ionicons name="trending-up" size={12} color="#3B82F6" />
                <Text style={styles.todFooterText}>
                  {peakTod.label} 시간대({peakTod.range})에 가장 많이 쓰셨어요
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* 요일별 패턴 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>요일별 소비 패턴</Text>
          <View style={styles.dowCard}>
            <View style={styles.barRow}>
              {dow.map((d) => {
                const ratio = d.total / maxDow;
                return (
                  <View key={d.label} style={styles.barCol}>
                    <View style={styles.barTrack}>
                      <View
                        style={[
                          styles.bar,
                          {
                            height: `${Math.max(ratio * 100, 4)}%`,
                            backgroundColor: d.isWeekend ? "#A855F7" : "#3B82F6",
                            opacity: d.total === 0 ? 0.25 : 1,
                          },
                        ]}
                      />
                    </View>
                    <Text style={[styles.dowLabel, d.isWeekend && { color: "#A855F7", fontWeight: "700" }]}>
                      {d.label}
                    </Text>
                  </View>
                );
              })}
            </View>
            <View style={styles.legendRow}>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: "#3B82F6" }]} />
                <Text style={styles.legendText}>평일</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: "#A855F7" }]} />
                <Text style={styles.legendText}>주말</Text>
              </View>
            </View>
          </View>
        </View>

        {/* AI 챗봇 진입 */}
        <View style={styles.section}>
          <View style={styles.chatCard}>
            <View style={styles.chatHead}>
              <View style={styles.chatBadge}>
                <Ionicons name="sparkles" size={14} color="#FFFFFF" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.chatTitle}>AI에게 물어보기</Text>
                <Text style={styles.chatSub}>현재 지출 데이터를 기기에서 바로 분석해요</Text>
              </View>
            </View>
            <View style={styles.chatInputRow}>
              <TextInput
                value={question}
                onChangeText={setQuestion}
                onSubmitEditing={() => askQuestion()}
                placeholder="예: 가장 많이 쓴 카테고리는?"
                placeholderTextColor="#818CF8"
                returnKeyType="send"
                style={styles.chatInput}
              />
              <TouchableOpacity
                accessibilityLabel="질문하기"
                disabled={!question.trim()}
                onPress={() => askQuestion()}
                style={[styles.chatSendButton, !question.trim() && styles.chatSendButtonDisabled]}
              >
                <Ionicons name="send" size={15} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
            <View style={styles.chatPromptList}>
              {AI_SUGGESTED_QUESTIONS.map((q) => (
                <TouchableOpacity key={q} onPress={() => askQuestion(q)} style={styles.chatPrompt}>
                  <Text style={styles.chatPromptText}>{q}</Text>
                  <Ionicons name="arrow-forward" size={14} color="#7C3AED" />
                </TouchableOpacity>
              ))}
            </View>
            {!!answer && (
              <View style={styles.chatAnswer}>
                <View style={styles.chatAnswerTitleRow}>
                  <Ionicons name="sparkles-outline" size={14} color="#C4B5FD" />
                  <Text style={styles.chatAnswerTitle}>분석 답변</Text>
                </View>
                <Text style={styles.chatAnswerText}>{answer}</Text>
              </View>
            )}
          </View>
        </View>

        {/* Top 매장 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>자주 가는 매장</Text>
          {loading ? (
            <View style={styles.storeList}>
              <View style={{ padding: 24, alignItems: "center" }}>
                <ActivityIndicator color="#3B82F6" />
              </View>
            </View>
          ) : chartStores.length === 0 ? (
            <View style={styles.storeList}>
              <View style={{ padding: 20, alignItems: "center" }}>
                <Text style={styles.emptyText}>데이터가 없어요</Text>
              </View>
            </View>
          ) : (
            <View style={styles.storeList}>
              {chartStores.map((s, i) => (
                <View
                  key={s.store}
                  style={[styles.storeRow, i === chartStores.length - 1 && { borderBottomWidth: 0 }]}
                >
                  <View style={styles.rankBadge}>
                    <Text style={styles.rankText}>{i + 1}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.storeName} numberOfLines={1}>{s.store}</Text>
                    <Text style={styles.storeMeta}>{rangeLabel} · {s.count}회 결제</Text>
                  </View>
                  <Text style={styles.storeAmount}>{formatKRW(s.total)}</Text>
                </View>
              ))}
            </View>
          )}
        </View>
        <View style={{ height: 24 }} />
      </ScrollView>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F9FAFB" },
  scroll: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 20 },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  headerTitle: { fontSize: 22, fontWeight: "700", color: "#111827" },
  iconBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: "#FFFFFF", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "#F3F4F6" },
  aiReportHero: { flexDirection: "row", alignItems: "center", gap: 13, padding: 17, borderRadius: 20, backgroundColor: "#312E81", shadowColor: "#312E81", shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.18, shadowRadius: 12, elevation: 5 },
  aiReportHeroIcon: { width: 44, height: 44, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: "#7C3AED" },
  aiReportHeroCopy: { flex: 1 },
  aiReportHeroTitle: { color: "#FFFFFF", fontSize: 17, fontWeight: "800" },
  aiReportHeroDescription: { color: "#C7D2FE", fontSize: 11, lineHeight: 16, marginTop: 4 },
  aiReportHeroAction: { width: 32, height: 32, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.1)" },
  statisticsHeader: { marginTop: 26, marginBottom: 10 },
  statisticsTitle: { color: "#111827", fontSize: 16, fontWeight: "800" },
  statisticsDescription: { color: "#9CA3AF", fontSize: 11, marginTop: 3 },
  monthCard: { marginBottom: 16, padding: 14, borderRadius: 16, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#E5E7EB" },
  monthHint: { color: "#9CA3AF", fontSize: 10, fontWeight: "600", textAlign: "center", marginBottom: 9 },
  monthSelector: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  monthButton: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: "#F3F4F6" },
  monthButtonDisabled: { opacity: 0.55 },
  monthLabelGroup: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7 },
  monthTitle: { color: "#111827", fontSize: 17, fontWeight: "800" },
  currentMonthBadge: { paddingHorizontal: 7, paddingVertical: 3, borderRadius: 999, backgroundColor: "#DBEAFE" },
  currentMonthBadgeText: { color: "#2563EB", fontSize: 9, fontWeight: "800" },
  errorBox: { flexDirection: "row", alignItems: "center", gap: 7, padding: 11, marginBottom: 12, borderRadius: 12, backgroundColor: "#FEF2F2", borderWidth: 1, borderColor: "#FECACA" },
  errorText: { flex: 1, color: "#B91C1C", fontSize: 11, lineHeight: 16 },
  totalCard: { backgroundColor: "#FFFFFF", borderRadius: 20, padding: 20, borderWidth: 1, borderColor: "#F3F4F6" },
  totalLabel: { color: "#6B7280", fontSize: 13, fontWeight: "600" },
  totalAmount: { color: "#111827", fontSize: 28, fontWeight: "800", marginTop: 4 },
  totalMetaRow: { flexDirection: "row", marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: "#F3F4F6", alignItems: "center" },
  metaItem: { flex: 1, alignItems: "center" },
  metaLabel: { color: "#9CA3AF", fontSize: 11, marginBottom: 4 },
  metaValue: { color: "#111827", fontWeight: "700", fontSize: 13 },
  divider: { width: 1, height: 24, backgroundColor: "#F3F4F6" },
  section: { marginTop: 24 },
  sectionTitle: { fontSize: 15, fontWeight: "700", color: "#111827", marginBottom: 12 },
  trendCard: { backgroundColor: "#FFFFFF", borderRadius: 16, padding: 16, borderWidth: 1, borderColor: "#F3F4F6" },
  dailyBarRow: { flexDirection: "row", height: 160, alignItems: "flex-end", gap: 8, paddingRight: 4 },
  dailyBarCol: { width: 48, height: 160, alignItems: "center" },
  barRow: { flexDirection: "row", alignItems: "flex-end", height: 160, gap: 8 },
  barCol: { flex: 1, alignItems: "center" },
  barValue: { fontSize: 10, color: "#6B7280", marginBottom: 4, height: 14 },
  barTrack: { flex: 1, width: "70%", backgroundColor: "#F9FAFB", borderRadius: 6, justifyContent: "flex-end", overflow: "hidden" },
  bar: { width: "100%", borderTopLeftRadius: 6, borderTopRightRadius: 6 },
  barLabel: { fontSize: 11, color: "#6B7280", marginTop: 6 },
  catCard: { backgroundColor: "#FFFFFF", borderRadius: 16, padding: 16, borderWidth: 1, borderColor: "#F3F4F6", gap: 14 },
  catRow: { gap: 8 },
  catHead: { flexDirection: "row", alignItems: "center", gap: 8 },
  catIcon: { width: 28, height: 28, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  catLabel: { color: "#111827", fontWeight: "600", fontSize: 13, flex: 1 },
  catPct: { color: "#6B7280", fontSize: 12, marginRight: 8 },
  catAmt: { color: "#111827", fontWeight: "700", fontSize: 13 },
  catBarTrack: { height: 6, backgroundColor: "#F3F4F6", borderRadius: 999, overflow: "hidden" },
  catBarFill: { height: "100%", borderRadius: 999 },
  storeList: { backgroundColor: "#FFFFFF", borderRadius: 16, borderWidth: 1, borderColor: "#F3F4F6", overflow: "hidden" },
  storeRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: "#F3F4F6", gap: 12 },
  rankBadge: { width: 28, height: 28, borderRadius: 14, backgroundColor: "#EFF6FF", alignItems: "center", justifyContent: "center" },
  rankText: { color: "#3B82F6", fontWeight: "800", fontSize: 13 },
  storeName: { color: "#111827", fontWeight: "600", fontSize: 14 },
  storeMeta: { color: "#9CA3AF", fontSize: 11, marginTop: 2 },
  storeAmount: { color: "#111827", fontWeight: "700", fontSize: 13 },
  todCard: { backgroundColor: "#FFFFFF", borderRadius: 16, padding: 16, borderWidth: 1, borderColor: "#F3F4F6", gap: 12 },
  todRow: { gap: 6 },
  todHead: { flexDirection: "row", alignItems: "center", gap: 8 },
  todIcon: { width: 26, height: 26, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  todLabel: { color: "#111827", fontWeight: "700", fontSize: 13, width: 36 },
  todRange: { color: "#9CA3AF", fontSize: 11, flex: 1 },
  todAmt: { color: "#111827", fontWeight: "700", fontSize: 12 },
  todBarTrack: { height: 6, backgroundColor: "#F3F4F6", borderRadius: 999, overflow: "hidden", marginLeft: 34 },
  todBarFill: { height: "100%", borderRadius: 999 },
  todFooter: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#EFF6FF", paddingHorizontal: 10, paddingVertical: 8, borderRadius: 10, marginTop: 4 },
  todFooterText: { color: "#1D4ED8", fontSize: 11, fontWeight: "600", flex: 1 },
  dowCard: { backgroundColor: "#FFFFFF", borderRadius: 16, padding: 16, borderWidth: 1, borderColor: "#F3F4F6" },
  dowLabel: { fontSize: 11, color: "#6B7280", marginTop: 6 },
  legendRow: { flexDirection: "row", justifyContent: "center", gap: 16, marginTop: 8 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: 11, color: "#6B7280", fontWeight: "600" },
  chatCard: { backgroundColor: "#1E1B4B", borderRadius: 18, padding: 18 },
  chatHead: { flexDirection: "row", alignItems: "center", gap: 12 },
  chatBadge: { width: 32, height: 32, borderRadius: 16, backgroundColor: "#7C3AED", alignItems: "center", justifyContent: "center" },
  chatTitle: { color: "#FFFFFF", fontWeight: "700", fontSize: 14 },
  chatSub: { color: "#A5B4FC", fontSize: 11, marginTop: 2, lineHeight: 16 },
  chatInputRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 14 },
  chatInput: { flex: 1, minHeight: 42, borderRadius: 12, paddingHorizontal: 12, color: "#FFFFFF", backgroundColor: "rgba(255,255,255,0.08)", borderWidth: 1, borderColor: "rgba(255,255,255,0.12)", fontSize: 12 },
  chatSendButton: { width: 42, height: 42, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: "#7C3AED" },
  chatSendButtonDisabled: { opacity: 0.4 },
  chatPromptList: { gap: 8, marginTop: 14 },
  chatPrompt: { flexDirection: "row", alignItems: "center", backgroundColor: "rgba(255,255,255,0.06)", borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" },
  chatPromptText: { color: "#E0E7FF", fontSize: 12, fontWeight: "600", flex: 1 },
  chatAnswer: { marginTop: 12, borderRadius: 12, padding: 12, backgroundColor: "rgba(124,58,237,0.2)", borderWidth: 1, borderColor: "rgba(196,181,253,0.24)" },
  chatAnswerTitleRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  chatAnswerTitle: { color: "#C4B5FD", fontSize: 11, fontWeight: "700" },
  chatAnswerText: { color: "#F5F3FF", fontSize: 12, lineHeight: 19, marginTop: 7 },
  emptyText: { color: "#9CA3AF", fontSize: 13, textAlign: "center" },
});
