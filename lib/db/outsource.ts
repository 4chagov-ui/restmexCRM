import { createClient } from "@/lib/supabase/server";
import { logRequestHistory } from "@/lib/db/request-history";
import type { RequestStatus } from "@/lib/db/requests";

export type OutsourceStatus = "sent" | "in_progress" | "completed";
export type ExecutionType = "internal" | "outsourced" | "mixed";

export type OutsourcedRequest = {
  id: string;
  request_number: number | null;
  description: string;
  status: RequestStatus;
  outsource_status: OutsourceStatus | null;
  outsource_contractor: string | null;
  outsource_contact: string | null;
  outsource_comment: string | null;
  outsource_expected_date: string | null;
  outsourced_at: string | null;
  location_name: string | null;
};

export async function getOutsourcedRequests(): Promise<OutsourcedRequest[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("requests")
    .select(
      `
        id,
        request_number,
        description,
        status,
        outsource_status,
        outsource_contractor,
        outsource_contact,
        outsource_comment,
        outsource_expected_date,
        outsourced_at,
        locations ( name )
      `,
    )
    .eq("execution_type", "outsourced")
    .is("deleted_at", null)
    .order("outsourced_at", { ascending: false });

  if (error) {
    // Fallback before migration: status-only.
    if (
      error.code === "42703" ||
      /execution_type|outsource_status/i.test(error.message)
    ) {
      return getOutsourcedRequestsLegacy();
    }
    throw error;
  }

  return (data ?? []).map(mapOutsourcedRow);
}

async function getOutsourcedRequestsLegacy(): Promise<OutsourcedRequest[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("requests")
    .select(
      `
        id,
        request_number,
        description,
        status,
        outsource_contractor,
        outsource_comment,
        locations ( name )
      `,
    )
    .eq("status", "outsource")
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  return (data ?? []).map((row) => ({
    id: row.id as string,
    request_number: row.request_number as number | null,
    description: row.description as string,
    status: row.status as RequestStatus,
    outsource_status: "sent" as OutsourceStatus,
    outsource_contractor: (row.outsource_contractor as string | null) ?? null,
    outsource_contact: null,
    outsource_comment: (row.outsource_comment as string | null) ?? null,
    outsource_expected_date: null,
    outsourced_at: null,
    location_name: locationName(row.locations),
  }));
}

export async function transferRequestToOutsource(input: {
  requestId: string;
  actorId: string;
  contractor: string;
  contact: string;
  comment: string;
  expectedDate: string | null;
  outsourcedAt: string;
}) {
  const supabase = await createClient();

  const { data: current, error: readError } = await supabase
    .from("requests")
    .select(
      "id, status, assigned_to, planned_date, execution_type, deleted_at",
    )
    .eq("id", input.requestId)
    .maybeSingle();

  if (readError) {
    throw readError;
  }

  if (!current || current.deleted_at) {
    return { ok: false as const, error: "Заявка не найдена." };
  }

  if (current.execution_type === "outsourced") {
    return { ok: false as const, error: "Заявка уже на аутсорсе." };
  }

  const plannedDate = current.planned_date as string | null;
  const affectedMechanics = await getActiveAssigneeEmployeeIds(input.requestId);

  const { error: rpcError } = await supabase.rpc(
    "transfer_request_to_outsource",
    {
      p_request_id: input.requestId,
      p_actor_id: input.actorId,
      p_contractor: input.contractor,
      p_contact: input.contact,
      p_comment: input.comment,
      p_expected_date: input.expectedDate,
      p_outsourced_at: input.outsourcedAt,
    },
  );

  if (rpcError) {
    // App-level fallback if RPC not migrated yet.
    if (
      rpcError.code === "PGRST202" ||
      /transfer_request_to_outsource|Could not find/i.test(rpcError.message)
    ) {
      await transferRequestToOutsourceAppLevel(input, affectedMechanics);
    } else {
      throw rpcError;
    }
  }

  if (plannedDate && affectedMechanics.length > 0) {
    await renumberMechanicQueuesForDate(plannedDate, affectedMechanics);
  }

  await logRequestHistory({
    requestId: input.requestId,
    action: "outsourced",
    fieldName: "execution_type",
    oldValue: (current.execution_type as string | null) ?? "internal",
    newValue: "outsourced",
    metadata: {
      contractorId: null,
      contractorName: input.contractor || null,
      comment: input.comment || null,
      previousStatus: current.status as string,
      removedAssigneesCount: affectedMechanics.length,
      assigneesCleared: true,
    },
  });

  return { ok: true as const };
}

export async function returnRequestFromOutsource(input: {
  requestId: string;
  actorId: string;
}) {
  const supabase = await createClient();

  const { data: current, error: readError } = await supabase
    .from("requests")
    .select(
      "id, status, execution_type, outsource_contractor, outsource_status, deleted_at",
    )
    .eq("id", input.requestId)
    .maybeSingle();

  if (readError) {
    throw readError;
  }

  if (!current || current.deleted_at) {
    return { ok: false as const, error: "Заявка не найдена." };
  }

  const { error } = await supabase
    .from("requests")
    .update({
      execution_type: "internal",
      status: "needs_planning" satisfies RequestStatus,
      outsource_status: null,
      outsourced_at: null,
      outsourced_by: null,
      outsource_contractor: null,
      outsource_contact: null,
      outsource_comment: null,
      outsource_expected_date: null,
      assigned_to: null,
      planned_date: null,
      start_time: null,
      end_time: null,
      queue_position: null,
    })
    .eq("id", input.requestId);

  if (error) {
    throw error;
  }

  await logRequestHistory({
    requestId: input.requestId,
    action: "returned_from_outsource",
    fieldName: "execution_type",
    oldValue: (current.execution_type as string | null) ?? "outsourced",
    newValue: "internal",
    metadata: {
      contractorName: (current.outsource_contractor as string | null) ?? null,
      previousStatus: current.status as string,
    },
  });

  return { ok: true as const };
}

async function transferRequestToOutsourceAppLevel(
  input: {
    requestId: string;
    actorId: string;
    contractor: string;
    contact: string;
    comment: string;
    expectedDate: string | null;
    outsourcedAt: string;
  },
  _affectedMechanics: string[],
) {
  const supabase = await createClient();

  const { error: removeError } = await supabase
    .from("request_assignees")
    .update({
      removed_at: input.outsourcedAt,
      removed_by: input.actorId,
      removal_reason: "Передано на аутсорс",
    })
    .eq("request_id", input.requestId)
    .is("removed_at", null);

  if (
    removeError &&
    removeError.code !== "42703" &&
    !/removed_at/i.test(removeError.message)
  ) {
    // Fallback: hard delete assignees if soft-remove columns missing.
    const { error: deleteError } = await supabase
      .from("request_assignees")
      .delete()
      .eq("request_id", input.requestId);
    if (deleteError) {
      throw deleteError;
    }
  } else if (removeError && removeError.code === "42703") {
    const { error: deleteError } = await supabase
      .from("request_assignees")
      .delete()
      .eq("request_id", input.requestId);
    if (deleteError) {
      throw deleteError;
    }
  }

  const { error } = await supabase
    .from("requests")
    .update({
      execution_type: "outsourced",
      status: "outsource",
      outsource_status: "sent",
      outsource_contractor: input.contractor || null,
      outsource_contact: input.contact || null,
      outsource_comment: input.comment || null,
      outsource_expected_date: input.expectedDate,
      outsourced_at: input.outsourcedAt,
      outsourced_by: input.actorId,
      assigned_to: null,
      planned_date: null,
      start_time: null,
      end_time: null,
      queue_position: null,
    })
    .eq("id", input.requestId);

  if (error) {
    // Narrower update if new columns missing.
    if (error.code === "42703" || /execution_type|outsource_/i.test(error.message)) {
      const { error: legacyError } = await supabase
        .from("requests")
        .update({
          status: "outsource",
          outsource_contractor: input.contractor || null,
          outsource_comment: input.comment || null,
          assigned_to: null,
          planned_date: null,
          start_time: null,
          end_time: null,
          queue_position: null,
        })
        .eq("id", input.requestId);
      if (legacyError) {
        throw legacyError;
      }
      return;
    }
    throw error;
  }
}

async function getActiveAssigneeEmployeeIds(requestId: string) {
  const supabase = await createClient();
  let query = supabase
    .from("request_assignees")
    .select("employee_id")
    .eq("request_id", requestId);

  query = query.is("removed_at", null);

  const { data, error } = await query;
  if (error) {
    if (error.code === "42703" || /removed_at/i.test(error.message)) {
      const { data: legacy, error: legacyError } = await supabase
        .from("request_assignees")
        .select("employee_id")
        .eq("request_id", requestId);
      if (legacyError) {
        return [];
      }
      return [...new Set((legacy ?? []).map((row) => row.employee_id as string))];
    }
    return [];
  }

  return [...new Set((data ?? []).map((row) => row.employee_id as string))];
}

async function renumberMechanicQueuesForDate(
  date: string,
  employeeIds: string[],
) {
  const supabase = await createClient();

  for (const employeeId of employeeIds) {
    const { data, error } = await supabase
      .from("requests")
      .select("id")
      .eq("assigned_to", employeeId)
      .eq("planned_date", date)
      .is("deleted_at", null)
      .neq("status", "outsource")
      .order("queue_position", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: true });

    if (error) {
      continue;
    }

    const ids = (data ?? []).map((row) => row.id as string);
    for (let index = 0; index < ids.length; index += 1) {
      await supabase
        .from("requests")
        .update({ queue_position: index + 1 })
        .eq("id", ids[index]);
    }
  }
}

function mapOutsourcedRow(row: Record<string, unknown>): OutsourcedRequest {
  return {
    id: row.id as string,
    request_number: row.request_number as number | null,
    description: row.description as string,
    status: row.status as RequestStatus,
    outsource_status: (row.outsource_status as OutsourceStatus | null) ?? "sent",
    outsource_contractor: (row.outsource_contractor as string | null) ?? null,
    outsource_contact: (row.outsource_contact as string | null) ?? null,
    outsource_comment: (row.outsource_comment as string | null) ?? null,
    outsource_expected_date: (row.outsource_expected_date as string | null) ?? null,
    outsourced_at: (row.outsourced_at as string | null) ?? null,
    location_name: locationName(row.locations),
  };
}

function locationName(locations: unknown) {
  const location = Array.isArray(locations) ? locations[0] : locations;
  return (
    (location as { name?: string | null } | null)?.name ?? null
  );
}
