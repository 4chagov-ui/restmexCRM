import { requireMechanicUser } from "@/lib/auth/current-user";
import { getWorkLocations } from "@/lib/db/work";
import { getPhoneHref } from "@/lib/phone";

export const dynamic = "force-dynamic";

export default async function WorkLocationsPage() {
  await requireMechanicUser();
  const locations = await getWorkLocations();

  return (
    <main className="min-h-screen px-3 py-4 sm:px-4 lg:px-6">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
        <header className="rounded-2xl border border-white/70 bg-white/90 p-4 shadow-xl shadow-slate-200/60 backdrop-blur sm:p-5">
          <h1 className="text-3xl font-semibold tracking-tight text-slate-950">
            Заведения
          </h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Только просмотр: контакты и адреса для выезда.
          </p>
        </header>

        {locations.length > 0 ? (
          <section className="grid gap-3">
            {locations.map((location) => (
              <article
                className="rounded-2xl border border-slate-200 bg-white p-4 shadow-md shadow-slate-200/50"
                key={location.id}
              >
                <h2 className="text-lg font-semibold tracking-tight text-slate-950">
                  {location.name}
                </h2>
                <p className="mt-1 text-base leading-6 text-slate-600">
                  {location.address ?? "Адрес не указан"}
                </p>

                <dl className="mt-3 grid gap-2 text-sm">
                  <Info label="Контакт" value={location.contact ?? "Не указан"} />
                  <Info label="Телефон" value={location.phone ?? "Не указан"} />
                  <Info
                    label="Режим работы"
                    value={location.working_hours ?? "Не указан"}
                  />
                </dl>

                {location.notes ? (
                  <p className="mt-3 rounded-xl bg-slate-50 px-3 py-3 text-sm leading-6 text-slate-700">
                    {location.notes}
                  </p>
                ) : null}

                <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {location.phone ? (
                    <a
                      className="inline-flex min-h-12 items-center justify-center rounded-xl bg-emerald-600 px-4 py-3 text-base font-semibold text-white"
                      href={getPhoneHref(location.phone)}
                    >
                      Позвонить
                    </a>
                  ) : null}
                  {location.yandex_maps_url ? (
                    <a
                      className="inline-flex min-h-12 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-3 text-base font-semibold text-slate-950"
                      href={location.yandex_maps_url}
                      rel="noreferrer"
                      target="_blank"
                    >
                      Открыть Яндекс Карты
                    </a>
                  ) : null}
                </div>
              </article>
            ))}
          </section>
        ) : (
          <section className="rounded-2xl border border-dashed border-slate-300 bg-white/85 p-6 text-center">
            <h2 className="text-lg font-semibold text-slate-950">
              Заведений пока нет
            </h2>
          </section>
        )}
      </div>
    </main>
  );
}

function Info({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-xl bg-slate-50 px-3 py-2.5">
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className="mt-1 text-base font-semibold text-slate-950">{value}</dd>
    </div>
  );
}
