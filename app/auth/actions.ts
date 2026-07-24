"use server";

import { redirect, unstable_rethrow } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getHomePathForRole } from "@/lib/auth/permissions";
import { hasSupabaseEnv } from "@/lib/supabase/env";

function getString(formData: FormData, key: string) {
  const value = formData.get(key);

  return typeof value === "string" ? value.trim() : "";
}

export async function signInAction(formData: FormData) {
  const email = getString(formData, "email");
  const password = getString(formData, "password");

  if (!email || !password) {
    redirect("/login?error=missing");
  }

  if (!hasSupabaseEnv()) {
    redirect("/login?error=config");
  }

  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      redirect("/login?error=invalid");
    }

    const context = await getCurrentUser();
    redirect(getHomePathForRole(context.role));
  } catch (error) {
    unstable_rethrow(error);
    redirect("/login?error=config");
  }
}

export async function signOutAction() {
  try {
    const supabase = await createClient();
    await supabase.auth.signOut();
  } catch {
    // Still send user to login if env/session cleanup fails.
  }
  redirect("/login");
}
