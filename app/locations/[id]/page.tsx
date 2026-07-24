import Link from "next/link";
import { notFound } from "next/navigation";
import { LocationForm } from "@/components/locations/location-form";
import { LocationRequestsList } from "@/components/locations/location-requests-list";
import { updateLocationAction } from "@/app/locations/[id]/actions";
import { requireManagerUser } from "@/lib/auth/current-user";
import { getLocationById } from "@/lib/db/locations";
import { getPhoneHref } from "@/lib/phone";

export const dynamic = "force-dynamic";

type LocationDetailPageProps = {
  params: Promise<{
    id: string;
  }>;
  searchParams: Promise<{
    created?: string;
    saved?: string;
  }>;
};

const dateFormatter = new Intl.DateTimeFormat("ru-RU", {
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

  return dateFormatter.format(new Date(value));
}

function formatDate(value: string | null) {
  if (!value) {
    return "Не указана";
  }

  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(value));
}

function InfoCard({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl bg-slate-50 px-4 py-3">
      <dt className="text-xs font-medium text-slate-500">{label}</dt>
      <dd className="mt-1 text-sm font-semibold text-slate-950">{value}</dd>
    </div>
  );
}

export default async function LocationDetailPage({
  params,
  searchParams,
}: LocationDetailPageProps) {
  await requireManagerUser();

  const { id } = await params;
  const { created, saved } = await searchParams;
  const location = await getLocationById(id);

  if (!location) {
    notFound();
  }

  const successMessage =
    created === "1"
      ? "Заведение создано"
      : saved === "1"
        ? "Изменения сохранены"
        : null;

  return (
    <main className="min-h-screen px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
        {successMessage ? (
          <div className="rounded-3xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm font-medium text-emerald-800 shadow-sm">
            {successMessage}
          </div>
        ) : null}

        <header className="overflow-hidden rounded-[2rem] border border-white/70 bg-white/85 p-6 shadow-2xl shadow-slate-200/70 backdrop-blur sm:p-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600 shadow-sm">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                CRM / Заведение
              </div>
              <h1 className="mt-5 text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl">
                {location.name}
              </h1>
              <p className="mt-4 max-w-3xl text-base leading-7 text-slate-600">
                {location.address ?? "Адрес не указан"}
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              {location.phone ? (
                <a
                  className="inline-flex justify-center rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-950 shadow-sm transition hover:bg-slate-50"
                  href={getPhoneHref(location.phone)}
                >
                  Позвонить
                </a>
              ) : null}
              {location.yandex_maps_url ? (
                <a
                  className="inline-flex justify-center rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-950 shadow-sm transition hover:bg-slate-50"
                  href={location.yandex_maps_url}
                  rel="noreferrer"
                  target="_blank"
                >
                  Открыть Яндекс Карты
                </a>
              ) : null}
              <Link
                className="inline-flex justify-center rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-950 shadow-sm transition hover:bg-slate-50"
                href={`/requests/new?locationId=${location.id}`}
              >
                Новая заявка
              </Link>
              <a
                className="inline-flex justify-center rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-slate-300/80 transition hover:-translate-y-0.5 hover:bg-slate-800"
                href="#edit"
              >
                Редактировать
              </a>
              <Link
                className="inline-flex justify-center rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-950 shadow-sm transition hover:bg-slate-50"
                href="/locations"
              >
                К списку
              </Link>
            </div>
          </div>
        </header>

        <section className="grid gap-6 xl:grid-cols-[1fr_22rem]">
          <div className="rounded-[2rem] border border-slate-200 bg-white/90 p-5 shadow-xl shadow-slate-200/60 backdrop-blur sm:p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-slate-950">Сведения</p>
                <p className="mt-1 text-sm leading-6 text-slate-500">
                  Контактная информация и рабочие детали объекта.
                </p>
              </div>
              {location.yandex_maps_url ? (
                <a
                  className="inline-flex justify-center rounded-2xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-slate-300/80 transition hover:-translate-y-0.5 hover:bg-slate-800"
                  href={location.yandex_maps_url}
                  rel="noreferrer"
                  target="_blank"
                >
                  Открыть в Яндекс Картах
                </a>
              ) : null}
            </div>

            <dl className="mt-5 grid gap-3 md:grid-cols-2">
              <InfoCard label="Контакт" value={location.contact ?? "Не указан"} />
              <InfoCard label="Телефон" value={location.phone ?? "Не указан"} />
              <InfoCard
                label="Режим работы"
                value={location.working_hours ?? "Не указан"}
              />
              <InfoCard
                label="Дата создания"
                value={formatDateTime(location.created_at)}
              />
              <InfoCard
                label="Примечание"
                value={location.notes ?? "Нет примечания"}
              />
              <InfoCard
                label="Ссылка на Яндекс Карты"
                value={
                  location.yandex_maps_url ? (
                    <a
                      className="text-blue-700 hover:text-blue-900"
                      href={location.yandex_maps_url}
                      rel="noreferrer"
                      target="_blank"
                    >
                      Открыть ссылку
                    </a>
                  ) : (
                    "Не указана"
                  )
                }
              />
            </dl>
          </div>

          <aside className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
            <InfoCard label="Всего заявок" value={location.total_requests} />
            <InfoCard label="Открытых" value={location.open_requests} />
            <InfoCard label="Выполнено" value={location.completed_requests} />
            <InfoCard label="Просроченных" value={location.overdue_requests} />
            <InfoCard label="Последний визит" value={formatDate(location.last_visit_at)} />
            <InfoCard label="Следующий визит" value={formatDate(location.next_visit_at)} />
            <InfoCard
              label="Последний механик"
              value={location.last_mechanic_name ?? "Не указан"}
            />
          </aside>
        </section>

        <section className="grid gap-4" id="edit">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight text-slate-950">
              Редактирование
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Изменения сохраняются напрямую в Supabase через Server Action.
            </p>
          </div>
          <LocationForm
            action={updateLocationAction}
            location={location}
            submitLabel="Сохранить изменения"
          />
        </section>

        <section className="grid gap-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-2xl font-semibold tracking-tight text-slate-950">
                Заявки заведения
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Новые и открытые заявки выводятся выше завершенных.
              </p>
            </div>
            <Link
              className="inline-flex justify-center rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-950 shadow-sm transition hover:bg-slate-50"
              href={`/requests/new?locationId=${location.id}`}
            >
              Новая заявка
            </Link>
          </div>
          <LocationRequestsList
            locationId={location.id}
            requests={location.requests}
          />
        </section>
      </div>
    </main>
  );
}
