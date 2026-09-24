"use server";

import { revalidatePath } from "next/cache";
import { requireCurrentUser, requireManagerUser } from "@/lib/auth/current-user";
import { canUseManagerArea } from "@/lib/auth/permissions";
import {
  collectPhotoFiles,
  deleteRequestPhoto,
  listRequestLevelPhotos,
  listRequestAttachments,
  signAttachmentUrls,
  uploadRequestPhoto,
  type AttachmentWithUrl,
} from "@/lib/db/attachments";
import { logRequestHistory } from "@/lib/db/request-history";
import {
  isAllowedImageMime,
  MAX_PHOTOS_PER_OPERATION,
  MAX_UPLOAD_BYTES,
} from "@/lib/attachments/constants";
import { getMechanicRequestById } from "@/lib/db/work";

export type AttachmentActionResult =
  | { ok: true; uploaded?: number; failed?: number; warnings?: string[] }
  | { ok: false; error: string };

function revalidateRequestPaths(requestId: string) {
  revalidatePath(`/requests/${requestId}`);
  revalidatePath(`/work/requests/${requestId}`);
  revalidatePath("/requests");
  revalidatePath("/work/requests");
  revalidatePath("/work/today");
  revalidatePath("/today");
}

async function assertCanAccessRequestMedia(requestId: string) {
  const context = await requireCurrentUser();
  if (!context.authUser || !context.profile) {
    return { ok: false as const, error: "Нужна авторизация." };
  }

  if (canUseManagerArea(context.role)) {
    return { ok: true as const, context };
  }

  if (context.role === "mechanic" && context.employee) {
    const request = await getMechanicRequestById(
      context.employee.id,
      requestId,
    );
    if (!request) {
      return { ok: false as const, error: "Заявка не найдена или недоступна." };
    }
    return { ok: true as const, context };
  }

  return { ok: false as const, error: "Недостаточно прав." };
}

export async function getRequestPhotosAction(
  requestId: string,
): Promise<AttachmentWithUrl[]> {
  const access = await assertCanAccessRequestMedia(requestId);
  if (!access.ok) {
    return [];
  }

  const photos = await listRequestLevelPhotos(requestId);
  return signAttachmentUrls(photos);
}

export async function uploadRequestPhotosAction(
  requestId: string,
  formData: FormData,
): Promise<AttachmentActionResult> {
  const access = await assertCanAccessRequestMedia(requestId);
  if (!access.ok) {
    return access;
  }

  const files = collectPhotoFiles(formData);
  if (files.length === 0) {
    return { ok: false, error: "Выберите хотя бы одно фото." };
  }

  if (files.length > MAX_PHOTOS_PER_OPERATION) {
    return {
      ok: false,
      error: `За один раз можно добавить не больше ${MAX_PHOTOS_PER_OPERATION} фото.`,
    };
  }

  const existing = await listRequestAttachments(requestId);
  const requestLevelCount = existing.filter((item) => item.comment_id == null)
    .length;
  if (requestLevelCount + files.length > MAX_PHOTOS_PER_OPERATION * 2) {
    // Soft ceiling: 20 request-level photos total.
    return {
      ok: false,
      error: "Слишком много фотографий в заявке. Удалите лишние и попробуйте снова.",
    };
  }

  let uploaded = 0;
  const warnings: string[] = [];

  for (const file of files) {
    const mime = file.type || "application/octet-stream";
    if (!isAllowedImageMime(mime)) {
      warnings.push(`«${file.name}»: недопустимый тип файла.`);
      continue;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      warnings.push(`«${file.name}»: файл слишком большой.`);
      continue;
    }

    const result = await uploadRequestPhoto({
      requestId,
      file,
      fileName: file.name,
      mimeType: mime,
      fileSize: file.size,
      uploadedBy: access.context.profile!.id,
      commentId: null,
    });

    if (result.ok) {
      uploaded += 1;
    } else {
      warnings.push(`«${file.name}»: ${result.error}`);
    }
  }

  if (uploaded > 0) {
    await logRequestHistory({
      requestId,
      action: "attachment_added",
      metadata: {
        count: uploaded,
        scope: "request",
      },
    });
  }

  revalidateRequestPaths(requestId);

  if (uploaded === 0) {
    return {
      ok: false,
      error: warnings[0] ?? "Не удалось загрузить фотографии.",
    };
  }

  return {
    ok: true,
    uploaded,
    failed: warnings.length,
    warnings: warnings.length > 0 ? warnings : undefined,
  };
}

export async function deleteRequestPhotoAction(
  attachmentId: string,
): Promise<AttachmentActionResult> {
  await requireCurrentUser();

  try {
    const result = await deleteRequestPhoto(attachmentId);
    if (!result.ok) {
      return result;
    }

    await logRequestHistory({
      requestId: result.requestId,
      action: "attachment_removed",
      metadata: {
        count: 1,
        scope: "request",
      },
    });

    revalidateRequestPaths(result.requestId);
    return {
      ok: true,
      warnings: result.warning ? [result.warning] : undefined,
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Не удалось удалить фото.",
    };
  }
}

/** Manager-only helper used after create — same upload path. */
export async function uploadPhotosForNewRequest(
  requestId: string,
  files: File[],
  uploadedBy: string,
) {
  await requireManagerUser();

  let uploaded = 0;
  const failures: string[] = [];

  for (const file of files.slice(0, MAX_PHOTOS_PER_OPERATION)) {
    const mime = file.type || "application/octet-stream";
    if (!isAllowedImageMime(mime)) {
      failures.push(`«${file.name}»: недопустимый тип.`);
      continue;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      failures.push(`«${file.name}»: слишком большой файл.`);
      continue;
    }

    const result = await uploadRequestPhoto({
      requestId,
      file,
      fileName: file.name,
      mimeType: mime,
      fileSize: file.size,
      uploadedBy,
      commentId: null,
    });

    if (result.ok) {
      uploaded += 1;
    } else {
      failures.push(`«${file.name}»: ${result.error}`);
    }
  }

  if (uploaded > 0) {
    await logRequestHistory({
      requestId,
      action: "attachment_added",
      metadata: {
        count: uploaded,
        scope: "request",
      },
    });
  }

  return { uploaded, failures };
}
