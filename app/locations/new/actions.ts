"use server";

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

export async function createLocationAction(formData: FormData) {
  await requireManagerUser();

  const supabase = await createClient();
  const name = getString(formData, "name");

  if (!name) {
    throw new Error("Укажите название заведения.");
  }

  const { data, error } = await supabase
    .from("locations")
    .insert({
      name,
      address: nullable(getString(formData, "address")),
      contact: nullable(getString(formData, "contact")),
      phone: normalizePhoneInput(getString(formData, "phone")),
      yandex_maps_url: nullable(getString(formData, "yandex_maps_url")),
      working_hours: nullable(getString(formData, "working_hours")),
      notes: nullable(getString(formData, "notes")),
    })
    .select("id")
    .single();

  if (error) {
    throw error;
  }

  redirect(`/locations/${data.id}?created=1`);
}
