import { createClient } from "@/lib/supabase/server";
import {
  formatAssigneesShort,
  getAssigneesForRequest,
  getAssigneesForRequests,
  type RequestAssignee,
} from "@/lib/db/assignees";
import { getActiveEmployees, getEmployeesById } from "@/lib/db/employees";
import { isUndefinedColumnError } from "@/lib/db/schema-errors";

export type RequestStatus =
  | "needs_planning"
  | "needs_review"
  | "planned"
  | "in_progress"
  | "waiting_client"
  | "specialist_on_way"
  | "waiting_parts"
  | "outsource"
  | "postponed"
  | "done"
  | "cancelled"
  | "duplicate"
  | "not_actual";

export type RequestListItem = {
  id: string;
  request_number: number | null;
  title: string | null;
  description: string;
  request_type: string;
  urgency: string;
  status: RequestStatus;
  source: string;
  reported_by_name: string | null;
  planned_date: string | null;
  start_time: string | null;
  end_time: string | null;
  queue_position: number | null;
  assigned_to: string | null;
  assigned_to_name: string | null;
  manager_comment: string | null;
  executor_comment: string | null;
  closed_at: string | null;
  created_at: string;
  assignees: RequestAssignee[];
  assignees_label: string;
  is_collaborative: boolean;
  location: {
    name: string | null;
    address: string | null;
    city: string | null;
  } | null;
};

export type RequestDetail = RequestListItem & {
  request_type: string;
  close_result: string | null;
};

export const REQUESTS_PAGE_SIZE = 50;

export type MechanicListFilter =
  | "all"
  | "unassigned"
  | "ivan"
  | "oleg"
  | "maxim";

type GetRequestsOptions = {
  search?: string;
  mechanic?: MechanicListFilter;
  page?: number;
  pageSize?: number;
};

export type GetRequestsResult = {
  items: RequestListItem[];
  total: number;
  page: number;
  pageSize: number;
};

export type RequestsDashboardStats = {
  total: number;
  needsPlanning: number;
  todayInWork: number;
  done: number;
};

type RequestRow = Omit<
  RequestListItem,
  | "location"
  | "assigned_to_name"
  | "assignees"
  | "assignees_label"
  | "is_collaborative"
> & {
  locations:
    | {
        name: string | null;
        address: string | null;
        city: string | null;
      }
    | {
        name: string | null;
        address: string | null;
        city: string | null;
      }[]
    | null;
};

const requestListSelect = `
  id,
  request_number,
  title,
  description,
  request_type,
  urgency,
  status,
  source,
  reported_by_name,
  planned_date,
  start_time,
  end_time,
  queue_position,
  assigned_to,
  manager_comment,
  executor_comment,
  closed_at,
  created_at,
  locations (
    name,
    address,
    city
  )
`;

const mechanicNameNeedles: Record<
  Exclude<MechanicListFilter, "all" | "unassigned">,
  string
> = {
  ivan: "иван",
  oleg: "олег",
  maxim: "максим",
};

export async function getRequests(
  options: GetRequestsOptions = {},
): Promise<GetRequestsResult> {
  const supabase = await createClient();
  const search = options.search?.trim();
  const mechanic = options.mechanic ?? "all";
  const pageSize = Math.min(Math.max(options.pageSize ?? REQUESTS_PAGE_SIZE, 1), 100);
  const page = Math.max(options.page ?? 1, 1);
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const assignedFilter = await resolveMechanicAssignedFilter(mechanic);
  if (assignedFilter === "empty") {
    return { items: [], total: 0, page, pageSize };
  }

  let query = supabase
    .from("requests")
    .select(requestListSelect, { count: "exact" })
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .range(from, to);

  query = applyRequestSearch(query, search);
  query = applyMechanicAssignedFilter(query, assignedFilter);

  let { data, error, count } = await query;

  if (error && isUndefinedColumnError(error)) {
    let fallback = supabase
      .from("requests")
      .select(requestListSelect, { count: "exact" })
      .order("created_at", { ascending: false })
      .range(from, to);
    fallback = applyRequestSearch(fallback, search);
    fallback = applyMechanicAssignedFilter(fallback, assignedFilter);
    ({ data, error, count } = await fallback);
  }

  if (error) {
    throw error;
  }

  const rows = (data ?? []) as RequestRow[];
  const employeesById = await getEmployeesById(
    rows
      .map((request) => request.assigned_to)
      .filter((id): id is string => Boolean(id)),
  );
  const assigneesMap = await getAssigneesForRequests(
    rows.map((request) => request.id),
  );

  return {
    page,
    pageSize,
    total: count ?? 0,
    items: rows.map((request) => {
      const location = Array.isArray(request.locations)
        ? (request.locations[0] ?? null)
        : request.locations;
      const assignees = assigneesMap.get(request.id) ?? [];

      return {
        ...request,
        assigned_to_name: request.assigned_to
          ? (employeesById.get(request.assigned_to)?.name ?? null)
          : null,
        assignees,
        assignees_label: formatAssigneesShort(assignees),
        is_collaborative: assignees.length > 1,
        location,
      };
    }),
  };
}

/** Stats ignore mechanic filter (same as previous page behavior). */
export async function getRequestsDashboardStats(
  search?: string,
): Promise<RequestsDashboardStats> {
  const supabase = await createClient();
  const today = getLocalTodayKey();
  const trimmed = search?.trim();

  const base = () => {
    let query = supabase
      .from("requests")
      .select("*", { count: "exact", head: true })
      .is("deleted_at", null);
    query = applyRequestSearch(query, trimmed);
    return query;
  };

  const [totalRes, needsRes, todayRes, doneRes] = await Promise.all([
    base(),
    base().eq("status", "needs_planning"),
    base()
      .eq("planned_date", today)
      .in("status", ["planned", "in_progress", "waiting_client"]),
    base().eq("status", "done"),
  ]);

  const firstError =
    totalRes.error || needsRes.error || todayRes.error || doneRes.error;

  if (firstError && isUndefinedColumnError(firstError)) {
    const baseFallback = () => {
      let query = supabase
        .from("requests")
        .select("*", { count: "exact", head: true });
      query = applyRequestSearch(query, trimmed);
      return query;
    };
    const [t, n, d, done] = await Promise.all([
      baseFallback(),
      baseFallback().eq("status", "needs_planning"),
      baseFallback()
        .eq("planned_date", today)
        .in("status", ["planned", "in_progress", "waiting_client"]),
      baseFallback().eq("status", "done"),
    ]);
    if (t.error || n.error || d.error || done.error) {
      throw t.error || n.error || d.error || done.error;
    }
    return {
      total: t.count ?? 0,
      needsPlanning: n.count ?? 0,
      todayInWork: d.count ?? 0,
      done: done.count ?? 0,
    };
  }

  if (firstError) {
    throw firstError;
  }

  return {
    total: totalRes.count ?? 0,
    needsPlanning: needsRes.count ?? 0,
    todayInWork: todayRes.count ?? 0,
    done: doneRes.count ?? 0,
  };
}

function applyRequestSearch<T extends { or: (filters: string) => T }>(
  query: T,
  search: string | undefined,
): T {
  if (!search) {
    return query;
  }
  const safeSearch = search.replaceAll(",", " ").replaceAll("%", "");
  return query.or(
    `title.ilike.%${safeSearch}%,description.ilike.%${safeSearch}%,reported_by_name.ilike.%${safeSearch}%`,
  );
}

type AssignedFilter = "all" | "unassigned" | { ids: string[] } | "empty";

async function resolveMechanicAssignedFilter(
  mechanic: MechanicListFilter,
): Promise<AssignedFilter> {
  if (mechanic === "all") {
    return "all";
  }
  if (mechanic === "unassigned") {
    return "unassigned";
  }

  const employees = await getActiveEmployees();
  const needle = mechanicNameNeedles[mechanic];
  const ids = employees
    .filter((employee) => employee.name.toLowerCase().includes(needle))
    .map((employee) => employee.id);

  if (ids.length === 0) {
    return "empty";
  }

  return { ids };
}

function applyMechanicAssignedFilter<
  T extends {
    is: (column: string, value: null) => T;
    in: (column: string, values: string[]) => T;
  },
>(query: T, filter: AssignedFilter): T {
  if (filter === "all" || filter === "empty") {
    return query;
  }
  if (filter === "unassigned") {
    return query.is("assigned_to", null);
  }
  return query.in("assigned_to", filter.ids);
}

function getLocalTodayKey() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export async function getRequestById(id: string) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("requests")
    .select(
      `
        id,
        request_number,
        title,
        description,
        request_type,
        urgency,
        status,
        source,
        reported_by_name,
        planned_date,
        start_time,
        end_time,
        queue_position,
        assigned_to,
        manager_comment,
        executor_comment,
        closed_at,
        close_result,
        created_at,
        locations (
          name,
          address,
          city
        )
      `,
    )
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();

  if (error && isUndefinedColumnError(error)) {
    const fallback = await supabase
      .from("requests")
      .select(
        `
        id,
        request_number,
        title,
        description,
        request_type,
        urgency,
        status,
        source,
        reported_by_name,
        planned_date,
        start_time,
        end_time,
        queue_position,
        assigned_to,
        manager_comment,
        executor_comment,
        closed_at,
        close_result,
        created_at,
        locations (
          name,
          address,
          city
        )
      `,
      )
      .eq("id", id)
      .maybeSingle();
    if (fallback.error) {
      throw fallback.error;
    }
    if (!fallback.data) {
      return null;
    }
    const row = fallback.data as RequestRow & { close_result: string | null };
    const employeesById = await getEmployeesById(
      row.assigned_to ? [row.assigned_to] : [],
    );
    const location = Array.isArray(row.locations)
      ? (row.locations[0] ?? null)
      : row.locations;
    const assignees = await getAssigneesForRequest(row.id);

    return {
      ...row,
      assigned_to_name: row.assigned_to
        ? (employeesById.get(row.assigned_to)?.name ?? null)
        : null,
      assignees,
      assignees_label: formatAssigneesShort(assignees),
      is_collaborative: assignees.length > 1,
      location,
    } satisfies RequestDetail;
  }

  if (error) {
    throw error;
  }

  if (!data) {
    return null;
  }

  const row = data as RequestRow & { close_result: string | null };
  const employeesById = await getEmployeesById(
    row.assigned_to ? [row.assigned_to] : [],
  );
  const location = Array.isArray(row.locations)
    ? (row.locations[0] ?? null)
    : row.locations;
  const assignees = await getAssigneesForRequest(row.id);

  return {
    ...row,
    assigned_to_name: row.assigned_to
      ? (employeesById.get(row.assigned_to)?.name ?? null)
      : null,
    assignees,
    assignees_label: formatAssigneesShort(assignees),
    is_collaborative: assignees.length > 1,
    location,
  } satisfies RequestDetail;
}
