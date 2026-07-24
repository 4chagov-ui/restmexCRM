import type { JsonValue, LogRequestHistoryInput } from "@/lib/db/request-history";

export type RequestHistoryComparable = {
  location_id?: string | null;
  description?: string | null;
  title?: string | null;
  request_type?: string | null;
  urgency?: string | null;
  status?: string | null;
  planned_date?: string | null;
  start_time?: string | null;
  end_time?: string | null;
  queue_position?: number | null;
  manager_comment?: string | null;
  executor_comment?: string | null;
  execution_type?: string | null;
  reported_by_name?: string | null;
};

const TRACKED_FIELDS: Array<keyof RequestHistoryComparable> = [
  "location_id",
  "description",
  "title",
  "request_type",
  "urgency",
  "status",
  "planned_date",
  "start_time",
  "end_time",
  "queue_position",
  "manager_comment",
  "executor_comment",
  "execution_type",
  "reported_by_name",
];

function normalizeComparable(
  field: keyof RequestHistoryComparable,
  value: unknown,
): JsonValue {
  if (value === undefined || value === null || value === "") {
    return null;
  }
  if (field === "start_time" || field === "end_time") {
    return String(value).slice(0, 5);
  }
  if (field === "queue_position") {
    const num = Number(value);
    return Number.isFinite(num) ? num : null;
  }
  return value as JsonValue;
}

export function buildRequestFieldHistoryEvents(input: {
  requestId: string;
  before: RequestHistoryComparable;
  after: RequestHistoryComparable;
  locationNames?: Map<string, string>;
}): LogRequestHistoryInput[] {
  const events: LogRequestHistoryInput[] = [];

  for (const field of TRACKED_FIELDS) {
    const oldValue = normalizeComparable(field, input.before[field]);
    const newValue = normalizeComparable(field, input.after[field]);

    if (JSON.stringify(oldValue) === JSON.stringify(newValue)) {
      continue;
    }

    if (field === "status") {
      events.push({
        requestId: input.requestId,
        action: "status_changed",
        fieldName: "status",
        oldValue,
        newValue,
      });
      continue;
    }

    if (
      field === "planned_date" ||
      field === "start_time" ||
      field === "end_time"
    ) {
      events.push({
        requestId: input.requestId,
        action: "schedule_changed",
        fieldName: field,
        oldValue,
        newValue,
      });
      continue;
    }

    if (field === "queue_position") {
      events.push({
        requestId: input.requestId,
        action: "queue_changed",
        fieldName: "queue",
        oldValue,
        newValue,
      });
      continue;
    }

    const metadata: Record<string, JsonValue> = {};
    if (field === "location_id") {
      if (typeof oldValue === "string") {
        metadata.oldLocationName =
          input.locationNames?.get(oldValue) ?? null;
      }
      if (typeof newValue === "string") {
        metadata.newLocationName =
          input.locationNames?.get(newValue) ?? null;
      }
    }

    events.push({
      requestId: input.requestId,
      action: "request_updated",
      fieldName: field === "urgency" ? "priority" : field,
      oldValue:
        field === "location_id" && typeof oldValue === "string"
          ? (input.locationNames?.get(oldValue) ?? oldValue)
          : oldValue,
      newValue:
        field === "location_id" && typeof newValue === "string"
          ? (input.locationNames?.get(newValue) ?? newValue)
          : newValue,
      metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
    });
  }

  return events;
}
