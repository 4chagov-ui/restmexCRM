import {
  isAllowedImageMime,
  isHeicLike,
  JPEG_QUALITY,
  MAX_IMAGE_EDGE_PX,
  MAX_UPLOAD_BYTES,
} from "@/lib/attachments/constants";

export type OptimizeImageResult =
  | { ok: true; file: File }
  | { ok: false; error: string };

function loadImageBitmap(file: File): Promise<ImageBitmap> {
  return createImageBitmap(file);
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality: number,
): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), type, quality);
  });
}

/**
 * Client-side resize/compress before upload.
 * Small images stay untouched when already under limits.
 */
export async function optimizeImageForUpload(
  file: File,
): Promise<OptimizeImageResult> {
  if (isHeicLike(file)) {
    return {
      ok: false,
      error: `«${file.name}»: формат HEIC/HEIF не поддерживается. Сохраните фото как JPEG или PNG.`,
    };
  }

  const mime = file.type || "application/octet-stream";
  if (!isAllowedImageMime(mime)) {
    return {
      ok: false,
      error: `«${file.name}»: допустимы только JPEG, PNG или WebP.`,
    };
  }

  try {
    const bitmap = await loadImageBitmap(file);
    const longest = Math.max(bitmap.width, bitmap.height);
    const needsResize = longest > MAX_IMAGE_EDGE_PX;
    const needsReencode =
      needsResize || file.size > MAX_UPLOAD_BYTES || mime === "image/png";

    if (!needsReencode) {
      bitmap.close();
      return { ok: true, file };
    }

    const scale = needsResize ? MAX_IMAGE_EDGE_PX / longest : 1;
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      bitmap.close();
      return { ok: false, error: `«${file.name}»: не удалось обработать изображение.` };
    }

    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();

    const outputType = mime === "image/png" ? "image/png" : "image/jpeg";
    const blob = await canvasToBlob(
      canvas,
      outputType,
      outputType === "image/jpeg" ? JPEG_QUALITY : 0.92,
    );

    if (!blob) {
      return { ok: false, error: `«${file.name}»: не удалось сжать изображение.` };
    }

    if (blob.size > MAX_UPLOAD_BYTES) {
      return {
        ok: false,
        error: `«${file.name}»: даже после сжатия файл слишком большой.`,
      };
    }

    const baseName = file.name.replace(/\.[^.]+$/, "") || "photo";
    const ext = outputType === "image/png" ? "png" : "jpg";
    const optimized = new File([blob], `${baseName}.${ext}`, {
      type: outputType,
      lastModified: Date.now(),
    });

    return { ok: true, file: optimized };
  } catch {
    return {
      ok: false,
      error: `«${file.name}»: не удалось прочитать изображение.`,
    };
  }
}

export async function optimizeImagesForUpload(files: File[]) {
  const optimized: File[] = [];
  const errors: string[] = [];

  for (const file of files) {
    const result = await optimizeImageForUpload(file);
    if (result.ok) {
      optimized.push(result.file);
    } else {
      errors.push(result.error);
    }
  }

  return { optimized, errors };
}
