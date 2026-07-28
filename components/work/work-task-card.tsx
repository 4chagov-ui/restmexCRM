"use client";

import { useState, useTransition } from "react";
import {
  completeMyPartAction,
  completeWorkAction,
  startWorkAction,
} from "@/app/work/requests/[id]/actions";
import { RequestReturnLink } from "@/components/navigation/request-return-link";
import { RequestStatusBadge } from "@/components/requests/request-status-badge";
import { QuickCompleteDialog } from "@/components/work/quick-complete-dialog";
import type { WorkRequestItem } from "@/lib/db/work";

const urgencyLabels: Record<string, string> = {
  low: "Низкая",
  normal: "Обычная",
  high: "Высокая",
  critical: "Критичная",
};

type WorkTaskCardProps = {
  request: WorkRequestItem;
  hideWhenDone?: boolean;
  /** Keep done items in the parent list (day plan «Выполненные сегодня»). */
  keepWhenDone?: boolean;
  onLocalUpdate?: (request: WorkRequestItem | null) => void;
  onNotice?: (message: string | null) => void;
};

export function WorkTaskCard({
  hideWhenDone = false,
  keepWhenDone = false,
  onLocalUpdate,
  onNotice,
  request: initialRequest,
}: WorkTaskCardProps) {
  const [request, setRequest] = useState(initialRequest);
  const [dialogMode, setDialogMode] = useState<
    "close_request" | "complete_part" | null
  >(null);
  const [comment, setComment] = useState(initialRequest.executor_comment ?? "");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (hideWhenDone && request.status === "done") {
    return null;
  }

  const isParticipant = request.my_role === "participant";
  const isResponsible =
    request.my_role === "responsible" || request.my_role === null;
  const myPartDone = request.my_participation_status === "completed";
  const responsible = request.assignees.find(
    (item) => item.role === "responsible",
  );

  function patchLocal(next: WorkRequestItem) {
    setRequest(next);
    onLocalUpdate?.(next);
  }

  function handleStart() {
    if (isPending || myPartDone) {
      return;
    }

    const snapshot = request;
    const next: WorkRequestItem = {
      ...request,
      status:
        request.status === "planned" || request.status === "needs_planning"
          ? "in_progress"
          : request.status,
      closed_at: null,
      my_participation_status: "in_progress",
      started_at: request.started_at ?? new Date().toISOString(),
    };

    patchLocal(next);
    onNotice?.("Вы начали работу");
    setError(null);

    startTransition(async () => {
      const result = await startWorkAction(request.id);

      if (!result.ok) {
        setRequest(snapshot);
        onLocalUpdate?.(snapshot);
        onNotice?.(result.error);
      }
    });
  }

  function handleCompleteConfirm() {
    if (isPending || !dialogMode) {
      return;
    }

    const snapshot = request;
    const trimmed = comment.trim();
    const nextComment =
      trimmed.length > 0 ? trimmed : request.executor_comment;

    if (dialogMode === "complete_part") {
      setError(null);

      startTransition(async () => {
        const result = await completeMyPartAction(request.id, comment);
        if (!result.ok) {
          setError(result.error);
          return;
        }

        const next: WorkRequestItem = {
          ...snapshot,
          executor_comment: nextComment,
          my_participation_status: "completed",
        };
        patchLocal(next);
        setDialogMode(null);
        onNotice?.("Ваша часть работы завершена");
      });
      return;
    }

    setError(null);

    startTransition(async () => {
      const result = await completeWorkAction(request.id, comment);

      if (!result.ok) {
        setError(result.error);
        return;
      }

      const next: WorkRequestItem = {
        ...snapshot,
        status: "done",
        executor_comment: nextComment,
        closed_at: new Date().toISOString(),
        my_participation_status: "completed",
      };
      patchLocal(next);
      setDialogMode(null);
      onNotice?.("Заявка выполнена");

      if (hideWhenDone && !keepWhenDone) {
        onLocalUpdate?.(null);
      }
    });
  }

  const showStart =
    !myPartDone &&
    request.status !== "done" &&
    request.status !== "waiting_parts" &&
    request.status !== "outsource" &&
    (request.my_participation_status === "assigned" ||
      (request.my_participation_status === null &&
        request.status === "planned"));

  const showCompletePrimary =
    isResponsible && request.status === "in_progress" && !myPartDone;

  const showCompletePart =
    isParticipant &&
    !myPartDone &&
    (request.my_participation_status === "in_progress" ||
      (request.my_participation_status === "assigned" &&
        request.status === "in_progress"));

  const showOpenOnly =
    request.status === "waiting_parts" ||
    request.status === "outsource" ||
    request.status === "done" ||
    myPartDone;

  return (
    <>
      <article className="min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 shadow-md shadow-slate-200/50">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <span className="rounded-lg bg-slate-950 px-2.5 py-1 text-xs font-semibold text-white">
            #{request.request_number ?? "—"}
          </span>
          <span className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-semibold tabular-nums text-slate-700">
            {formatTimeRange(request)}
          </span>
          <span className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
            оч. {request.queue_position ?? "—"}
          </span>
          <RequestStatusBadge status={request.status} />
          <span className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
            {urgencyLabels[request.urgency] ?? request.urgency}
          </span>
        </div>

        {request.my_role === "responsible" ? (
          <p className="mt-3 text-sm font-semibold text-amber-800">
            ⭐ Вы ответственный
          </p>
        ) : null}
        {request.my_role === "participant" ? (
          <p className="mt-3 text-sm font-semibold text-sky-800">
            👥 Вы участвуете в заявке
          </p>
        ) : null}

        {request.is_collaborative ? (
          <div className="mt-2 rounded-xl border border-sky-100 bg-sky-50 px-3 py-2 text-sm text-sky-950">
            <p className="font-semibold">Команда</p>
            <ul className="mt-1 grid gap-0.5 text-xs leading-5">
              {request.assignees.map((member) => (
                <li key={member.id}>
                  {member.role === "responsible" ? "⭐ " : ""}
                  {member.employee_name.split(" ")[0] ?? member.employee_name}
                  {" — "}
                  {member.role === "responsible"
                    ? "ответственный"
                    : "участник"}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <h2 className="mt-3 text-lg font-semibold tracking-tight text-slate-950">
          {request.location?.name ?? "Заведение не указано"}
        </h2>
        <p className="mt-1 text-sm leading-6 text-slate-500">
          {request.location?.address ?? "Адрес не указан"}
        </p>
        <p className="mt-2 line-clamp-3 text-sm leading-6 text-slate-700">
          {request.description}
        </p>

        {request.status === "done" && request.is_collaborative ? (
          <p className="mt-3 rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
            ✓ Выполнено командой ·{" "}
            {request.assignees
              .map(
                (item) =>
                  item.employee_name.split(" ")[0] ?? item.employee_name,
              )
              .join(", ")}
            {request.closed_at
              ? ` · Закрыто в ${new Date(request.closed_at).toLocaleTimeString(
                  "ru-RU",
                  { hour: "2-digit", minute: "2-digit" },
                )}`
              : ""}
          </p>
        ) : null}

        {myPartDone && request.status !== "done" ? (
          <p className="mt-3 rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
            ✓ Вы завершили свою часть работы
            {responsible ? (
              <>
                <br />
                Ожидается закрытие ответственным: {responsible.employee_name}
              </>
            ) : null}
          </p>
        ) : null}

        {showOpenOnly && request.executor_comment && !myPartDone ? (
          <p className="mt-3 rounded-xl bg-slate-50 px-3 py-2 text-sm leading-5 text-slate-600">
            {request.executor_comment}
          </p>
        ) : null}

        <div className="mt-4 grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-2">
          <RequestReturnLink
            basePath="/work/requests"
            className="inline-flex min-h-12 w-full items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-3 text-base font-semibold text-slate-950"
            requestId={request.id}
          >
            {showOpenOnly &&
            !showStart &&
            !showCompletePrimary &&
            !showCompletePart
              ? "Открыть задачу"
              : "Открыть"}
          </RequestReturnLink>

          {showStart ? (
            <button
              className="inline-flex min-h-12 w-full items-center justify-center rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-base font-semibold text-sky-950 disabled:opacity-50"
              disabled={isPending}
              onClick={handleStart}
              type="button"
            >
              {isPending ? "Сохраняем…" : "Начать работу"}
            </button>
          ) : null}

          {showCompletePrimary ? (
            <button
              className="inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-emerald-600 px-4 py-3 text-base font-semibold text-white disabled:opacity-50"
              disabled={isPending}
              onClick={() => {
                setError(null);
                setComment(request.executor_comment ?? "");
                setDialogMode("close_request");
              }}
              type="button"
            >
              Выполнить
            </button>
          ) : null}

          {showCompletePart ? (
            <button
              className="inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-emerald-600 px-4 py-3 text-base font-semibold text-white disabled:opacity-50"
              disabled={isPending}
              onClick={() => {
                setError(null);
                setComment(request.executor_comment ?? "");
                setDialogMode("complete_part");
              }}
              type="button"
            >
              Работу завершил
            </button>
          ) : null}
        </div>
      </article>

      {dialogMode ? (
        <QuickCompleteDialog
          comment={comment}
          error={error}
          isPending={isPending}
          locationName={request.location?.name ?? null}
          mode={dialogMode}
          onCancel={() => {
            if (!isPending) {
              setDialogMode(null);
              setError(null);
            }
          }}
          onCommentChange={setComment}
          onConfirm={handleCompleteConfirm}
          participants={request.assignees}
          requestNumber={request.request_number}
        />
      ) : null}
    </>
  );
}

function formatTimeRange(request: WorkRequestItem) {
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
