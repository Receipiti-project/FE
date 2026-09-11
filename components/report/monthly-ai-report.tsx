import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { formatKRW } from "@/constants/mockData";
import { createReport, ReportResponse } from "@/services/api/reportApi";

function monthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(date: Date): string {
  return `${date.getFullYear()}년 ${date.getMonth() + 1}월`;
}

function moveMonth(date: Date, amount: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + amount, 1);
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metric}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue}>{value}</Text>
    </View>
  );
}

function AnalysisRow({
  icon,
  title,
  value,
  description,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  value: string;
  description?: string;
}) {
  return (
    <View style={styles.analysisRow}>
      <View style={styles.analysisIcon}>
        <Ionicons name={icon} size={17} color="#3B82F6" />
      </View>
      <View style={styles.analysisContent}>
        <Text style={styles.analysisTitle}>{title}</Text>
        <Text style={styles.analysisValue}>{value}</Text>
        {!!description && <Text style={styles.analysisDescription}>{description}</Text>}
      </View>
    </View>
  );
}

export function MonthlyAiReport() {
  const currentMonth = useMemo(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  }, []);
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  const [report, setReport] = useState<ReportResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isCurrentMonth = monthKey(selectedMonth) === monthKey(currentMonth);

  const selectMonth = (amount: number) => {
    setSelectedMonth((previous) => moveMonth(previous, amount));
    setReport(null);
    setError(null);
  };

  const loadReport = async () => {
    setLoading(true);
    setError(null);
    try {
      setReport(await createReport(monthKey(selectedMonth)));
    } catch (requestError) {
      setReport(null);
      setError((requestError as Error)?.message ?? "리포트를 생성하지 못했어요.");
    } finally {
      setLoading(false);
    }
  };

  const time = report?.frequentSpendingTime;
  const day = report?.frequentSpendingDay;
  const category = report?.topCategory;

  return (
    <View style={styles.section}>
      <View style={styles.sectionTitleRow}>
        <View style={styles.titleGroup}>
          <Ionicons name="sparkles-outline" size={17} color="#3B82F6" />
          <Text style={styles.sectionTitle}>AI 월간 소비 리포트</Text>
        </View>
      </View>

      <View style={styles.monthCard}>
        <Text style={styles.monthHint}>분석할 월을 선택하세요</Text>
        <View style={styles.monthSelector}>
          <TouchableOpacity
            accessibilityLabel="이전 달"
            hitSlop={10}
            onPress={() => selectMonth(-1)}
            style={styles.monthButton}
          >
            <Ionicons name="chevron-back" size={21} color="#374151" />
          </TouchableOpacity>
          <Text style={styles.monthText}>{monthLabel(selectedMonth)}</Text>
          <TouchableOpacity
            accessibilityLabel="다음 달"
            disabled={isCurrentMonth}
            hitSlop={10}
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
        <TouchableOpacity
          disabled={loading}
          onPress={loadReport}
          style={[styles.generateButton, loading && styles.generateButtonDisabled]}
        >
          {loading ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Ionicons name="sparkles" size={16} color="#FFFFFF" />
          )}
          <Text style={styles.generateButtonText}>
            {loading ? "분석 중..." : report ? "다시 생성하기" : "리포트 보기"}
          </Text>
        </TouchableOpacity>
      </View>

      {!!error && (
        <View style={styles.errorCard}>
          <Ionicons name="alert-circle-outline" size={18} color="#DC2626" />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {report && (
        <View style={styles.resultCard}>
          <View style={styles.resultHeader}>
            <View>
              <Text style={styles.resultMonth}>{report.targetMonth ?? monthKey(selectedMonth)}</Text>
              <Text style={styles.resultTitle}>소비 분석 결과</Text>
            </View>
            <View
              style={[
                styles.anomalyBadge,
                report.anomalyDetected && styles.anomalyBadgeWarning,
              ]}
            >
              <Text
                style={[
                  styles.anomalyBadgeText,
                  report.anomalyDetected && styles.anomalyBadgeTextWarning,
                ]}
              >
                {report.anomalyDetected ? "이상 소비 감지" : "안정적인 소비"}
              </Text>
            </View>
          </View>

          <View style={styles.metricsRow}>
            <Metric label="총 지출" value={formatKRW(report.totalAmount ?? 0)} />
            <View style={styles.metricDivider} />
            <Metric label="결제 건수" value={`${report.transactionCount ?? 0}건`} />
          </View>

          {!!report.anomalyReason && (
            <View style={report.anomalyDetected ? styles.warningBox : styles.normalBox}>
              <Text style={report.anomalyDetected ? styles.warningText : styles.normalText}>
                {report.anomalyReason}
              </Text>
            </View>
          )}

          <View style={styles.analysisList}>
            {time && (
              <AnalysisRow
                icon="time-outline"
                title="자주 소비한 시간"
                value={`${time.timeRange ?? "-"} · ${time.transactionCount ?? 0}건 · ${formatKRW(time.amount ?? 0)}`}
                description={time.description}
              />
            )}
            {day && (
              <AnalysisRow
                icon="calendar-outline"
                title="자주 소비한 요일"
                value={`${day.dayOfWeek ?? "-"} · ${day.transactionCount ?? 0}건 · ${formatKRW(day.amount ?? 0)}`}
                description={day.description}
              />
            )}
            {category && (
              <AnalysisRow
                icon="pie-chart-outline"
                title="가장 많이 쓴 카테고리"
                value={`${category.categoryName ?? "-"} · ${formatKRW(category.amount ?? 0)} · ${Math.round(category.percentage ?? 0)}%`}
                description={category.description}
              />
            )}
          </View>

          {!!report.spendingPatternInsights?.length && (
            <View style={styles.insightsBox}>
              <Text style={styles.subheading}>소비 패턴 인사이트</Text>
              {report.spendingPatternInsights.map((insight, index) => (
                <View key={`${index}-${insight}`} style={styles.insightRow}>
                  <View style={styles.insightDot} />
                  <Text style={styles.insightText}>{insight}</Text>
                </View>
              ))}
            </View>
          )}

          {!!report.summary && (
            <View style={styles.summaryBox}>
              <View style={styles.summaryTitleRow}>
                <Ionicons name="document-text-outline" size={16} color="#1D4ED8" />
                <Text style={styles.summaryTitle}>AI 요약</Text>
              </View>
              <Text style={styles.summaryText}>{report.summary}</Text>
            </View>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginTop: 24 },
  sectionTitleRow: { marginBottom: 12 },
  titleGroup: { flexDirection: "row", alignItems: "center", gap: 6 },
  sectionTitle: { color: "#111827", fontSize: 15, fontWeight: "700" },
  monthCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    padding: 16,
  },
  monthHint: { color: "#6B7280", fontSize: 12, textAlign: "center" },
  monthSelector: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 12,
  },
  monthButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
  },
  monthButtonDisabled: { backgroundColor: "#F9FAFB" },
  monthText: { color: "#111827", fontSize: 18, fontWeight: "800" },
  generateButton: {
    height: 46,
    borderRadius: 12,
    backgroundColor: "#2563EB",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    marginTop: 16,
  },
  generateButtonDisabled: { opacity: 0.65 },
  generateButtonText: { color: "#FFFFFF", fontSize: 14, fontWeight: "700" },
  errorCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    padding: 13,
    marginTop: 10,
    borderRadius: 12,
    backgroundColor: "#FEF2F2",
  },
  errorText: { flex: 1, color: "#B91C1C", fontSize: 12, lineHeight: 18 },
  resultCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    padding: 16,
    marginTop: 12,
  },
  resultHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  resultMonth: { color: "#6B7280", fontSize: 11, fontWeight: "600" },
  resultTitle: { color: "#111827", fontSize: 17, fontWeight: "800", marginTop: 2 },
  anomalyBadge: { backgroundColor: "#ECFDF5", borderRadius: 999, paddingHorizontal: 9, paddingVertical: 5 },
  anomalyBadgeWarning: { backgroundColor: "#FFF7ED" },
  anomalyBadgeText: { color: "#047857", fontSize: 10, fontWeight: "700" },
  anomalyBadgeTextWarning: { color: "#C2410C" },
  metricsRow: {
    flexDirection: "row",
    alignItems: "center",
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: "#F3F4F6",
    paddingVertical: 15,
    marginTop: 16,
  },
  metric: { flex: 1, alignItems: "center" },
  metricLabel: { color: "#9CA3AF", fontSize: 11 },
  metricValue: { color: "#111827", fontSize: 16, fontWeight: "800", marginTop: 4 },
  metricDivider: { width: 1, height: 32, backgroundColor: "#E5E7EB" },
  warningBox: { backgroundColor: "#FFF7ED", borderRadius: 10, padding: 11, marginTop: 12 },
  warningText: { color: "#9A3412", fontSize: 12, lineHeight: 18 },
  normalBox: { backgroundColor: "#ECFDF5", borderRadius: 10, padding: 11, marginTop: 12 },
  normalText: { color: "#047857", fontSize: 12, lineHeight: 18 },
  analysisList: { marginTop: 6 },
  analysisRow: {
    flexDirection: "row",
    gap: 10,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  analysisIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: "#EFF6FF",
    alignItems: "center",
    justifyContent: "center",
  },
  analysisContent: { flex: 1 },
  analysisTitle: { color: "#6B7280", fontSize: 11, fontWeight: "600" },
  analysisValue: { color: "#111827", fontSize: 13, fontWeight: "700", marginTop: 3 },
  analysisDescription: { color: "#6B7280", fontSize: 11, lineHeight: 17, marginTop: 4 },
  insightsBox: { marginTop: 15 },
  subheading: { color: "#111827", fontSize: 13, fontWeight: "700", marginBottom: 9 },
  insightRow: { flexDirection: "row", alignItems: "flex-start", gap: 8, marginBottom: 7 },
  insightDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: "#3B82F6", marginTop: 6 },
  insightText: { flex: 1, color: "#4B5563", fontSize: 12, lineHeight: 18 },
  summaryBox: { backgroundColor: "#EFF6FF", borderRadius: 12, padding: 13, marginTop: 14 },
  summaryTitleRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  summaryTitle: { color: "#1D4ED8", fontSize: 12, fontWeight: "700" },
  summaryText: { color: "#1E3A8A", fontSize: 12, lineHeight: 19, marginTop: 7 },
});
