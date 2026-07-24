import { createClient } from "@/lib/supabase/server";
import { getEmployeesById } from "@/lib/db/employees";
import type { RequestStatus } from "@/lib/db/requests";

export type LocationOption = {
  id: string;
  name: string;
  address: string | null;
  contact: string | null;
  phone: string | null;
};

export type LocationListItem = LocationOption & {
  city: string | null;
  notes: string | null;
  yandex_maps_url: string | null;
  working_hours: string | null;
  created_at: string;
  total_requests: number;
  open_requests: number;
  last_request_at: string | null;
};

export type LocationRequestItem = {
  id: string;
  request_number: number | null;
  description: string;
  status: RequestStatus;
  urgency: string;
  assigned_to: string | null;
  assigned_to_name: string | null;
  planned_date: string | null;
  closed_at: string | null;
  created_at: string;
};

export type LocationDetail = LocationListItem & {
  completed_requests: number;
  overdue_requests: number;
  last_visit_at: string | null;
  next_visit_at: string | null;
  last_mechanic_name: string | null;
  requests: LocationRequestItem[];
};

type LocationRow = {
  id: string;
  name: string;
  address: string | null;
  city: string | null;
  client_name: string | null;
  contact: string | null;
  phone: string | null;
  yandex_maps_url: string | null;
  working_hours: string | null;
  notes: string | null;
  is_active: boolean;
  created_at: string;
};

type RequestRow = {
  id: string;
  request_number: number | null;
  location_id: string | null;
  description: string;
  status: RequestStatus;
  urgency: string;
  assigned_to: string | null;
  planned_date: string | null;
  closed_at: string | null;
  created_at: string;
};

const closedStatuses = new Set<RequestStatus>([
  "done",
  "cancelled",
  "duplicate",
  "not_actual",
]);

function isOpenStatus(status: RequestStatus) {
  return !closedStatuses.has(status);
}

function getTodayDateKey() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function sortLocationRequests(requests: LocationRequestItem[]) {
  return [...requests].sort((a, b) => {
    const aClosed = closedStatuses.has(a.status);
    const bClosed = closedStatuses.has(b.status);

    if (aClosed !== bClosed) {
      return aClosed ? 1 : -1;
    }

    return Date.parse(b.created_at) - Date.parse(a.created_at);
  });
}

export async function getLocations() {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("locations")
    .select("id, name, address, contact, phone")
    .eq("is_active", true)
    .order("name", { ascending: true });

  if (error) {
    throw error;
  }

  return (data ?? []) as LocationOption[];
}

type GetLocationsOptions = {
  search?: string;
};

export async function getLocationList(options: GetLocationsOptions = {}) {
  const supabase = await createClient();
  const search = options.search?.trim();

  let query = supabase
    .from("locations")
    .select(
      "id, name, address, city, client_name, contact, phone, yandex_maps_url, working_hours, notes, is_active, created_at",
    )
    .eq("is_active", true)
    .order("name", { ascending: true });

  if (search) {
    const safeSearch = search.replaceAll(",", " ").replaceAll("%", "");
    query = query.or(
      `name.ilike.%${safeSearch}%,address.ilike.%${safeSearch}%,city.ilike.%${safeSearch}%,notes.ilike.%${safeSearch}%`,
    );
  }

  const { data: locations, error } = await query;

  if (error) {
    throw error;
  }

  const rows = (locations ?? []) as LocationRow[];
  const locationIds = rows.map((location) => location.id);

  if (locationIds.length === 0) {
    return [] as LocationListItem[];
  }

  const { data: requests, error: requestsError } = await supabase
    .from("requests")
    .select("id, location_id, status, created_at")
    .in("location_id", locationIds)
    .is("deleted_at", null);

  if (requestsError) {
    throw requestsError;
  }

  const statsByLocation = new Map<
    string,
    { total: number; open: number; lastRequestAt: string | null }
  >();

  ((requests ?? []) as Pick<
    RequestRow,
    "id" | "location_id" | "status" | "created_at"
  >[]).forEach((request) => {
    if (!request.location_id) {
      return;
    }

    const stats = statsByLocation.get(request.location_id) ?? {
      total: 0,
      open: 0,
      lastRequestAt: null,
    };

    stats.total += 1;

    if (isOpenStatus(request.status)) {
      stats.open += 1;
    }

    if (
      !stats.lastRequestAt ||
      Date.parse(request.created_at) > Date.parse(stats.lastRequestAt)
    ) {
      stats.lastRequestAt = request.created_at;
    }

    statsByLocation.set(request.location_id, stats);
  });

  return rows.map((location) => {
    const stats = statsByLocation.get(location.id);

    return {
      ...location,
      total_requests: stats?.total ?? 0,
      open_requests: stats?.open ?? 0,
      last_request_at: stats?.lastRequestAt ?? null,
    };
  });
}

export async function getLocationById(id: string) {
  const supabase = await createClient();

  const { data: location, error } = await supabase
    .from("locations")
    .select(
      "id, name, address, city, client_name, contact, phone, yandex_maps_url, working_hours, notes, is_active, created_at",
    )
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!location) {
    return null;
  }

  const { data: requests, error: requestsError } = await supabase
    .from("requests")
    .select(
      "id, request_number, location_id, description, status, urgency, assigned_to, planned_date, closed_at, created_at",
    )
    .eq("location_id", id)
    .is("deleted_at", null);

  if (requestsError) {
    throw requestsError;
  }

  const requestRows = (requests ?? []) as RequestRow[];
  const employeesById = await getEmployeesById(
    requestRows
      .map((request) => request.assigned_to)
      .filter((employeeId): employeeId is string => Boolean(employeeId)),
  );
  const mappedRequests = sortLocationRequests(
    requestRows.map((request) => ({
      id: request.id,
      request_number: request.request_number,
      description: request.description,
      status: request.status,
      urgency: request.urgency,
      assigned_to: request.assigned_to,
      assigned_to_name: request.assigned_to
        ? (employeesById.get(request.assigned_to)?.name ?? null)
        : null,
      planned_date: request.planned_date,
      closed_at: request.closed_at,
      created_at: request.created_at,
    })),
  );
  const totalRequests = mappedRequests.length;
  const openRequests = mappedRequests.filter((request) =>
    isOpenStatus(request.status),
  ).length;
  const completedRequests = mappedRequests.filter(
    (request) => request.status === "done",
  ).length;
  const today = getTodayDateKey();
  const overdueRequests = mappedRequests.filter(
    (request) =>
      isOpenStatus(request.status) &&
      Boolean(request.planned_date) &&
      request.planned_date! < today,
  ).length;
  const completedVisits = mappedRequests
    .filter((request) => request.status === "done" && request.closed_at)
    .sort(
      (a, b) => Date.parse(b.closed_at ?? "") - Date.parse(a.closed_at ?? ""),
    );
  const upcomingVisits = mappedRequests
    .filter(
      (request) =>
        isOpenStatus(request.status) &&
        Boolean(request.planned_date) &&
        request.planned_date! >= today,
    )
    .map((request) => request.planned_date!)
    .sort((a, b) => Date.parse(a) - Date.parse(b));
  const lastCompletedVisit = completedVisits[0] ?? null;
  const lastRequest = mappedRequests
    .slice()
    .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))[0];

  return {
    ...(location as LocationRow),
    total_requests: totalRequests,
    open_requests: openRequests,
    completed_requests: completedRequests,
    overdue_requests: overdueRequests,
    last_visit_at: lastCompletedVisit?.closed_at ?? null,
    next_visit_at: upcomingVisits[0] ?? null,
    last_mechanic_name: lastCompletedVisit?.assigned_to_name ?? null,
    last_request_at: lastRequest?.created_at ?? null,
    requests: mappedRequests,
  } satisfies LocationDetail;
}
