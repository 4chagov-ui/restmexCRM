import Link from "next/link";

export const mechanicFilterOptions = [
  { value: "all", label: "Все" },
  { value: "ivan", label: "Иван" },
  { value: "nikita", label: "Никита" },
  { value: "maxim", label: "Максим" },
  { value: "unassigned", label: "Не назначен" },
] as const;

export type MechanicFilter = (typeof mechanicFilterOptions)[number]["value"];

type RequestsToolbarProps = {
  search?: string;
  mechanic: MechanicFilter;
};

export function RequestsToolbar({ mechanic, search }: RequestsToolbarProps) {
  return (
    <div className="rounded-[1.75rem] border border-white/70 bg-white/85 p-3 shadow-xl shadow-slate-200/60 backdrop-blur">
      <form
        action="/requests"
        className="grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-[1fr_13rem_auto_auto]"
      >
        <label className="sr-only" htmlFor="request-search">
          Поиск заявок
        </label>
        <input
          className="w-full min-w-0 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-950 shadow-sm outline-none transition placeholder:text-slate-400 hover:border-slate-300 focus:border-slate-950 focus:ring-4 focus:ring-slate-950/5 sm:col-span-2 lg:col-span-1"
          defaultValue={search}
          id="request-search"
          name="q"
          placeholder="Поиск по описанию, названию или автору"
          type="search"
        />

        <label className="sr-only" htmlFor="mechanic-filter">
          Фильтр по механику
        </label>
        <select
          className="w-full min-w-0 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 shadow-sm outline-none transition hover:border-slate-300 focus:border-slate-950 focus:ring-4 focus:ring-slate-950/5"
          defaultValue={mechanic}
          id="mechanic-filter"
          name="mechanic"
        >
          {mechanicFilterOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>

        <button
          className="w-full rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-slate-300/70 transition hover:-translate-y-0.5 hover:bg-slate-800 sm:w-auto"
          type="submit"
        >
          Найти
        </button>

        <Link
          className="inline-flex w-full justify-center rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-950 shadow-sm transition hover:bg-slate-50 sm:w-auto"
          href="/requests/new"
        >
          Новая заявка
        </Link>
      </form>
    </div>
  );
}
