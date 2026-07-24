"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireMechanicUser } from "@/lib/auth/current-user";
import { mechanicAllowedStatuses } from "@/lib/auth/permissions";
import {
  getMechanicRequestById,
  updateMechanicRequest,
} from "@/lib/db/work";
import type { RequestStatus } from "@/lib/db/requests";
import { logRequestHistory } from "@/lib/db/request-history";

export type WorkActionResult =
  | { ok: true }
  | { ok: false; error: string };

function getString(formData: FormData, key: string) {
  const value = formData.get(key);

  return typeof value === "string" ? value.trim() : "";
}

function nullable(value: string) {
  return value.length > 0 ? value : null;
}

function revalidateWorkPaths(requestId: string) {
  revalidatePath("/work/today");
  revalidatePath("/work/requests");
  revalidatePath(`/work/requests/${requestId}`);
  revalidatePath("/today");
  revalidatePath(`/requests/${requestId}`);
}

export async function startWorkAction(
  requestId: string,
): Promise<WorkActionResult> {
  const context = await requireMechanicUser();

  try {
    if (!requestId) {
      return { ok: false, error: "Не найден ID заявки." };
    }

    const currentRequest = await getMechanicRequestById(
      context.employee.id,
      requestId,
    );

    if (!currentRequest) {
      return { ok: false, error: "Заявка не найдена или недоступна." };
    }

    const supabase = await createClient();
    const now = new Date().toISOString();

    const { error: assigneeError } = await supabase
      .from("request_assignees")
      .update({
        participation_status: "in_progress",
        started_at: now,
      })
      .eq("request_id", requestId)
      .eq("employee_id", context.employee.id);

    if (assigneeError) {
      // Fallback when assignees table is not migrated yet.
      if (!assigneeError.message.includes("request_assignees")) {
        return { ok: false, error: assigneeError.message };
      }
    }

    const nextStartedAt = currentRequest.started_at ?? now;
    const nextStatus: RequestStatus =
      currentRequest.status === "planned" ||
      currentRequest.status === "needs_planning"
        ? "in_progress"
        : currentRequest.status;

    const updated = await updateMechanicRequest(context.employee.id, requestId, {
      status: nextStatus,
      executor_comment: currentRequest.executor_comment,
      closed_at: nextStatus === "done" ? currentRequest.closed_at : null,
      close_result: null,
      started_at: nextStartedAt,
    });

    if (!updated) {
      return { ok: false, error: "Заявка не найдена или недоступна." };
    }

    if (currentRequest.status === "waiting_parts" && nextStatus === "in_progress") {
      await logRequestHistory({
        requestId,
        action: "waiting_parts_finished",
        fieldName: "status",
        oldValue: currentRequest.status,
        newValue: nextStatus,
      });
    }

    if (nextStatus !== currentRequest.status) {
      await logRequestHistory({
        requestId,
        action: "work_started",
        fieldName: "status",
        oldValue: currentRequest.status,
        newValue: nextStatus,
      });
    }

    revalidateWorkPaths(requestId);
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Неизвестная ошибка",
    };
  }
}

export async function completeMyPartAction(
  requestId: string,
  executorComment?: string | null,
): Promise<WorkActionResult> {
  const context = await requireMechanicUser();

  try {
    if (!requestId) {
      return { ok: false, error: "Не найден ID заявки." };
    }

    const currentRequest = await getMechanicRequestById(
      context.employee.id,
      requestId,
    );

    if (!currentRequest) {
      return { ok: false, error: "Заявка не найдена или недоступна." };
    }

    if (currentRequest.my_role !== "participant") {
      return {
        ok: false,
        error: "Эту кнопку может использовать только дополнительный участник.",
      };
    }

    const supabase = await createClient();
    const now = new Date().toISOString();
    const trimmed = executorComment?.trim() ?? "";

    if (trimmed.length > 0) {
      await updateMechanicRequest(context.employee.id, requestId, {
        status: currentRequest.status,
        executor_comment: trimmed,
        closed_at: currentRequest.closed_at,
        close_result: null,
      });
    }

    const { error } = await supabase
      .from("request_assignees")
      .update({
        participation_status: "completed",
        completed_at: now,
      })
      .eq("request_id", requestId)
      .eq("employee_id", context.employee.id);

    if (error) {
      return { ok: false, error: error.message };
    }

    await logRequestHistory({
      requestId,
      action: "work_completed",
      metadata: {
        scope: "participant",
        mechanicId: context.employee.id,
        mechanicName: context.employee.name,
        comment: trimmed.length > 0 ? trimmed : null,
      },
    });

    revalidateWorkPaths(requestId);
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Неизвестная ошибка",
    };
  }
}

export async function completeWorkAction(
  requestId: string,
  executorComment?: string | null,
): Promise<WorkActionResult> {
  const context = await requireMechanicUser();

  try {
    if (!requestId) {
      return { ok: false, error: "Не найден ID заявки." };
    }

    const currentRequest = await getMechanicRequestById(
      context.employee.id,
      requestId,
    );

    if (!currentRequest) {
      return { ok: false, error: "Заявка не найдена или недоступна." };
    }

    if (
      currentRequest.my_role !== "responsible" &&
      currentRequest.assignees.length > 0
    ) {
      return {
        ok: false,
        error: "Закрыть заявку может только ответственный механик.",
      };
    }

    const trimmed = executorComment?.trim() ?? "";
    const nextComment =
      trimmed.length > 0 ? trimmed : currentRequest.executor_comment;
    const now = new Date().toISOString();

    const updated = await updateMechanicRequest(context.employee.id, requestId, {
      status: "done",
      executor_comment: nextComment,
      closed_at: currentRequest.closed_at ?? now,
      close_result: "completed",
    });

    if (!updated) {
      return { ok: false, error: "Заявка не найдена или недоступна." };
    }

    const supabase = await createClient();
    const { error: assigneeError } = await supabase
      .from("request_assignees")
      .update({
        participation_status: "completed",
        completed_at: now,
      })
      .eq("request_id", requestId)
      .neq("participation_status", "completed");

    if (assigneeError && !assigneeError.message.includes("request_assignees")) {
      return { ok: false, error: assigneeError.message };
    }

    // Ensure responsible row is completed even if already marked.
    await supabase
      .from("request_assignees")
      .update({
        participation_status: "completed",
        completed_at: now,
      })
      .eq("request_id", requestId)
      .eq("employee_id", context.employee.id);

    await logRequestHistory({
      requestId,
      action: "work_completed",
      fieldName: "status",
      oldValue: currentRequest.status,
      newValue: "done",
      metadata: {
        scope: "responsible",
        comment: nextComment,
        startedAt: currentRequest.started_at,
        completedAt: currentRequest.closed_at ?? now,
      },
    });

    revalidateWorkPaths(requestId);
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Неизвестная ошибка",
    };
  }
}

export async function updateWorkRequestAction(
  formData: FormData,
): Promise<WorkActionResult> {
  const context = await requireMechanicUser();

  try {
    const requestId = getString(formData, "request_id");
    const status = getString(formData, "status") as RequestStatus;
    const executorCommentRaw = formData.get("executor_comment");
    const executorCommentProvided = typeof executorCommentRaw === "string";
    const executorComment = executorCommentProvided
      ? executorCommentRaw.trim()
      : "";

    if (!requestId) {
      return { ok: false, error: "Не найден ID заявки." };
    }

    if (!mechanicAllowedStatuses.includes(status)) {
      return { ok: false, error: "Недоступный статус для механика." };
    }

    const currentRequest = await getMechanicRequestById(
      context.employee.id,
      requestId,
    );

    if (!currentRequest) {
      return { ok: false, error: "Заявка не найдена или недоступна." };
    }

    if (currentRequest.my_role === "participant" && status !== "in_progress") {
      return {
        ok: false,
        error:
          "Участник может только начать работу или завершить свою часть.",
      };
    }

    if (status === "done") {
      return completeWorkAction(
        requestId,
        executorCommentProvided ? executorComment : currentRequest.executor_comment,
      );
    }

    if (status === "in_progress") {
      return startWorkAction(requestId);
    }

    const closedAt = null;
    const nextComment = executorCommentProvided
      ? nullable(executorComment)
      : currentRequest.executor_comment;

    const updated = await updateMechanicRequest(context.employee.id, requestId, {
      status,
      executor_comment: nextComment,
      closed_at: closedAt,
      close_result: null,
    });

    if (!updated) {
      return { ok: false, error: "Заявка не найдена или недоступна." };
    }

    if (status !== currentRequest.status) {
      if (status === "waiting_parts") {
        await logRequestHistory({
          requestId,
          action: "waiting_parts_started",
          fieldName: "status",
          oldValue: currentRequest.status,
          newValue: status,
        });
      } else if (currentRequest.status === "waiting_parts") {
        await logRequestHistory({
          requestId,
          action: "waiting_parts_finished",
          fieldName: "status",
          oldValue: currentRequest.status,
          newValue: status,
        });
      } else if (currentRequest.status === "done") {
        await logRequestHistory({
          requestId,
          action: "work_reopened",
          fieldName: "status",
          oldValue: currentRequest.status,
          newValue: status,
        });
      } else {
        await logRequestHistory({
          requestId,
          action: "status_changed",
          fieldName: "status",
          oldValue: currentRequest.status,
          newValue: status,
        });
      }
    }

    if (
      executorCommentProvided &&
      nextComment !== currentRequest.executor_comment
    ) {
      await logRequestHistory({
        requestId,
        action: "request_updated",
        fieldName: "executor_comment",
        oldValue: currentRequest.executor_comment,
        newValue: nextComment,
      });
    }

    revalidateWorkPaths(requestId);
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Неизвестная ошибка",
    };
  }
}
