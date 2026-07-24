"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { getLocalDateKey, shiftDateKey } from "@/lib/dates";

const dateFormatter = new Intl.DateTimeFormat("ru-RU", {
  weekday: "long",
  day: "2-digit",
  month: "long",
  year: "numeric",
});

type WorkDateNavigationProps = {
  date: string;
  employeeName: string;
};

export function WorkDateNavigation({
  date,
  employeeName,
}: WorkDateNavigationProps) {
  const router = useRouter();
  const today = getLocalDateKey();
  const tomorrow = shiftDateKey(today, 1);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600 shadow-sm">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
          Рабочее место
        </div>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
          Мой план
        </h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          {employeeName} · {dateFormatter.format(new Date(`${date}T00:00:00`))}
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Link
          className="inline-flex min-h-11 flex-1 items-center justify-center rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-950 sm:flex-none"
          href={`/work/today?date=${shiftDateKey(date, -1)}`}
        >
          Предыдущий день
        </Link>
        <Link
          className={`inline-flex min-h-11 flex-1 items-center justify-center rounded-xl px-3 py-2.5 text-sm font-semibold sm:flex-none ${
            date === today
              ? "bg-slate-950 text-white"
              : "border border-slate-200 bg-white text-slate-950"
          }`}
          href={`/work/today?date=${today}`}
        >
          Сегодня
        </Link>
        <Link
          className={`inline-flex min-h-11 flex-1 items-center justify-center rounded-xl px-3 py-2.5 text-sm font-semibold sm:flex-none ${
            date === tomorrow
              ? "bg-emerald-600 text-white"
              : "border border-emerald-200 bg-emerald-50 text-emerald-900"
          }`}
          href={`/work/today?date=${tomorrow}`}
        >
          Завтра
        </Link>
        <Link
          className="inline-flex min-h-11 flex-1 items-center justify-center rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-950 sm:flex-none"
          href={`/work/today?date=${shiftDateKey(date, 1)}`}
        >
          Следующий день
        </Link>
      </div>

      <label className="text-sm font-medium text-slate-700">
        Выбрать дату
        <input
          className="mt-2 min-h-12 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-base text-slate-950 shadow-sm outline-none focus:border-slate-950 focus:ring-4 focus:ring-slate-950/5"
          defaultValue={date}
          onChange={(event) => {
            const value = event.target.value;

            if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
              router.push(`/work/today?date=${value}`);
            }
          }}
          type="date"
        />
      </label>
    </div>
  );
}
