import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import {
  AI_INSIGHTS,
  AI_SUGGESTED_QUESTIONS,
  CATEGORIZATION_STATS,
  formatKRW,
  getCategory,
} from "@/constants/mockData";
import { useExpenditures } from "@/hooks/useExpenditures";

const RANGES = ["이번주", "이번달"] as const;
type Range = (typeof RANGES)[number];

function currentWeekStart(): string {
  const d = new Date();
  const day = d.getDay(); 
  const diff = day === 0 ? 6 : day - 1; 
  d.setDate(d.getDate() - diff);
  return d.toISOString().slice(0, 10);
}

export default function ReportScreen() {
  const [range, setRange] = useState<Range>("이번달");

  const {
    loading,
    totalAmount,
    txCount,
    dailyAvg,
    allItems,
    weeklySpending,
    byCategoryReport,
    topStores,
    timeOfDayPattern,
    dayOfWeekPattern,
    refetch,
  } = useExpenditures();

  // 기간 필터 적용
  const weekStart = useMemo(() => currentWeekStart(), []);

  const filteredItems = useMemo(() => {
    if (range === "이번주") {
      return allItems.filter((t) => t.datetime.slice(0, 10) >= weekStart);
    }
    return allItems;
  }, [range, allItems, weekStart]);

  const filteredTotal = useMemo(
    () => filteredItems.reduce((s, t) => s + t.amount, 0),
    [filteredItems]
  );
  const filteredCount = filteredItems.length;
  const filteredAvg = filteredCount > 0 ? Math.round(filteredTotal / 7) : 0;

  // 기간 필터 적용 차트 데이터
  const displayTotal = range === "이번달" ? totalAmount : filteredTotal;
  const displayCount = range === "이번달" ? txCount : filteredCount;
  const displayAvg = range === "이번달" ? dailyAvg : filteredAvg;

  const chartWeekly = useMemo(() => {
    if (range === "이번달") return weeklySpending;
    return weeklySpending.filter((d) => d.date >= weekStart);
  }, [range, weeklySpending, weekStart]);

  const chartCategory = useMemo(() => {
    if (range === "이번달") return byCategoryReport;
    const map = new Map<string, number>();
    filteredItems.forEach((t) => {
      map.set(t.category, (map.get(t.category) ?? 0) + t.amount);
    });
    return byCategoryReport
      .map((c) => ({ ...c, total: map.get(c.id) ?? 0 }))
      .filter((c) => c.total > 0)
      .sort((a, b) => b.total - a.total);
  }, [range, byCategoryReport, filteredItems]);

  const chartStores = useMemo(() => {
    if (range === "이번달") return topStores;
    const map = new Map<string, { count: number; total: number }>();
    filteredItems.forEach((t) => {
      const cur = map.get(t.store) ?? { count: 0, total: 0 };
      map.set(t.store, { count: cur.count + 1, total: cur.total + t.amount });
    });
    return [...map.entries()]
      .map(([store, v]) => ({ store, ...v }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 3);
  }, [range, topStores, filteredItems]);

  const maxWeek = Math.max(...chartWeekly.map((d) => d.total), 1);
  const maxCat = Math.max(...chartCategory.map((c) => c.total), 1);
  const tod = range === "이번달" ? timeOfDayPattern : timeOfDayPattern; // 동일 (월간)
  const maxTod = Math.max(...tod.map((t) => t.total), 1);
  const dow = range === "이번달" ? dayOfWeekPattern : dayOfWeekPattern;
  const maxDow = Math.max(...dow.map((d) => d.total), 1);
  const peakTod = tod.reduce((a, b) => (a.total > b.total ? a : b));

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

        {/* 기간 선택 */}
        <View style={styles.rangeRow}>
          {RANGES.map((r) => {
            const active = r === range;
            return (
              <TouchableOpacity
                key={r}
                onPress={() => setRange(r)}
                style={[styles.rangeChip, active && styles.rangeChipActive]}
              >
                <Text style={[styles.rangeChipText, active && styles.rangeChipTextActive]}>
                  {r}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* 총 지출 카드 */}
        <View style={styles.totalCard}>
          <Text style={styles.totalLabel}>{range} 총 지출</Text>
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
              <View style={styles.barRow}>
                {chartWeekly.map((d) => {
                  const ratio = d.total / maxWeek;
                  const isToday = d.label === "오늘";
                  return (
                    <View key={d.date} style={styles.barCol}>
                      <Text style={styles.barValue}>
                        {d.total > 0 ? `${Math.round(d.total / 1000)}k` : ""}
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
              </View>
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
                const cat = getCategory(c.id);
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
                <Text style={styles.chatSub}>자연어로 소비 내역을 검색하고 분석해보세요</Text>
              </View>
            </View>
            <View style={styles.chatPromptList}>
              {AI_SUGGESTED_QUESTIONS.map((q) => (
                <TouchableOpacity key={q} style={styles.chatPrompt}>
                  <Text style={styles.chatPromptText}>{q}</Text>
                  <Ionicons name="arrow-forward" size={14} color="#7C3AED" />
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>

        {/* AI 리포트 */}
        <View style={styles.section}>
          <View style={styles.sectionHead}>
            <View style={styles.aiTitleRow}>
              <Ionicons name="sparkles-outline" size={16} color="#3B82F6" />
              <Text style={[styles.sectionTitle, { marginBottom: 0 }]}>AI 소비 리포트</Text>
            </View>
            <Text style={styles.metaTinyLabel}>매주 월요일 자동 갱신</Text>
          </View>
          <View style={{ gap: 10 }}>
            {AI_INSIGHTS.map((ins) => (
              <View key={ins.title} style={[styles.insightCard, { borderLeftColor: ins.accent }]}>
                <View style={[styles.insightIcon, { backgroundColor: `${ins.accent}1A` }]}>
                  <Ionicons name={ins.icon} size={18} color={ins.accent} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.insightTitle}>{ins.title}</Text>
                  <Text style={styles.insightBody}>{ins.body}</Text>
                </View>
              </View>
            ))}
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
                    <Text style={styles.storeMeta}>{range} {s.count}회 방문</Text>
                  </View>
                  <Text style={styles.storeAmount}>{formatKRW(s.total)}</Text>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* 카테고리 자동분류 통계 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>카테고리 자동분류</Text>
          <View style={styles.classifyCard}>
            <View style={styles.classifyRow}>
              <View style={[styles.classifyStat, { borderRightWidth: 1 }]}>
                <Text style={styles.classifyValue}>{CATEGORIZATION_STATS.autoMatched}</Text>
                <Text style={styles.classifyLabel}>자동 매칭</Text>
              </View>
              <View style={[styles.classifyStat, { borderRightWidth: 1 }]}>
                <Text style={[styles.classifyValue, { color: "#7C3AED" }]}>{CATEGORIZATION_STATS.userCorrected}</Text>
                <Text style={styles.classifyLabel}>내가 수정</Text>
              </View>
              <View style={styles.classifyStat}>
                <Text style={[styles.classifyValue, { color: "#F59E0B" }]}>{CATEGORIZATION_STATS.pending}</Text>
                <Text style={styles.classifyLabel}>분류 대기</Text>
              </View>
            </View>
            <View style={styles.classifyAccBox}>
              <View style={styles.classifyAccHead}>
                <Text style={styles.classifyAccLabel}>분류 정확도</Text>
                <Text style={styles.classifyAccVal}>{Math.round(CATEGORIZATION_STATS.accuracy * 100)}%</Text>
              </View>
              <View style={styles.classifyTrack}>
                <View style={[styles.classifyFill, { width: `${CATEGORIZATION_STATS.accuracy * 100}%` }]} />
              </View>
              <Text style={styles.classifyHint}>
                내 수정 이력이 많을수록 더 정확해져요.
              </Text>
            </View>
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
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  headerTitle: { fontSize: 22, fontWeight: "700", color: "#111827" },
  iconBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: "#FFFFFF", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "#F3F4F6" },
  rangeRow: { flexDirection: "row", backgroundColor: "#F3F4F6", borderRadius: 12, padding: 4, marginBottom: 16 },
  rangeChip: { flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: "center" },
  rangeChipActive: { backgroundColor: "#FFFFFF" },
  rangeChipText: { fontSize: 13, color: "#6B7280", fontWeight: "600" },
  rangeChipTextActive: { color: "#111827", fontWeight: "700" },
  totalCard: { backgroundColor: "#FFFFFF", borderRadius: 20, padding: 20, borderWidth: 1, borderColor: "#F3F4F6" },
  totalLabel: { color: "#6B7280", fontSize: 13, fontWeight: "600" },
  totalAmount: { color: "#111827", fontSize: 28, fontWeight: "800", marginTop: 4 },
  totalMetaRow: { flexDirection: "row", marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: "#F3F4F6", alignItems: "center" },
  metaItem: { flex: 1, alignItems: "center" },
  metaLabel: { color: "#9CA3AF", fontSize: 11, marginBottom: 4 },
  metaValue: { color: "#111827", fontWeight: "700", fontSize: 13 },
  divider: { width: 1, height: 24, backgroundColor: "#F3F4F6" },
  section: { marginTop: 24 },
  sectionHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  aiTitleRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  metaTinyLabel: { color: "#9CA3AF", fontSize: 11 },
  sectionTitle: { fontSize: 15, fontWeight: "700", color: "#111827", marginBottom: 12 },
  trendCard: { backgroundColor: "#FFFFFF", borderRadius: 16, padding: 16, borderWidth: 1, borderColor: "#F3F4F6" },
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
  insightCard: { flexDirection: "row", backgroundColor: "#FFFFFF", borderRadius: 16, padding: 14, borderWidth: 1, borderColor: "#F3F4F6", borderLeftWidth: 4, gap: 12, alignItems: "flex-start" },
  insightIcon: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  insightTitle: { color: "#111827", fontSize: 14, fontWeight: "700", marginBottom: 4 },
  insightBody: { color: "#4B5563", fontSize: 12, lineHeight: 18 },
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
  chatPromptList: { gap: 8, marginTop: 14 },
  chatPrompt: { flexDirection: "row", alignItems: "center", backgroundColor: "rgba(255,255,255,0.06)", borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" },
  chatPromptText: { color: "#E0E7FF", fontSize: 12, fontWeight: "600", flex: 1 },
  classifyCard: { backgroundColor: "#FFFFFF", borderRadius: 16, padding: 16, borderWidth: 1, borderColor: "#F3F4F6" },
  classifyRow: { flexDirection: "row" },
  classifyStat: { flex: 1, alignItems: "center", paddingVertical: 8, borderRightColor: "#F3F4F6" },
  classifyValue: { fontSize: 22, fontWeight: "800", color: "#111827" },
  classifyLabel: { fontSize: 11, color: "#6B7280", marginTop: 4 },
  classifyAccBox: { marginTop: 12, paddingTop: 14, borderTopWidth: 1, borderTopColor: "#F3F4F6" },
  classifyAccHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  classifyAccLabel: { color: "#6B7280", fontWeight: "600", fontSize: 12 },
  classifyAccVal: { color: "#111827", fontWeight: "800", fontSize: 14 },
  classifyTrack: { height: 6, backgroundColor: "#F3F4F6", borderRadius: 999, marginTop: 8, overflow: "hidden" },
  classifyFill: { height: "100%", backgroundColor: "#10B981", borderRadius: 999 },
  classifyHint: { color: "#9CA3AF", fontSize: 11, lineHeight: 16, marginTop: 10 },
  emptyText: { color: "#9CA3AF", fontSize: 13, textAlign: "center" },
});
