import { apiUrl, buildAuthHeaders } from "@/services/api/config";

/** POST /api/v1/report 응답 */
export type ReportTimeAnalysis = {
  timeRange?: string;
  transactionCount?: number;
  amount?: number;
  description?: string;
};

export type ReportDayAnalysis = {
  dayOfWeek?: string;
  transactionCount?: number;
  amount?: number;
  description?: string;
};

export type ReportCategoryAnalysis = {
  categoryName?: string;
  amount?: number;
  percentage?: number;
  description?: string;
};

export type ReportResponse = {
  targetMonth?: string;
  totalAmount?: number;
  transactionCount?: number;
  anomalyDetected?: boolean;
  anomalyReason?: string;
  frequentSpendingTime?: ReportTimeAnalysis | null;
  frequentSpendingDay?: ReportDayAnalysis | null;
  topCategory?: ReportCategoryAnalysis | null;
  spendingPatternInsights?: string[];
  summary?: string;
};

/**
 * POST /api/v1/report?month=YYYY-MM
 * 서버 DB에 저장된 선택 월 소비 데이터를 기반으로 AI 소비 분석 리포트 생성
 */
export async function createReport(month: string): Promise<ReportResponse> {
  const url = apiUrl(`/api/v1/report?month=${encodeURIComponent(month)}`);
  const res = await fetch(url, {
    method: "POST",
    headers: buildAuthHeaders(),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => null) as { message?: string } | null;
    throw new Error(body?.message || `AI 리포트 생성 실패 (HTTP ${res.status})`);
  }

  return res.json() as Promise<ReportResponse>;
}
