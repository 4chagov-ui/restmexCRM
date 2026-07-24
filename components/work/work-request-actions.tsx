"use client";

import { useState, useTransition } from "react";
import {
  completeMyPartAction,
  completeWorkAction,
  startWorkAction,
  updateWorkRequestAction,
} from "@/app/work/requests/[id]/actions";
import type { RequestStatus } from "@/lib/db/requests";
import type { WorkRequestItem } from "@/lib/db/work";

type WorkRequestActionsProps = {
  request: WorkRequestItem;
};

export function WorkRequestActions({ request }: WorkRequestActionsProps) {
  const [comment, setComment] = useState(request.executor_comment ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [status, setStatus] = useState(request.status);
  const [participation, setParticipation] = useState(
    request.my_participation_status,
  );
  const [isPending, startTransition] = useTransition();

  const isParticipant = request.my_role === "participant";
  const isResponsible =
    request.my_role === "responsible" || request.my_role === null;
  const myPartDone = participation === "completed";

  function submitStatus(nextStatus: RequestStatus) {
    if (isPending) {
      return;
    }

    setError(null);
    setSaved(false);

    startTransition(async () => {
      let result;

      if (nextStatus === "in_progress") {
        result = await startWorkAction(request.id);
      } else if (nextStatus === "done") {
        result = await completeWorkAction(request.id, comment);
      } else {
        const formData = new FormData();
        formData.set("request_id", request.id);
        formData.set("status", nextStatus);
        formData.set("executor_comment", comment);
        result = await updateWorkRequestAction(formData);
      }

      if (!result.ok) {
        setError(result.error);
        return;
      }

      setStatus(nextStatus);
      if (nextStatus === "in_progress") {
        setParticipation("in_progress");
      }
      if (nextStatus === "done") {
        setParticipation("completed");
      }
      setSaved(true);
    });
  }

  function completeMyPart() {
    if (isPending) {
      return;
    }

    setError(null);
    setSaved(false);

    startTransition(async () => {
      const result = await completeMyPartAction(request.id, comment);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setParticipation("completed");
      setSaved(true);
    });
  }

  function saveCommentOnly() {
    if (isPending) {
      return;
    }

    setError(null);
    setSaved(false);

    startTransition(async () => {
      const formData = new FormData();
      formData.set("request_id", request.id);
      formData.set("status", status);
      formData.set("executor_comment", comment);
      const result = await updateWorkRequestAction(formData);

      if (!result.ok) {
        setError(result.error);
        return;
      }

      setSaved(true);
    });
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-lg shadow-slate-200/50 sm:p-5">
      <h2 className="text-lg font-semibold tracking-tight text-slate-950">
        Работа по заявке
      </h2>
      <p className="mt-1 text-sm leading-6 text-slate-500">
        {isParticipant
          ? "Вы участник: можете начать работу и отметить свою часть. Закрыть заявку может только ответственный."
          : "Можно менять статус и комментарий исполнителя."}
      </p>

      {saved ? (
        <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-800">
          Изменения сохранены.
        </div>
      ) : null}

      {error ? (
        <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-800">
          {error}
        </div>
      ) : null}

      <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
        <button
          className="min-h-12 rounded-xl border border-sky-200 bg-sky-50 px-3 py-3 text-sm font-semibold text-sky-950 disabled:opacity-50"
          disabled={isPending || myPartDone}
          onClick={() => submitStatus("in_progress")}
          type="button"
        >
          В работу
        </button>
        <button
          className="min-h-12 rounded-xl border border-amber-200 bg-amber-50 px-3 py-3 text-sm font-semibold text-amber-950 disabled:opacity-50"
          disabled={isPending || myPartDone || isParticipant}
          onClick={() => submitStatus("waiting_parts")}
          type="button"
        >
          Заказ запчастей
        </button>
        {isResponsible ? (
          <button
            className="min-h-12 rounded-xl border border-emerald-600 bg-emerald-600 px-3 py-3 text-sm font-semibold text-white disabled:opacity-50"
            disabled={isPending || myPartDone}
            onClick={() => submitStatus("done")}
            type="button"
          >
            Выполнено
          </button>
        ) : (
          <button
            className="min-h-12 rounded-xl border border-emerald-600 bg-emerald-600 px-3 py-3 text-sm font-semibold text-white disabled:opacity-50"
            disabled={isPending || myPartDone}
            onClick={completeMyPart}
            type="button"
          >
            Работу завершил
          </button>
        )}
      </div>

      <div className="mt-5 grid gap-4">
        <label className="text-sm font-medium text-slate-800">
          Комментарий исполнителя
          <span className="mt-0.5 block text-xs font-normal text-slate-500">
            Комментарий — необязательно
          </span>
          <textarea
            className="mt-2 min-h-36 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-base leading-6 text-slate-950 shadow-sm outline-none placeholder:text-slate-400 focus:border-slate-950 focus:ring-4 focus:ring-slate-950/5"
            onChange={(event) => setComment(event.target.value)}
            placeholder="Можно оставить пустым"
            value={comment}
          />
        </label>

        <button
          className="inline-flex min-h-12 w-full justify-center rounded-xl bg-slate-950 px-5 py-3 text-base font-semibold text-white disabled:opacity-50"
          disabled={isPending}
          onClick={saveCommentOnly}
          type="button"
        >
          {isPending ? "Сохраняем…" : "Сохранить комментарий"}
        </button>
      </div>
    </section>
  );
}
