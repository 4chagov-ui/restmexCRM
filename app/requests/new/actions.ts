"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireManagerUser } from "@/lib/auth/current-user";
import {
  parseParticipantIds,
  syncRequestAssignees,
} from "@/lib/db/assignees";
import { uploadPhotosForNewRequest } from "@/app/requests/attachments-actions";
import { collectPhotoFiles } from "@/lib/db/attachments";
import { logRequestHistory } from "@/lib/db/request-history";
import { MAX_PHOTOS_PER_OPERATION } from "@/lib/attachments/constants";

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

export async function createRequestAction(formData: FormData) {
  const context = await requireManagerUser();

  const supabase = await createClient();
  const locationId = getString(formData, "location_id");
  const description = getString(formData, "description");

  if (!locationId) {
    throw new Error("Выберите существующее заведение.");
  }

  if (!description) {
    throw new Error("Опишите проблему.");
  }

  const phone = getString(formData, "phone");
  const contact = getString(formData, "contact");
  const requestType = getString(formData, "request_type") as RequestType;
  const urgency = getString(formData, "urgency") as UrgencyLevel;
  const assignedTo = getString(formData, "assigned_to");
  const participantIds = parseParticipantIds(formData);
  const startTime = getString(formData, "start_time");
  const endTime = getString(formData, "end_time");
  const photoFiles = collectPhotoFiles(formData).slice(
    0,
    MAX_PHOTOS_PER_OPERATION,
  );

  const { data: location } = await supabase
    .from("locations")
    .select("name")
    .eq("id", locationId)
    .maybeSingle();

  const { data, error } = await supabase
    .from("requests")
    .insert({
      location_id: locationId,
      title: description.slice(0, 120),
      description,
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

  if (error) {
    throw error;
  }

  if (data?.id && assignedTo) {
    try {
      await syncRequestAssignees(data.id, assignedTo, participantIds);
    } catch (assigneeError) {
      if (
        !(assigneeError instanceof Error) ||
        !assigneeError.message.includes("request_assignees")
      ) {
        throw assigneeError;
      }
    }
  }

  if (data?.id) {
    await logRequestHistory({
      requestId: data.id,
      action: "request_created",
      metadata: {
        requestNumber: (data.request_number as number | null) ?? null,
        locationName: (location?.name as string | null) ?? null,
        status: (data.status as string | null) ?? "needs_planning",
      },
    });
  }

  let photoFailed = 0;
  if (data?.id && photoFiles.length > 0) {
    const uploadResult = await uploadPhotosForNewRequest(
      data.id,
      photoFiles,
      context.profile.id,
    );
    photoFailed = uploadResult.failures.length;
  }

  if (data?.id) {
    const params = new URLSearchParams({ saved: "1" });
    if (photoFailed > 0) {
      params.set("photoErrors", String(photoFailed));
    }
    redirect(`/requests/${data.id}?${params.toString()}`);
  }

  redirect("/requests");
}
