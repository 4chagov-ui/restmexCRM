import { RequestReturnLink } from "@/components/navigation/request-return-link";
import { formatClosedTime } from "@/lib/plan/day-sections";
import type { TodayRequestItem } from "@/lib/db/today";

type TodayCompletedCardProps = {
  request: TodayRequestItem;
  selectedDate: string;
};

export function TodayCompletedCard({
  request,
  selectedDate,
}: TodayCompletedCardProps) {
  const closedTime = formatClosedTime(request.closed_at);
  const names = request.assignees.map(
    (item) => item.employee_name.split(" ")[0] ?? item.employee_name,
  );

  return (
    <article
      className="rounded-xl border border-slate-200 bg-slate-50/90 p-2.5 text-slate-600"
      data-request-id={request.id}
    >
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-[11px] font-semibold text-emerald-700">
          ✓ Выполнено
        </span>
        {closedTime ? (
          <span className="text-[11px] font-semibold tabular-nums text-slate-500">
            {closedTime}
          </span>
        ) : null}
        <span className="rounded-md bg-white px-1.5 py-0.5 text-[10px] font-semibold text-slate-500">
          #{request.request_number ?? "—"}
        </span>
      </div>

      <h3 className="mt-1 truncate text-sm font-semibold text-slate-700">
        {request.location?.name ?? "Заведение не указано"}
      </h3>

      {request.is_collaborative ? (
        <p className="mt-1 text-[11px] leading-4 text-slate-500">
          ✓ Команда: {names.join(", ")}
        </p>
      ) : request.assigned_to_name ? (
        <p className="mt-1 text-[11px] text-slate-500">
          Закрыто {request.assigned_to_name.split(" ")[0]}
        </p>
      ) : null}

      <RequestReturnLink
        className="mt-1.5 inline-flex text-[11px] font-semibold text-slate-600 underline-offset-2 hover:underline"
        requestId={request.id}
        returnPath={`/today?date=${selectedDate}`}
      >
        Открыть
      </RequestReturnLink>
    </article>
  );
}
