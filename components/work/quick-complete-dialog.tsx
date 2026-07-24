"use client";

import { useId } from "react";
import type { RequestAssignee } from "@/lib/db/assignees";

type QuickCompleteDialogProps = {
  mode: "close_request" | "complete_part";
  requestNumber: number | null;
  locationName: string | null;
  comment: string;
  error: string | null;
  isPending: boolean;
  participants?: RequestAssignee[];
  onCommentChange: (value: string) => void;
  onCancel: () => void;
  onConfirm: () => void;
};

export function QuickCompleteDialog({
  comment,
  error,
  isPending,
  locationName,
  mode,
  onCancel,
  onCommentChange,
  onConfirm,
  participants = [],
  requestNumber,
}: QuickCompleteDialogProps) {
  const titleId = useId();
  const others = participants.filter((item) => item.role === "participant");
  const incomplete = others.filter(
    (item) => item.participation_status !== "completed",
  );

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center overflow-y-auto bg-slate-950/40 p-3 sm:items-center sm:p-4">
      <div
        aria-labelledby={titleId}
        aria-modal="true"
        className="mb-[max(0.75rem,env(safe-area-inset-bottom))] w-full max-w-md rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl sm:mb-0 sm:p-5"
        role="dialog"
      >
        <h2 className="text-lg font-semibold text-slate-950" id={titleId}>
          {mode === "complete_part"
            ? "Завершить свою часть работы?"
            : "Завершить задачу"}
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          #{requestNumber ?? "—"} · {locationName ?? "Заведение не указано"}
        </p>

        {mode === "close_request" && others.length > 0 ? (
          <div className="mt-3 rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-700">
            <p className="font-semibold text-slate-900">Участники:</p>
            <ul className="mt-1 space-y-1">
              {others.map((item) => (
                <li key={item.id}>
                  {item.participation_status === "completed" ? "✓" : "●"}{" "}
                  {item.employee_name.split(" ")[0] ?? item.employee_name}{" "}
                  {item.participation_status === "completed"
                    ? "завершил работу"
                    : "еще не отметил завершение"}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {mode === "close_request" && incomplete.length > 0 ? (
          <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
            Не все участники отметили завершение своей части. Все равно закрыть
            заявку?
          </p>
        ) : null}

        <label className="mt-4 block text-sm font-medium text-slate-800">
          {mode === "complete_part" ? "Комментарий" : "Что было сделано?"}
          <span className="mt-0.5 block text-xs font-normal text-slate-500">
            Комментарий — необязательно
          </span>
          <textarea
            autoFocus
            className="mt-2 min-h-28 w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-base leading-6 text-slate-950 outline-none focus:border-slate-950 focus:ring-4 focus:ring-slate-950/5"
            onChange={(event) => onCommentChange(event.target.value)}
            placeholder="Можно оставить пустым"
            value={comment}
          />
        </label>

        {error ? (
          <p className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
            {error}
          </p>
        ) : null}

        <div className="mt-4 grid grid-cols-2 gap-2">
          <button
            className="min-h-12 rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm font-semibold text-slate-700 disabled:opacity-50"
            disabled={isPending}
            onClick={onCancel}
            type="button"
          >
            Отмена
          </button>
          <button
            className="min-h-12 rounded-xl bg-emerald-600 px-3 py-3 text-sm font-semibold text-white disabled:opacity-50"
            disabled={isPending}
            onClick={onConfirm}
            type="button"
          >
            {isPending
              ? "Сохраняем…"
              : mode === "complete_part"
                ? "Подтвердить"
                : incomplete.length > 0
                  ? "Закрыть заявку"
                  : "Завершить"}
          </button>
        </div>
      </div>
    </div>
  );
}
