import type { TodayPlan } from "@/lib/db/today";

type TodaySummaryProps = {
  stats: TodayPlan["stats"];
};

const items: Array<{
  key: keyof TodayPlan["stats"];
  label: string;
  tone?: "dark" | "warning";
}> = [
  { key: "total", label: "Всего задач", tone: "dark" },
  { key: "unplanned", label: "Незапланированных" },
  { key: "inWork", label: "В работе" },
  { key: "done", label: "Выполненных" },
  { key: "overdue", label: "Просроченных", tone: "warning" },
];

export function TodaySummary({ stats }: TodaySummaryProps) {
  return (
    <section className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
      {items.map((item) => (
        <div
          className={`rounded-2xl border px-4 py-3 shadow-sm ${
            item.tone === "dark"
              ? "border-slate-950 bg-slate-950 text-white shadow-slate-300/60"
              : item.tone === "warning"
                ? "border-amber-200 bg-amber-50 text-amber-950"
                : "border-slate-200 bg-white/85 text-slate-950"
          }`}
          key={item.key}
        >
          <p
            className={`text-xs ${
              item.tone === "dark" ? "text-slate-300" : "text-slate-500"
            }`}
          >
            {item.label}
          </p>
          <p className="mt-1 text-2xl font-semibold tracking-tight tabular-nums">
            {stats[item.key]}
          </p>
        </div>
      ))}
    </section>
  );
}
