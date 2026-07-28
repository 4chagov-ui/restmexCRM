import Link from "next/link";
import { getLocalDateKey, shiftDateKey } from "@/lib/dates";

const dateFormatter = new Intl.DateTimeFormat("ru-RU", {
  weekday: "long",
  day: "2-digit",
  month: "long",
  year: "numeric",
});

type DateNavigationProps = {
  date: string;
};

export function DateNavigation({ date }: DateNavigationProps) {
  const currentDate = getLocalDateKey();

  return (
    <div className="flex min-w-0 flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <div className="min-w-0">
        <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600 shadow-sm">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
          CRM / План на сегодня
        </div>
        <h1 className="mt-5 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl lg:text-5xl">
          План на сегодня
        </h1>
        <p className="mt-4 break-words text-base leading-7 text-slate-600">
          {dateFormatter.format(new Date(`${date}T00:00:00`))}
        </p>
      </div>

      <div className="grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-3">
        <Link
          className="inline-flex w-full justify-center rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-950 shadow-sm transition hover:bg-slate-50"
          href={`/today?date=${shiftDateKey(date, -1)}`}
        >
          Предыдущий день
        </Link>
        <Link
          className="inline-flex w-full justify-center rounded-2xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-slate-300/80 transition hover:-translate-y-0.5 hover:bg-slate-800"
          href={`/today?date=${currentDate}`}
        >
          Сегодня
        </Link>
        <Link
          className="inline-flex w-full justify-center rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-950 shadow-sm transition hover:bg-slate-50"
          href={`/today?date=${shiftDateKey(date, 1)}`}
        >
          Следующий день
        </Link>
      </div>
    </div>
  );
}
