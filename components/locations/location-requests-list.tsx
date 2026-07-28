import { RequestReturnLink } from "@/components/navigation/request-return-link";
import type { LocationRequestItem } from "@/lib/db/locations";
import { RequestStatusBadge } from "@/components/requests/request-status-badge";

const urgencyLabels: Record<string, string> = {
  low: "Низкая",
  normal: "Обычная",
  high: "Высокая",
  critical: "Критичная",
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

  return dateFormatter.format(new Date(value));
}

type LocationRequestsListProps = {
  requests: LocationRequestItem[];
  locationId: string;
};

export function LocationRequestsList({
  locationId,
  requests,
}: LocationRequestsListProps) {
  const returnPath = `/locations/${locationId}`;
  if (requests.length === 0) {
    return (
      <section className="rounded-[2rem] border border-dashed border-slate-300 bg-white/85 p-10 text-center shadow-xl shadow-slate-200/50 backdrop-blur">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-950 text-white">
          0
        </div>
        <h2 className="mt-5 text-xl font-semibold text-slate-950">
          Заявок по заведению пока нет
        </h2>
        <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-600">
          Создайте заявку и выберите это заведение, чтобы она появилась в истории.
        </p>
      </section>
    );
  }

  return (
    <section className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white/90 shadow-xl shadow-slate-200/60 backdrop-blur">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-100 text-left text-sm">
          <thead className="bg-slate-50/80 text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
            <tr>
              <th className="px-5 py-4">Заявка</th>
              <th className="px-5 py-4">Описание</th>
              <th className="px-5 py-4">Статус</th>
              <th className="px-5 py-4">Срочность</th>
              <th className="px-5 py-4">Ответственный</th>
              <th className="px-5 py-4">План</th>
              <th className="px-5 py-4">Создана</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {requests.map((request) => (
              <tr className="transition hover:bg-slate-50/80" key={request.id}>
                <td className="whitespace-nowrap px-5 py-4">
                  <RequestReturnLink
                    className="font-semibold text-slate-950 underline-offset-4 hover:underline"
                    requestId={request.id}
                    returnPath={returnPath}
                  >
                    #{request.request_number ?? "без номера"}
                  </RequestReturnLink>
                </td>
                <td className="min-w-0 max-w-xs px-5 py-4 sm:max-w-md">
                  <RequestReturnLink
                    className="line-clamp-2 text-slate-700 hover:text-slate-950"
                    requestId={request.id}
                    returnPath={returnPath}
                  >
                    {request.description}
                  </RequestReturnLink>
                </td>
                <td className="whitespace-nowrap px-5 py-4">
                  <RequestStatusBadge status={request.status} />
                </td>
                <td className="whitespace-nowrap px-5 py-4 font-medium text-slate-700">
                  {urgencyLabels[request.urgency] ?? request.urgency}
                </td>
                <td className="whitespace-nowrap px-5 py-4 text-slate-600">
                  {request.assigned_to_name ?? "Не назначен"}
                </td>
                <td className="whitespace-nowrap px-5 py-4 text-slate-600">
                  {formatDate(request.planned_date)}
                </td>
                <td className="whitespace-nowrap px-5 py-4 text-slate-600">
                  {formatDate(request.created_at)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
