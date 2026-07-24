"use client";

import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCorners,
  pointerWithin,
  useDroppable,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useMemo, useState, type ReactNode } from "react";
import { TodayCompletedCard } from "@/components/today/today-completed-card";
import { TodayRequestCard } from "@/components/today/today-request-card";
import type { EmployeeOption } from "@/lib/db/employees";
import type { RequestStatus } from "@/lib/db/requests";
import type { TodayRequestItem } from "@/lib/db/today";
import { formatCompletedSectionLabel } from "@/lib/date/local-date";
import { splitDayRequests } from "@/lib/plan/day-sections";
import {
  UNPLANNED_COLUMN_ID,
  type BoardMovePayload,
  type PlanPayload,
} from "@/lib/today/board-state";

export { UNPLANNED_COLUMN_ID };

const EMPTY_LOCKED_IDS = new Set<string>();

/** Prefer pointer hit (works on empty columns), then corner distance. */
const boardCollisionDetection: CollisionDetection = (args) => {
  const pointerHits = pointerWithin(args);
  if (pointerHits.length > 0) {
    return pointerHits;
  }
  return closestCorners(args);
};

type TodayBoardProps = {
  employees: EmployeeOption[];
  unplanned: TodayRequestItem[];
  columns: Array<{
    employee: EmployeeOption;
    requests: TodayRequestItem[];
  }>;
  selectedDate: string;
  enableDrag?: boolean;
  /** Request ids with an in-flight save — drag disabled for these cards only. */
  lockedRequestIds?: ReadonlySet<string>;
  draftPlanningRequestId?: string | null;
  onPlan: (payload: PlanPayload) => void;
  onCancelDraft?: (requestId: string) => void;
  onStatus: (requestId: string, status: RequestStatus) => void;
  onMove: (payload: BoardMovePayload) => void;
};

type BoardColumnModel = {
  id: string;
  title: string;
  subtitle: string;
  tone: "unplanned" | "employee";
  requests: TodayRequestItem[];
  active: TodayRequestItem[];
  completed: TodayRequestItem[];
};

export function TodayBoard({
  columns,
  draftPlanningRequestId = null,
  employees,
  enableDrag = true,
  lockedRequestIds,
  onCancelDraft,
  onMove,
  onPlan,
  onStatus,
  selectedDate,
  unplanned,
}: TodayBoardProps) {
  const lockedIds = lockedRequestIds ?? EMPTY_LOCKED_IDS;
  const [activeId, setActiveId] = useState<string | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
  );

  const boardColumns = useMemo<BoardColumnModel[]>(
    () => [
      {
        id: UNPLANNED_COLUMN_ID,
        title: "Нужно запланировать",
        subtitle: "Нет даты, ответственного или очередности",
        tone: "unplanned",
        requests: unplanned,
        active: unplanned,
        completed: [],
      },
      ...columns.map((column) => {
        const { active, completed } = splitDayRequests(
          column.requests,
          selectedDate,
        );
        return {
          id: column.employee.id,
          title: column.employee.name,
          subtitle: formatTaskCount(active.length),
          tone: "employee" as const,
          requests: column.requests,
          active,
          completed,
        };
      }),
    ],
    [columns, selectedDate, unplanned],
  );

  const requestLookup = useMemo(() => {
    const map = new Map<string, TodayRequestItem>();

    for (const column of boardColumns) {
      for (const request of column.requests) {
        map.set(request.id, request);
      }
    }

    return map;
  }, [boardColumns]);

  const columnByRequestId = useMemo(() => {
    const map = new Map<string, string>();

    for (const column of boardColumns) {
      for (const request of column.requests) {
        map.set(request.id, column.id);
      }
    }

    return map;
  }, [boardColumns]);

  const activeRequest = activeId ? (requestLookup.get(activeId) ?? null) : null;
  const canDrag = enableDrag && employees.length > 0;
  const columnCount = boardColumns.length;

  function resolveColumnId(overId: string, overDataType?: string) {
    if (overDataType === "column") {
      return overId;
    }

    return columnByRequestId.get(overId) ?? null;
  }

  function handleDragStart(event: DragStartEvent) {
    const requestId = String(event.active.id);
    if (lockedIds.has(requestId)) {
      return;
    }
    setActiveId(requestId);
  }

  function handleDragOver(event: DragOverEvent) {
    // Visual feedback only via Sortable/Droppable; commit on drag end.
    void event;
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setActiveId(null);

    if (!over || !canDrag) {
      return;
    }

    const requestId = String(active.id);
    if (lockedIds.has(requestId)) {
      return;
    }

    const fromColumnId =
      (active.data.current?.columnId as string | undefined) ??
      columnByRequestId.get(requestId);

    const overId = String(over.id);
    const toColumnId = resolveColumnId(
      overId,
      over.data.current?.type as string | undefined,
    );

    if (!fromColumnId || !toColumnId) {
      return;
    }

    const targetColumn = boardColumns.find((column) => column.id === toColumnId);
    const targetActive = targetColumn?.active ?? [];
    let toIndex =
      over.data.current?.type === "column"
        ? targetActive.length
        : targetActive.findIndex((request) => request.id === overId);

    if (toIndex < 0) {
      toIndex = targetActive.length;
    }

    if (
      fromColumnId === toColumnId &&
      over.data.current?.type !== "column"
    ) {
      const fromIndex = targetActive.findIndex(
        (request) => request.id === requestId,
      );

      if (fromIndex >= 0 && toIndex > fromIndex) {
        toIndex -= 1;
      }
    }

    if (
      fromColumnId === toColumnId &&
      targetActive.findIndex((request) => request.id === requestId) === toIndex
    ) {
      return;
    }

    onMove({
      requestId,
      fromColumnId,
      toColumnId,
      toIndex: Math.max(toIndex, 0),
    });
  }

  return (
    <DndContext
      collisionDetection={boardCollisionDetection}
      onDragEnd={handleDragEnd}
      onDragOver={handleDragOver}
      onDragStart={handleDragStart}
      sensors={sensors}
    >
      <div className="w-full overflow-x-auto pb-2">
        <div
          className="grid gap-4"
          style={
            columns.length > 0
              ? {
                  gridTemplateColumns: `repeat(${columnCount}, minmax(350px, 1fr))`,
                  minWidth: 1500,
                }
              : {
                  gridTemplateColumns: "minmax(350px, 420px)",
                }
          }
        >
          {boardColumns.map((column) => (
            <DroppableColumn
              columnId={column.id}
              count={
                column.tone === "employee"
                  ? column.active.length
                  : column.requests.length
              }
              doneCount={column.completed.length}
              enableDrag={canDrag}
              key={column.id}
              subtitle={column.subtitle}
              title={column.title}
              tone={column.tone}
            >
              {/* SortableContext must stay mounted even when active is empty,
                  otherwise empty / «все выполнены» columns stop accepting drops. */}
              <SortableContext
                items={column.active.map((request) => request.id)}
                strategy={verticalListSortingStrategy}
              >
                <div className="flex min-h-[10rem] flex-1 flex-col gap-2.5">
                  {column.active.length > 0 ? (
                    column.active.map((request) => (
                      <SortableRequestCard
                        columnId={column.id}
                        draftPlanning={draftPlanningRequestId === request.id}
                        enableDrag={
                          canDrag &&
                          !lockedIds.has(request.id) &&
                          (!draftPlanningRequestId ||
                            draftPlanningRequestId === request.id)
                        }
                        employees={employees}
                        key={request.id}
                        mode={
                          column.id === UNPLANNED_COLUMN_ID
                            ? "unplanned"
                            : "planned"
                        }
                        onCancelDraft={
                          onCancelDraft
                            ? () => onCancelDraft(request.id)
                            : undefined
                        }
                        onPlan={onPlan}
                        onStatus={onStatus}
                        request={request}
                        selectedDate={selectedDate}
                      />
                    ))
                  ) : column.tone === "employee" &&
                    column.completed.length > 0 ? (
                    <div className="rounded-xl border border-emerald-200 bg-emerald-50/80 px-3 py-3 text-center">
                      <p className="text-sm font-semibold text-emerald-900">
                        Все задачи выполнены
                      </p>
                      <p className="mt-1 text-xs text-emerald-800">
                        {formatCompletedSectionLabel(
                          selectedDate,
                          column.completed.length,
                        ).replace(/^✓\s*/, "")}
                      </p>
                      <p className="mt-2 text-[11px] text-emerald-700/80">
                        Перетащите заявку сюда, чтобы назначить
                      </p>
                    </div>
                  ) : (
                    <EmptyState
                      text={
                        column.id === UNPLANNED_COLUMN_ID
                          ? "Все актуальные заявки уже имеют дату, ответственного и очередность."
                          : "Перетащите заявку сюда или назначьте из карточки."
                      }
                      title={
                        column.id === UNPLANNED_COLUMN_ID
                          ? "Незапланированных заявок нет"
                          : "Сегодня задач нет"
                      }
                    />
                  )}
                </div>
              </SortableContext>

              {column.tone === "employee" && column.completed.length > 0 ? (
                <div className="mt-2 grid gap-2 border-t border-slate-200 pt-3">
                  <p className="text-[11px] font-semibold text-emerald-800">
                    {formatCompletedSectionLabel(
                      selectedDate,
                      column.completed.length,
                    )}
                  </p>
                  {column.completed.map((request) => (
                    <TodayCompletedCard
                      key={request.id}
                      request={request}
                      selectedDate={selectedDate}
                    />
                  ))}
                </div>
              ) : null}
            </DroppableColumn>
          ))}
        </div>
      </div>

      <DragOverlay>
        {activeRequest ? (
          <div className="scale-[1.03] rounded-xl border border-slate-300 bg-white p-3 shadow-2xl shadow-slate-400/40">
            <p className="text-xs font-semibold text-slate-950">
              #{activeRequest.request_number ?? "—"} ·{" "}
              {activeRequest.location?.name ?? "Заявка"}
            </p>
            <p className="mt-1 line-clamp-2 text-xs text-slate-600">
              {activeRequest.description}
            </p>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

function DroppableColumn({
  children,
  columnId,
  count,
  doneCount = 0,
  enableDrag,
  subtitle,
  title,
  tone,
}: {
  children: ReactNode;
  columnId: string;
  count: number;
  doneCount?: number;
  enableDrag: boolean;
  subtitle: string;
  title: string;
  tone: "unplanned" | "employee";
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: columnId,
    data: { type: "column", columnId },
    disabled: !enableDrag,
  });
  const isUnplanned = tone === "unplanned";

  return (
    <section
      className={`flex min-h-[28rem] min-w-0 flex-col rounded-2xl border p-3 shadow-lg shadow-slate-200/40 backdrop-blur ${
        isUnplanned
          ? "border-amber-200 bg-amber-50/80"
          : "border-slate-200 bg-white/80"
      } ${isOver ? "ring-2 ring-slate-950/15" : ""}`}
      data-column-id={columnId}
      ref={setNodeRef}
    >
      <div className="flex items-start justify-between gap-3 border-b border-slate-200/70 pb-3">
        <div className="min-w-0">
          <h2 className="truncate text-lg font-semibold tracking-tight text-slate-950">
            {title}
          </h2>
          <p className="mt-0.5 text-sm text-slate-500">{subtitle}</p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <span
            className={`rounded-full px-2.5 py-1 text-sm font-semibold tabular-nums ${
              isUnplanned
                ? "bg-white text-amber-800 shadow-sm"
                : "bg-slate-950 text-white"
            }`}
          >
            {count}
          </span>
          {!isUnplanned && doneCount > 0 ? (
            <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold tabular-nums text-emerald-800">
              ✓ {doneCount}
            </span>
          ) : null}
        </div>
      </div>

      <div className="mt-3 flex min-h-0 flex-1 flex-col gap-2.5">
        {children}
      </div>
    </section>
  );
}

function SortableRequestCard({
  columnId,
  draftPlanning = false,
  enableDrag,
  employees,
  mode,
  onCancelDraft,
  onPlan,
  onStatus,
  request,
  selectedDate,
}: {
  columnId: string;
  draftPlanning?: boolean;
  enableDrag: boolean;
  employees: EmployeeOption[];
  mode: "unplanned" | "planned";
  onPlan: (payload: PlanPayload) => void;
  onCancelDraft?: () => void;
  onStatus: (requestId: string, status: RequestStatus) => void;
  request: TodayRequestItem;
  selectedDate: string;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: request.id,
    data: { type: "request", columnId },
    disabled: !enableDrag || draftPlanning,
  });

  const canGrab = enableDrag && !draftPlanning;

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.35 : 1,
      }}
      className={canGrab ? "cursor-grab touch-none active:cursor-grabbing" : undefined}
      {...(canGrab ? { ...attributes, ...listeners } : {})}
    >
      <TodayRequestCard
        draftPlanning={draftPlanning}
        employees={employees}
        mode={mode}
        onCancelDraft={onCancelDraft}
        onPlan={onPlan}
        onStatus={onStatus}
        request={request}
        selectedDate={selectedDate}
      />
    </div>
  );
}

function EmptyState({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-200 bg-white/60 px-3 py-3">
      <p className="text-sm font-semibold text-slate-950">{title}</p>
      <p className="mt-1 text-xs leading-5 text-slate-500">{text}</p>
    </div>
  );
}

function formatTaskCount(count: number) {
  const mod10 = count % 10;
  const mod100 = count % 100;

  if (mod10 === 1 && mod100 !== 11) {
    return `(${count} задача)`;
  }

  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) {
    return `(${count} задачи)`;
  }

  return `(${count} задач)`;
}
