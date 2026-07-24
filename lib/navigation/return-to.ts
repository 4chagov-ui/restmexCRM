/**
 * Safe internal return navigation after editing a request.
 * Never trust returnTo blindly — only same-origin relative paths.
 */

const DEFAULT_FALLBACK = "/requests";

export function getSafeReturnTo(
  value: string | null | undefined,
  fallback: string = DEFAULT_FALLBACK,
): string {
  if (!value) {
    return fallback;
  }

  let decoded = value;
  try {
    decoded = decodeURIComponent(value);
  } catch {
    return fallback;
  }

  const trimmed = decoded.trim();

  if (!trimmed.startsWith("/")) {
    return fallback;
  }

  // Protocol-relative and schemes
  if (
    trimmed.startsWith("//") ||
    trimmed.toLowerCase().startsWith("/\\") ||
    /^\/[a-z][a-z0-9+.-]*:/i.test(trimmed)
  ) {
    return fallback;
  }

  if (/[\u0000-\u001F\u007F]/.test(trimmed)) {
    return fallback;
  }

  return trimmed;
}

export function buildReturnToHref(
  requestHref: string,
  currentPathWithQuery: string,
): string {
  const safeReturn = getSafeReturnTo(currentPathWithQuery, DEFAULT_FALLBACK);
  const encoded = encodeURIComponent(safeReturn);
  const separator = requestHref.includes("?") ? "&" : "?";
  return `${requestHref}${separator}returnTo=${encoded}`;
}

export function buildRequestHref(
  requestId: string,
  currentPathWithQuery: string,
  basePath: "/requests" | "/work/requests" = "/requests",
): string {
  return buildReturnToHref(`${basePath}/${requestId}`, currentPathWithQuery);
}

export function scrollStorageKey(returnTo: string) {
  return `scroll:${returnTo}`;
}
