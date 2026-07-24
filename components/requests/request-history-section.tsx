"use client";

import { useEffect, useState, useTransition } from "react";
import { loadRequestHistoryAction } from "@/app/requests/history-actions";
import { RequestHistoryTimeline } from "@/components/requests/request-history-timeline";
import type { RequestHistoryRow } from "@/lib/db/request-history";
import {
  formatEventsCount,
  formatHistoryEvent,
  groupHistoryByDate,
} from "@/lib/request-history/format";

type RequestHistorySectionProps = {
  requestId: string;
  initialItems?: RequestHistoryRow[];
  initialHasMore?: boolean;
};

export function RequestHistorySection({
  requestId,
  initialItems,
  initialHasMore = false,
}: RequestHistorySectionProps) {
  const [items, setItems] = useState<RequestHistoryRow[]>(initialItems ?? []);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(Boolean(initialItems));
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (initialItems) {
      return;
    }

    startTransition(async () => {
      const result = await loadRequestHistoryAction({
        requestId,
        offset: 0,
        limit: 50,
      });

      if (!result.ok) {
        setError(result.error);
        setLoaded(true);
        return;
      }

      setItems(result.items);
      setHasMore(result.hasMore);
      setLoaded(true);
    });
  }, [requestId, initialItems]);

  function handleLoadMore() {
    startTransition(async () => {
      const result = await loadRequestHistoryAction({
        requestId,
        offset: items.length,
        limit: 50,
      });

      if (!result.ok) {
        setError(result.error);
        return;
      }

      setItems((prev) => [...prev, ...result.items]);
      setHasMore(result.hasMore);
    });
  }

  const formatted = items.map(formatHistoryEvent);
  const groups = groupHistoryByDate(formatted);
  const isLoading = !loaded || (isPending && items.length === 0);

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-gradient-to-b from-white to-slate-50/80 p-4 shadow-sm sm:p-5">
      <header className="min-w-0">
        <h2 className="text-lg font-semibold tracking-tight text-slate-950 sm:text-xl">
          История изменений
        </h2>
        {!isLoading && !error && items.length > 0 ? (
          <p className="mt-1 text-sm text-slate-500">
            {formatEventsCount(items.length, hasMore)}
          </p>
        ) : (
          <p className="mt-1 text-sm text-slate-500">
            Лента действий по этой заявке
          </p>
        )}
      </header>

      {isLoading ? (
        <div className="mt-5 space-y-3">
          {[0, 1, 2].map((key) => (
            <div
              key={key}
              className="flex animate-pulse gap-3"
            >
              <div className="h-10 w-10 shrink-0 rounded-full bg-slate-200" />
              <div className="h-24 flex-1 rounded-2xl bg-slate-200/80" />
            </div>
          ))}
        </div>
      ) : null}

      {error ? (
        <p className="mt-5 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
          {error}
        </p>
      ) : null}

      {loaded && !error && items.length === 0 ? (
        <div className="mt-6 flex flex-col items-center rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-10 text-center">
          <span className="text-3xl" aria-hidden>
            🕘
          </span>
          <p className="mt-3 text-sm font-semibold text-slate-900">
            История изменений пока пуста
          </p>
          <p className="mt-1 max-w-xs text-sm leading-6 text-slate-500">
            Первые изменения появятся после сохранения заявки.
          </p>
        </div>
      ) : null}

      {loaded && !error && items.length > 0 ? (
        <RequestHistoryTimeline groups={groups} />
      ) : null}

      {hasMore ? (
        <button
          className="mt-5 inline-flex h-11 w-full items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 sm:w-auto"
          disabled={isPending}
          onClick={handleLoadMore}
          type="button"
        >
          {isPending ? "Загрузка…" : "Показать ещё"}
        </button>
      ) : null}
    </section>
  );
}
