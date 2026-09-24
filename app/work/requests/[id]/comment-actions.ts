"use server";

import { revalidatePath } from "next/cache";
import { requireMechanicUser } from "@/lib/auth/current-user";
import {
  collectPhotoFiles,
  uploadRequestPhoto,
} from "@/lib/db/attachments";
import {
  createRequestComment,
} from "@/lib/db/request-comments";
import { logRequestHistory } from "@/lib/db/request-history";
import { getMechanicRequestById } from "@/lib/db/work";
import {
  isAllowedImageMime,
  MAX_PHOTOS_PER_OPERATION,
  MAX_UPLOAD_BYTES,
} from "@/lib/attachments/constants";
import type { WorkActionResult } from "@/app/work/requests/[id]/actions";

function revalidateWorkPaths(requestId: string) {
  revalidatePath("/work/today");
  revalidatePath("/work/requests");
  revalidatePath(`/work/requests/${requestId}`);
  revalidatePath("/today");
  revalidatePath(`/requests/${requestId}`);
}

export async function addWorkCommentAction(
  requestId: string,
  formData: FormData,
): Promise<WorkActionResult & { warnings?: string[] }> {
  const context = await requireMechanicUser();

  try {
    if (!requestId) {
      return { ok: false, error: "Не найден ID заявки." };
    }

    const request = await getMechanicRequestById(
      context.employee.id,
      requestId,
    );

    if (!request) {
      return { ok: false, error: "Заявка не найдена или недоступна." };
    }

    const bodyRaw = formData.get("body");
    const body = typeof bodyRaw === "string" ? bodyRaw.trim() : "";
    const files = collectPhotoFiles(formData);

    if (!body && files.length === 0) {
      return {
        ok: false,
        error: "Напишите комментарий или добавьте фото.",
      };
    }

    if (files.length > MAX_PHOTOS_PER_OPERATION) {
      return {
        ok: false,
        error: `За один раз можно добавить не больше ${MAX_PHOTOS_PER_OPERATION} фото.`,
      };
    }

    const comment = await createRequestComment({
      requestId,
      authorId: context.profile.id,
      body,
    });

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
        uploadedBy: context.profile.id,
        commentId: comment.id,
      });

      if (result.ok) {
        uploaded += 1;
      } else {
        warnings.push(`«${file.name}»: ${result.error}`);
      }
    }

    await logRequestHistory({
      requestId,
      action: "comment_added",
      metadata: {
        commentId: comment.id,
        photoCount: uploaded,
        hasText: body.length > 0,
      },
    });

    if (uploaded > 0) {
      await logRequestHistory({
        requestId,
        action: "attachment_added",
        metadata: {
          count: uploaded,
          scope: "comment",
          commentId: comment.id,
        },
      });
    }

    revalidateWorkPaths(requestId);

    if (uploaded === 0 && files.length > 0 && warnings.length > 0) {
      return {
        ok: true,
        warnings: [
          "Комментарий сохранён, но фото не загрузились: " +
            warnings.join(" "),
        ],
      };
    }

    return {
      ok: true,
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error ? error.message : "Не удалось добавить комментарий.",
    };
  }
}
