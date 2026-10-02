"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireManagerUser } from "@/lib/auth/current-user";
import { setRequestResponsible } from "@/lib/db/assignees";
import type { RequestStatus } from "@/lib/db/requests";
import { logRequestHistory, resolveEmployeeNames } from "@/lib/db/request-history";
import { assertRequestTasksComplete } from "@/lib/db/request-tasks";

export type TodayActionResult =
  | { ok: true }
  | { ok: false; error: string };

function nullable(value: string | null | undefined) {
  const trimmed = value?.trim() ?? "";
  return trimmed.length > 0 ? trimmed : null;
}

function sliceTime(value: string | null | undefined) {
  return value ? value.slice(0, 5) : null;
}

export async function saveTodayPlanAction(input: {
  requestId: string;
  plannedDate: string;
  startTime?: string | null;
  endTime?: string | null;
  assignedTo: string;
  queuePosition: number;
  /** Full active column order after placement — normalizes 1..N in DB. */
  columnOrderedIds?: string[];
}): Promise<TodayActionResult> {
  await requireManagerUser();

  try {
    const supabase = await createClient();
    const {
      requestId,
      plannedDate,
      startTime,
      endTime,
      assignedTo,
      queuePosition,
      columnOrderedIds,
    } = input;

    if (!requestId) {
      return { ok: false, error: "Не найден ID заявки." };
    }

    if (!plannedDate || !assignedTo || !queuePosition) {
      return {
        ok: false,
        error: "Укажите дату, ответственного и очередность.",
      };
    }

    const { data: currentRequest, error: currentError } = await supabase
      .from("requests")
      .select(
        "status, assigned_to, planned_date, start_time, end_time, queue_position",
      )
      .eq("id", requestId)
      .single();

    if (currentError) {
      return { ok: false, error: currentError.message };
    }

    const currentStatus = currentRequest?.status as RequestStatus | undefined;
    const nextStatus: RequestStatus =
      currentStatus === "done" ? "done" : "planned";
    const nextStart = nullable(startTime);
    const nextEnd = nullable(endTime);

    const updatePayload: {
      planned_date: string;
      start_time: string | null;
      end_time: string | null;
      queue_position: number;
      assigned_to: string;
      status: RequestStatus;
      closed_at?: null;
    } = {
      planned_date: plannedDate,
      start_time: nextStart,
      end_time: nextEnd,
      queue_position: queuePosition,
      assigned_to: assignedTo,
      status: nextStatus,
    };

    if (nextStatus !== "done") {
      updatePayload.closed_at = null;
    }

    const { error } = await supabase
      .from("requests")
      .update(updatePayload)
      .eq("id", requestId);

    if (error) {
      return { ok: false, error: error.message };
    }

    try {
      await setRequestResponsible(requestId, assignedTo, { logHistory: false });
    } catch (assigneeError) {
      if (
        !(assigneeError instanceof Error) ||
        !assigneeError.message.includes("request_assignees")
      ) {
        return {
          ok: false,
          error:
            assigneeError instanceof Error
              ? assigneeError.message
              : "Ошибка назначения участников",
        };
      }
    }

    const orderedIds =
      columnOrderedIds && columnOrderedIds.length > 0
        ? columnOrderedIds
        : [requestId];

    const renumberError = await renumberQueuePositions(supabase, orderedIds);
    if (renumberError) {
      return { ok: false, error: renumberError };
    }

    const names = await resolveEmployeeNames([
      currentRequest.assigned_to as string | null,
      assignedTo,
    ]);

    await logRequestHistory({
      requestId,
      action: "request_moved",
      oldValue: {
        id: (currentRequest.assigned_to as string | null) ?? null,
        name: currentRequest.assigned_to
          ? (names.get(currentRequest.assigned_to as string) ?? "Без имени")
          : "Не назначен",
      },
      newValue: {
        id: assignedTo,
        name: names.get(assignedTo) ?? "Без имени",
      },
      metadata: {
        fromMechanicId: (currentRequest.assigned_to as string | null) ?? null,
        fromMechanicName: currentRequest.assigned_to
          ? (names.get(currentRequest.assigned_to as string) ?? "Без имени")
          : "Не назначен",
        toMechanicId: assignedTo,
        toMechanicName: names.get(assignedTo) ?? "Без имени",
        fromQueue: (currentRequest.queue_position as number | null) ?? null,
        toQueue: queuePosition,
        date: plannedDate,
        oldStartTime: sliceTime(currentRequest.start_time as string | null),
        oldEndTime: sliceTime(currentRequest.end_time as string | null),
        newStartTime: sliceTime(nextStart),
        newEndTime: sliceTime(nextEnd),
        scheduleNote: "Время и очередь заданы при планировании",
      },
    });

    if (currentStatus !== nextStatus) {
      await logRequestHistory({
        requestId,
        action: "status_changed",
        fieldName: "status",
        oldValue: currentStatus ?? null,
        newValue: nextStatus,
      });
    }

    revalidatePath("/today");
    revalidatePath("/requests");
    revalidatePath(`/requests/${requestId}`);
    revalidatePath("/work/today");
    revalidatePath("/work/requests");

    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Неизвестная ошибка",
    };
  }
}

export async function saveTodayStatusAction(input: {
  requestId: string;
  status: RequestStatus;
}): Promise<TodayActionResult> {
  await requireManagerUser();

  try {
    const supabase = await createClient();
    const { requestId, status } = input;

    if (!requestId) {
      return { ok: false, error: "Не найден ID заявки." };
    }

    const { data: currentRequest, error: currentError } = await supabase
      .from("requests")
      .select("closed_at, status")
      .eq("id", requestId)
      .single();

    if (currentError) {
      return { ok: false, error: currentError.message };
    }

    const previousStatus = currentRequest?.status as RequestStatus | undefined;
    if (status === "done") {
      const tasksReady = await assertRequestTasksComplete(requestId);
      if (!tasksReady.ok) {
        return tasksReady;
      }
    }
    const closedAt =
      status === "done"
        ? ((currentRequest?.closed_at as string | null) ??
          new Date().toISOString())
        : null;

    const { error } = await supabase
      .from("requests")
      .update({
        status,
        closed_at: closedAt,
        close_result: status === "done" ? "completed" : null,
      })
      .eq("id", requestId);

    if (error) {
      return { ok: false, error: error.message };
    }

    if (previousStatus && previousStatus !== status) {
      if (previousStatus === "done" && status !== "done") {
        await logRequestHistory({
          requestId,
          action: "work_reopened",
          fieldName: "status",
          oldValue: previousStatus,
          newValue: status,
        });
      } else if (status === "in_progress") {
        await logRequestHistory({
          requestId,
          action: "work_started",
          fieldName: "status",
          oldValue: previousStatus,
          newValue: status,
        });
      } else if (status === "done") {
        await logRequestHistory({
          requestId,
          action: "work_completed",
          fieldName: "status",
          oldValue: previousStatus,
          newValue: status,
        });
      } else {
        await logRequestHistory({
          requestId,
          action: "status_changed",
          fieldName: "status",
          oldValue: previousStatus,
          newValue: status,
        });
      }
    }

    revalidatePath("/today");
    revalidatePath("/requests");
    revalidatePath(`/requests/${requestId}`);

    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Неизвестная ошибка",
    };
  }
}

export async function moveTodayRequestAction(input: {
  requestId: string;
  assignedTo: string | null;
  plannedDate: string | null;
  targetOrderedIds: string[];
  sourceOrderedIds: string[];
}): Promise<TodayActionResult> {
  await requireManagerUser();

  try {
    const supabase = await createClient();
    const {
      requestId,
      assignedTo,
      plannedDate,
      targetOrderedIds,
      sourceOrderedIds,
    } = input;

    if (!requestId) {
      return { ok: false, error: "Не найден ID заявки." };
    }

    const { data: currentRequest, error: currentError } = await supabase
      .from("requests")
      .select(
        "status, planned_date, assigned_to, queue_position, start_time, end_time",
      )
      .eq("id", requestId)
      .single();

    if (currentError) {
      return { ok: false, error: currentError.message };
    }

    const currentStatus = currentRequest?.status as RequestStatus | undefined;
    const fromMechanicId = (currentRequest.assigned_to as string | null) ?? null;
    const fromQueue = (currentRequest.queue_position as number | null) ?? null;
    const oldStart = sliceTime(currentRequest.start_time as string | null);
    const oldEnd = sliceTime(currentRequest.end_time as string | null);

    let toQueue: number | null = null;
    let nextPlannedDate: string | null = null;

    if (assignedTo === null) {
      const { error } = await supabase
        .from("requests")
        .update({
          assigned_to: null,
          planned_date: null,
          queue_position: null,
          status:
            currentStatus === "done"
              ? "done"
              : ("needs_planning" as RequestStatus),
        })
        .eq("id", requestId);

      if (error) {
        return { ok: false, error: error.message };
      }

      try {
        await setRequestResponsible(requestId, null, { logHistory: false });
      } catch {
        // ignore missing assignees table
      }
    } else {
      nextPlannedDate =
        plannedDate ??
        ((currentRequest?.planned_date as string | null) ?? null);

      if (!nextPlannedDate) {
        return {
          ok: false,
          error: "Для назначения нужна плановая дата.",
        };
      }

      const queuePosition = Math.max(
        targetOrderedIds.findIndex((id) => id === requestId) + 1,
        1,
      );
      toQueue = queuePosition;

      const { error } = await supabase
        .from("requests")
        .update({
          assigned_to: assignedTo,
          planned_date: nextPlannedDate,
          queue_position: queuePosition,
          status:
            currentStatus === "done" ? "done" : ("planned" as RequestStatus),
        })
        .eq("id", requestId);

      if (error) {
        return { ok: false, error: error.message };
      }

      try {
        await setRequestResponsible(requestId, assignedTo, {
          logHistory: false,
        });
      } catch {
        // ignore missing assignees table
      }

      const renumberError = await renumberQueuePositions(
        supabase,
        targetOrderedIds,
      );

      if (renumberError) {
        return { ok: false, error: renumberError };
      }
    }

    if (sourceOrderedIds.length > 0) {
      const sourceError = await renumberQueuePositions(
        supabase,
        sourceOrderedIds,
      );

      if (sourceError) {
        return { ok: false, error: sourceError };
      }
    }

    const names = await resolveEmployeeNames([fromMechanicId, assignedTo]);

    await logRequestHistory({
      requestId,
      action: "request_moved",
      oldValue: {
        id: fromMechanicId,
        name: fromMechanicId
          ? (names.get(fromMechanicId) ?? "Без имени")
          : "Не назначен",
      },
      newValue: {
        id: assignedTo,
        name: assignedTo
          ? (names.get(assignedTo) ?? "Без имени")
          : "Не назначен",
      },
      metadata: {
        fromMechanicId,
        fromMechanicName: fromMechanicId
          ? (names.get(fromMechanicId) ?? "Без имени")
          : "Не назначен",
        toMechanicId: assignedTo,
        toMechanicName: assignedTo
          ? (names.get(assignedTo) ?? "Без имени")
          : "Не назначен",
        fromQueue,
        toQueue,
        date: nextPlannedDate ?? plannedDate,
        oldStartTime: oldStart,
        oldEndTime: oldEnd,
        newStartTime: oldStart,
        newEndTime: oldEnd,
        scheduleNote:
          "Автопересчёт очереди соседних заявок в историю не пишется",
      },
    });

    revalidatePath("/today");
    revalidatePath("/requests");
    revalidatePath(`/requests/${requestId}`);

    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Неизвестная ошибка",
    };
  }
}

export async function reorderTodayQueueAction(input: {
  orderedIds: string[];
  movedRequestId?: string;
}): Promise<TodayActionResult> {
  await requireManagerUser();

  try {
    const supabase = await createClient();
    const movedRequestId = input.movedRequestId ?? null;
    let previousQueue: number | null = null;

    if (movedRequestId) {
      const { data: current } = await supabase
        .from("requests")
        .select("queue_position, start_time, end_time, assigned_to, planned_date")
        .eq("id", movedRequestId)
        .maybeSingle();
      previousQueue = (current?.queue_position as number | null) ?? null;

      const errorMessage = await renumberQueuePositions(
        supabase,
        input.orderedIds,
      );

      if (errorMessage) {
        return { ok: false, error: errorMessage };
      }

      const nextQueue = Math.max(
        input.orderedIds.findIndex((id) => id === movedRequestId) + 1,
        1,
      );

      if (previousQueue !== nextQueue) {
        await logRequestHistory({
          requestId: movedRequestId,
          action: "queue_changed",
          fieldName: "queue",
          oldValue: previousQueue,
          newValue: nextQueue,
          metadata: {
            fromQueue: previousQueue,
            toQueue: nextQueue,
            date: (current?.planned_date as string | null) ?? null,
            oldStartTime: sliceTime(current?.start_time as string | null),
            oldEndTime: sliceTime(current?.end_time as string | null),
            newStartTime: sliceTime(current?.start_time as string | null),
            newEndTime: sliceTime(current?.end_time as string | null),
            scheduleNote:
              "Плановое время соседних заявок при пересчёте очереди не логируется отдельно",
          },
        });
      }

      revalidatePath("/today");
      return { ok: true };
    }

    const errorMessage = await renumberQueuePositions(
      supabase,
      input.orderedIds,
    );

    if (errorMessage) {
      return { ok: false, error: errorMessage };
    }

    revalidatePath("/today");

    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Неизвестная ошибка",
    };
  }
}

async function renumberQueuePositions(
  supabase: Awaited<ReturnType<typeof createClient>>,
  orderedIds: string[],
) {
  for (let index = 0; index < orderedIds.length; index += 1) {
    const { error } = await supabase
      .from("requests")
      .update({ queue_position: index + 1 })
      .eq("id", orderedIds[index]);

    if (error) {
      return error.message;
    }
  }

  return null;
}
