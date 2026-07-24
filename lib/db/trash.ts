import { createClient } from "@/lib/supabase/server";
import {
  formatAssigneesShort,
  getAssigneesForRequests,
  type RequestAssignee,
} from "@/lib/db/assignees";
import type { RequestStatus } from "@/lib/db/requests";
import { getLocalDateKey } from "@/lib/dates";
import { logRequestHistory } from "@/lib/db/request-history";
import {
  isUndefinedColumnError,
  MISSING_SOFT_DELETE_MESSAGE,
} from "@/lib/db/schema-errors";

export type TrashedRequest = {
  id: string;
  request_number: number | null;
  description: string;
  status: RequestStatus;
  planned_date: string | null;
  deleted_at: string;
  deleted_by: string | null;
  deleted_by_name: string | null;
  deletion_reason: string | null;
  location_name: string | null;
  assignees: RequestAssignee[];
  assignees_label: string;
};

const planningStatuses = new Set<RequestStatus>([
  "planned",
  "in_progress",
  "specialist_on_way",
  "waiting_client",
  "postponed",
]);

export async function getTrashedRequests(): Promise<TrashedRequest[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("requests")
    .select(
      `
        id,
        request_number,
        description,
        status,
        planned_date,
        deleted_at,
        deleted_by,
        deletion_reason,
        locations ( name )
      `,
    )
    .not("deleted_at", "is", null)
    .order("deleted_at", { ascending: false });

  if (error) {
    if (isUndefinedColumnError(error)) {
      throw new Error(MISSING_SOFT_DELETE_MESSAGE);
    }
    throw error;
  }

  const rows = data ?? [];
  const deletedByIds = [
    ...new Set(
      rows
        .map((row) => row.deleted_by as string | null)
        .filter((id): id is string => Boolean(id)),
    ),
  ];

  const profilesById = new Map<string, string>();
  if (deletedByIds.length > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name")
      .in("id", deletedByIds);
    for (const profile of profiles ?? []) {
      profilesById.set(
        profile.id as string,
        (profile.full_name as string | null) ?? "Без имени",
      );
    }
  }

  const assigneesMap = await getAssigneesForRequests(
    rows.map((row) => row.id as string),
  );

  return rows.map((row) => {
    const location = Array.isArray(row.locations)
      ? row.locations[0]
      : row.locations;
    const assignees = assigneesMap.get(row.id as string) ?? [];

    return {
      id: row.id as string,
      request_number: row.request_number as number | null,
      description: row.description as string,
      status: row.status as RequestStatus,
      planned_date: row.planned_date as string | null,
      deleted_at: row.deleted_at as string,
      deleted_by: row.deleted_by as string | null,
      deleted_by_name: row.deleted_by
        ? (profilesById.get(row.deleted_by as string) ?? null)
        : null,
      deletion_reason: row.deletion_reason as string | null,
      location_name: (location?.name as string | null) ?? null,
      assignees,
      assignees_label: formatAssigneesShort(assignees),
    };
  });
}

export async function moveRequestToTrash(input: {
  requestId: string;
  actorId: string;
  reason: string;
}) {
  const supabase = await createClient();
  const deletedAt = new Date().toISOString();

  const { data: current, error: readError } = await supabase
    .from("requests")
    .select("id, status, planned_date, deleted_at, deletion_reason")
    .eq("id", input.requestId)
    .maybeSingle();

  if (readError) {
    throw readError;
  }

  if (!current || current.deleted_at) {
    return { ok: false as const, error: "Заявка не найдена или уже в корзине." };
  }

  const { error } = await supabase
    .from("requests")
    .update({
      deleted_at: deletedAt,
      deleted_by: input.actorId,
      deletion_reason: input.reason,
    })
    .eq("id", input.requestId)
    .is("deleted_at", null);

  if (error) {
    if (isUndefinedColumnError(error)) {
      return { ok: false as const, error: MISSING_SOFT_DELETE_MESSAGE };
    }
    throw error;
  }

  await logRequestHistory({
    requestId: input.requestId,
    action: "moved_to_trash",
    oldValue: { status: current.status as string, deleted_at: null },
    newValue: { deleted_at: deletedAt, deletion_reason: input.reason },
    metadata: {
      reason: input.reason,
      previousStatus: current.status as string,
      previousDate: (current.planned_date as string | null) ?? null,
    },
  });

  return { ok: true as const };
}

export async function restoreRequestFromTrash(input: {
  requestId: string;
  actorId: string;
}) {
  const supabase = await createClient();

  const { data: current, error: readError } = await supabase
    .from("requests")
    .select("id, status, planned_date, deleted_at, deletion_reason")
    .eq("id", input.requestId)
    .maybeSingle();

  if (readError) {
    throw readError;
  }

  if (!current || !current.deleted_at) {
    return { ok: false as const, error: "Заявка не в корзине." };
  }

  const today = getLocalDateKey();
  const plannedDate = current.planned_date as string | null;
  const status = current.status as RequestStatus;
  let nextStatus = status;

  if (
    plannedDate &&
    plannedDate < today &&
    planningStatuses.has(status)
  ) {
    nextStatus = "needs_planning";
  }

  const { error } = await supabase
    .from("requests")
    .update({
      deleted_at: null,
      deleted_by: null,
      deletion_reason: null,
      status: nextStatus,
      ...(nextStatus === "needs_planning"
        ? {
            planned_date: null,
            start_time: null,
            end_time: null,
            queue_position: null,
          }
        : {}),
    })
    .eq("id", input.requestId);

  if (error) {
    throw error;
  }

  await logRequestHistory({
    requestId: input.requestId,
    action: "restored_from_trash",
    oldValue: {
      deleted_at: current.deleted_at as string,
      status,
      planned_date: plannedDate,
    },
    newValue: {
      deleted_at: null,
      status: nextStatus,
    },
    metadata: {
      previousStatus: status,
      previousDate: plannedDate,
    },
  });

  return { ok: true as const, status: nextStatus };
}
