import { toLocalDateKey } from "@/lib/date/local-date";
import type { RequestStatus } from "@/lib/db/requests";

type TimedRequest = {
  status: RequestStatus;
  planned_date: string | null;
  start_time: string | null;
  end_time: string | null;
  queue_position: number | null;
  closed_at: string | null;
  created_at: string;
};

/** Dispatcher column order: queue is the source of truth (1, 2, 3…). */
export function sortByQueuePosition<T extends TimedRequest>(requests: T[]): T[] {
  return [...requests].sort((a, b) => {
    const queueA = a.queue_position ?? Number.MAX_SAFE_INTEGER;
    const queueB = b.queue_position ?? Number.MAX_SAFE_INTEGER;

    if (queueA !== queueB) {
      return queueA - queueB;
    }

    const timeA = a.start_time ?? "99:99";
    const timeB = b.start_time ?? "99:99";

    if (timeA !== timeB) {
      return timeA.localeCompare(timeB);
    }

    return Date.parse(a.created_at) - Date.parse(b.created_at);
  });
}

/**
 * Mechanic day-plan order: in progress → planned → overdue → other,
 * then queue within the same group.
 */
export function sortActiveDayRequests<T extends TimedRequest>(
  requests: T[],
  selectedDate: string,
  now = new Date(),
): T[] {
  return [...requests].sort((a, b) => {
    const rankA = activeRank(a, selectedDate, now);
    const rankB = activeRank(b, selectedDate, now);

    if (rankA !== rankB) {
      return rankA - rankB;
    }

    const queueA = a.queue_position ?? Number.MAX_SAFE_INTEGER;
    const queueB = b.queue_position ?? Number.MAX_SAFE_INTEGER;

    if (queueA !== queueB) {
      return queueA - queueB;
    }

    const timeA = a.start_time ?? "99:99";
    const timeB = b.start_time ?? "99:99";

    if (timeA !== timeB) {
      return timeA.localeCompare(timeB);
    }

    return Date.parse(a.created_at) - Date.parse(b.created_at);
  });
}

/** Completed for a day: newest closed first. */
export function sortCompletedDayRequests<T extends TimedRequest>(requests: T[]): T[] {
  return [...requests].sort((a, b) => {
    const closedA = a.closed_at ? Date.parse(a.closed_at) : 0;
    const closedB = b.closed_at ? Date.parse(b.closed_at) : 0;

    if (closedA !== closedB) {
      return closedB - closedA;
    }

    return Date.parse(b.created_at) - Date.parse(a.created_at);
  });
}

/**
 * Split day-plan requests for a selected calendar day.
 * Completed = status done AND local(closed_at) === selectedDate.
 * Done on another day are excluded from both lists (not deleted).
 */
export function splitDayRequests<
  T extends { status: RequestStatus; closed_at?: string | null },
>(requests: T[], selectedDate: string) {
  const active: T[] = [];
  const completed: T[] = [];

  for (const request of requests) {
    if (request.status === "done") {
      if (
        request.closed_at &&
        toLocalDateKey(request.closed_at) === selectedDate
      ) {
        completed.push(request);
      }
      continue;
    }

    active.push(request);
  }

  return { active, completed };
}

export function isCompletedOnSelectedDate(
  request: { status: RequestStatus; closed_at?: string | null },
  selectedDate: string,
) {
  return (
    request.status === "done" &&
    Boolean(request.closed_at) &&
    toLocalDateKey(request.closed_at as string) === selectedDate
  );
}

export function formatClosedTime(closedAt: string | null) {
  if (!closedAt) {
    return null;
  }

  return new Intl.DateTimeFormat("ru-RU", {
    timeZone: "Europe/Moscow",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(closedAt));
}

function activeRank(
  request: TimedRequest,
  selectedDate: string,
  now: Date,
) {
  if (request.status === "in_progress" || request.status === "specialist_on_way") {
    return 0;
  }

  if (isOverdue(request, selectedDate, now)) {
    return 2;
  }

  if (
    request.status === "planned" ||
    request.status === "needs_planning" ||
    request.status === "needs_review"
  ) {
    return 1;
  }

  return 3;
}

function isOverdue(
  request: TimedRequest,
  selectedDate: string,
  now: Date,
) {
  if (request.status === "done") {
    return false;
  }

  if (request.planned_date && request.planned_date < selectedDate) {
    return true;
  }

  if (request.planned_date !== selectedDate || !request.end_time) {
    return false;
  }

  const [year, month, day] = selectedDate.split("-").map(Number);
  const [hours, minutes] = request.end_time.slice(0, 5).split(":").map(Number);

  if (!year || !month || !day || hours === undefined || minutes === undefined) {
    return false;
  }

  const endAt = new Date(year, month - 1, day, hours, minutes, 0, 0);
  return endAt.getTime() < now.getTime();
}
