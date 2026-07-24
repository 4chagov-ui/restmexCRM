import type { RequestStatus } from "@/lib/db/requests";

const STATUS_LABELS: Record<RequestStatus, string> = {
  needs_planning: "Нужно запланировать",
  needs_review: "На проверке",
  planned: "Запланировано",
  in_progress: "В работе",
  waiting_client: "Ждём клиента",
  specialist_on_way: "Специалист в пути",
  waiting_parts: "Заказ запчастей",
  outsource: "Аутсорс",
  postponed: "Перенесено",
  done: "Выполнено",
  cancelled: "Отменено",
  duplicate: "Дубль",
  not_actual: "Неактуально",
};

const STATUS_STYLES: Record<RequestStatus, string> = {
  needs_planning: "bg-amber-50 text-amber-800 ring-amber-200",
  needs_review: "bg-amber-50 text-amber-700 ring-amber-200",
  planned: "bg-blue-50 text-blue-700 ring-blue-200",
  in_progress: "bg-violet-50 text-violet-700 ring-violet-200",
  waiting_client: "bg-orange-50 text-orange-700 ring-orange-200",
  specialist_on_way: "bg-cyan-50 text-cyan-700 ring-cyan-200",
  waiting_parts: "bg-amber-50 text-amber-900 ring-amber-300",
  outsource: "bg-fuchsia-50 text-fuchsia-800 ring-fuchsia-200",
  postponed: "bg-slate-100 text-slate-700 ring-slate-200",
  done: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  cancelled: "bg-rose-50 text-rose-700 ring-rose-200",
  duplicate: "bg-zinc-100 text-zinc-700 ring-zinc-200",
  not_actual: "bg-stone-100 text-stone-700 ring-stone-200",
};

type RequestStatusBadgeProps = {
  status: RequestStatus;
};

export function RequestStatusBadge({ status }: RequestStatusBadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${STATUS_STYLES[status]}`}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}
