import Link from "next/link";
import { Suspense } from "react";
import { RestoreScroll } from "@/components/navigation/restore-scroll";
import { RequestCard } from "@/components/requests/request-card";
import {
  mechanicFilterOptions,
  type MechanicFilter,
  RequestsToolbar,
} from "@/components/requests/requests-toolbar";
import { requireManagerUser } from "@/lib/auth/current-user";
import {
  getRequests,
  getRequestsDashboardStats,
  REQUESTS_PAGE_SIZE,
  type MechanicListFilter,
} from "@/lib/db/requests";

export const dynamic = "force-dynamic";

type RequestsPageProps = {
  searchParams: Promise<{
    mechanic?: string;
    q?: string;
    page?: string;
  }>;
};

function getMechanicFilter(value: string | undefined): MechanicFilter {
  const knownValue = mechanicFilterOptions.some((option) => option.value === value);

  return knownValue ? (value as MechanicFilter) : "all";
}

function StatCard({
  label,
  value,
  tone = "light",
}: {
  label: string;
  value: number;
  tone?: "dark" | "light";
}) {
  return (
    <div
      className={`rounded-3xl border px-5 py-4 shadow-sm ${
        tone === "dark"
          ? "border-slate-950 bg-slate-950 text-white shadow-slate-300/60"
          : "border-slate-200 bg-white/85 text-slate-950"
      }`}
    >
      <p
        className={`text-sm ${
          tone === "dark" ? "text-slate-300" : "text-slate-500"
        }`}
      >
        {label}
      </p>
      <p className="mt-2 text-3xl font-semibold tracking-tight">{value}</p>
    </div>
  );
}

function buildPageHref(input: {
  page: number;
  search?: string;
  mechanic: MechanicFilter;
}) {
  const params = new URLSearchParams();
  if (input.search) {
    params.set("q", input.search);
  }
  if (input.mechanic !== "all") {
    params.set("mechanic", input.mechanic);
  }
  if (input.page > 1) {
    params.set("page", String(input.page));
  }
  const query = params.toString();
  return query ? `/requests?${query}` : "/requests";
}

export default async function RequestsPage({ searchParams }: RequestsPageProps) {
  await requireManagerUser();

  const {
    mechanic: mechanicParam,
    q,
    page: pageParam,
  } = await searchParams;
  const search = q?.trim() || undefined;
  const mechanic = getMechanicFilter(mechanicParam);
  const page = Math.max(Number.parseInt(pageParam ?? "1", 10) || 1, 1);

  const [{ items, total, pageSize }, stats] = await Promise.all([
    getRequests({
      search,
      mechanic: mechanic as MechanicListFilter,
      page,
      pageSize: REQUESTS_PAGE_SIZE,
    }),
    getRequestsDashboardStats(search),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, totalPages);
  const from = total === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const to = Math.min(safePage * pageSize, total);

  return (
    <main className="min-h-screen px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
        <Suspense fallback={null}>
          <RestoreScroll />
        </Suspense>
        <header className="overflow-hidden rounded-[2rem] border border-white/70 bg-white/85 p-6 shadow-2xl shadow-slate-200/70 backdrop-blur sm:p-8">
          <div className="grid gap-6 xl:grid-cols-[1fr_35rem] xl:items-end">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600 shadow-sm">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                CRM / Requests
              </div>
              <h1 className="mt-5 text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl">
                Заявки
              </h1>
              <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600">
                Общий список заявок из Supabase. Текущие задачи, план на сегодня
                и аутсорс остаются отдельными представлениями над этой же таблицей.
              </p>
              <Link
                className="mt-4 inline-flex h-10 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700"
                href="/requests/trash"
              >
                Корзина
              </Link>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <StatCard label="Всего заявок" tone="dark" value={stats.total} />
              <StatCard
                label="Нужно запланировать"
                value={stats.needsPlanning}
              />
              <StatCard label="Сегодня в работе" value={stats.todayInWork} />
              <StatCard label="Выполнено" value={stats.done} />
            </div>
          </div>
        </header>

        <RequestsToolbar mechanic={mechanic} search={search} />

        {items.length > 0 ? (
          <Suspense
            fallback={
              <section className="grid gap-3">
                <div className="h-24 animate-pulse rounded-2xl bg-slate-100" />
              </section>
            }
          >
            <section className="grid gap-3">
              {items.map((request) => (
                <RequestCard key={request.id} request={request} />
              ))}
            </section>
          </Suspense>
        ) : (
          <section className="rounded-[2rem] border border-dashed border-slate-300 bg-white/85 p-10 text-center shadow-xl shadow-slate-200/50 backdrop-blur">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-950 text-white">
              0
            </div>
            <h2 className="mt-5 text-xl font-semibold text-slate-950">
              Заявок не найдено
            </h2>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-600">
              Попробуйте изменить поиск или фильтр по механику. Страница
              показывает только реальные данные из таблицы <code>requests</code>.
            </p>
          </section>
        )}

        {total > 0 ? (
          <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white/85 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-slate-600">
              Показано {from}–{to} из {total}
            </p>
            <div className="flex gap-2">
              {safePage > 1 ? (
                <Link
                  className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700"
                  href={buildPageHref({
                    page: safePage - 1,
                    search,
                    mechanic,
                  })}
                >
                  Назад
                </Link>
              ) : null}
              {safePage < totalPages ? (
                <Link
                  className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700"
                  href={buildPageHref({
                    page: safePage + 1,
                    search,
                    mechanic,
                  })}
                >
                  Дальше
                </Link>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>
    </main>
  );
}
