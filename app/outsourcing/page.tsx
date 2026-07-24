import Link from "next/link";
import { returnFromOutsourceAction } from "@/app/outsourcing/actions";
import { RequestStatusBadge } from "@/components/requests/request-status-badge";
import { FormSubmitButton } from "@/components/ui/form-submit-button";
import { requireManagerUser } from "@/lib/auth/current-user";
import { getOutsourcedRequests } from "@/lib/db/outsource";
import { buildRequestHref } from "@/lib/navigation/return-to";

export const dynamic = "force-dynamic";

const dateFormatter = new Intl.DateTimeFormat("ru-RU", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

const outsourceStatusLabels: Record<string, string> = {
  sent: "Передано",
  in_progress: "В работе",
  completed: "Выполнено",
};

export default async function OutsourcingPage() {
  await requireManagerUser();
  const items = await getOutsourcedRequests();
  const returnPath = "/outsourcing";

  return (
    <main className="min-h-screen px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
        <header className="rounded-[2rem] border border-white/70 bg-white/85 p-6 shadow-xl shadow-slate-200/60 backdrop-blur sm:p-8">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
            CRM / Аутсорс
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
            Аутсорс
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
            Заявки, переданные внешним подрядчикам. Они не отображаются в планах
            и кабинетах внутренних механиков.
          </p>
        </header>

        {items.length === 0 ? (
          <section className="rounded-[2rem] border border-dashed border-slate-300 bg-white/85 p-10 text-center">
            <h2 className="text-xl font-semibold text-slate-950">
              Нет заявок на аутсорсе
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              Передайте заявку из карточки редактирования — «Передать на аутсорс».
            </p>
          </section>
        ) : (
          <section className="grid gap-3">
            {items.map((item) => (
              <article
                className="rounded-2xl border border-fuchsia-100 bg-white p-4 shadow-sm sm:p-5"
                key={item.id}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-fuchsia-50 px-2.5 py-1 text-xs font-semibold text-fuchsia-800">
                    Передано на аутсорс
                  </span>
                  <RequestStatusBadge status={item.status} />
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
                    {outsourceStatusLabels[item.outsource_status ?? "sent"] ??
                      "Передано"}
                  </span>
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
                    #{item.request_number ?? "—"}
                  </span>
                </div>

                <h2 className="mt-3 text-lg font-semibold text-slate-950">
                  {item.location_name ?? "Заведение не указано"}
                </h2>
                <p className="mt-1 line-clamp-3 text-sm leading-6 text-slate-600">
                  {item.description}
                </p>

                <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
                  <div className="rounded-xl bg-slate-50 px-3 py-2">
                    <dt className="text-xs text-slate-500">Подрядчик</dt>
                    <dd className="font-medium text-slate-900">
                      {item.outsource_contractor ?? "—"}
                    </dd>
                  </div>
                  <div className="rounded-xl bg-slate-50 px-3 py-2">
                    <dt className="text-xs text-slate-500">Контакт</dt>
                    <dd className="font-medium text-slate-900">
                      {item.outsource_contact ?? "—"}
                    </dd>
                  </div>
                  <div className="rounded-xl bg-slate-50 px-3 py-2">
                    <dt className="text-xs text-slate-500">Передано</dt>
                    <dd className="font-medium text-slate-900">
                      {item.outsourced_at
                        ? dateFormatter.format(new Date(item.outsourced_at))
                        : "—"}
                    </dd>
                  </div>
                  <div className="rounded-xl bg-slate-50 px-3 py-2">
                    <dt className="text-xs text-slate-500">Ожидаемый срок</dt>
                    <dd className="font-medium text-slate-900">
                      {item.outsource_expected_date
                        ? dateFormatter.format(
                            new Date(`${item.outsource_expected_date}T00:00:00`),
                          )
                        : "—"}
                    </dd>
                  </div>
                  {item.outsource_comment ? (
                    <div className="rounded-xl bg-slate-50 px-3 py-2 sm:col-span-2">
                      <dt className="text-xs text-slate-500">Комментарий</dt>
                      <dd className="font-medium text-slate-900">
                        {item.outsource_comment}
                      </dd>
                    </div>
                  ) : null}
                </dl>

                <div className="mt-4 flex flex-wrap gap-2">
                  <Link
                    className="inline-flex h-11 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-800"
                    href={buildRequestHref(item.id, returnPath)}
                  >
                    Открыть
                  </Link>
                  <form action={returnFromOutsourceAction}>
                    <input name="request_id" type="hidden" value={item.id} />
                    <input name="return_to" type="hidden" value={returnPath} />
                    <FormSubmitButton
                      className="inline-flex h-11 items-center justify-center rounded-xl bg-slate-950 px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
                      pendingLabel="Возврат…"
                    >
                      Вернуть во внутреннюю работу
                    </FormSubmitButton>
                  </form>
                </div>
              </article>
            ))}
          </section>
        )}
      </div>
    </main>
  );
}
