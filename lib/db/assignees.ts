import { createClient } from "@/lib/supabase/server";
import { getEmployeesById } from "@/lib/db/employees";
import {
  logAssigneeChanges,
  snapshotAssignees,
} from "@/lib/db/request-history";

export type AssigneeRole = "responsible" | "participant";
export type ParticipationStatus = "assigned" | "in_progress" | "completed";

export type RequestAssignee = {
  id: string;
  request_id: string;
  employee_id: string;
  employee_name: string;
  role: AssigneeRole;
  participation_status: ParticipationStatus;
  started_at: string | null;
  completed_at: string | null;
};

type AssigneeRow = {
  id: string;
  request_id: string;
  employee_id: string;
  role: AssigneeRole;
  participation_status: ParticipationStatus;
  started_at: string | null;
  completed_at: string | null;
};

export async function getAssigneesForRequest(requestId: string) {
  const map = await getAssigneesForRequests([requestId]);
  return map.get(requestId) ?? [];
}

export async function getAssigneesForRequests(requestIds: string[]) {
  const result = new Map<string, RequestAssignee[]>();

  if (requestIds.length === 0) {
    return result;
  }

  const supabase = await createClient();
  let query = supabase
    .from("request_assignees")
    .select(
      "id, request_id, employee_id, role, participation_status, started_at, completed_at",
    )
    .in("request_id", requestIds)
    .is("removed_at", null);

  let { data, error } = await query;

  if (
    error &&
    (error.code === "42703" || /removed_at/i.test(error.message))
  ) {
    ({ data, error } = await supabase
      .from("request_assignees")
      .select(
        "id, request_id, employee_id, role, participation_status, started_at, completed_at",
      )
      .in("request_id", requestIds));
  }

  if (error) {
    // Table may not exist yet before migration — fail soft for managers UI.
    if (
      error.code === "42P01" ||
      error.code === "PGRST205" ||
      /relation .*request_assignees.* does not exist/i.test(error.message)
    ) {
      return result;
    }
    throw error;
  }

  const rows = (data ?? []) as AssigneeRow[];
  const employeeIds = [...new Set(rows.map((row) => row.employee_id))];
  const employees = await getEmployeesById(employeeIds);

  for (const row of rows) {
    const item: RequestAssignee = {
      ...row,
      employee_name: employees.get(row.employee_id)?.name ?? "Без имени",
    };
    const list = result.get(row.request_id) ?? [];
    list.push(item);
    result.set(row.request_id, list);
  }

  for (const [requestId, list] of result) {
    result.set(
      requestId,
      [...list].sort((a, b) => {
        if (a.role !== b.role) {
          return a.role === "responsible" ? -1 : 1;
        }
        return a.employee_name.localeCompare(b.employee_name, "ru");
      }),
    );
  }

  return result;
}

export async function getAssigneeRequestIds(employeeId: string) {
  const supabase = await createClient();
  let { data, error } = await supabase
    .from("request_assignees")
    .select("request_id")
    .eq("employee_id", employeeId)
    .is("removed_at", null);

  if (
    error &&
    (error.code === "42703" || /removed_at/i.test(error.message))
  ) {
    ({ data, error } = await supabase
      .from("request_assignees")
      .select("request_id")
      .eq("employee_id", employeeId));
  }

  if (error) {
    // Only soft-fail when the table/relationship is missing — not on RLS/empty.
    if (
      error.code === "42P01" ||
      error.code === "PGRST205" ||
      /relation .*request_assignees.* does not exist/i.test(error.message)
    ) {
      return null;
    }
    throw error;
  }

  return [...new Set((data ?? []).map((row) => row.request_id as string))];
}

export async function getMyAssigneeRow(requestId: string, employeeId: string) {
  const supabase = await createClient();
  let { data, error } = await supabase
    .from("request_assignees")
    .select(
      "id, request_id, employee_id, role, participation_status, started_at, completed_at",
    )
    .eq("request_id", requestId)
    .eq("employee_id", employeeId)
    .is("removed_at", null)
    .maybeSingle();

  if (
    error &&
    (error.code === "42703" || /removed_at/i.test(error.message))
  ) {
    ({ data, error } = await supabase
      .from("request_assignees")
      .select(
        "id, request_id, employee_id, role, participation_status, started_at, completed_at",
      )
      .eq("request_id", requestId)
      .eq("employee_id", employeeId)
      .maybeSingle());
  }

  if (error) {
    throw error;
  }

  if (!data) {
    return null;
  }

  const employees = await getEmployeesById([employeeId]);
  const row = data as AssigneeRow;

  return {
    ...row,
    employee_name: employees.get(employeeId)?.name ?? "Без имени",
  } satisfies RequestAssignee;
}

/** Full replace of assignees; keeps participation for unchanged rows. */
export async function syncRequestAssignees(
  requestId: string,
  responsibleId: string | null,
  participantIds: string[],
  options?: { logHistory?: boolean },
) {
  const supabase = await createClient();
  const logHistory = options?.logHistory ?? true;
  const participants = [
    ...new Set(participantIds.filter((id) => id && id !== responsibleId)),
  ];

  const beforeActive = await getAssigneesForRequest(requestId);

  const { data: existing, error: existingError } = await supabase
    .from("request_assignees")
    .select("id, employee_id, role, participation_status, started_at, completed_at")
    .eq("request_id", requestId);

  if (existingError) {
    throw existingError;
  }

  const current = (existing ?? []) as AssigneeRow[];
  const desiredIds = new Set(
    responsibleId ? [responsibleId, ...participants] : [],
  );

  const toDelete = current.filter((row) => !desiredIds.has(row.employee_id));
  if (toDelete.length > 0) {
    const { error } = await supabase
      .from("request_assignees")
      .delete()
      .in(
        "id",
        toDelete.map((row) => row.id),
      );
    if (error) {
      throw error;
    }
  }

  if (!responsibleId) {
    const { error } = await supabase
      .from("requests")
      .update({ assigned_to: null })
      .eq("id", requestId);
    if (error) {
      throw error;
    }
    if (logHistory) {
      await logAssigneeChanges({
        requestId,
        before: snapshotAssignees(beforeActive),
        after: [],
      });
    }
    return;
  }

  for (const employeeId of desiredIds) {
    const role: AssigneeRole =
      employeeId === responsibleId ? "responsible" : "participant";
    const prev = current.find((row) => row.employee_id === employeeId);

    if (prev) {
      if (prev.role !== role) {
        const { error } = await supabase
          .from("request_assignees")
          .update({ role })
          .eq("id", prev.id);
        if (error) {
          throw error;
        }
      }
      continue;
    }

    const { error } = await supabase.from("request_assignees").insert({
      request_id: requestId,
      employee_id: employeeId,
      role,
      participation_status: "assigned",
    });
    if (error) {
      throw error;
    }
  }

  const { error: assignedError } = await supabase
    .from("requests")
    .update({ assigned_to: responsibleId })
    .eq("id", requestId);

  if (assignedError) {
    throw assignedError;
  }

  if (logHistory) {
    const after: Array<{ employee_id: string; role: AssigneeRole }> = [
      { employee_id: responsibleId, role: "responsible" },
      ...participants.map((employeeId) => ({
        employee_id: employeeId,
        role: "participant" as const,
      })),
    ];
    await logAssigneeChanges({
      requestId,
      before: snapshotAssignees(beforeActive),
      after: snapshotAssignees(after),
    });
  }
}

/** Used by today DnD / quick plan — changes responsible, keeps other participants. */
export async function setRequestResponsible(
  requestId: string,
  employeeId: string | null,
  options?: { logHistory?: boolean },
) {
  const supabase = await createClient();
  const logHistory = options?.logHistory ?? true;
  const beforeActive = logHistory
    ? await getAssigneesForRequest(requestId)
    : [];

  if (!employeeId) {
    const { error } = await supabase
      .from("request_assignees")
      .delete()
      .eq("request_id", requestId);
    if (error) {
      throw error;
    }
    const { error: requestError } = await supabase
      .from("requests")
      .update({ assigned_to: null })
      .eq("id", requestId);
    if (requestError) {
      throw requestError;
    }
    if (logHistory) {
      await logAssigneeChanges({
        requestId,
        before: snapshotAssignees(beforeActive),
        after: [],
      });
    }
    return;
  }

  const { data: existing, error: existingError } = await supabase
    .from("request_assignees")
    .select("id, employee_id, role")
    .eq("request_id", requestId);

  if (existingError) {
    throw existingError;
  }

  const rows = (existing ?? []) as Array<{
    id: string;
    employee_id: string;
    role: AssigneeRole;
  }>;
  const currentResponsible = rows.find((row) => row.role === "responsible");
  const asMember = rows.find((row) => row.employee_id === employeeId);

  if (
    currentResponsible &&
    currentResponsible.employee_id !== employeeId
  ) {
    const { error } = await supabase
      .from("request_assignees")
      .delete()
      .eq("id", currentResponsible.id);
    if (error) {
      throw error;
    }
  }

  if (asMember) {
    if (asMember.role !== "responsible") {
      const { error } = await supabase
        .from("request_assignees")
        .update({ role: "responsible" })
        .eq("id", asMember.id);
      if (error) {
        throw error;
      }
    }
  } else {
    const { error } = await supabase.from("request_assignees").insert({
      request_id: requestId,
      employee_id: employeeId,
      role: "responsible",
      participation_status: "assigned",
    });
    if (error) {
      throw error;
    }
  }

  const { error: requestError } = await supabase
    .from("requests")
    .update({ assigned_to: employeeId })
    .eq("id", requestId);

  if (requestError) {
    throw requestError;
  }

  if (logHistory) {
    const afterActive = await getAssigneesForRequest(requestId);
    await logAssigneeChanges({
      requestId,
      before: snapshotAssignees(beforeActive),
      after: snapshotAssignees(afterActive),
    });
  }
}

export function parseParticipantIds(formData: FormData) {
  return formData
    .getAll("participant_ids")
    .filter((value): value is string => typeof value === "string")
    .map((value) => value.trim())
    .filter(Boolean);
}

export function formatAssigneesShort(assignees: RequestAssignee[]) {
  if (assignees.length === 0) {
    return "Не назначен";
  }

  if (assignees.length === 1) {
    return assignees[0].employee_name;
  }

  const first = assignees[0].employee_name.split(" ")[0] ?? assignees[0].employee_name;
  if (assignees.length === 2) {
    const second =
      assignees[1].employee_name.split(" ")[0] ?? assignees[1].employee_name;
    return `${first} + ${second}`;
  }

  return `${first} + ещё ${assignees.length - 1}`;
}
