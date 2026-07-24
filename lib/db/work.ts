import { createClient } from "@/lib/supabase/server";
import { localDateKeyBoundsUtc, toLocalDateKey } from "@/lib/date/local-date";
import { getLocalDateKey, shiftDateKey } from "@/lib/dates";
import {
  getAssigneeRequestIds,
  getAssigneesForRequests,
  type RequestAssignee,
  type ParticipationStatus,
  type AssigneeRole,
} from "@/lib/db/assignees";
import type { RequestStatus } from "@/lib/db/requests";
import { isCompletedOnSelectedDate } from "@/lib/plan/day-sections";

export type WorkRequestFilter =
  | "today"
  | "tomorrow"
  | "upcoming"
  | "in_progress"
  | "waiting_parts"
  | "done"
  | "all"
  | "responsible"
  | "participant";

export type WorkRequestItem = {
  id: string;
  request_number: number | null;
  description: string;
  urgency: string;
  status: RequestStatus;
  planned_date: string | null;
  start_time: string | null;
  end_time: string | null;
  queue_position: number | null;
  manager_comment: string | null;
  executor_comment: string | null;
  started_at: string | null;
  closed_at: string | null;
  created_at: string;
  location: WorkLocation | null;
  assignees: RequestAssignee[];
  my_role: AssigneeRole | null;
  my_participation_status: ParticipationStatus | null;
  is_collaborative: boolean;
};

export type WorkLocation = {
  id: string;
  name: string;
  address: string | null;
  contact: string | null;
  phone: string | null;
  yandex_maps_url: string | null;
  working_hours: string | null;
  notes: string | null;
};

type WorkRequestRow = {
  id: string;
  request_number: number | null;
  description: string;
  urgency: string;
  status: RequestStatus;
  planned_date: string | null;
  start_time: string | null;
  end_time: string | null;
  queue_position: number | null;
  manager_comment: string | null;
  executor_comment: string | null;
  started_at: string | null;
  closed_at: string | null;
  created_at: string;
  assigned_to: string | null;
  locations: WorkLocation | WorkLocation[] | null;
  request_assignees?: Array<{
    employee_id: string;
    role: AssigneeRole;
    participation_status?: ParticipationStatus;
  }> | null;
};

const cancelledStatuses = new Set<RequestStatus>([
  "cancelled",
  "duplicate",
  "not_actual",
]);

export async function getMechanicToday(
  employeeId: string,
  date = getLocalDateKey(),
) {
  const [planned, closedOnDate] = await Promise.all([
    getMechanicRequests(employeeId, "today", date),
    getMechanicClosedOnDate(employeeId, date),
  ]);

  const byId = new Map<string, WorkRequestItem>();
  for (const item of [...planned, ...closedOnDate]) {
    // Prefer the closed-on-date row when merging (same id).
    if (!byId.has(item.id) || isCompletedOnSelectedDate(item, date)) {
      byId.set(item.id, item);
    }
  }

  // Keep active planned for the day + completed closed that day (drop done planned for other days).
  const merged = [...byId.values()].filter((item) => {
    if (item.status === "done") {
      return isCompletedOnSelectedDate(item, date);
    }
    return item.planned_date === date;
  });

  return sortWorkRequests(merged);
}

export async function getMechanicRequests(
  employeeId: string,
  filter: WorkRequestFilter = "today",
  date = getLocalDateKey(),
) {
  const rows = await fetchMechanicRequestRows(employeeId, filter, date);
  const enriched = await enrichWorkRequests(rows, employeeId);

  if (filter === "responsible") {
    return sortWorkRequests(
      enriched.filter((item) => item.my_role === "responsible"),
    );
  }

  if (filter === "participant") {
    return sortWorkRequests(
      enriched.filter((item) => item.my_role === "participant"),
    );
  }

  return sortWorkRequests(enriched);
}

export async function getMechanicRequestById(
  employeeId: string,
  requestId: string,
) {
  const supabase = await createClient();

  // Source of truth: membership in request_assignees (any role).
  const { data: viaAssignee, error: assigneeError } = await supabase
    .from("requests")
    .select(requestSelectWithAssignees)
    .eq("id", requestId)
    .eq("request_assignees.employee_id", employeeId)
    .is("deleted_at", null)
    .maybeSingle();

  if (!assigneeError && viaAssignee) {
    const row = viaAssignee as WorkRequestRow;
    if (row.status === "outsource") {
      return null;
    }
    const [item] = await enrichWorkRequests([row], employeeId);
    return item ?? null;
  }

  // Legacy: old rows without request_assignees, only assigned_to.
  const { data, error } = await supabase
    .from("requests")
    .select(requestSelect)
    .eq("id", requestId)
    .eq("assigned_to", employeeId)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    return null;
  }

  const row = data as WorkRequestRow;
  if (row.status === "outsource") {
    return null;
  }

  const [item] = await enrichWorkRequests([row], employeeId);
  return item ?? null;
}

export async function getWorkLocations() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("locations")
    .select(
      "id, name, address, contact, phone, yandex_maps_url, working_hours, notes",
    )
    .eq("is_active", true)
    .order("name", { ascending: true });

  if (error) {
    throw error;
  }

  return (data ?? []) as WorkLocation[];
}

export async function updateMechanicRequest(
  employeeId: string,
  requestId: string,
  fields: {
    status: RequestStatus;
    executor_comment: string | null;
    closed_at: string | null;
    close_result: string | null;
    started_at?: string | null;
  },
) {
  const membership = await getMechanicRequestById(employeeId, requestId);
  if (!membership) {
    return false;
  }

  if (fields.status === "done" && membership.my_role !== "responsible") {
    return false;
  }

  const supabase = await createClient();
  const payload: Record<string, string | null> = {
    status: fields.status,
    executor_comment: fields.executor_comment,
    closed_at: fields.closed_at,
    close_result: fields.close_result,
  };

  if (fields.started_at !== undefined) {
    payload.started_at = fields.started_at;
  }

  const { data, error } = await supabase
    .from("requests")
    .update(payload)
    .eq("id", requestId)
    .select("id")
    .maybeSingle();

  if (error) {
    throw error;
  }

  return Boolean(data);
}

const requestSelect = `
  id,
  request_number,
  description,
  urgency,
  status,
  planned_date,
  start_time,
  end_time,
  queue_position,
  manager_comment,
  executor_comment,
  started_at,
  closed_at,
  created_at,
  assigned_to,
  locations (
    id,
    name,
    address,
    contact,
    phone,
    yandex_maps_url,
    working_hours,
    notes
  )
`;

const requestSelectWithAssignees = `
  ${requestSelect},
  request_assignees!inner (
    employee_id,
    role,
    participation_status
  )
`;

async function fetchMechanicRequestRows(
  employeeId: string,
  filter: WorkRequestFilter,
  date: string,
): Promise<WorkRequestRow[]> {
  const supabase = await createClient();
  const dateFilter =
    filter === "responsible" || filter === "participant" ? "all" : filter;

  // Prefer visible IDs from request_assignees ∪ assigned_to (legacy).
  const visibleIds = await getVisibleRequestIdsForMechanic(employeeId);

  if (visibleIds === "legacy_assigned_only") {
    let query = supabase
      .from("requests")
      .select(requestSelect)
      .eq("assigned_to", employeeId)
      .is("deleted_at", null);
    query = applyWorkFilters(query, dateFilter, date);
    const { data, error } = await query.order("created_at", {
      ascending: true,
    });
    if (error) {
      throw error;
    }
    return dedupeRequestRows((data ?? []) as WorkRequestRow[]);
  }

  if (visibleIds.length === 0) {
    return [];
  }

  // Primary: inner join keeps filter at DB level (assignee membership).
  let joined = supabase
    .from("requests")
    .select(requestSelectWithAssignees)
    .eq("request_assignees.employee_id", employeeId)
    .in("id", visibleIds)
    .is("deleted_at", null);

  joined = applyWorkFilters(joined, dateFilter, date);

  const { data: joinedData, error: joinedError } = await joined.order(
    "created_at",
    { ascending: true },
  );

  if (!joinedError) {
    const fromJoin = dedupeRequestRows((joinedData ?? []) as WorkRequestRow[]);

    // Include legacy assigned_to rows that never got request_assignees backfill.
    const missingLegacy = visibleIds.filter(
      (id) => !fromJoin.some((row) => row.id === id),
    );
    if (missingLegacy.length === 0) {
      return fromJoin;
    }

    let legacyQuery = supabase
      .from("requests")
      .select(requestSelect)
      .in("id", missingLegacy)
      .eq("assigned_to", employeeId)
      .is("deleted_at", null);
    legacyQuery = applyWorkFilters(legacyQuery, dateFilter, date);
    const { data: legacyData, error: legacyError } = await legacyQuery;
    if (legacyError) {
      throw legacyError;
    }

    return dedupeRequestRows([
      ...fromJoin,
      ...((legacyData ?? []) as WorkRequestRow[]),
    ]);
  }

  const tableMissing =
    joinedError.code === "42P01" ||
    joinedError.code === "PGRST205" ||
    /request_assignees|Could not find/i.test(joinedError.message);

  if (!tableMissing) {
    throw joinedError;
  }

  let query = supabase
    .from("requests")
    .select(requestSelect)
    .in("id", visibleIds)
    .is("deleted_at", null);
  query = applyWorkFilters(query, dateFilter, date);
  const { data, error } = await query.order("created_at", { ascending: true });
  if (error) {
    throw error;
  }
  return dedupeRequestRows((data ?? []) as WorkRequestRow[]);
}

/**
 * Request IDs the mechanic should see.
 * - request_assignees (any role) is the source of truth
 * - assigned_to is a temporary fallback for pre-migration rows
 */
async function getVisibleRequestIdsForMechanic(
  employeeId: string,
): Promise<string[] | "legacy_assigned_only"> {
  const supabase = await createClient();
  const assigneeIds = await getAssigneeRequestIds(employeeId);

  const { data: assignedRows, error: assignedError } = await supabase
    .from("requests")
    .select("id")
    .eq("assigned_to", employeeId)
    .is("deleted_at", null);

  if (assignedError) {
    throw assignedError;
  }

  const assignedIds = (assignedRows ?? []).map((row) => row.id as string);

  if (assigneeIds === null) {
    return "legacy_assigned_only";
  }

  return [...new Set([...assigneeIds, ...assignedIds])];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function applyWorkFilters(query: any, filter: WorkRequestFilter, date: string) {
  if (filter === "today") {
    return query
      .eq("planned_date", date)
      .not("status", "in", cancelledStatusList())
      .neq("status", "outsource");
  }

  if (filter === "tomorrow") {
    const tomorrow = shiftDateKey(date, 1);
    return query
      .eq("planned_date", tomorrow)
      .not("status", "in", cancelledStatusList())
      .neq("status", "outsource");
  }

  if (filter === "upcoming") {
    return query
      .gt("planned_date", date)
      .not("status", "in", cancelledStatusList())
      .neq("status", "outsource");
  }

  if (filter === "in_progress") {
    return query.eq("status", "in_progress");
  }

  if (filter === "waiting_parts") {
    return query.eq("status", "waiting_parts");
  }

  if (filter === "done") {
    return query.eq("status", "done");
  }

  // Outsourced requests are not shown in the mechanic cabinet.
  return query.neq("status", "outsource");
}

function dedupeRequestRows(rows: WorkRequestRow[]) {
  const map = new Map<string, WorkRequestRow>();
  for (const row of rows) {
    if (!map.has(row.id)) {
      map.set(row.id, row);
    }
  }
  return [...map.values()];
}

async function enrichWorkRequests(
  rows: WorkRequestRow[],
  employeeId: string,
): Promise<WorkRequestItem[]> {
  const assigneesMap = await getAssigneesForRequests(rows.map((row) => row.id));

  return rows.map((request) => {
    const location = Array.isArray(request.locations)
      ? (request.locations[0] ?? null)
      : request.locations;
    let assignees = assigneesMap.get(request.id) ?? [];

    if (assignees.length === 0) {
      const joinRows = Array.isArray(request.request_assignees)
        ? request.request_assignees
        : [];
      assignees = joinRows.map((item) => ({
        id: `${request.id}:${item.employee_id}`,
        request_id: request.id,
        employee_id: item.employee_id,
        employee_name: item.employee_id === employeeId ? "Вы" : "Коллега",
        role: item.role,
        participation_status: item.participation_status ?? "assigned",
        started_at: null,
        completed_at: null,
      }));
    }

    // Legacy solo assignment without request_assignees rows.
    if (
      assignees.length === 0 &&
      request.assigned_to &&
      request.assigned_to === employeeId
    ) {
      assignees = [
        {
          id: `${request.id}:${employeeId}`,
          request_id: request.id,
          employee_id: employeeId,
          employee_name: "Вы",
          role: "responsible",
          participation_status:
            request.status === "done"
              ? "completed"
              : request.status === "in_progress"
                ? "in_progress"
                : "assigned",
          started_at: request.started_at,
          completed_at: request.closed_at,
        },
      ];
    }

    const mine =
      assignees.find((item) => item.employee_id === employeeId) ?? null;

    const isAssigned =
      Boolean(mine) ||
      request.assigned_to === employeeId;

    return {
      id: request.id,
      request_number: request.request_number,
      description: request.description,
      urgency: request.urgency,
      status: request.status,
      planned_date: request.planned_date,
      start_time: request.start_time,
      end_time: request.end_time,
      queue_position: request.queue_position,
      manager_comment: request.manager_comment,
      executor_comment: request.executor_comment,
      started_at: request.started_at ?? null,
      closed_at: request.closed_at,
      created_at: request.created_at,
      location,
      assignees,
      my_role:
        mine?.role ??
        (isAssigned && request.assigned_to === employeeId
          ? "responsible"
          : null),
      my_participation_status: mine?.participation_status ?? null,
      is_collaborative: assignees.length > 1,
    };
  });
}

async function getMechanicClosedOnDate(employeeId: string, date: string) {
  const supabase = await createClient();
  const { startIso, endIso } = localDateKeyBoundsUtc(date);
  const visibleIds = await getVisibleRequestIdsForMechanic(employeeId);

  if (visibleIds === "legacy_assigned_only") {
    const { data, error } = await supabase
      .from("requests")
      .select(requestSelect)
      .eq("assigned_to", employeeId)
      .eq("status", "done")
      .gte("closed_at", startIso)
      .lte("closed_at", endIso)
      .is("deleted_at", null);

    if (error && isDeletedAtMissing(error)) {
      const fallback = await supabase
        .from("requests")
        .select(requestSelect)
        .eq("assigned_to", employeeId)
        .eq("status", "done")
        .gte("closed_at", startIso)
        .lte("closed_at", endIso);
      if (fallback.error) {
        throw fallback.error;
      }
      return filterClosedOnDate(
        await enrichWorkRequests(
          (fallback.data ?? []) as WorkRequestRow[],
          employeeId,
        ),
        date,
      );
    }

    if (error) {
      throw error;
    }

    return filterClosedOnDate(
      await enrichWorkRequests((data ?? []) as WorkRequestRow[], employeeId),
      date,
    );
  }

  if (visibleIds.length === 0) {
    return [];
  }

  const { data, error } = await supabase
    .from("requests")
    .select(requestSelect)
    .in("id", visibleIds)
    .eq("status", "done")
    .gte("closed_at", startIso)
    .lte("closed_at", endIso)
    .is("deleted_at", null);

  if (error && isDeletedAtMissing(error)) {
    const fallback = await supabase
      .from("requests")
      .select(requestSelect)
      .in("id", visibleIds)
      .eq("status", "done")
      .gte("closed_at", startIso)
      .lte("closed_at", endIso);
    if (fallback.error) {
      throw fallback.error;
    }
    return filterClosedOnDate(
      await enrichWorkRequests(
        (fallback.data ?? []) as WorkRequestRow[],
        employeeId,
      ),
      date,
    );
  }

  if (error) {
    throw error;
  }

  return filterClosedOnDate(
    await enrichWorkRequests((data ?? []) as WorkRequestRow[], employeeId),
    date,
  );
}

function filterClosedOnDate(items: WorkRequestItem[], date: string) {
  return items.filter(
    (item) =>
      item.status === "done" &&
      item.closed_at &&
      toLocalDateKey(item.closed_at) === date,
  );
}

function isDeletedAtMissing(error: { code?: string; message?: string }) {
  return (
    error.code === "42703" || /deleted_at/i.test(error.message ?? "")
  );
}

function sortWorkRequests(requests: WorkRequestItem[]) {
  return [...requests].sort((a, b) => {
    const queueA = a.queue_position ?? Number.MAX_SAFE_INTEGER;
    const queueB = b.queue_position ?? Number.MAX_SAFE_INTEGER;

    if (queueA !== queueB) {
      return queueA - queueB;
    }

    const timeA = a.start_time ?? "99:99";
    const timeB = b.start_time ?? "99:99";

    if (timeA !== timeB) {
      return timeA.localeCompare(timeB);
    }

    return Date.parse(a.created_at) - Date.parse(b.created_at);
  });
}

function cancelledStatusList() {
  return `(${Array.from(cancelledStatuses)
    .map((status) => `"${status}"`)
    .join(",")})`;
}
