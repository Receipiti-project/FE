import {
  recognizeImageViaServer,
  ApiNotConfiguredError,
  OcrServerError,
  type OcrUploadKind,
} from "@/services/api/ocrApi";
import { isApiConfigured } from "@/services/api/config";

export { ApiNotConfiguredError, OcrServerError };

export type RecognizedTextLine = {
  text: string;
  frame?: { x: number; y: number; w: number; h: number };
};

export type RecognizedText = {
  text: string;
  lines: RecognizedTextLine[];
  engine: string;
};

export function isServerOcrConfigured(): boolean {
  return isApiConfigured();
}

export function isOnDeviceOcrAvailable(): boolean {
  return isServerOcrConfigured();
}

export const MLKitUnavailableError = ApiNotConfiguredError;

export async function recognizeText(
  uri: string,
  kind: OcrUploadKind = "receipt"
): Promise<RecognizedText> {
  return recognizeImageViaServer(kind, uri);
}

export function fromManualText(text: string): RecognizedText {
  const lines: RecognizedTextLine[] = text
    .split(/\r?\n/)
    .map((t) => t.trim())
    .filter(Boolean)
    .map((t) => ({ text: t }));
  return { text, lines, engine: "manual" };
}
