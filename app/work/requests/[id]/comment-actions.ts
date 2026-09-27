"use server";

import { revalidatePath } from "next/cache";
import { requireMechanicUser } from "@/lib/auth/current-user";
import { createRequestComment } from "@/lib/db/request-comments";
import { logRequestHistory } from "@/lib/db/request-history";
import { getMechanicRequestById } from "@/lib/db/work";

function revalidateWorkPaths(requestId: string) {
  revalidatePath("/work/today");
  revalidatePath("/work/requests");
  revalidatePath(`/work/requests/${requestId}`);
  revalidatePath("/today");
  revalidatePath(`/requests/${requestId}`);
}

export async function addWorkCommentAction(
  requestId: string,
  body: string,
): Promise<
  { ok: true; commentId: string } | { ok: false; error: string }
> {
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

    const comment = await createRequestComment({
      requestId,
      authorId: context.profile.id,
      body,
    });

    return { ok: true, commentId: comment.id };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : "Не удалось добавить комментарий.",
    };
  }
}

export async function logWorkCommentAction(input: {
  requestId: string;
  commentId: string;
  photoCount: number;
  hasText: boolean;
}) {
  await requireMechanicUser();

  try {
    await logRequestHistory({
      requestId: input.requestId,
      action: "comment_added",
      metadata: {
        commentId: input.commentId,
        photoCount: input.photoCount,
        hasText: input.hasText,
      },
    });
    revalidateWorkPaths(input.requestId);
    return { ok: true as const };
  } catch (error) {
    return {
      ok: false as const,
      error:
        error instanceof Error
          ? error.message
          : "Не удалось записать историю комментария.",
    };
  }
}
