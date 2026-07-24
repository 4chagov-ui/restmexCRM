import { toLocalDateKey } from "@/lib/date/local-date";

export function getLocalDateKey(value = new Date()) {
  return toLocalDateKey(value);
}

export function normalizeTodayDate(value: string | undefined) {
  if (value && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value;
  }

  return getLocalDateKey();
}

export function shiftDateKey(dateKey: string, days: number) {
  const date = new Date(`${dateKey}T00:00:00`);
  date.setDate(date.getDate() + days);

  return getLocalDateKey(date);
}
