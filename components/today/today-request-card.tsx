"use client";

import { useState, type PointerEvent } from "react";
import { RequestReturnLink } from "@/components/navigation/request-return-link";
import { RequestStatusBadge } from "@/components/requests/request-status-badge";
import { QuickPlanForm } from "@/components/today/quick-plan-form";
import type { EmployeeOption } from "@/lib/db/employees";
import type { RequestStatus } from "@/lib/db/requests";
import type { TodayRequestItem } from "@/lib/db/today";
import type { PlanPayload } from "@/lib/today/board-state";

/** Keep buttons/links/forms from starting a card drag (listeners are on the card wrapper). */
function stopCardDrag(event: PointerEvent) {
  event.stopPropagation();
}

const urgencyLabels: Record<string, string> = {
  low: "Низкая",
  normal: "Обычная",
  high: "Высокая",
  critical: "Критичная",
};

const requestTypeLabels: Record<string, string> = {
  repair: "Ремонт",
  maintenance: "Обслуживание",
  diagnostics: "Диагностика",
  installation: "Монтаж",
  other: "Другое",
};

const dateFormatter = new Intl.DateTimeFormat("ru-RU", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

type TodayRequestCardProps = {
  request: TodayRequestItem;
  employees: EmployeeOption[];
  selectedDate: string;
  mode: "unplanned" | "planned";
  /** Draft planning after DnD from unplanned — confirm before DB write. */
  draftPlanning?: boolean;
  onPlan: (payload: PlanPayload) => void;
  onCancelDraft?: () => void;
  onStatus: (requestId: string, status: RequestStatus) => void;
};

export function TodayRequestCard({
  draftPlanning = false,
  employees,
  mode,
  onCancelDraft,
  onPlan,
  onStatus,
  request,
  selectedDate,
}: TodayRequestCardProps) {
  const [planOpen, setPlanOpen] = useState(false);
  const isDone = request.status === "done";
  const isInProgress = request.status === "in_progress";

  if (mode === "planned") {
    return (
      <article
        className={`min-w-0 overflow-hidden rounded-xl border p-3 shadow-sm ${
          draftPlanning
            ? "border-amber-300 bg-amber-50/70"
            : isDone
              ? "border-slate-200 bg-white opacity-70"
              : "border-slate-200 bg-white"
        }`}
        data-request-id={request.id}
      >
        <div className="flex min-w-0 flex-col gap-1.5">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="rounded-md bg-slate-950 px-2 py-0.5 text-[11px] font-semibold text-white">
              #{request.request_number ?? "—"}
            </span>
            {draftPlanning ? (
              <span className="rounded-md bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-900">
                Черновик
              </span>
            ) : (
              <>
                {request.queue_position ? (
                  <span className="rounded-md bg-sky-50 px-1.5 py-0.5 text-[11px] font-bold tabular-nums text-sky-900">
                    {request.queue_position}
                  </span>
                ) : null}
                <span className="text-[11px] font-semibold tabular-nums text-slate-700">
                  {formatTimeRange(request)}
                </span>
              </>
            )}
            {request.has_time_overlap ? (
              <span className="rounded-md bg-rose-50 px-1.5 py-0.5 text-[10px] font-semibold text-rose-700">
                Пересечение
              </span>
            ) : null}
          </div>

          <h3 className="truncate text-sm font-semibold text-slate-950">
            {request.location?.name ?? "Заведение не указано"}
          </h3>
          <p className="line-clamp-2 text-xs leading-5 text-slate-600">
            {request.description}
          </p>
          {request.task_total ? (
            <p className="text-[11px] font-semibold text-slate-500">
              {request.task_done ?? 0}/{request.task_total}
            </p>
          ) : null}

          {request.is_collaborative ? (
            <p
              className="text-[11px] font-semibold text-sky-800"
              title={request.assignees
                .map(
                  (item) =>
                    `${item.employee_name}${item.role === "responsible" ? " (отв.)" : ""}`,
                )
                .join(", ")}
            >
              👥 {request.assignees_label}
            </p>
          ) : null}

          {!draftPlanning ? (
            <>
              <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600">
                  {requestTypeLabels[request.request_type] ?? request.request_type}
                </span>
                <RequestStatusBadge status={request.status} />
                <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600">
                  {urgencyLabels[request.urgency] ?? request.urgency}
                </span>
              </div>

              <div className="mt-1.5 grid min-w-0 grid-cols-2 gap-1.5">
                <RequestReturnLink
                  className="inline-flex w-full min-w-0 justify-center rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-[11px] font-semibold text-slate-950"
                  onPointerDown={stopCardDrag}
                  requestId={request.id}
                  returnPath={`/today?date=${selectedDate}`}
                >
                  Открыть
                </RequestReturnLink>

                {isDone ? (
                  <span className="inline-flex w-full min-w-0 items-center justify-center rounded-lg bg-emerald-50 px-2 py-1.5 text-[11px] font-semibold text-emerald-700">
                    Выполнено
                  </span>
                ) : isInProgress ? (
                  <button
                    className="w-full min-w-0 rounded-lg bg-emerald-600 px-2 py-1.5 text-[11px] font-semibold text-white"
                    onClick={() => onStatus(request.id, "done")}
                    onPointerDown={stopCardDrag}
                    type="button"
                  >
                    Завершить
                  </button>
                ) : (
                  <button
                    className="w-full min-w-0 rounded-lg border border-sky-200 bg-sky-50 px-2 py-1.5 text-[11px] font-semibold text-sky-900"
                    onClick={() => onStatus(request.id, "in_progress")}
                    onPointerDown={stopCardDrag}
                    type="button"
                  >
                    Начать работу
                  </button>
                )}
              </div>
            </>
          ) : (
            <div
              className="mt-1 min-w-0 overflow-hidden rounded-xl border border-amber-200 bg-white p-2.5"
              onPointerDown={stopCardDrag}
            >
              <p className="mb-2 text-xs font-semibold text-slate-700">
                Планирование
              </p>
              <QuickPlanForm
                compact
                defaultAssignedTo={request.assigned_to}
                employees={employees}
                lockAssignedTo
                onCancel={onCancelDraft}
                onSubmit={onPlan}
                request={request}
                selectedDate={selectedDate}
                submitLabel="Назначить"
              />
            </div>
          )}
        </div>
      </article>
    );
  }

  return (
    <article
      className="min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-white p-3 shadow-sm"
      data-request-id={request.id}
    >
      <div className="flex min-w-0 flex-col gap-1.5">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="rounded-md bg-slate-950 px-2 py-0.5 text-[11px] font-semibold text-white">
            #{request.request_number ?? "—"}
          </span>
          <RequestStatusBadge status={request.status} />
          <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600">
            {urgencyLabels[request.urgency] ?? request.urgency}
          </span>
        </div>

        <h3 className="truncate text-sm font-semibold text-slate-950">
          {request.location?.name ?? "Заведение не указано"}
        </h3>
        <p className="line-clamp-2 text-xs leading-5 text-slate-600">
          {request.description}
        </p>
        {request.task_total ? (
          <p className="text-[11px] font-semibold text-slate-500">
            {request.task_done ?? 0}/{request.task_total}
          </p>
        ) : null}
        <p className="truncate text-[11px] text-slate-400">
          {request.location?.address ?? "Адрес не указан"}
        </p>
        <p className="text-[11px] text-slate-500">
          Создана {dateFormatter.format(new Date(request.created_at))}
        </p>

        {planOpen ? (
          <div
            className="mt-1 min-w-0 overflow-hidden rounded-xl border border-slate-100 bg-slate-50 p-2.5"
            onPointerDown={stopCardDrag}
          >
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="text-xs font-semibold text-slate-700">Планирование</p>
              <button
                className="text-[11px] font-medium text-slate-500 hover:text-slate-800"
                onClick={() => setPlanOpen(false)}
                type="button"
              >
                Скрыть
              </button>
            </div>
            <QuickPlanForm
              compact
              employees={employees}
              onSubmit={(payload) => {
                onPlan(payload);
                setPlanOpen(false);
              }}
              request={request}
              selectedDate={selectedDate}
              submitLabel="Назначить"
            />
          </div>
        ) : (
          <button
            className="mt-1 inline-flex w-full justify-center rounded-lg bg-slate-950 px-3 py-2 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
            disabled={employees.length === 0}
            onClick={() => setPlanOpen(true)}
            onPointerDown={stopCardDrag}
            type="button"
          >
            Запланировать
          </button>
        )}
      </div>
    </article>
  );
}

function formatTimeRange(request: TodayRequestItem) {
  const start = request.start_time?.slice(0, 5);
  const end = request.end_time?.slice(0, 5);

  if (start && end) {
    return `${start} — ${end}`;
  }

  if (start) {
    return `с ${start}`;
  }

  if (end) {
    return `до ${end}`;
  }

  return "Время не указано";
}
