"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireManagerUser } from "@/lib/auth/current-user";
import {
  returnRequestFromOutsource,
  transferRequestToOutsource,
} from "@/lib/db/outsource";
import { getSafeReturnTo } from "@/lib/navigation/return-to";

function getString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

export async function transferToOutsourceAction(formData: FormData) {
  const context = await requireManagerUser();
  const requestId = getString(formData, "request_id");
  const contractor = getString(formData, "outsource_contractor");
  const contact = getString(formData, "outsource_contact");
  const comment = getString(formData, "outsource_comment");
  const expectedDate = getString(formData, "outsource_expected_date") || null;
  const outsourcedAt =
    getString(formData, "outsourced_at") || new Date().toISOString();
  const returnTo = getSafeReturnTo(
    getString(formData, "return_to") || null,
    "/outsourcing",
  );

  if (!requestId) {
    throw new Error("Не найден ID заявки.");
  }

  if (!contractor) {
    throw new Error("Укажите подрядчика.");
  }

  const result = await transferRequestToOutsource({
    requestId,
    actorId: context.profile.id,
    contractor,
    contact,
    comment,
    expectedDate,
    outsourcedAt,
  });

  if (!result.ok) {
    throw new Error(result.error);
  }

  revalidatePath("/requests");
  revalidatePath(`/requests/${requestId}`);
  revalidatePath("/outsourcing");
  revalidatePath("/today");
  revalidatePath("/work/today");
  revalidatePath("/work/requests");
  redirect(returnTo);
}

export async function returnFromOutsourceAction(formData: FormData) {
  const context = await requireManagerUser();
  const requestId = getString(formData, "request_id");
  const returnTo = getSafeReturnTo(
    getString(formData, "return_to") || null,
    "/requests",
  );

  if (!requestId) {
    throw new Error("Не найден ID заявки.");
  }

  const result = await returnRequestFromOutsource({
    requestId,
    actorId: context.profile.id,
  });

  if (!result.ok) {
    throw new Error(result.error);
  }

  revalidatePath("/requests");
  revalidatePath(`/requests/${requestId}`);
  revalidatePath("/outsourcing");
  revalidatePath("/today");
  redirect(returnTo);
}
