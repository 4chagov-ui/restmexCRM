/** Application calendar timezone (RestMex operates in Russia). */
export const APP_TIME_ZONE = "Europe/Moscow";

const dateKeyFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: APP_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/**
 * YYYY-MM-DD in the application timezone.
 * Pass ISO timestamps (e.g. closed_at) — do not slice UTC strings.
 */
export function toLocalDateKey(value: string | Date = new Date()): string {
  const date = typeof value === "string" ? new Date(value) : value;

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return dateKeyFormatter.format(date);
}

/** Moscow is permanently UTC+3 (no DST). */
export function localDateKeyBoundsUtc(dateKey: string): {
  startIso: string;
  endIso: string;
} {
  return {
    startIso: new Date(`${dateKey}T00:00:00+03:00`).toISOString(),
    endIso: new Date(`${dateKey}T23:59:59.999+03:00`).toISOString(),
  };
}

const longDayFormatter = new Intl.DateTimeFormat("ru-RU", {
  timeZone: APP_TIME_ZONE,
  day: "numeric",
  month: "long",
});

/** «Выполненные сегодня (n)» / «Выполненные за 21 июля (n)» */
export function formatCompletedSectionLabel(
  selectedDate: string,
  count: number,
  todayKey = toLocalDateKey(),
): string {
  if (selectedDate === todayKey) {
    return `✓ Выполненные сегодня (${count})`;
  }

  const [year, month, day] = selectedDate.split("-").map(Number);
  if (!year || !month || !day) {
    return `✓ Выполнено (${count})`;
  }

  const label = longDayFormatter.format(new Date(year, month - 1, day));
  return `✓ Выполненные за ${label} (${count})`;
}
