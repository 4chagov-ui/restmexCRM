import Link from "next/link";
import type { LocationListItem } from "@/lib/db/locations";
import { getPhoneHref } from "@/lib/phone";

const dateFormatter = new Intl.DateTimeFormat("ru-RU", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

function formatDate(value: string | null) {
  if (!value) {
    return "Нет заявок";
  }

  return dateFormatter.format(new Date(value));
}

type LocationCardProps = {
  location: LocationListItem;
};

export function LocationCard({ location }: LocationCardProps) {
  const subtitle = location.city || location.notes || "Район не указан";

  return (
    <article className="group relative overflow-hidden rounded-[1.5rem] border border-white/70 bg-white/90 p-5 shadow-lg shadow-slate-200/50 backdrop-blur transition duration-200 hover:-translate-y-1 hover:border-slate-300 hover:bg-white hover:shadow-2xl hover:shadow-slate-200/80">
      <Link
        aria-label={`Открыть заведение ${location.name}`}
        className="absolute inset-0 z-0"
        href={`/locations/${location.id}`}
      />
      <div className="grid gap-4 xl:grid-cols-[1fr_26rem] xl:items-center">
        <div className="relative z-10 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
              {subtitle}
            </span>
            {location.open_requests > 0 ? (
              <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-800 ring-1 ring-amber-200">
                Открытых: {location.open_requests}
              </span>
            ) : (
              <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 ring-1 ring-emerald-200">
                Нет открытых
              </span>
            )}
          </div>

          <h2 className="mt-3 truncate text-lg font-semibold tracking-tight text-slate-950">
            {location.name}
          </h2>
          <p className="mt-1 line-clamp-2 text-sm leading-6 text-slate-600">
            {location.address ?? "Адрес не указан"}
          </p>
          <p className="mt-1 text-sm text-slate-500">
            {location.contact || location.phone
              ? [location.contact, location.phone].filter(Boolean).join(" · ")
              : "Контакт не указан"}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {location.phone ? (
              <a
                className="relative z-20 inline-flex rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-950 shadow-sm transition hover:bg-slate-50"
                href={getPhoneHref(location.phone)}
              >
                Позвонить
              </a>
            ) : null}
            {location.yandex_maps_url ? (
              <a
                className="relative z-20 inline-flex rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-950 shadow-sm transition hover:bg-slate-50"
                href={location.yandex_maps_url}
                rel="noreferrer"
                target="_blank"
              >
                Открыть карту
              </a>
            ) : null}
            <Link
              className="relative z-20 inline-flex rounded-2xl bg-slate-950 px-3 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-slate-800"
              href={`/locations/${location.id}#edit`}
            >
              Редактировать
            </Link>
          </div>
        </div>

        <dl className="relative z-10 grid gap-2 text-sm sm:grid-cols-3">
          <div className="rounded-2xl bg-slate-50 px-3 py-2.5">
            <dt className="text-xs text-slate-500">Всего заявок</dt>
            <dd className="mt-1 font-semibold text-slate-950">
              {location.total_requests}
            </dd>
          </div>
          <div className="rounded-2xl bg-slate-50 px-3 py-2.5">
            <dt className="text-xs text-slate-500">Открытых</dt>
            <dd className="mt-1 font-semibold text-slate-950">
              {location.open_requests}
            </dd>
          </div>
          <div className="rounded-2xl bg-slate-50 px-3 py-2.5">
            <dt className="text-xs text-slate-500">Последняя</dt>
            <dd className="mt-1 font-semibold text-slate-950">
              {formatDate(location.last_request_at)}
            </dd>
          </div>
        </dl>
      </div>
    </article>
  );
}
