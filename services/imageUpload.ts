import { Platform } from "react-native";
import { File as ExpoFile } from "expo-file-system";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";

const TARGET_UPLOAD_BYTES = 850 * 1024;

const COMPRESSION_ATTEMPTS = [
  { maxDimension: 2400, quality: 0.72 },
  { maxDimension: 2000, quality: 0.62 },
  { maxDimension: 1600, quality: 0.52 },
  { maxDimension: 1200, quality: 0.42 },
] as const;

export type PreparedUploadImage = {
  uri: string;
  fileName: string;
  mimeType: string;
  size: number | null;
};

async function getFileSize(uri: string): Promise<number | null> {
  if (Platform.OS !== "web") {
    try {
      const file = new ExpoFile(uri);
      return file.exists ? file.size : null;
    } catch {
      // 일부 content URI는 File API로 크기를 읽을 수 없어 fetch로 재시도합니다.
    }
  }

  try {
    const response = await fetch(uri);
    return (await response.blob()).size;
  } catch {
    return null;
  }
}

function originalUploadInfo(uri: string, size: number | null): PreparedUploadImage {
  const path = uri.split("?")[0];
  const originalName = path.substring(path.lastIndexOf("/") + 1);
  const extension = originalName.toLowerCase().split(".").pop();

  if (extension === "png") {
    return { uri, fileName: originalName || "upload.png", mimeType: "image/png", size };
  }
  if (extension === "heic" || extension === "heif") {
    return { uri, fileName: originalName || "upload.heic", mimeType: "image/heic", size };
  }
  return { uri, fileName: originalName || "upload.jpg", mimeType: "image/jpeg", size };
}

function removeCachedFile(uri?: string): void {
  if (!uri || Platform.OS === "web") return;
  try {
    const file = new ExpoFile(uri);
    if (file.exists) file.delete();
  } catch {
    // 캐시 정리는 업로드 성공 여부에 영향을 주지 않습니다.
  }
}

/**
 * Nginx 요청 제한보다 작아지도록 이미지를 JPEG로 단계적으로 최적화합니다.
 * 이미 충분히 작은 파일은 재인코딩하지 않아 OCR 선명도를 보존합니다.
 */
export async function prepareImageForUpload(uri: string): Promise<PreparedUploadImage> {
  const originalSize = await getFileSize(uri);
  if (originalSize !== null && originalSize <= TARGET_UPLOAD_BYTES) {
    return originalUploadInfo(uri, originalSize);
  }

  const source = await ImageManipulator.manipulate(uri).renderAsync();
  let previousAttemptUri: string | undefined;
  let latest: PreparedUploadImage | null = null;

  for (const attempt of COMPRESSION_ATTEMPTS) {
    const context = ImageManipulator.manipulate(uri);
    const longestSide = Math.max(source.width, source.height);

    if (longestSide > attempt.maxDimension) {
      if (source.width >= source.height) {
        context.resize({ width: attempt.maxDimension, height: null });
      } else {
        context.resize({ width: null, height: attempt.maxDimension });
      }
    }

    const rendered = await context.renderAsync();
    const result = await rendered.saveAsync({
      compress: attempt.quality,
      format: SaveFormat.JPEG,
    });
    const size = await getFileSize(result.uri);

    removeCachedFile(previousAttemptUri);
    previousAttemptUri = result.uri;
    latest = {
      uri: result.uri,
      fileName: `upload_${Date.now()}.jpg`,
      mimeType: "image/jpeg",
      size,
    };

    if (size !== null && size <= TARGET_UPLOAD_BYTES) return latest;
  }

  if (!latest) throw new Error("이미지를 변환하지 못했어요.");
  return latest;
}
