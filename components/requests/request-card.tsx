import type { RequestListItem } from "@/lib/db/requests";
import { RequestReturnLink } from "@/components/navigation/request-return-link";
import { RequestStatusBadge } from "@/components/requests/request-status-badge";

const urgencyLabels: Record<string, string> = {
  low: "Низкая",
  normal: "Обычная",
  high: "Высокая",
  critical: "Критичная",
};

const urgencyStyles: Record<string, string> = {
  low: "bg-slate-50 text-slate-600 ring-slate-200",
  normal: "bg-blue-50 text-blue-700 ring-blue-200",
  high: "bg-orange-50 text-orange-700 ring-orange-200",
  critical: "bg-rose-50 text-rose-700 ring-rose-200",
};

const dateFormatter = new Intl.DateTimeFormat("ru-RU", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

function formatDate(value: string | null) {
  if (!value) {
    return "Не назначена";
  }

  const [year, month, day] = value.split("-").map(Number);

  if (!year || !month || !day) {
    return value;
  }

  return dateFormatter.format(new Date(year, month - 1, day));
}

function formatTimeRange(startTime: string | null, endTime: string | null) {
  if (!startTime && !endTime) {
    return null;
  }

  const start = startTime?.slice(0, 5) ?? "??:??";
  const end = endTime?.slice(0, 5) ?? "??:??";

  return `${start} - ${end}`;
}

type RequestCardProps = {
  request: RequestListItem;
};

export function RequestCard({ request }: RequestCardProps) {
  const timeRange = formatTimeRange(request.start_time, request.end_time);
  const mechanicName = request.is_collaborative
    ? request.assignees_label
    : (request.assigned_to_name ?? "Не назначен");

  return (
    <RequestReturnLink
      className="group block rounded-[1.5rem] border border-white/70 bg-white/90 p-4 shadow-lg shadow-slate-200/50 backdrop-blur transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-xl hover:shadow-slate-200/80 sm:p-5"
      requestId={request.id}
    >
      <div className="grid gap-4 xl:grid-cols-[1fr_34rem] xl:items-center">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
              #{request.request_number ?? "без номера"}
            </span>
            <RequestStatusBadge status={request.status} />
            <span
              className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${
                urgencyStyles[request.urgency] ?? urgencyStyles.normal
              }`}
            >
              {urgencyLabels[request.urgency] ?? request.urgency}
            </span>
          </div>

          <h2 className="mt-3 truncate text-base font-semibold tracking-tight text-slate-950 sm:text-lg">
            {request.location?.name ?? "Заведение не указано"}
          </h2>
          <p className="mt-1 line-clamp-2 text-sm leading-6 text-slate-600">
            {request.description}
          </p>
          {request.location?.address ? (
            <p className="mt-1 truncate text-xs text-slate-400">
              {request.location.address}
            </p>
          ) : null}
        </div>

        <dl className="grid gap-2 text-sm sm:grid-cols-3 xl:grid-cols-4">
          <div className="rounded-2xl bg-slate-50 px-3 py-2.5">
            <dt className="text-xs text-slate-500">Плановая дата</dt>
            <dd className="mt-1 font-medium text-slate-950">
              {formatDate(request.planned_date)}
            </dd>
          </div>
          <div className="rounded-2xl bg-slate-50 px-3 py-2.5">
            <dt className="text-xs text-slate-500">Время</dt>
            <dd className="mt-1 font-medium text-slate-950">
              {timeRange ?? "Не указано"}
            </dd>
          </div>
          <div className="rounded-2xl bg-slate-50 px-3 py-2.5">
            <dt className="text-xs text-slate-500">
              {request.is_collaborative ? "👥 Механики" : "Механик"}
            </dt>
            <dd
              className="mt-1 truncate font-medium text-slate-950"
              title={request.assignees
                .map((item) => item.employee_name)
                .join(", ")}
            >
              {mechanicName}
            </dd>
          </div>
          <div className="rounded-2xl bg-slate-50 px-3 py-2.5 sm:col-span-3 xl:col-span-1">
            <dt className="text-xs text-slate-500">Создана</dt>
            <dd className="mt-1 font-medium text-slate-950">
              {formatDate(request.created_at.slice(0, 10))}
            </dd>
          </div>
        </dl>
      </div>
    </RequestReturnLink>
  );
}
