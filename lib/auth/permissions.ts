import type { RequestStatus } from "@/lib/db/requests";

export type AppRole = "admin" | "manager" | "mechanic";

export const managerRoles = new Set<AppRole>(["admin", "manager"]);
export const mechanicRoles = new Set<AppRole>(["admin", "mechanic"]);

const managerRoutePrefixes = [
  "/",
  "/requests",
  "/outsourcing",
  "/today",
  "/mechanics",
  "/locations",
  "/map",
  "/settings",
  "/profile-not-configured",
];

const mechanicRoutePrefixes = [
  "/work/today",
  "/work/requests",
  "/work/locations",
  "/work/profile",
];

export const mechanicAllowedStatuses: RequestStatus[] = [
  "planned",
  "in_progress",
  "waiting_parts",
  "done",
];

export function normalizeRole(value: string | null | undefined): AppRole | null {
  if (value === "admin" || value === "manager" || value === "mechanic") {
    return value;
  }

  return null;
}

export function getHomePathForRole(role: AppRole | null) {
  if (role === "mechanic") {
    return "/work/today";
  }

  if (role === "admin" || role === "manager") {
    return "/today";
  }

  return "/profile-not-configured";
}

export function canUseManagerArea(role: AppRole | null) {
  return Boolean(role && managerRoles.has(role));
}

export function canUseMechanicArea(role: AppRole | null) {
  return Boolean(role && mechanicRoles.has(role));
}

export function canAccessRoute(role: AppRole | null, pathname: string) {
  if (!role) {
    return false;
  }

  if (pathname === "/login" || pathname === "/profile-not-configured") {
    return true;
  }

  if (pathname.startsWith("/work")) {
    return canUseMechanicArea(role) && matchesPrefix(pathname, mechanicRoutePrefixes);
  }

  return canUseManagerArea(role) && matchesPrefix(pathname, managerRoutePrefixes);
}

export function canEditRequest(role: AppRole | null) {
  return Boolean(role && (managerRoles.has(role) || role === "mechanic"));
}

export function canAssignEmployee(role: AppRole | null) {
  return Boolean(role && managerRoles.has(role));
}

function matchesPrefix(pathname: string, prefixes: string[]) {
  return prefixes.some((prefix) => {
    if (prefix === "/") {
      return pathname === "/";
    }

    return pathname === prefix || pathname.startsWith(`${prefix}/`);
  });
}
