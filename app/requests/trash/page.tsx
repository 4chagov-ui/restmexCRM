import Link from "next/link";
import { restoreFromTrashAction } from "@/app/requests/trash/actions";
import { RequestStatusBadge } from "@/components/requests/request-status-badge";
import { FormSubmitButton } from "@/components/ui/form-submit-button";
import { requireManagerUser } from "@/lib/auth/current-user";
import { getTrashedRequests } from "@/lib/db/trash";
import { MISSING_SOFT_DELETE_MESSAGE } from "@/lib/db/schema-errors";

export const dynamic = "force-dynamic";

const dateTimeFormatter = new Intl.DateTimeFormat("ru-RU", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

export default async function RequestsTrashPage() {
  await requireManagerUser();

  let items: Awaited<ReturnType<typeof getTrashedRequests>> = [];
  let setupError: string | null = null;

  try {
    items = await getTrashedRequests();
  } catch (error) {
    setupError =
      error instanceof Error ? error.message : MISSING_SOFT_DELETE_MESSAGE;
  }

  return (
    <main className="min-h-screen px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
        <header className="rounded-[2rem] border border-white/70 bg-white/85 p-6 shadow-xl shadow-slate-200/60 backdrop-blur sm:p-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
                CRM / Корзина
              </p>
              <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
                Корзина заявок
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
                Soft delete: записи остаются в базе. Восстановление возвращает
                заявку в журнал. Окончательное удаление в этой версии недоступно.
              </p>
            </div>
            <Link
              className="inline-flex h-11 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700"
              href="/requests"
            >
              К заявкам
            </Link>
          </div>
        </header>

        {setupError ? (
          <section className="rounded-[2rem] border border-amber-200 bg-amber-50 p-6 text-amber-950 shadow-sm">
            <h2 className="text-lg font-semibold">Нужна миграция базы</h2>
            <p className="mt-2 text-sm leading-6">{setupError}</p>
            <ol className="mt-4 list-decimal space-y-1 pl-5 text-sm leading-6">
              <li>Откройте Supabase → SQL Editor</li>
              <li>
                Выполните файл{" "}
                <code className="rounded bg-white/80 px-1.5 py-0.5">
                  SUPABASE_REQUESTS_SOFT_DELETE.sql
                </code>
              </li>
              <li>Обновите эту страницу</li>
            </ol>
          </section>
        ) : items.length === 0 ? (
          <section className="rounded-[2rem] border border-dashed border-slate-300 bg-white/85 p-10 text-center">
            <h2 className="text-xl font-semibold text-slate-950">Корзина пуста</h2>
            <p className="mt-2 text-sm text-slate-600">
              Перемещённые по ошибке заявки появятся здесь.
            </p>
          </section>
        ) : (
          <section className="grid gap-3">
            {items.map((item) => (
              <article
                className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5"
                key={item.id}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
                    #{item.request_number ?? "—"}
                  </span>
                  <RequestStatusBadge status={item.status} />
                </div>

                <h2 className="mt-3 text-lg font-semibold text-slate-950">
                  {item.location_name ?? "Заведение не указано"}
                </h2>
                <p className="mt-1 line-clamp-3 text-sm leading-6 text-slate-600">
                  {item.description}
                </p>

                <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
                  <div className="rounded-xl bg-slate-50 px-3 py-2">
                    <dt className="text-xs text-slate-500">Удалил</dt>
                    <dd className="font-medium text-slate-900">
                      {item.deleted_by_name ?? "Неизвестно"}
                    </dd>
                  </div>
                  <div className="rounded-xl bg-slate-50 px-3 py-2">
                    <dt className="text-xs text-slate-500">Когда</dt>
                    <dd className="font-medium text-slate-900">
                      {dateTimeFormatter.format(new Date(item.deleted_at))}
                    </dd>
                  </div>
                  <div className="rounded-xl bg-slate-50 px-3 py-2 sm:col-span-2">
                    <dt className="text-xs text-slate-500">Причина</dt>
                    <dd className="font-medium text-slate-900">
                      {item.deletion_reason ?? "—"}
                    </dd>
                  </div>
                  <div className="rounded-xl bg-slate-50 px-3 py-2 sm:col-span-2">
                    <dt className="text-xs text-slate-500">Исполнители</dt>
                    <dd className="font-medium text-slate-900">
                      {item.assignees_label || "Не назначены"}
                    </dd>
                  </div>
                </dl>

                <form action={restoreFromTrashAction} className="mt-4">
                  <input name="request_id" type="hidden" value={item.id} />
                  <FormSubmitButton
                    className="inline-flex h-11 items-center justify-center rounded-xl bg-emerald-600 px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
                    pendingLabel="Восстановление…"
                  >
                    Восстановить
                  </FormSubmitButton>
                </form>
              </article>
            ))}
          </section>
        )}
      </div>
    </main>
  );
}
