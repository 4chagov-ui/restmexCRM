import Link from "next/link";
import { Suspense } from "react";
import { RestoreScroll } from "@/components/navigation/restore-scroll";
import { WorkTaskList } from "@/components/work/work-task-list";
import { requireMechanicUser } from "@/lib/auth/current-user";
import { getMechanicRequests, type WorkRequestFilter } from "@/lib/db/work";

export const dynamic = "force-dynamic";

type WorkRequestsPageProps = {
  searchParams: Promise<{
    filter?: string;
  }>;
};

const filters: Array<{ value: WorkRequestFilter; label: string }> = [
  { value: "all", label: "Все мои" },
  { value: "responsible", label: "Я ответственный" },
  { value: "participant", label: "Я участник" },
  { value: "today", label: "Сегодня" },
  { value: "tomorrow", label: "Завтра" },
  { value: "upcoming", label: "Предстоящие" },
  { value: "in_progress", label: "В работе" },
  { value: "waiting_parts", label: "Заказ запчастей" },
  { value: "done", label: "Выполненные" },
];

export default async function WorkRequestsPage({
  searchParams,
}: WorkRequestsPageProps) {
  const context = await requireMechanicUser();
  const { filter: filterParam } = await searchParams;
  const filter = filters.some((item) => item.value === filterParam)
    ? (filterParam as WorkRequestFilter)
    : "all";
  const requests = await getMechanicRequests(context.employee.id, filter);
  const hideWhenDone =
    filter !== "done" &&
    filter !== "all" &&
    filter !== "responsible" &&
    filter !== "participant";

  return (
    <main className="min-h-screen px-3 py-4 sm:px-4 lg:px-6">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
        <Suspense fallback={null}>
          <RestoreScroll />
        </Suspense>
        <header className="rounded-2xl border border-white/70 bg-white/90 p-4 shadow-xl shadow-slate-200/60 backdrop-blur sm:p-5">
          <h1 className="text-3xl font-semibold tracking-tight text-slate-950">
            Мои задачи
          </h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Заявки, где {context.employee.name} — ответственный или участник.
          </p>
        </header>

        <nav className="flex gap-2 overflow-x-auto rounded-2xl border border-slate-200 bg-white/90 p-2 shadow-lg shadow-slate-200/40">
          {filters.map((item) => (
            <Link
              className={`shrink-0 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${
                filter === item.value
                  ? "bg-slate-950 text-white"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-950"
              }`}
              href={`/work/requests?filter=${item.value}`}
              key={item.value}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <Suspense fallback={null}>
          <WorkTaskList
            emptyText="В этом фильтре нет ваших задач."
            emptyTitle="Заявок не найдено"
            hideWhenDone={hideWhenDone}
            requests={
              hideWhenDone
                ? requests.filter((request) => request.status !== "done")
                : requests
            }
          />
        </Suspense>
      </div>
    </main>
  );
}
