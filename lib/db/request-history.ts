import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getEmployeesById } from "@/lib/db/employees";

export const REQUEST_HISTORY_ACTIONS = [
  "request_created",
  "request_updated",
  "assignment_added",
  "assignment_removed",
  "responsible_changed",
  "participant_added",
  "participant_removed",
  "request_moved",
  "queue_changed",
  "schedule_changed",
  "status_changed",
  "work_started",
  "work_completed",
  "work_reopened",
  "waiting_parts_started",
  "waiting_parts_finished",
  "moved_to_trash",
  "restored_from_trash",
  "outsourced",
  "returned_from_outsource",
  "comment_added",
  "comment_updated",
  "comment_deleted",
  "attachment_added",
  "attachment_removed",
] as const;

export type RequestHistoryAction = (typeof REQUEST_HISTORY_ACTIONS)[number];

export type JsonValue =
  | string
  | number
  | boolean
  | null
  | { [key: string]: JsonValue }
  | JsonValue[];

export type LogRequestHistoryInput = {
  requestId: string;
  action: RequestHistoryAction;
  fieldName?: string | null;
  oldValue?: JsonValue;
  newValue?: JsonValue;
  metadata?: Record<string, JsonValue> | null;
};

export type RequestHistoryRow = {
  id: string;
  request_id: string;
  actor_id: string | null;
  actor_name: string;
  action: string;
  field_name: string | null;
  old_value: JsonValue;
  new_value: JsonValue;
  metadata: Record<string, JsonValue>;
  created_at: string;
};

function toJsonb(value: JsonValue | undefined): JsonValue | null {
  if (value === undefined) {
    return null;
  }
  return value;
}

function valuesEqual(a: JsonValue | undefined, b: JsonValue | undefined) {
  if (a === undefined && b === undefined) {
    return true;
  }
  return JSON.stringify(toJsonb(a)) === JSON.stringify(toJsonb(b));
}

function isMissingHistoryError(error: {
  code?: string;
  message?: string;
}) {
  return (
    error.code === "42P01" ||
    error.code === "PGRST202" ||
    error.code === "PGRST205" ||
    /request_history|insert_request_history/i.test(error.message ?? "")
  );
}

/**
 * Server-only history writer. Actor is always the authenticated user (via RPC).
 * Throws on real insert failures so callers do not silently succeed without audit.
 * Soft-skips only when the migration/RPC is not applied yet.
 */
export async function logRequestHistory(
  input: LogRequestHistoryInput,
): Promise<{ ok: true } | { ok: false; skipped: true; reason: string }> {
  if (
    valuesEqual(input.oldValue, input.newValue) &&
    (input.action === "request_updated" ||
      input.action === "status_changed" ||
      input.action === "queue_changed" ||
      input.action === "schedule_changed")
  ) {
    return { ok: false, skipped: true, reason: "no_change" };
  }

  const context = await getCurrentUser();
  if (!context.authUser) {
    throw new Error("Нельзя записать историю без авторизованного пользователя.");
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("insert_request_history", {
    p_request_id: input.requestId,
    p_action: input.action,
    p_field_name: input.fieldName ?? null,
    p_old_value: toJsonb(input.oldValue),
    p_new_value: toJsonb(input.newValue),
    p_metadata: input.metadata ?? {},
  });

  if (error) {
    if (isMissingHistoryError(error)) {
      console.error(
        "[request_history] migration missing, event skipped:",
        input.action,
        error.message,
      );
      return {
        ok: false,
        skipped: true,
        reason: "migration_missing",
      };
    }
    throw error;
  }

  return { ok: true };
}

export async function logRequestHistoryMany(
  events: LogRequestHistoryInput[],
) {
  for (const event of events) {
    await logRequestHistory(event);
  }
}

export async function getRequestHistory(input: {
  requestId: string;
  limit?: number;
  offset?: number;
}): Promise<{ items: RequestHistoryRow[]; hasMore: boolean }> {
  const limit = Math.min(Math.max(input.limit ?? 50, 1), 100);
  const offset = Math.max(input.offset ?? 0, 0);
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("request_history")
    .select(
      "id, request_id, actor_id, action, field_name, old_value, new_value, metadata, created_at",
    )
    .eq("request_id", input.requestId)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit);

  if (error) {
    if (isMissingHistoryError(error)) {
      return { items: [], hasMore: false };
    }
    throw error;
  }

  const rows = data ?? [];
  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;

  const actorIds = [
    ...new Set(
      page
        .map((row) => row.actor_id as string | null)
        .filter((id): id is string => Boolean(id)),
    ),
  ];

  const names = new Map<string, string>();
  if (actorIds.length > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name")
      .in("id", actorIds);

    for (const profile of profiles ?? []) {
      names.set(
        profile.id as string,
        ((profile.full_name as string | null)?.trim() ||
          "Неизвестный пользователь"),
      );
    }
  }

  return {
    hasMore,
    items: page.map((row) => ({
      id: row.id as string,
      request_id: row.request_id as string,
      actor_id: (row.actor_id as string | null) ?? null,
      actor_name: row.actor_id
        ? (names.get(row.actor_id as string) ?? "Неизвестный пользователь")
        : "Неизвестный пользователь",
      action: row.action as string,
      field_name: (row.field_name as string | null) ?? null,
      old_value: (row.old_value as JsonValue) ?? null,
      new_value: (row.new_value as JsonValue) ?? null,
      metadata: (row.metadata as Record<string, JsonValue> | null) ?? {},
      created_at: row.created_at as string,
    })),
  };
}

export async function resolveEmployeeNames(employeeIds: Array<string | null | undefined>) {
  const ids = [
    ...new Set(
      employeeIds.filter((id): id is string => Boolean(id && id.trim())),
    ),
  ];
  if (ids.length === 0) {
    return new Map<string, string>();
  }
  const employees = await getEmployeesById(ids);
  const map = new Map<string, string>();
  for (const id of ids) {
    map.set(id, employees.get(id)?.name ?? "Без имени");
  }
  return map;
}

export type AssigneeSnapshot = {
  employee_id: string;
  role: "responsible" | "participant";
  name?: string;
};

/** Diff assignees and emit granular history events. */
export async function logAssigneeChanges(input: {
  requestId: string;
  before: AssigneeSnapshot[];
  after: AssigneeSnapshot[];
}) {
  const names = await resolveEmployeeNames([
    ...input.before.map((row) => row.employee_id),
    ...input.after.map((row) => row.employee_id),
  ]);

  const beforeMap = new Map(
    input.before.map((row) => [
      row.employee_id,
      { ...row, name: row.name ?? names.get(row.employee_id) ?? "Без имени" },
    ]),
  );
  const afterMap = new Map(
    input.after.map((row) => [
      row.employee_id,
      { ...row, name: row.name ?? names.get(row.employee_id) ?? "Без имени" },
    ]),
  );

  const beforeResponsible = input.before.find((row) => row.role === "responsible");
  const afterResponsible = input.after.find((row) => row.role === "responsible");

  if (
    (beforeResponsible?.employee_id ?? null) !==
    (afterResponsible?.employee_id ?? null)
  ) {
    if (beforeResponsible && afterResponsible) {
      await logRequestHistory({
        requestId: input.requestId,
        action: "responsible_changed",
        fieldName: "responsible",
        oldValue: {
          id: beforeResponsible.employee_id,
          name: names.get(beforeResponsible.employee_id) ?? "Без имени",
        },
        newValue: {
          id: afterResponsible.employee_id,
          name: names.get(afterResponsible.employee_id) ?? "Без имени",
        },
      });
    } else if (!beforeResponsible && afterResponsible) {
      await logRequestHistory({
        requestId: input.requestId,
        action: "assignment_added",
        metadata: {
          mechanicId: afterResponsible.employee_id,
          mechanicName: names.get(afterResponsible.employee_id) ?? "Без имени",
          role: "responsible",
        },
      });
    } else if (beforeResponsible && !afterResponsible) {
      await logRequestHistory({
        requestId: input.requestId,
        action: "assignment_removed",
        metadata: {
          mechanicId: beforeResponsible.employee_id,
          mechanicName: names.get(beforeResponsible.employee_id) ?? "Без имени",
          role: "responsible",
        },
      });
    }
  }

  for (const [employeeId, after] of afterMap) {
    const before = beforeMap.get(employeeId);
    if (!before) {
      if (after.role === "participant") {
        await logRequestHistory({
          requestId: input.requestId,
          action: "participant_added",
          metadata: {
            mechanicId: employeeId,
            mechanicName: after.name ?? "Без имени",
            role: "participant",
          },
        });
      } else if (
        after.role === "responsible" &&
        beforeResponsible?.employee_id === after.employee_id
      ) {
        // Already covered by assignment_added / responsible_changed.
      } else if (after.role === "responsible" && !beforeResponsible) {
        // Covered above.
      }
      continue;
    }

    if (before.role === "participant" && after.role === "responsible") {
      // Role promotion covered by responsible_changed.
      continue;
    }
    if (before.role === "responsible" && after.role === "participant") {
      await logRequestHistory({
        requestId: input.requestId,
        action: "participant_added",
        metadata: {
          mechanicId: employeeId,
          mechanicName: after.name ?? "Без имени",
          role: "participant",
        },
      });
    }
  }

  for (const [employeeId, before] of beforeMap) {
    if (afterMap.has(employeeId)) {
      continue;
    }
    if (before.role === "responsible") {
      // Covered by assignment_removed / responsible_changed.
      continue;
    }
    await logRequestHistory({
      requestId: input.requestId,
      action: "participant_removed",
      metadata: {
        mechanicId: employeeId,
        mechanicName: before.name ?? names.get(employeeId) ?? "Без имени",
        role: "participant",
      },
    });
  }
}

export function snapshotAssignees(
  rows: Array<{ employee_id: string; role: "responsible" | "participant" }>,
): AssigneeSnapshot[] {
  return rows.map((row) => ({
    employee_id: row.employee_id,
    role: row.role,
  }));
}
