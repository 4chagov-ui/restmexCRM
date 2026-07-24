"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireManagerUser } from "@/lib/auth/current-user";
import { getSafeReturnTo } from "@/lib/navigation/return-to";
import {
  moveRequestToTrash,
  restoreRequestFromTrash,
} from "@/lib/db/trash";

function getString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

export async function moveToTrashAction(formData: FormData) {
  const context = await requireManagerUser();
  const requestId = getString(formData, "request_id");
  const reason = getString(formData, "deletion_reason");
  const returnTo = getSafeReturnTo(
    getString(formData, "return_to") || null,
    "/requests",
  );

  if (!requestId) {
    throw new Error("Не найден ID заявки.");
  }

  if (!reason) {
    throw new Error("Укажите причину перемещения в корзину.");
  }

  const result = await moveRequestToTrash({
    requestId,
    actorId: context.profile.id,
    reason,
  });

  if (!result.ok) {
    throw new Error(result.error);
  }

  revalidatePath("/requests");
  revalidatePath("/requests/trash");
  revalidatePath(`/requests/${requestId}`);
  revalidatePath("/today");
  revalidatePath("/work/today");
  revalidatePath("/work/requests");
  redirect(returnTo);
}

export async function restoreFromTrashAction(formData: FormData) {
  const context = await requireManagerUser();
  const requestId = getString(formData, "request_id");

  if (!requestId) {
    throw new Error("Не найден ID заявки.");
  }

  const result = await restoreRequestFromTrash({
    requestId,
    actorId: context.profile.id,
  });

  if (!result.ok) {
    throw new Error(result.error);
  }

  revalidatePath("/requests");
  revalidatePath("/requests/trash");
  revalidatePath(`/requests/${requestId}`);
  revalidatePath("/today");
  revalidatePath("/work/today");
  revalidatePath("/work/requests");
}
