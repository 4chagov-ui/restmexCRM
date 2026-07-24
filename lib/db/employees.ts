import { createClient } from "@/lib/supabase/server";

export type EmployeeOption = {
  id: string;
  name: string;
  phone: string | null;
  role: string;
  is_active: boolean;
  sort_order: number;
};

export type EmployeeTaskStats = {
  employee_id: string;
  total: number;
  open: number;
  done: number;
};

type RequestStatsRow = {
  assigned_to: string | null;
  status: string;
};

const closedStatuses = new Set(["done", "cancelled", "duplicate", "not_actual"]);

function isMissingEmployeesTable(error: { code?: string; message?: string }) {
  return (
    error.code === "42P01" ||
    error.code === "PGRST205" ||
    error.message?.toLowerCase().includes("employees") === true
  );
}

export async function getActiveEmployees() {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("employees")
    .select("id, name, phone, role, is_active, sort_order")
    .eq("is_active", true)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });

  if (error) {
    if (isMissingEmployeesTable(error)) {
      return [];
    }

    throw error;
  }

  return (data ?? []) as EmployeeOption[];
}

export async function getEmployeeById(id: string) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("employees")
    .select("id, name, phone, role, is_active, sort_order")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    if (isMissingEmployeesTable(error)) {
      return null;
    }

    throw error;
  }

  return data as EmployeeOption | null;
}

export async function getEmployeesById(ids: string[]) {
  const supabase = await createClient();
  const uniqueIds = Array.from(new Set(ids.filter(Boolean)));

  if (uniqueIds.length === 0) {
    return new Map<string, EmployeeOption>();
  }

  const { data, error } = await supabase
    .from("employees")
    .select("id, name, phone, role, is_active, sort_order")
    .in("id", uniqueIds);

  if (error) {
    if (isMissingEmployeesTable(error)) {
      return new Map<string, EmployeeOption>();
    }

    throw error;
  }

  return new Map(((data ?? []) as EmployeeOption[]).map((employee) => [
    employee.id,
    employee,
  ]));
}

export async function getEmployeeTaskStats(date?: string) {
  const supabase = await createClient();
  let query = supabase
    .from("requests")
    .select("assigned_to, status")
    .not("assigned_to", "is", null)
    .is("deleted_at", null);

  if (date) {
    query = query.eq("planned_date", date);
  }

  const { data, error } = await query;

  if (error) {
    if (isMissingEmployeesTable(error)) {
      return [];
    }

    throw error;
  }

  const statsByEmployee = new Map<string, EmployeeTaskStats>();

  ((data ?? []) as RequestStatsRow[]).forEach((request) => {
    if (!request.assigned_to) {
      return;
    }

    const stats = statsByEmployee.get(request.assigned_to) ?? {
      employee_id: request.assigned_to,
      total: 0,
      open: 0,
      done: 0,
    };

    stats.total += 1;

    if (request.status === "done") {
      stats.done += 1;
    } else if (!closedStatuses.has(request.status)) {
      stats.open += 1;
    }

    statsByEmployee.set(request.assigned_to, stats);
  });

  return Array.from(statsByEmployee.values());
}
