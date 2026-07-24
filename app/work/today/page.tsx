import { Suspense } from "react";
import { RestoreScroll } from "@/components/navigation/restore-scroll";
import { WorkDateNavigation } from "@/components/work/work-date-navigation";
import { WorkTaskList } from "@/components/work/work-task-list";
import { requireMechanicUser } from "@/lib/auth/current-user";
import { getMechanicToday } from "@/lib/db/work";
import {
  getLocalDateKey,
  normalizeTodayDate,
  shiftDateKey,
} from "@/lib/dates";

export const dynamic = "force-dynamic";

type WorkTodayPageProps = {
  searchParams: Promise<{
    date?: string;
  }>;
};

export default async function WorkTodayPage({ searchParams }: WorkTodayPageProps) {
  const context = await requireMechanicUser();
  const params = await searchParams;
  const date = normalizeTodayDate(params.date);
  const today = getLocalDateKey();
  const tomorrow = shiftDateKey(today, 1);
  const requests = await getMechanicToday(context.employee.id, date);

  const emptyTitle =
    date === today
      ? "На сегодня задач нет"
      : date === tomorrow
        ? "На завтра задач нет"
        : "На этот день задач нет";

  return (
    <main className="min-h-screen px-3 py-4 sm:px-4 lg:px-6">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
        <Suspense fallback={null}>
          <RestoreScroll />
        </Suspense>
        <header className="rounded-2xl border border-white/70 bg-white/90 p-4 shadow-xl shadow-slate-200/60 backdrop-blur sm:p-5">
          <WorkDateNavigation
            date={date}
            employeeName={context.employee.name}
          />
        </header>

        <Suspense fallback={null}>
          <WorkTaskList
            emptyText="Показаны заявки, где вы ответственный или участник."
            emptyTitle={emptyTitle}
            requests={requests}
            selectedDate={date}
            showCompletedToday
          />
        </Suspense>
      </div>
    </main>
  );
}
