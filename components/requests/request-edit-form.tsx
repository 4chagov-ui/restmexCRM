import type { RequestAssignee } from "@/lib/db/assignees";
import type { EmployeeOption } from "@/lib/db/employees";
import type { RequestDetail, RequestStatus } from "@/lib/db/requests";
import { updateRequestAction } from "@/app/requests/[id]/actions";
import { MoveToTrashDialog } from "@/components/requests/move-to-trash-dialog";
import { RequestAssigneesFields } from "@/components/requests/request-assignees-fields";
import { RequestStatusBadge } from "@/components/requests/request-status-badge";
import { TransferToOutsourceDialog } from "@/components/requests/transfer-to-outsource-dialog";
import { FormSubmitButton } from "@/components/ui/form-submit-button";
import { returnFromOutsourceAction } from "@/app/outsourcing/actions";

const requestTypeLabels: Record<string, string> = {
  repair: "Ремонт",
  maintenance: "Обслуживание",
  installation: "Монтаж",
  diagnostics: "Диагностика",
  delivery: "Доставка",
  consultation: "Консультация",
  other: "Другое",
};

const urgencyLabels: Record<string, string> = {
  low: "Низкая",
  normal: "Обычная",
  high: "Высокая",
  critical: "Критичная",
};

const statusOptions: Array<{ value: RequestStatus; label: string }> = [
  { value: "needs_planning", label: "Нужно запланировать" },
  { value: "planned", label: "Запланировано" },
  { value: "in_progress", label: "В работе" },
  { value: "waiting_parts", label: "Заказ запчастей" },
  { value: "outsource", label: "Аутсорс" },
  { value: "waiting_client", label: "Ждём клиента" },
  { value: "specialist_on_way", label: "Специалист в пути" },
  { value: "done", label: "Выполнено" },
  { value: "postponed", label: "Перенесено" },
  { value: "cancelled", label: "Отменено" },
];

const fieldClassName =
  "mt-1.5 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 hover:border-slate-300 focus:border-slate-950 focus:ring-2 focus:ring-slate-950/5";

const textareaClassName =
  "mt-1.5 min-h-28 w-full resize-y rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm leading-6 text-slate-950 outline-none transition placeholder:text-slate-400 hover:border-slate-300 focus:border-slate-950 focus:ring-2 focus:ring-slate-950/5";

const labelClassName = "block text-xs font-medium text-slate-500";

const dateTimeFormatter = new Intl.DateTimeFormat("ru-RU", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

function formatDateTime(value: string | null) {
  if (!value) {
    return "Не указана";
  }

  return dateTimeFormatter.format(new Date(value));
}

function normalizeDate(value: string | null) {
  return value?.slice(0, 10) ?? "";
}

function normalizeTime(value: string | null) {
  return value?.slice(0, 5) ?? "";
}

function InfoItem({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="rounded-xl bg-slate-50 px-3 py-2.5">
      <dt className="text-xs font-medium text-slate-500">{label}</dt>
      <dd className="mt-0.5 text-sm font-semibold text-slate-950">{value}</dd>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-sm font-semibold tracking-tight text-slate-950">
      {children}
    </h2>
  );
}

type RequestEditFormProps = {
  request: RequestDetail;
  employees: EmployeeOption[];
  assignees?: RequestAssignee[];
  returnTo?: string | null;
  cancelHref?: string;
};

export function RequestEditForm({
  assignees = [],
  cancelHref = "/requests",
  employees,
  request,
  returnTo = null,
}: RequestEditFormProps) {
  const participantIds = assignees
    .filter((item) => item.role === "participant")
    .map((item) => item.employee_id);
  const responsibleId =
    assignees.find((item) => item.role === "responsible")?.employee_id ??
    request.assigned_to;

  return (
    <form
      action={updateRequestAction}
      className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_18rem]"
    >
      <input name="request_id" type="hidden" value={request.id} />
      <input name="request_type" type="hidden" value={request.request_type} />
      <input name="urgency" type="hidden" value={request.urgency} />
      {returnTo ? (
        <input name="return_to" type="hidden" value={returnTo} />
      ) : null}

      <div className="min-w-0 space-y-3">
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <SectionTitle>Основное</SectionTitle>

          <div className="mt-3 grid gap-3">
            <label className={labelClassName}>
              Описание
              <textarea
                className={`${textareaClassName} min-h-32`}
                defaultValue={request.description}
                name="description"
                required
              />
            </label>

            <label className={`${labelClassName} max-w-md`}>
              Статус
              <select
                className={fieldClassName}
                defaultValue={request.status}
                name="status"
              >
                {statusOptions.map((status) => (
                  <option key={status.value} value={status.value}>
                    {status.label}
                  </option>
                ))}
              </select>
            </label>

            <RequestAssigneesFields
              compact
              employees={employees}
              initialParticipantIds={participantIds}
              initialResponsibleId={responsibleId}
            />
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <SectionTitle>Планирование</SectionTitle>

          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <label className={labelClassName}>
              Плановая дата
              <input
                className={fieldClassName}
                defaultValue={normalizeDate(request.planned_date)}
                name="planned_date"
                type="date"
              />
            </label>

            <label className={labelClassName}>
              Начало
              <input
                className={fieldClassName}
                defaultValue={normalizeTime(request.start_time)}
                name="start_time"
                type="time"
              />
            </label>

            <label className={labelClassName}>
              Окончание
              <input
                className={fieldClassName}
                defaultValue={normalizeTime(request.end_time)}
                name="end_time"
                type="time"
              />
            </label>

            <label className={labelClassName}>
              Очередность
              <input
                className={fieldClassName}
                defaultValue={request.queue_position ?? ""}
                min="1"
                name="queue_position"
                type="number"
              />
            </label>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <SectionTitle>Комментарии</SectionTitle>

          <div className="mt-3 grid gap-3">
            <label className={labelClassName}>
              Комментарий диспетчера
              <textarea
                className={textareaClassName}
                defaultValue={request.manager_comment ?? ""}
                name="manager_comment"
                placeholder="Что важно учесть при планировании"
              />
            </label>

            <label className={labelClassName}>
              Комментарий механика
              <textarea
                className={textareaClassName}
                defaultValue={request.executor_comment ?? ""}
                name="executor_comment"
                placeholder="Что сделал механик или что осталось"
              />
            </label>
          </div>
        </section>

        <div className="sticky bottom-3 z-10 flex flex-col-reverse gap-2 rounded-2xl border border-slate-200 bg-white/95 p-3 shadow-lg shadow-slate-200/50 backdrop-blur sm:flex-row sm:items-center sm:justify-between">
          <MoveToTrashDialog
            requestId={request.id}
            requestNumber={request.request_number}
            returnTo={cancelHref}
          />
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <a
              className="inline-flex h-11 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              href={cancelHref}
            >
              Отмена
            </a>
            <FormSubmitButton
              className="inline-flex h-11 items-center justify-center rounded-xl bg-slate-950 px-5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
              pendingLabel="Сохранение…"
            >
              Сохранить изменения
            </FormSubmitButton>
          </div>
        </div>
      </div>

      <aside className="space-y-3">
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-semibold text-slate-950">Сводка</p>
            <RequestStatusBadge status={request.status} />
          </div>

          <dl className="mt-3 grid gap-2">
            <InfoItem
              label="Тип"
              value={
                requestTypeLabels[request.request_type] ?? request.request_type
              }
            />
            <InfoItem
              label="Срочность"
              value={urgencyLabels[request.urgency] ?? request.urgency}
            />
            <InfoItem
              label="Ответственный"
              value={
                request.is_collaborative
                  ? request.assignees_label
                  : (request.assigned_to_name ?? "Не назначен")
              }
            />
            <InfoItem
              label="Создана"
              value={formatDateTime(request.created_at)}
            />
            <InfoItem
              label="Закрыта"
              value={formatDateTime(request.closed_at)}
            />
          </dl>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium text-slate-500">Заведение</p>
          <p className="mt-1 text-sm font-semibold text-slate-950">
            {request.location?.name ?? "Не указано"}
          </p>
          <p className="mt-1 text-sm leading-5 text-slate-500">
            {request.location?.address ?? "Адрес не указан"}
          </p>
        </section>

        <section className="rounded-2xl border border-fuchsia-100 bg-fuchsia-50/40 p-4 shadow-sm">
          <p className="text-sm font-semibold text-slate-950">Аутсорс</p>
          {request.status === "outsource" ? (
            <form action={returnFromOutsourceAction} className="mt-3">
              <input name="request_id" type="hidden" value={request.id} />
              <input name="return_to" type="hidden" value={cancelHref} />
              <p className="mb-3 text-xs leading-5 text-slate-600">
                Заявка у внешнего подрядчика. Возврат переведёт её в «Нужно
                запланировать» без автоназначения механиков.
              </p>
              <FormSubmitButton
                className="inline-flex h-11 w-full items-center justify-center rounded-xl bg-slate-950 px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
                pendingLabel="Возврат…"
              >
                Вернуть во внутреннюю работу
              </FormSubmitButton>
            </form>
          ) : (
            <div className="mt-3">
              <TransferToOutsourceDialog
                requestId={request.id}
                requestNumber={request.request_number}
                returnTo="/outsourcing"
              />
            </div>
          )}
        </section>
      </aside>
    </form>
  );
}
