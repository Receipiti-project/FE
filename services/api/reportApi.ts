import { apiUrl, buildAuthHeaders, isApiConfigured } from "@/services/api/config";

/** POST /api/v1/report 응답 */
export type ReportResponse = {
  report: string;
};

/**
 * POST /api/v1/report?month=YYYY-MM
 * 선택한 월의 소비 데이터를 기반으로 AI 소비 분석 리포트(마크다운) 생성
 */
export async function createReport(
  month: string,
  expenditureData: string
): Promise<ReportResponse> {
  if (!isApiConfigured()) {
    throw new Error("API_BASE_URL 이 설정되지 않았습니다.");
  }

  const url = apiUrl(`/api/v1/report?month=${encodeURIComponent(month)}`);
  const res = await fetch(url, {
    method: "POST",
    headers: buildAuthHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ expenditureData }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`AI 리포트 생성 실패 (HTTP ${res.status})${text ? `: ${text}` : ""}`);
  }

  return res.json() as Promise<ReportResponse>;
}
