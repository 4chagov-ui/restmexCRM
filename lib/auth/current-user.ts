import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { EmployeeOption } from "@/lib/db/employees";
import {
  canUseManagerArea,
  canUseMechanicArea,
  getHomePathForRole,
  normalizeRole,
  type AppRole,
} from "@/lib/auth/permissions";

export type CurrentProfile = {
  id: string;
  full_name: string;
  role: AppRole | null;
  phone: string | null;
  is_active: boolean;
  employee_id: string | null;
};

export type CurrentUserContext = {
  authUser: {
    id: string;
    email?: string;
  } | null;
  profile: CurrentProfile | null;
  employee: EmployeeOption | null;
  role: AppRole | null;
};

type ProfileRow = {
  id: string;
  full_name: string | null;
  role: string | null;
  phone: string | null;
  is_active: boolean | null;
  employee_id?: string | null;
};

export async function getCurrentUser(): Promise<CurrentUserContext> {
  const emptyContext: CurrentUserContext = {
    authUser: null,
    profile: null,
    employee: null,
    role: null,
  };

  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return emptyContext;
    }

    const profile = await getProfileForUser(user.id);
    const employee = profile?.employee_id
      ? await getEmployeeForProfile(profile.employee_id)
      : null;

    return {
      authUser: {
        id: user.id,
        email: user.email,
      },
      profile,
      employee,
      role: profile?.role ?? null,
    };
  } catch {
    return emptyContext;
  }
}

export async function requireCurrentUser() {
  const context = await getCurrentUser();

  if (!context.authUser) {
    redirect("/login");
  }

  return context;
}

export async function requireConfiguredProfile() {
  const context = await requireCurrentUser();

  if (!context.profile || !context.role) {
    redirect("/profile-not-configured");
  }

  return context as CurrentUserContext & {
    profile: CurrentProfile;
    role: AppRole;
  };
}

export async function requireManagerUser() {
  const context = await requireConfiguredProfile();

  if (!canUseManagerArea(context.role)) {
    redirect(getHomePathForRole(context.role));
  }

  return context;
}

export async function requireMechanicUser() {
  const context = await requireConfiguredProfile();

  if (!canUseMechanicArea(context.role)) {
    redirect(getHomePathForRole(context.role));
  }

  if (!context.employee) {
    redirect("/profile-not-configured");
  }

  return context as CurrentUserContext & {
    profile: CurrentProfile;
    role: AppRole;
    employee: EmployeeOption;
  };
}

async function getProfileForUser(userId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, role, phone, is_active, employee_id")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    if (isMissingEmployeeIdColumn(error)) {
      return getProfileWithoutEmployeeId(userId);
    }

    throw error;
  }

  return mapProfile(data as ProfileRow | null);
}

async function getProfileWithoutEmployeeId(userId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, role, phone, is_active")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return mapProfile(data as ProfileRow | null);
}

async function getEmployeeForProfile(employeeId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("employees")
    .select("id, name, phone, role, is_active, sort_order")
    .eq("id", employeeId)
    .maybeSingle();

  if (error) {
    return null;
  }

  return data as EmployeeOption | null;
}

function mapProfile(profile: ProfileRow | null): CurrentProfile | null {
  if (!profile || profile.is_active === false) {
    return null;
  }

  return {
    id: profile.id,
    full_name: profile.full_name ?? "Без имени",
    role: normalizeRole(profile.role),
    phone: profile.phone,
    is_active: profile.is_active ?? true,
    employee_id: profile.employee_id ?? null,
  };
}

function isMissingEmployeeIdColumn(error: { code?: string; message?: string }) {
  return (
    error.code === "42703" ||
    error.message?.toLowerCase().includes("employee_id") === true
  );
}
