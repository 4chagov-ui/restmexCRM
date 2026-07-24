import type { EmployeeOption } from "@/lib/db/employees";
import type { RequestStatus } from "@/lib/db/requests";
import type { TodayPlan, TodayRequestItem } from "@/lib/db/today";
import {
  sortByQueuePosition,
  sortCompletedDayRequests,
  splitDayRequests,
} from "@/lib/plan/day-sections";

const cancelledStatuses = new Set<RequestStatus>([
  "cancelled",
  "duplicate",
  "not_actual",
]);

const closedStatuses = new Set<RequestStatus>([
  "done",
  "cancelled",
  "duplicate",
  "not_actual",
]);

const inWorkStatuses = new Set<RequestStatus>([
  "planned",
  "in_progress",
  "specialist_on_way",
  "waiting_client",
  "waiting_parts",
]);

export type TodayBoardState = {
  unplanned: TodayRequestItem[];
  columns: Array<{
    employee: EmployeeOption;
    requests: TodayRequestItem[];
  }>;
  stats: TodayPlan["stats"];
};

export type PlanPayload = {
  requestId: string;
  plannedDate: string;
  startTime: string | null;
  endTime: string | null;
  assignedTo: string;
  queuePosition: number;
};

export type BoardMovePayload = {
  requestId: string;
  fromColumnId: string;
  toColumnId: string;
  toIndex: number;
};

export const UNPLANNED_COLUMN_ID = "unplanned";

export function applyMoveOnBoard(
  state: TodayBoardState,
  selectedDate: string,
  employees: EmployeeOption[],
  payload: BoardMovePayload,
): TodayBoardState {
  const current = findRequestInBoard(state, payload.requestId);

  if (!current || current.status === "done") {
    return state;
  }

  if (payload.fromColumnId === payload.toColumnId) {
    return applyReorderOnBoard(state, payload.toColumnId, payload.requestId, payload.toIndex, selectedDate);
  }

  const without = removeRequest(state, payload.requestId);

  if (payload.toColumnId === UNPLANNED_COLUMN_ID) {
    const updated: TodayRequestItem = {
      ...current,
      assigned_to: null,
      assigned_to_name: null,
      planned_date: null,
      queue_position: null,
      status: "needs_planning",
      has_time_overlap: false,
    };

    const unplanned = [...without.unplanned];
    unplanned.splice(
      Math.min(payload.toIndex, unplanned.length),
      0,
      updated,
    );

    return recomputeBoard(
      {
        ...without,
        unplanned,
        columns: renumberEmployeeColumns(without.columns, employees, selectedDate),
      },
      state.stats.overdue,
    );
  }

  const employee = employees.find((item) => item.id === payload.toColumnId);
  const plannedDate = current.planned_date ?? selectedDate;
  const updated: TodayRequestItem = {
    ...current,
    assigned_to: payload.toColumnId,
    assigned_to_name: employee?.name ?? null,
    planned_date: plannedDate,
    queue_position: payload.toIndex + 1,
    status: "planned",
    has_time_overlap: false,
  };

  const columns = ensureColumns(without.columns, employees).map((column) => {
    if (column.employee.id !== payload.toColumnId) {
      return { ...column, requests: renumberQueue(column.requests, selectedDate) };
    }

    const { active, completed } = splitDayRequests(column.requests, selectedDate);
    const nextActive = [...active];
    nextActive.splice(Math.min(payload.toIndex, nextActive.length), 0, updated);
    const numbered = renumberQueue(
      [...nextActive, ...sortCompletedDayRequests(completed)],
      selectedDate,
    );

    return { ...column, requests: numbered };
  });

  return recomputeBoard(
    {
      ...without,
      columns,
    },
    state.stats.overdue,
  );
}

export function applyReorderOnBoard(
  state: TodayBoardState,
  columnId: string,
  requestId: string,
  toIndex: number,
  selectedDate: string,
): TodayBoardState {
  if (columnId === UNPLANNED_COLUMN_ID) {
    const fromIndex = state.unplanned.findIndex((item) => item.id === requestId);

    if (fromIndex < 0 || fromIndex === toIndex) {
      return state;
    }

    const unplanned = [...state.unplanned];
    const [moved] = unplanned.splice(fromIndex, 1);
    unplanned.splice(Math.min(toIndex, unplanned.length), 0, moved);

    return recomputeBoard({ ...state, unplanned }, state.stats.overdue);
  }

  const columns = state.columns.map((column) => {
    if (column.employee.id !== columnId) {
      return column;
    }

    const { active, completed } = splitDayRequests(column.requests, selectedDate);
    const fromIndex = active.findIndex((item) => item.id === requestId);

    if (fromIndex < 0 || fromIndex === toIndex) {
      return column;
    }

    const nextActive = [...active];
    const [moved] = nextActive.splice(fromIndex, 1);
    nextActive.splice(Math.min(toIndex, nextActive.length), 0, moved);

    return {
      ...column,
      requests: renumberQueue([
        ...nextActive,
        ...sortCompletedDayRequests(completed),
      ], selectedDate),
    };
  });

  return recomputeBoard({ ...state, columns }, state.stats.overdue);
}

export function getColumnOrderedIds(
  state: TodayBoardState,
  columnId: string,
): string[] {
  if (columnId === UNPLANNED_COLUMN_ID) {
    return state.unplanned.map((request) => request.id);
  }

  const requests =
    state.columns.find((column) => column.employee.id === columnId)?.requests ??
    [];

  return requests
    .filter((request) => request.status !== "done")
    .map((request) => request.id);
}

export function findRequestInBoard(
  state: TodayBoardState,
  requestId: string,
): TodayRequestItem | null {
  const fromUnplanned = state.unplanned.find(
    (request) => request.id === requestId,
  );

  if (fromUnplanned) {
    return fromUnplanned;
  }

  for (const column of state.columns) {
    const found = column.requests.find((request) => request.id === requestId);

    if (found) {
      return found;
    }
  }

  return null;
}

export function findColumnIdForRequest(
  state: TodayBoardState,
  requestId: string,
): string | null {
  if (state.unplanned.some((request) => request.id === requestId)) {
    return UNPLANNED_COLUMN_ID;
  }

  for (const column of state.columns) {
    if (column.requests.some((request) => request.id === requestId)) {
      return column.employee.id;
    }
  }

  return null;
}

function renumberQueue(requests: TodayRequestItem[], selectedDate: string) {
  const { active, completed } = splitDayRequests(requests, selectedDate);
  const numberedActive = active.map((request, index) => ({
    ...request,
    queue_position: index + 1,
  }));
  markTimeOverlaps(numberedActive);

  return [...numberedActive, ...sortCompletedDayRequests(completed)];
}

function renumberEmployeeColumns(
  columns: TodayBoardState["columns"],
  employees: EmployeeOption[],
  selectedDate: string,
) {
  return ensureColumns(columns, employees).map((column) => ({
    ...column,
    requests: renumberQueue(column.requests, selectedDate),
  }));
}

export function createBoardState(
  plan: Pick<TodayPlan, "unplanned" | "columns" | "stats">,
): TodayBoardState {
  return {
    unplanned: plan.unplanned,
    columns: plan.columns,
    stats: plan.stats,
  };
}

export function applyPlanToBoard(
  state: TodayBoardState,
  selectedDate: string,
  employees: EmployeeOption[],
  current: TodayRequestItem,
  plan: PlanPayload,
): TodayBoardState {
  const employeeName =
    employees.find((employee) => employee.id === plan.assignedTo)?.name ?? null;

  const nextStatus: RequestStatus =
    current.status === "done" ? "done" : "planned";

  const updated: TodayRequestItem = {
    ...current,
    planned_date: plan.plannedDate,
    start_time: plan.startTime,
    end_time: plan.endTime,
    assigned_to: plan.assignedTo,
    assigned_to_name: employeeName,
    queue_position: plan.queuePosition,
    status: nextStatus,
    has_time_overlap: false,
  };

  const without = removeRequest(state, current.id);

  if (
    updated.planned_date !== selectedDate ||
    cancelledStatuses.has(updated.status)
  ) {
    return recomputeBoard(
      {
        ...without,
        columns: renumberEmployeeColumns(without.columns, employees, selectedDate),
      },
      adjustOverdue(state.stats.overdue, updated, selectedDate),
    );
  }

  const columns = ensureColumns(without.columns, employees).map((column) => {
    if (column.employee.id !== plan.assignedTo) {
      return { ...column, requests: renumberQueue(column.requests, selectedDate) };
    }

    const { active, completed } = splitDayRequests(column.requests, selectedDate);
    const insertAt = Math.max(
      0,
      Math.min(Math.max(plan.queuePosition, 1) - 1, active.length),
    );
    const nextActive = [...active];
    nextActive.splice(insertAt, 0, updated);

    return {
      ...column,
      requests: renumberQueue([
        ...nextActive,
        ...sortCompletedDayRequests(completed),
      ], selectedDate),
    };
  });

  return recomputeBoard(
    {
      ...without,
      unplanned: without.unplanned,
      columns,
    },
    state.stats.overdue,
  );
}

export function applyStatusToBoard(
  state: TodayBoardState,
  requestId: string,
  status: RequestStatus,
  selectedDate: string,
): TodayBoardState {
  const updatedColumns = state.columns.map((column) => {
    const requests = column.requests.map((request) =>
      request.id === requestId
        ? {
            ...request,
            status,
            closed_at:
              status === "done"
                ? (request.closed_at ?? new Date().toISOString())
                : null,
          }
        : request,
    );

    return {
      ...column,
      requests: renumberQueue(
        sortPlannedRequests(requests, selectedDate),
        selectedDate,
      ),
    };
  });

  const updatedUnplanned = state.unplanned.map((request) =>
    request.id === requestId
      ? {
          ...request,
          status,
          closed_at:
            status === "done"
              ? (request.closed_at ?? new Date().toISOString())
              : null,
        }
      : request,
  );

  return recomputeBoard(
    {
      ...state,
      unplanned: updatedUnplanned,
      columns: updatedColumns,
    },
    state.stats.overdue,
  );
}

export function sortPlannedRequests(requests: TodayRequestItem[], selectedDate: string) {
  const { active, completed } = splitDayRequests(requests, selectedDate);

  return [
    ...sortByQueuePosition(active),
    ...sortCompletedDayRequests(completed),
  ];
}

function removeRequest(state: TodayBoardState, requestId: string): TodayBoardState {
  return {
    ...state,
    unplanned: state.unplanned.filter((request) => request.id !== requestId),
    columns: state.columns.map((column) => {
      const requests = column.requests.filter(
        (request) => request.id !== requestId,
      );
      markTimeOverlaps(requests);

      return { ...column, requests };
    }),
  };
}

function ensureColumns(
  columns: TodayBoardState["columns"],
  employees: EmployeeOption[],
) {
  const byId = new Map(columns.map((column) => [column.employee.id, column]));

  return employees.map((employee) => {
    const existing = byId.get(employee.id);

    return (
      existing ?? {
        employee,
        requests: [],
      }
    );
  });
}

function recomputeBoard(
  state: TodayBoardState,
  overdue: number,
): TodayBoardState {
  const planned = state.columns.flatMap((column) => column.requests);

  return {
    ...state,
    stats: {
      total: state.unplanned.length + planned.length,
      unplanned: state.unplanned.length,
      inWork: planned.filter((request) => inWorkStatuses.has(request.status))
        .length,
      done: planned.filter((request) => request.status === "done").length,
      overdue,
    },
  };
}

function adjustOverdue(
  current: number,
  request: TodayRequestItem,
  selectedDate: string,
) {
  if (closedStatuses.has(request.status) || !request.planned_date) {
    return current;
  }

  if (request.planned_date < selectedDate) {
    return Math.max(current, 1);
  }

  return current;
}

function sortUnplannedRequests(requests: TodayRequestItem[]) {
  return [...requests].sort((a, b) => {
    const urgencyDelta = urgencyRank(a.urgency) - urgencyRank(b.urgency);

    if (urgencyDelta !== 0) {
      return urgencyDelta;
    }

    return Date.parse(a.created_at) - Date.parse(b.created_at);
  });
}

function urgencyRank(value: string) {
  if (value === "critical") {
    return 1;
  }

  if (value === "high") {
    return 2;
  }

  if (value === "normal") {
    return 3;
  }

  return 4;
}

function markTimeOverlaps(requests: TodayRequestItem[]) {
  const active = requests.filter((request) => request.status !== "done");

  requests.forEach((request) => {
    if (
      request.status === "done" ||
      !request.start_time ||
      !request.end_time
    ) {
      request.has_time_overlap = false;
      return;
    }

    request.has_time_overlap = active.some((other) => {
      if (
        other.id === request.id ||
        !other.start_time ||
        !other.end_time ||
        cancelledStatuses.has(other.status)
      ) {
        return false;
      }

      return (
        request.start_time! < other.end_time! &&
        other.start_time! < request.end_time!
      );
    });
  });
}
