"use client";

import { useState } from "react";
import type { FormattedHistoryEvent } from "@/lib/request-history/format";
import { HISTORY_TONE_STYLES } from "@/lib/request-history/format";

type RequestHistoryTimelineProps = {
  groups: Array<{
    key: string;
    label: string;
    items: FormattedHistoryEvent[];
  }>;
};

export function RequestHistoryTimeline({ groups }: RequestHistoryTimelineProps) {
  return (
    <div className="mt-5 flex flex-col gap-7">
      {groups.map((group) => (
        <section key={group.key} className="min-w-0">
          <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
            {group.label}
          </h3>
          <ol className="relative mt-3 flex flex-col">
            <span
              aria-hidden
              className="absolute bottom-3 left-[19px] top-3 w-px bg-slate-200"
            />
            {group.items.map((event, index) => (
              <HistoryTimelineItem
                key={event.id}
                event={event}
                index={index}
              />
            ))}
          </ol>
        </section>
      ))}
    </div>
  );
}

function HistoryTimelineItem({
  event,
  index,
}: {
  event: FormattedHistoryEvent;
  index: number;
}) {
  const [open, setOpen] = useState(false);
  const tone = HISTORY_TONE_STYLES[event.tone];

  return (
    <li
      className="history-timeline-item relative flex gap-3 pb-4 last:pb-0 sm:gap-4"
      style={{ animationDelay: `${Math.min(index, 12) * 40}ms` }}
    >
      <div className="relative z-10 flex w-10 shrink-0 justify-center pt-1">
        <span
          className={`flex h-10 w-10 items-center justify-center rounded-full text-base ring-4 ring-white ${tone.badge}`}
          aria-hidden
        >
          {event.icon}
        </span>
      </div>

      <article className="min-w-0 flex-1 rounded-2xl border border-slate-200/90 bg-white p-3.5 shadow-sm shadow-slate-200/40 sm:p-4">
        <h4 className="text-sm font-semibold tracking-tight text-slate-950 sm:text-[15px]">
          {event.title}
        </h4>
        <p className="mt-1 text-sm font-medium text-slate-700">
          {event.actorName}
        </p>
        <time
          className="mt-0.5 block text-xs text-slate-500"
          dateTime={event.createdAt}
        >
          {event.whenLabel}
        </time>

        {event.change ? (
          <div className="mt-3 rounded-xl bg-slate-50 px-3 py-2.5">
            {event.change.label ? (
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                {event.change.label}
              </p>
            ) : null}
            <p
              className={`break-words text-sm text-slate-500 line-through decoration-slate-300 ${
                event.change.label ? "mt-1.5" : ""
              }`}
            >
              {event.change.oldValue}
            </p>
            <p className="my-1 text-center text-xs font-semibold text-slate-400">
              ↓
            </p>
            <p className="break-words text-sm font-semibold text-slate-950">
              {event.change.newValue}
            </p>
          </div>
        ) : null}

        {event.comment ? (
          <div className="mt-3 rounded-xl border border-amber-100 bg-amber-50/80 px-3 py-2.5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-amber-700">
              Комментарий
            </p>
            <p className="mt-1 break-words text-sm leading-6 text-amber-950">
              «{event.comment}»
            </p>
          </div>
        ) : null}

        {event.notes.length > 0 ? (
          <ul className="mt-3 flex flex-col gap-1">
            {event.notes.map((note) => (
              <li
                key={note}
                className="break-words text-xs leading-5 text-slate-500"
              >
                {note}
              </li>
            ))}
          </ul>
        ) : null}

        <button
          className="mt-3 text-xs font-semibold text-slate-500 transition hover:text-slate-800"
          onClick={() => setOpen((value) => !value)}
          type="button"
        >
          {open ? "Скрыть детали" : "Показать детали"}
        </button>

        <div
          className={`grid transition-[grid-template-rows,opacity] duration-300 ease-out ${
            open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
          }`}
        >
          <div className="overflow-hidden">
            <div className="mt-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs leading-5 text-slate-600">
              <DetailRow label="ID события" value={event.id} />
              <DetailRow label="Тип события" value={event.action} />
              {event.fieldName ? (
                <DetailRow label="Поле" value={event.fieldName} />
              ) : null}
              <DetailRow
                label="Старое значение"
                value={stringifyJson(event.oldValue)}
              />
              <DetailRow
                label="Новое значение"
                value={stringifyJson(event.newValue)}
              />
              <DetailRow
                label="Metadata"
                value={stringifyJson(event.metadata)}
              />
            </div>
          </div>
        </div>
      </article>
    </li>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-b border-slate-200/80 py-1.5 last:border-b-0">
      <p className="font-semibold text-slate-500">{label}</p>
      <p className="mt-0.5 break-all whitespace-pre-wrap text-slate-800">
        {value}
      </p>
    </div>
  );
}

function stringifyJson(value: unknown) {
  if (value === null || value === undefined) {
    return "—";
  }
  if (typeof value === "string") {
    return value;
  }
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}
