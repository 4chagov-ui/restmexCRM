import { Suspense } from "react";
import { RestoreScroll } from "@/components/navigation/restore-scroll";
import { DateNavigation } from "@/components/today/date-navigation";
import { TodayWorkspace } from "@/components/today/today-workspace";
import { requireManagerUser } from "@/lib/auth/current-user";
import { getTodayPlan, normalizeTodayDate } from "@/lib/db/today";

export const dynamic = "force-dynamic";

type TodayPageProps = {
  searchParams: Promise<{
    date?: string;
  }>;
};

export default async function TodayPage({ searchParams }: TodayPageProps) {
  await requireManagerUser();

  const params = await searchParams;
  const date = normalizeTodayDate(params.date);
  const plan = await getTodayPlan(date);

  return (
    <main className="min-h-screen px-3 py-4 sm:px-4 lg:px-5">
      <div className="flex w-full flex-col gap-4">
        <Suspense fallback={null}>
          <RestoreScroll />
        </Suspense>
        <header className="overflow-hidden rounded-2xl border border-white/70 bg-white/85 p-4 shadow-xl shadow-slate-200/60 backdrop-blur sm:p-5">
          <DateNavigation date={date} />
        </header>

        <TodayWorkspace
          hasEmployees={plan.employees.length > 0}
          plan={plan}
        />
      </div>
    </main>
  );
}
