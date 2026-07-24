"use client";

import { useEffect, useMemo, useState } from "react";
import { WorkCompletedCard } from "@/components/work/work-completed-card";
import { WorkTaskCard } from "@/components/work/work-task-card";
import { formatCompletedSectionLabel, toLocalDateKey } from "@/lib/date/local-date";
import {
  sortActiveDayRequests,
  sortCompletedDayRequests,
  splitDayRequests,
} from "@/lib/plan/day-sections";
import type { WorkRequestItem } from "@/lib/db/work";

type WorkTaskListProps = {
  requests: WorkRequestItem[];
  /** Hide cards after they become done (active filters, not day plan). */
  hideWhenDone?: boolean;
  /** Day plan: keep done items in «Выполненные сегодня». */
  showCompletedToday?: boolean;
  selectedDate?: string;
  emptyTitle: string;
  emptyText: string;
};

export function WorkTaskList({
  emptyText,
  emptyTitle,
  hideWhenDone = false,
  requests: initialRequests,
  selectedDate,
  showCompletedToday = false,
}: WorkTaskListProps) {
  const [requests, setRequests] = useState(initialRequests);
  const [notice, setNotice] = useState<string | null>(null);
  const dateKey = selectedDate ?? toLocalDateKey();

  useEffect(() => {
    setRequests(initialRequests);
  }, [initialRequests, dateKey]);

  const { active, completed } = useMemo(() => {
    if (!showCompletedToday) {
      const visible = hideWhenDone
        ? requests.filter((request) => request.status !== "done")
        : requests;
      return { active: visible, completed: [] as WorkRequestItem[] };
    }

    const split = splitDayRequests(requests, dateKey);
    return {
      active: sortActiveDayRequests(split.active, dateKey),
      completed: sortCompletedDayRequests(split.completed),
    };
  }, [dateKey, hideWhenDone, requests, showCompletedToday]);

  function handleLocalUpdate(requestId: string, next: WorkRequestItem | null) {
    setRequests((current) => {
      if (next === null) {
        return current.filter((item) => item.id !== requestId);
      }

      return current.map((item) => (item.id === requestId ? next : item));
    });
  }

  if (showCompletedToday) {
    const allDone = active.length === 0 && completed.length > 0;
    const totallyEmpty = active.length === 0 && completed.length === 0;
    const completedLabel = formatCompletedSectionLabel(dateKey, completed.length);

    return (
      <div className="grid gap-4">
        {notice ? (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-900">
            {notice}
          </div>
        ) : null}

        {totallyEmpty ? (
          <section className="rounded-2xl border border-dashed border-slate-300 bg-white/85 p-6 text-center shadow-lg shadow-slate-200/40">
            <h2 className="text-lg font-semibold text-slate-950">{emptyTitle}</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">{emptyText}</p>
          </section>
        ) : null}

        {allDone ? (
          <section className="rounded-2xl border border-emerald-200 bg-gradient-to-b from-emerald-50 to-white p-6 text-center shadow-lg shadow-emerald-100/60">
            <p className="text-3xl" aria-hidden>
              🎉
            </p>
            <h2 className="mt-3 text-xl font-semibold tracking-tight text-slate-950">
              {dateKey === toLocalDateKey()
                ? "Все задачи на сегодня выполнены!"
                : "На этот день активных задач нет"}
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              {completedLabel.replace(/^✓\s*/, "")}:{" "}
              <span className="font-semibold text-slate-950">
                {completed.length} {pluralRequests(completed.length)}
              </span>
            </p>
            <p className="mt-1 text-sm font-medium text-emerald-800">
              Отличная работа!
            </p>
          </section>
        ) : null}

        {active.length > 0 ? (
          <div className="grid gap-3">
            {active.map((request) => (
              <WorkTaskCard
                keepWhenDone
                key={request.id}
                onLocalUpdate={(next) => handleLocalUpdate(request.id, next)}
                onNotice={setNotice}
                request={request}
              />
            ))}
          </div>
        ) : null}

        {completed.length > 0 ? (
          <section className="grid gap-3">
            <div className="flex items-center gap-3 pt-2">
              <div className="h-px flex-1 bg-slate-200" />
              <h2 className="shrink-0 text-sm font-semibold text-emerald-800">
                {completedLabel}
              </h2>
              <div className="h-px flex-1 bg-slate-200" />
            </div>
            {completed.map((request) => (
              <WorkCompletedCard key={request.id} request={request} />
            ))}
          </section>
        ) : null}
      </div>
    );
  }

  return (
    <div className="grid gap-3">
      {notice ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-900">
          {notice}
        </div>
      ) : null}

      {requests.length > 0 ? (
        <>
          {requests.map((request) => (
            <WorkTaskCard
              hideWhenDone={hideWhenDone}
              key={request.id}
              onLocalUpdate={(next) => handleLocalUpdate(request.id, next)}
              onNotice={setNotice}
              request={request}
            />
          ))}
          {active.length === 0 && !notice ? (
            <section className="rounded-2xl border border-dashed border-slate-300 bg-white/85 p-6 text-center shadow-lg shadow-slate-200/40">
              <h2 className="text-lg font-semibold text-slate-950">{emptyTitle}</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">{emptyText}</p>
            </section>
          ) : null}
        </>
      ) : (
        <section className="rounded-2xl border border-dashed border-slate-300 bg-white/85 p-6 text-center shadow-lg shadow-slate-200/40">
          <h2 className="text-lg font-semibold text-slate-950">{emptyTitle}</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">{emptyText}</p>
        </section>
      )}
    </div>
  );
}

function pluralRequests(count: number) {
  const mod10 = count % 10;
  const mod100 = count % 100;

  if (mod10 === 1 && mod100 !== 11) {
    return "заявка";
  }

  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) {
    return "заявки";
  }

  return "заявок";
}
