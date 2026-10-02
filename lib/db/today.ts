import { createClient } from "@/lib/supabase/server";
import { localDateKeyBoundsUtc } from "@/lib/date/local-date";
import { isUndefinedColumnError } from "@/lib/db/schema-errors";
import {
  formatAssigneesShort,
  getAssigneesForRequests,
  type RequestAssignee,
} from "@/lib/db/assignees";
import { getActiveEmployees, getEmployeesById, type EmployeeOption } from "@/lib/db/employees";
import { getTaskProgressMap } from "@/lib/db/request-tasks";
import type { RequestStatus } from "@/lib/db/requests";
import {
  getLocalDateKey,
  normalizeTodayDate,
  shiftDateKey,
} from "@/lib/dates";
import {
  isCompletedOnSelectedDate,
  sortByQueuePosition,
  sortCompletedDayRequests,
  splitDayRequests,
} from "@/lib/plan/day-sections";

export { getLocalDateKey, normalizeTodayDate, shiftDateKey };

export type TodayRequestItem = {
  id: string;
  request_number: number | null;
  description: string;
  request_type: string;
  urgency: string;
  status: RequestStatus;
  planned_date: string | null;
  start_time: string | null;
  end_time: string | null;
  queue_position: number | null;
  assigned_to: string | null;
  assigned_to_name: string | null;
  closed_at: string | null;
  created_at: string;
  location: {
    name: string | null;
    address: string | null;
  } | null;
  has_time_overlap: boolean;
  assignees: RequestAssignee[];
  assignees_label: string;
  is_collaborative: boolean;
  task_done?: number;
  task_total?: number;
};

export type TodayPlan = {
  date: string;
  employees: EmployeeOption[];
  unplanned: TodayRequestItem[];
  columns: Array<{
    employee: EmployeeOption;
    requests: TodayRequestItem[];
  }>;
  stats: {
    total: number;
    unplanned: number;
    inWork: number;
    done: number;
    overdue: number;
  };
};

type RequestRow = Omit<
  TodayRequestItem,
  | "assigned_to_name"
  | "location"
  | "has_time_overlap"
  | "assignees"
  | "assignees_label"
  | "is_collaborative"
> & {
  locations:
    | {
        name: string | null;
        address: string | null;
      }
    | {
        name: string | null;
        address: string | null;
      }[]
    | null;
};

const cancelledStatuses = new Set<RequestStatus>([
  "cancelled",
  "duplicate",
  "not_actual",
]);

const closedStatuses = new Set<RequestStatus>([
  "done",
  "cancelled",
  "duplicate",
  "not_actual",
]);

const inWorkStatuses = new Set<RequestStatus>([
  "planned",
  "in_progress",
  "specialist_on_way",
  "waiting_client",
  "waiting_parts",
]);

/** Closed / terminal statuses excluded from unplanned + active columns. */
const CLOSED_STATUS_IN = "(done,cancelled,duplicate,not_actual)";

const todaySelect = `
  id,
  request_number,
  description,
  request_type,
  urgency,
  status,
  planned_date,
  start_time,
  end_time,
  queue_position,
  assigned_to,
  closed_at,
  created_at,
  locations (
    name,
    address
  )
`;

/**
 * Current selection rules (must stay equivalent after SQL push-down):
 *
 * Unplanned: not closed, status ≠ outsource, deleted_at null,
 *   and (planned_date IS NULL OR assigned_to IS NULL OR queue_position IS NULL).
 *
 * Active column: planned_date = selected date, assigned_to set,
 *   status not in closed/cancelled set, status ≠ done, status ≠ outsource.
 *
 * Completed section: status = done, assigned_to set,
 *   local(closed_at) = selected date (Europe/Moscow day bounds).
 *
 * Stats.overdue: not closed, planned_date < selected date (count only;
 *   overdue assigned+queued items are not shown in columns — same as before).
 */
export async function getTodayPlan(date: string): Promise<TodayPlan> {
  const { startIso, endIso } = localDateKeyBoundsUtc(date);

  const [employees, unplannedRows, activeRows, completedRows, overdueCount] =
    await Promise.all([
      getActiveEmployees(),
      fetchTodayUnplanned(),
      fetchTodayActiveForDate(date),
      fetchTodayCompletedForDate(startIso, endIso),
      countTodayOverdue(date),
    ]);

  const requestRows = dedupeRequestRows([
    ...unplannedRows,
    ...activeRows,
    ...completedRows,
  ]);

  const assignedEmployeeIds = requestRows
    .map((request) => request.assigned_to)
    .filter((id): id is string => Boolean(id));
  const employeesById = await getEmployeesById(
    Array.from(
      new Set([...employees.map((employee) => employee.id), ...assignedEmployeeIds]),
    ),
  );
  const assigneesMap = await getAssigneesForRequests(
    requestRows.map((request) => request.id),
  );
  const requests = requestRows.map((request) =>
    mapRequest(request, employeesById, assigneesMap.get(request.id) ?? []),
  );
  const taskProgress = await getTaskProgressMap(
    requests.map((request) => request.id),
  ).catch(() => new Map());
  for (const request of requests) {
    const progress = taskProgress.get(request.id);
    if (progress && progress.total > 0) {
      request.task_done = progress.done;
      request.task_total = progress.total;
    }
  }
  const unplanned = sortUnplannedRequests(
    requests.filter((request) => isUnplannedRequest(request)),
  );

  const activeForDate = requests.filter(
    (request) =>
      request.planned_date === date &&
      Boolean(request.assigned_to) &&
      !cancelledStatuses.has(request.status) &&
      request.status !== "done",
  );

  const completedForDate = requests.filter(
    (request) =>
      Boolean(request.assigned_to) &&
      isCompletedOnSelectedDate(request, date),
  );

  const columns = employees.map((employee) => {
    const active = activeForDate.filter(
      (request) => request.assigned_to === employee.id,
    );
    const completed = completedForDate.filter(
      (request) => request.assigned_to === employee.id,
    );
    const { active: splitActive, completed: splitCompleted } = splitDayRequests(
      [...active, ...completed],
      date,
    );
    const sortedActive = sortByQueuePosition(splitActive);
    const sortedCompleted = sortCompletedDayRequests(splitCompleted);
    const ordered = dedupeById([...sortedActive, ...sortedCompleted]);

    markTimeOverlaps(ordered);

    return {
      employee,
      requests: ordered,
    };
  });

  const planTotal = dedupeById([...activeForDate, ...completedForDate]).length;

  return {
    date,
    employees,
    unplanned,
    columns,
    stats: {
      total: planTotal + unplanned.length,
      unplanned: unplanned.length,
      inWork: activeForDate.filter((request) =>
        inWorkStatuses.has(request.status),
      ).length,
      done: completedForDate.length,
      overdue: overdueCount,
    },
  };
}

async function fetchTodayUnplanned(): Promise<RequestRow[]> {
  const supabase = await createClient();
  const query = supabase
    .from("requests")
    .select(todaySelect)
    .is("deleted_at", null)
    .neq("status", "outsource")
    .not("status", "in", CLOSED_STATUS_IN)
    .or("planned_date.is.null,assigned_to.is.null,queue_position.is.null")
    .order("created_at", { ascending: false });

  let { data, error } = await query;

  if (error && isUndefinedColumnError(error)) {
    ({ data, error } = await supabase
      .from("requests")
      .select(todaySelect)
      .neq("status", "outsource")
      .not("status", "in", CLOSED_STATUS_IN)
      .or("planned_date.is.null,assigned_to.is.null,queue_position.is.null")
      .order("created_at", { ascending: false }));
  }

  if (error) {
    throw error;
  }

  return (data ?? []) as RequestRow[];
}

async function fetchTodayActiveForDate(date: string): Promise<RequestRow[]> {
  const supabase = await createClient();
  let { data, error } = await supabase
    .from("requests")
    .select(todaySelect)
    .is("deleted_at", null)
    .eq("planned_date", date)
    .not("assigned_to", "is", null)
    .neq("status", "outsource")
    .not("status", "in", CLOSED_STATUS_IN)
    .order("created_at", { ascending: false });

  if (error && isUndefinedColumnError(error)) {
    ({ data, error } = await supabase
      .from("requests")
      .select(todaySelect)
      .eq("planned_date", date)
      .not("assigned_to", "is", null)
      .neq("status", "outsource")
      .not("status", "in", CLOSED_STATUS_IN)
      .order("created_at", { ascending: false }));
  }

  if (error) {
    throw error;
  }

  return (data ?? []) as RequestRow[];
}

async function fetchTodayCompletedForDate(
  startIso: string,
  endIso: string,
): Promise<RequestRow[]> {
  const supabase = await createClient();
  let { data, error } = await supabase
    .from("requests")
    .select(todaySelect)
    .is("deleted_at", null)
    .eq("status", "done")
    .not("assigned_to", "is", null)
    .gte("closed_at", startIso)
    .lte("closed_at", endIso)
    .order("closed_at", { ascending: false });

  if (error && isUndefinedColumnError(error)) {
    ({ data, error } = await supabase
      .from("requests")
      .select(todaySelect)
      .eq("status", "done")
      .not("assigned_to", "is", null)
      .gte("closed_at", startIso)
      .lte("closed_at", endIso)
      .order("closed_at", { ascending: false }));
  }

  if (error) {
    throw error;
  }

  return (data ?? []) as RequestRow[];
}

async function countTodayOverdue(date: string): Promise<number> {
  const supabase = await createClient();
  let { count, error } = await supabase
    .from("requests")
    .select("*", { count: "exact", head: true })
    .is("deleted_at", null)
    .neq("status", "outsource")
    .not("status", "in", CLOSED_STATUS_IN)
    .not("planned_date", "is", null)
    .lt("planned_date", date);

  if (error && isUndefinedColumnError(error)) {
    ({ count, error } = await supabase
      .from("requests")
      .select("*", { count: "exact", head: true })
      .neq("status", "outsource")
      .not("status", "in", CLOSED_STATUS_IN)
      .not("planned_date", "is", null)
      .lt("planned_date", date));
  }

  if (error) {
    throw error;
  }

  return count ?? 0;
}

function dedupeRequestRows(rows: RequestRow[]): RequestRow[] {
  const map = new Map<string, RequestRow>();
  for (const row of rows) {
    if (!map.has(row.id)) {
      map.set(row.id, row);
    }
  }
  return [...map.values()];
}

function dedupeById<T extends { id: string }>(items: T[]): T[] {
  const map = new Map<string, T>();
  for (const item of items) {
    if (!map.has(item.id)) {
      map.set(item.id, item);
    }
  }
  return [...map.values()];
}

function mapRequest(
  request: RequestRow,
  employeesById: Map<string, EmployeeOption>,
  assignees: RequestAssignee[],
): TodayRequestItem {
  const location = Array.isArray(request.locations)
    ? (request.locations[0] ?? null)
    : request.locations;

  return {
    ...request,
    assigned_to_name: request.assigned_to
      ? (employeesById.get(request.assigned_to)?.name ?? null)
      : null,
    location,
    has_time_overlap: false,
    assignees,
    assignees_label: formatAssigneesShort(assignees),
    is_collaborative: assignees.length > 1,
  };
}

function isUnplannedRequest(request: TodayRequestItem) {
  return (
    !closedStatuses.has(request.status) &&
    (!request.planned_date || !request.assigned_to || !request.queue_position)
  );
}

function sortUnplannedRequests(requests: TodayRequestItem[]) {
  return [...requests].sort((a, b) => {
    const urgencyDelta = urgencyRank(a.urgency) - urgencyRank(b.urgency);

    if (urgencyDelta !== 0) {
      return urgencyDelta;
    }

    return Date.parse(a.created_at) - Date.parse(b.created_at);
  });
}

function urgencyRank(value: string) {
  if (value === "critical") {
    return 1;
  }

  if (value === "high") {
    return 2;
  }

  if (value === "normal") {
    return 3;
  }

  return 4;
}

function markTimeOverlaps(requests: TodayRequestItem[]) {
  requests.forEach((request, index) => {
    if (!request.start_time || !request.end_time) {
      return;
    }

    const overlaps = requests.some((other, otherIndex) => {
      if (
        index === otherIndex ||
        !other.start_time ||
        !other.end_time ||
        cancelledStatuses.has(other.status)
      ) {
        return false;
      }

      return request.start_time! < other.end_time! && other.start_time! < request.end_time!;
    });

    request.has_time_overlap = overlaps;
  });
}
