"use client";

import { useState } from "react";
import type { EmployeeOption } from "@/lib/db/employees";
import type { TodayRequestItem } from "@/lib/db/today";
import type { PlanPayload } from "@/lib/today/board-state";

const inputClassName =
  "mt-1 box-border block w-full max-w-full min-w-0 rounded-xl border border-slate-200 bg-white px-2.5 py-2 text-xs text-slate-950 shadow-sm outline-none transition hover:border-slate-300 focus:border-slate-950 focus:ring-4 focus:ring-slate-950/5";

const labelClassName =
  "flex min-w-0 flex-col text-[11px] font-semibold text-slate-600";

type QuickPlanFormProps = {
  request: TodayRequestItem;
  employees: EmployeeOption[];
  selectedDate: string;
  compact?: boolean;
  submitLabel?: string;
  /** Prefill / lock responsible (e.g. column after DnD). */
  defaultAssignedTo?: string | null;
  lockAssignedTo?: boolean;
  onSubmit: (payload: PlanPayload) => void;
  onCancel?: () => void;
};

export function QuickPlanForm({
  compact = false,
  defaultAssignedTo,
  employees,
  lockAssignedTo = false,
  onCancel,
  onSubmit,
  request,
  selectedDate,
  submitLabel = "Назначить",
}: QuickPlanFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const assignedDefault =
    defaultAssignedTo ?? request.assigned_to ?? "";

  return (
    <form
      className="grid min-w-0 gap-2"
      onSubmit={(event) => {
        event.preventDefault();

        if (isSubmitting) {
          return;
        }

        const formData = new FormData(event.currentTarget);
        const plannedDate = String(formData.get("planned_date") ?? "").trim();
        const assignedTo = String(
          formData.get("assigned_to") ?? assignedDefault,
        ).trim();
        const startTime = String(formData.get("start_time") ?? "").trim();
        const endTime = String(formData.get("end_time") ?? "").trim();
        const queuePosition = Number(formData.get("queue_position"));

        if (!plannedDate || !assignedTo || !Number.isFinite(queuePosition)) {
          return;
        }

        setIsSubmitting(true);
        onSubmit({
          requestId: request.id,
          plannedDate,
          startTime: startTime || null,
          endTime: endTime || null,
          assignedTo,
          queuePosition,
        });
        setIsSubmitting(false);
      }}
    >
      {/*
        Compact = узкая колонка Today (~350px): всегда 1 колонка.
        На широких формах — адаптивная сетка от sm/xl.
      */}
      <div
        className={`grid min-w-0 gap-2 ${
          compact
            ? "grid-cols-1"
            : "grid-cols-1 sm:grid-cols-2 xl:grid-cols-5"
        }`}
      >
        <label className={labelClassName}>
          Дата
          <input
            className={inputClassName}
            defaultValue={request.planned_date ?? selectedDate}
            name="planned_date"
            required
            type="date"
          />
        </label>

        <label className={labelClassName}>
          Очередь
          <span className="mt-0.5 text-[10px] font-normal leading-4 text-slate-400">
            по месту в колонке
          </span>
          <input
            className={inputClassName}
            defaultValue={request.queue_position ?? 1}
            min="1"
            name="queue_position"
            required
            type="number"
          />
        </label>

        <label className={labelClassName}>
          Начало
          <input
            className={inputClassName}
            defaultValue={request.start_time?.slice(0, 5) ?? ""}
            name="start_time"
            type="time"
          />
        </label>

        <label className={labelClassName}>
          Окончание
          <input
            className={inputClassName}
            defaultValue={request.end_time?.slice(0, 5) ?? ""}
            name="end_time"
            type="time"
          />
        </label>

        <label
          className={`${labelClassName} ${
            compact ? "" : "sm:col-span-2 xl:col-span-1"
          }`}
        >
          Ответственный
          {lockAssignedTo ? (
            <>
              <input name="assigned_to" type="hidden" value={assignedDefault} />
              <p className={`${inputClassName} flex items-center bg-slate-50`}>
                {employees.find((item) => item.id === assignedDefault)?.name ??
                  "Не выбран"}
              </p>
            </>
          ) : (
            <select
              className={inputClassName}
              defaultValue={assignedDefault}
              name="assigned_to"
              required
            >
              <option value="">Выберите сотрудника</option>
              {employees.map((employee) => (
                <option key={employee.id} value={employee.id}>
                  {employee.name}
                </option>
              ))}
            </select>
          )}
        </label>
      </div>

      <div
        className={`grid min-w-0 gap-2 ${
          onCancel ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1"
        }`}
      >
        {onCancel ? (
          <button
            className="inline-flex w-full max-w-full justify-center rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
            disabled={isSubmitting}
            onClick={onCancel}
            type="button"
          >
            Отмена
          </button>
        ) : null}
        <button
          className="inline-flex w-full max-w-full justify-center rounded-xl bg-slate-950 px-3 py-2 text-xs font-semibold text-white shadow-lg shadow-slate-300/80 transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
          disabled={
            employees.length === 0 ||
            isSubmitting ||
            (lockAssignedTo && !assignedDefault)
          }
          type="submit"
        >
          {submitLabel}
        </button>
      </div>
    </form>
  );
}
