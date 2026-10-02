"use server";

import { createClient } from "@/lib/supabase/server";
import { requireManagerUser } from "@/lib/auth/current-user";
import {
  parseParticipantIds,
  syncRequestAssignees,
} from "@/lib/db/assignees";
import { logRequestHistory } from "@/lib/db/request-history";

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

function buildPhoneNote(phone: string) {
  return phone ? `Телефон: ${phone}` : null;
}

export type CreateRequestResult =
  | { ok: true; requestId: string }
  | { ok: false; error: string; requestId?: string };

export async function createRequestAction(
  formData: FormData,
): Promise<CreateRequestResult> {
  await requireManagerUser();

  const supabase = await createClient();
  const locationId = getString(formData, "location_id");
  const description = getString(formData, "description");
  const taskTitles = formData
    .getAll("task_title")
    .filter((value): value is string => typeof value === "string")
    .map((value) => value.trim())
    .filter((value) => value.length > 0);

  if (!locationId) {
    return { ok: false, error: "Выберите существующее заведение." };
  }

  if (!description && taskTitles.length === 0) {
    return {
      ok: false,
      error: "Добавьте описание или хотя бы один пункт работы.",
    };
  }

  const storedDescription = description || taskTitles.join("\n");

  const phone = getString(formData, "phone");
  const contact = getString(formData, "contact");
  const requestType = getString(formData, "request_type") as RequestType;
  const urgency = getString(formData, "urgency") as UrgencyLevel;
  const assignedTo = getString(formData, "assigned_to");
  const participantIds = parseParticipantIds(formData);
  const startTime = getString(formData, "start_time");
  const endTime = getString(formData, "end_time");

  const { data: location } = await supabase
    .from("locations")
    .select("name")
    .eq("id", locationId)
    .maybeSingle();

  const { data, error } = await supabase
    .from("requests")
    .insert({
      location_id: locationId,
      title: storedDescription.slice(0, 120),
      description: storedDescription,
      request_type: requestType || "other",
      urgency: urgency || "normal",
      status: "needs_planning",
      source: "manual",
      reported_by_name: nullable(contact),
      assigned_to: nullable(assignedTo),
      start_time: nullable(startTime),
      end_time: nullable(endTime),
      manager_comment: buildPhoneNote(phone),
    })
    .select("id, request_number, status")
    .single();

  if (error || !data?.id) {
    return {
      ok: false,
      error: error?.message || "Не удалось создать заявку.",
    };
  }

  if (assignedTo) {
    try {
      await syncRequestAssignees(data.id, assignedTo, participantIds);
    } catch (assigneeError) {
      if (
        !(assigneeError instanceof Error) ||
        !assigneeError.message.includes("request_assignees")
      ) {
        return {
          ok: false,
          error:
            assigneeError instanceof Error
              ? assigneeError.message
              : "Не удалось назначить механиков.",
          requestId: data.id,
        };
      }
    }
  }

  if (taskTitles.length > 0) {
    const { error: taskError } = await supabase.from("request_tasks").insert(
      taskTitles.map((title, index) => ({
        request_id: data.id,
        title,
        position: index + 1,
      })),
    );
    if (taskError && !taskError.message.toLowerCase().includes("request_tasks")) {
      return {
        ok: false,
        error: taskError.message,
        requestId: data.id,
      };
    }
  }

  try {
    await logRequestHistory({
      requestId: data.id,
      action: "request_created",
      metadata: {
        requestNumber: (data.request_number as number | null) ?? null,
        locationName: (location?.name as string | null) ?? null,
        status: (data.status as string | null) ?? "needs_planning",
      },
    });
  } catch {
    // History must not hide a request that was already created.
  }

  return { ok: true, requestId: data.id };
}
