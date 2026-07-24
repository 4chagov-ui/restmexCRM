import { RequestReturnLink } from "@/components/navigation/request-return-link";
import { formatClosedTime } from "@/lib/plan/day-sections";
import type { WorkRequestItem } from "@/lib/db/work";

type WorkCompletedCardProps = {
  request: WorkRequestItem;
};

export function WorkCompletedCard({ request }: WorkCompletedCardProps) {
  const closedTime = formatClosedTime(request.closed_at);
  const responsible = request.assignees.find(
    (item) => item.role === "responsible",
  );
  const names = request.assignees.map(
    (item) => item.employee_name.split(" ")[0] ?? item.employee_name,
  );

  return (
    <article className="rounded-2xl border border-slate-200 bg-slate-50/90 p-4 text-slate-600 shadow-sm">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-semibold text-emerald-700">✓ Выполнено</span>
        {closedTime ? (
          <span className="text-sm font-semibold tabular-nums text-slate-500">
            {closedTime}
          </span>
        ) : null}
        <span className="rounded-lg bg-white px-2 py-0.5 text-xs font-semibold text-slate-500">
          #{request.request_number ?? "—"}
        </span>
      </div>

      <h2 className="mt-2 text-base font-semibold text-slate-700">
        {request.location?.name ?? "Заведение не указано"}
      </h2>
      <p className="mt-1 line-clamp-2 text-sm leading-5 text-slate-500">
        {request.description}
      </p>

      {request.is_collaborative ? (
        <p className="mt-2 text-xs leading-5 text-slate-500">
          ✓ Выполнено командой
          <br />
          {names.join(" · ")}
          {closedTime ? ` · Закрыто ${closedTime}` : ""}
        </p>
      ) : responsible || request.assignees[0] ? (
        <p className="mt-2 text-xs text-slate-500">
          Закрыто{" "}
          {(responsible ?? request.assignees[0])?.employee_name ?? "механиком"}
        </p>
      ) : null}

      <RequestReturnLink
        basePath="/work/requests"
        className="mt-3 inline-flex min-h-10 items-center justify-center rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-600"
        requestId={request.id}
      >
        Открыть
      </RequestReturnLink>
    </article>
  );
}
