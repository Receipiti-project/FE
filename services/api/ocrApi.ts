import {
  API_OCR_TIMEOUT_MS,
  OCR_ENDPOINTS,
  apiUrl,
  buildAuthHeaders,
  isApiConfigured,
} from "@/services/api/config";
import type { RecognizedText, RecognizedTextLine } from "@/services/textRecognition";

export type RemoteOcrLine = {
  text: string;
  frame?: { x: number; y: number; w: number; h: number };
};

export type RemoteOcrResponse = {
  text: string;
  lines?: RemoteOcrLine[];
  engine?: string;
  confidence?: number;
};

export type RemoteOcrError = {
  error: { code: string; message: string };
};

export class ApiNotConfiguredError extends Error {
  constructor() {
    super(
      "백엔드 API URL 이 아직 설정되지 않았어요."
    );
    this.name = "ApiNotConfiguredError";
  }
}

export class OcrServerError extends Error {
  status: number;
  code?: string;
  constructor(status: number, message: string, code?: string) {
    super(message);
    this.name = "OcrServerError";
    this.status = status;
    this.code = code;
  }
}

export type OcrUploadKind = "receipt" | "capture";

export async function recognizeImageViaServer(
  kind: OcrUploadKind,
  uri: string,
  opts?: { requestId?: string }
): Promise<RecognizedText> {
  if (!isApiConfigured()) {
    throw new ApiNotConfiguredError();
  }

  const endpoint = kind === "receipt" ? OCR_ENDPOINTS.receipt : OCR_ENDPOINTS.capture;
  const url = apiUrl(endpoint);

  const headers = buildAuthHeaders();

  const form = new FormData();
  const fileName = inferFileName(uri);
  const mime = inferMime(fileName);

  form.append(
    "image",
    {
      uri,
      name: fileName,
      type: mime,
    } as unknown as Blob
  );
  form.append("lang", "ko");
  if (opts?.requestId) form.append("requestId", opts.requestId);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), API_OCR_TIMEOUT_MS);

  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers,
      body: form as unknown as BodyInit,
      signal: controller.signal,
    });
  } catch (e) {
    clearTimeout(timer);
    const msg =
      (e as Error)?.name === "AbortError"
        ? `OCR 요청이 ${Math.round(API_OCR_TIMEOUT_MS / 1000)}초를 초과했어요.`
        : `백엔드 OCR 호출에 실패했어요: ${(e as Error)?.message ?? "네트워크 오류"}`;
    throw new OcrServerError(0, msg, "NETWORK");
  }
  clearTimeout(timer);

  if (!res.ok) {
    let errCode = `HTTP_${res.status}`;
    let errMsg = `백엔드 OCR 응답 오류 (HTTP ${res.status})`;
    try {
      const body = (await res.json()) as RemoteOcrError;
      if (body?.error) {
        errCode = body.error.code ?? errCode;
        errMsg = body.error.message ?? errMsg;
      }
    } catch {
    }
    throw new OcrServerError(res.status, errMsg, errCode);
  }

  const data = (await res.json()) as RemoteOcrResponse;
  return normalizeRemoteOcr(data);
}


export function normalizeRemoteOcr(r: RemoteOcrResponse): RecognizedText {
  const text = r.text ?? "";
  const linesFromApi: RecognizedTextLine[] = Array.isArray(r.lines)
    ? r.lines
        .map((l) => ({
          text: (l.text ?? "").trim(),
          frame: l.frame,
        }))
        .filter((l) => l.text.length > 0)
    : [];

  const lines =
    linesFromApi.length > 0
      ? linesFromApi
      : text
          .split(/\r?\n/)
          .map((t) => t.trim())
          .filter(Boolean)
          .map((t) => ({ text: t }));

  return {
    text: text || lines.map((l) => l.text).join("\n"),
    lines,
    engine: r.engine ?? "server-ocr",
  };
}


function inferFileName(uri: string): string {
  const clean = uri.split("?")[0];
  const last = clean.substring(clean.lastIndexOf("/") + 1);
  if (last && /\.[a-zA-Z0-9]{2,4}$/.test(last)) return last;
  return `upload_${Date.now()}.jpg`;
}

function inferMime(fileName: string): string {
  const ext = fileName.toLowerCase().split(".").pop() ?? "";
  switch (ext) {
    case "png":
      return "image/png";
    case "heic":
      return "image/heic";
    case "heif":
      return "image/heif";
    case "webp":
      return "image/webp";
    case "jpg":
    case "jpeg":
    default:
      return "image/jpeg";
  }
}
