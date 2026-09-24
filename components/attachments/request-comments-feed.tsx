"use client";

import type { RequestCommentRow } from "@/lib/db/request-comments";
import { PhotoGallery } from "@/components/attachments/photo-gallery";

const timeFormatter = new Intl.DateTimeFormat("ru-RU", {
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

type RequestCommentsFeedProps = {
  comments: RequestCommentRow[];
  legacyManagerComment?: string | null;
  legacyExecutorComment?: string | null;
};

export function RequestCommentsFeed({
  comments,
  legacyManagerComment,
  legacyExecutorComment,
}: RequestCommentsFeedProps) {
  const hasLegacyManager = Boolean(legacyManagerComment?.trim());
  const hasLegacyExecutor = Boolean(legacyExecutorComment?.trim());
  const hasFeed = comments.length > 0;

  if (!hasFeed && !hasLegacyManager && !hasLegacyExecutor) {
    return (
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-lg shadow-slate-200/50 sm:p-5">
        <h2 className="text-lg font-semibold tracking-tight text-slate-950">
          Комментарии
        </h2>
        <p className="mt-2 text-sm text-slate-500">Комментариев пока нет.</p>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-lg shadow-slate-200/50 sm:p-5">
      <h2 className="text-lg font-semibold tracking-tight text-slate-950">
        Комментарии
      </h2>

      <div className="mt-4 space-y-3">
        {hasLegacyManager ? (
          <article className="rounded-xl bg-amber-50 px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-amber-700">
              Диспетчер
            </p>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-amber-950">
              {legacyManagerComment}
            </p>
          </article>
        ) : null}

        {hasLegacyExecutor ? (
          <article className="rounded-xl bg-slate-50 px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
              Комментарий исполнителя
            </p>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">
              {legacyExecutorComment}
            </p>
          </article>
        ) : null}

        {comments.map((comment) => (
          <article
            className="rounded-xl border border-slate-100 bg-slate-50/80 px-4 py-3"
            key={comment.id}
          >
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="text-sm font-semibold text-slate-950">
                {comment.author_name}
              </p>
              <p className="text-xs text-slate-500">
                {timeFormatter.format(new Date(comment.created_at))}
              </p>
            </div>
            {comment.body.trim() ? (
              <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">
                {comment.body}
              </p>
            ) : null}
            {comment.photos.length > 0 ? (
              <div className="mt-3">
                <PhotoGallery photos={comment.photos} />
              </div>
            ) : null}
          </article>
        ))}
      </div>
    </section>
  );
}
