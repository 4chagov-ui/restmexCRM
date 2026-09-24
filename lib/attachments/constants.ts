export const REQUEST_ATTACHMENTS_BUCKET = "request-attachments";

export const MAX_PHOTOS_PER_OPERATION = 10;
export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024; // after client optimize
export const MAX_IMAGE_EDGE_PX = 1920;
export const JPEG_QUALITY = 0.82;

export const ALLOWED_IMAGE_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export type AllowedImageMimeType = (typeof ALLOWED_IMAGE_MIME_TYPES)[number];

export const HEIC_MIME_HINTS = [
  "image/heic",
  "image/heif",
  "image/heic-sequence",
  "image/heif-sequence",
] as const;

export function isAllowedImageMime(mime: string): mime is AllowedImageMimeType {
  return (ALLOWED_IMAGE_MIME_TYPES as readonly string[]).includes(mime);
}

export function isHeicLike(file: File) {
  const mime = (file.type || "").toLowerCase();
  if ((HEIC_MIME_HINTS as readonly string[]).includes(mime)) {
    return true;
  }
  const name = file.name.toLowerCase();
  return name.endsWith(".heic") || name.endsWith(".heif");
}

export function extensionForMime(mime: string) {
  if (mime === "image/png") return "png";
  if (mime === "image/webp") return "webp";
  return "jpg";
}

export function buildAttachmentStoragePath(
  requestId: string,
  attachmentId: string,
  mimeType: string,
) {
  return `${requestId}/${attachmentId}.${extensionForMime(mimeType)}`;
}
