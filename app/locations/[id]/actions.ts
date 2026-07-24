"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireManagerUser } from "@/lib/auth/current-user";
import { normalizePhoneInput } from "@/lib/phone";

function getString(formData: FormData, key: string) {
  const value = formData.get(key);

  return typeof value === "string" ? value.trim() : "";
}

function nullable(value: string) {
  return value.length > 0 ? value : null;
}

export async function updateLocationAction(formData: FormData) {
  await requireManagerUser();

  const supabase = await createClient();
  const locationId = getString(formData, "location_id");
  const name = getString(formData, "name");

  if (!locationId) {
    throw new Error("Не найден ID заведения.");
  }

  if (!name) {
    throw new Error("Укажите название заведения.");
  }

  const { error } = await supabase
    .from("locations")
    .update({
      name,
      address: nullable(getString(formData, "address")),
      contact: nullable(getString(formData, "contact")),
      phone: normalizePhoneInput(getString(formData, "phone")),
      yandex_maps_url: nullable(getString(formData, "yandex_maps_url")),
      working_hours: nullable(getString(formData, "working_hours")),
      notes: nullable(getString(formData, "notes")),
    })
    .eq("id", locationId);

  if (error) {
    throw error;
  }

  revalidatePath("/locations");
  revalidatePath(`/locations/${locationId}`);
  revalidatePath("/requests");
  redirect(`/locations/${locationId}?saved=1`);
}
