"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireManagerUser } from "@/lib/auth/current-user";
import {
  parseParticipantIds,
  syncRequestAssignees,
} from "@/lib/db/assignees";
import type { RequestStatus } from "@/lib/db/requests";
import { logRequestHistoryMany } from "@/lib/db/request-history";
import { isUndefinedColumnError } from "@/lib/db/schema-errors";
import { getSafeReturnTo } from "@/lib/navigation/return-to";
import { buildRequestFieldHistoryEvents } from "@/lib/request-history/diff-request";

type RequestType =
  | "repair"
  | "maintenance"
  | "installation"
  | "diagnostics"
  | "delivery"
  | "consultation"
  | "other";

type UrgencyLevel = "low" | "normal" | "high" | "critical";

function getString(formData: FormData, key: string) {
  const value = formData.get(key);

  return typeof value === "string" ? value.trim() : "";
}

function nullable(value: string) {
  return value.length > 0 ? value : null;
}

function nullableNumber(value: string) {
  if (!value) {
    return null;
  }

  const parsed = Number(value);

  return Number.isFinite(parsed) ? parsed : null;
}

export async function updateRequestAction(formData: FormData) {
  await requireManagerUser();

  const supabase = await createClient();
  const requestId = getString(formData, "request_id");
  const description = getString(formData, "description");
  const status = getString(formData, "status") as RequestStatus;

  if (!requestId) {
    throw new Error("Не найден ID заявки.");
  }

  if (!description) {
    throw new Error("Описание заявки не может быть пустым.");
  }

  const requestSelect = `
        closed_at,
        location_id,
        description,
        title,
        request_type,
        urgency,
        status,
        planned_date,
        start_time,
        end_time,
        queue_position,
        manager_comment,
        executor_comment,
        reported_by_name
      `;

  let { data: currentRequest, error: currentError } = await supabase
    .from("requests")
    .select(`${requestSelect}, execution_type`)
    .eq("id", requestId)
    .single();

  if (currentError && isUndefinedColumnError(currentError)) {
    ({ data: currentRequest, error: currentError } = await supabase
      .from("requests")
      .select(requestSelect)
      .eq("id", requestId)
      .single());
  }

  if (currentError || !currentRequest) {
    throw currentError ?? new Error("Заявка не найдена.");
  }

  const closedAt =
    status === "done"
      ? ((currentRequest?.closed_at as string | null) ?? new Date().toISOString())
      : null;

  const assignedTo = nullable(getString(formData, "assigned_to"));
  const participantIds = parseParticipantIds(formData);
  const nextPayload = {
    title: description.slice(0, 120),
    description,
    request_type: (getString(formData, "request_type") || "other") as RequestType,
    urgency: (getString(formData, "urgency") || "normal") as UrgencyLevel,
    status,
    planned_date: nullable(getString(formData, "planned_date")),
    start_time: nullable(getString(formData, "start_time")),
    end_time: nullable(getString(formData, "end_time")),
    queue_position: nullableNumber(getString(formData, "queue_position")),
    assigned_to: assignedTo,
    manager_comment: nullable(getString(formData, "manager_comment")),
    executor_comment: nullable(getString(formData, "executor_comment")),
    closed_at: closedAt,
  };

  const { error } = await supabase
    .from("requests")
    .update(nextPayload)
    .eq("id", requestId);

  if (error) {
    throw error;
  }

  try {
    await syncRequestAssignees(requestId, assignedTo, participantIds);
  } catch (assigneeError) {
    console.error("[updateRequestAction] assignees", assigneeError);
  }

  const locationIds = [
    currentRequest.location_id as string | null,
  ].filter((id): id is string => Boolean(id));

  const locationNames = new Map<string, string>();
  if (locationIds.length > 0) {
    const { data: locations } = await supabase
      .from("locations")
      .select("id, name")
      .in("id", locationIds);
    for (const location of locations ?? []) {
      locationNames.set(
        location.id as string,
        (location.name as string | null) ?? "Без названия",
      );
    }
  }

  const fieldEvents = buildRequestFieldHistoryEvents({
    requestId,
    before: {
      location_id: currentRequest.location_id as string | null,
      description: currentRequest.description as string | null,
      title: currentRequest.title as string | null,
      request_type: currentRequest.request_type as string | null,
      urgency: currentRequest.urgency as string | null,
      status: currentRequest.status as string | null,
      planned_date: currentRequest.planned_date as string | null,
      start_time: currentRequest.start_time as string | null,
      end_time: currentRequest.end_time as string | null,
      queue_position: currentRequest.queue_position as number | null,
      manager_comment: currentRequest.manager_comment as string | null,
      executor_comment: currentRequest.executor_comment as string | null,
      execution_type:
        ((currentRequest as { execution_type?: string | null }).execution_type ??
          null),
      reported_by_name: currentRequest.reported_by_name as string | null,
    },
    after: {
      location_id: currentRequest.location_id as string | null,
      description: nextPayload.description,
      title: nextPayload.title,
      request_type: nextPayload.request_type,
      urgency: nextPayload.urgency,
      status: nextPayload.status,
      planned_date: nextPayload.planned_date,
      start_time: nextPayload.start_time,
      end_time: nextPayload.end_time,
      queue_position: nextPayload.queue_position,
      manager_comment: nextPayload.manager_comment,
      executor_comment: nextPayload.executor_comment,
      execution_type:
        ((currentRequest as { execution_type?: string | null }).execution_type ??
          null),
      reported_by_name: currentRequest.reported_by_name as string | null,
    },
    locationNames,
  });

  try {
    await logRequestHistoryMany(fieldEvents);
  } catch (historyError) {
    console.error("[updateRequestAction] history", historyError);
  }

  revalidatePath("/requests");
  revalidatePath(`/requests/${requestId}`);
  revalidatePath("/work/today");
  revalidatePath("/work/requests");
  revalidatePath("/today");

  const returnTo = getSafeReturnTo(
    getString(formData, "return_to") || null,
    `/requests/${requestId}?saved=1`,
  );
  redirect(returnTo);
}
