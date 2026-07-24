import Link from "next/link";
import { RequestCreateForm } from "@/components/requests/request-create-form";
import { requireManagerUser } from "@/lib/auth/current-user";
import { getActiveEmployees } from "@/lib/db/employees";
import { getLocations } from "@/lib/db/locations";

export const dynamic = "force-dynamic";

type NewRequestPageProps = {
  searchParams: Promise<{
    locationId?: string;
  }>;
};

export default async function NewRequestPage({
  searchParams,
}: NewRequestPageProps) {
  await requireManagerUser();

  const { locationId } = await searchParams;
  const [locations, employees] = await Promise.all([
    getLocations(),
    getActiveEmployees(),
  ]);

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,#eef2ff,transparent_32rem),linear-gradient(180deg,#fafafa,#f8fafc)]">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-4 py-6 sm:px-6 lg:px-8 lg:py-10">
        <header className="overflow-hidden rounded-[2rem] border border-white/70 bg-white/80 shadow-xl shadow-slate-200/60 backdrop-blur">
          <div className="grid gap-8 p-6 sm:p-8 lg:grid-cols-[1fr_22rem] lg:p-10">
            <div className="flex flex-col justify-between gap-8">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600 shadow-sm">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  CRM / Заявки
                </div>
                <h1 className="mt-5 max-w-3xl text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl">
                  Новая заявка
                </h1>
                <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600">
                  Создайте обращение, укажите заведение, контакт и детали
                  проблемы. После сохранения заявка появится в общем списке и
                  будет ожидать планирования.
                </p>
              </div>

              <div className="flex flex-wrap gap-2 text-xs font-medium text-slate-600">
                <span className="rounded-full bg-slate-100 px-3 py-1.5">
                  Supabase
                </span>
                <span className="rounded-full bg-slate-100 px-3 py-1.5">
                  Server Action
                </span>
                <span className="rounded-full bg-slate-100 px-3 py-1.5">
                  Реальные данные
                </span>
              </div>
            </div>

            <aside className="rounded-3xl border border-slate-200 bg-slate-950 p-5 text-white shadow-lg shadow-slate-300/60">
              <p className="text-sm font-medium text-slate-300">Статус</p>
              <p className="mt-3 text-2xl font-semibold">needs_planning</p>
              <p className="mt-3 text-sm leading-6 text-slate-300">
                Новая заявка создается без маршрута. Плановую дату,
                очередность и ответственного можно уточнить после сохранения.
              </p>
              <Link
                className="mt-6 inline-flex w-full justify-center rounded-2xl bg-white px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-slate-100"
                href="/requests"
              >
                Вернуться к списку
              </Link>
            </aside>
          </div>
        </header>

        <div className="grid gap-6 lg:grid-cols-[18rem_1fr]">
          <aside className="hidden rounded-3xl border border-slate-200 bg-white/80 p-5 shadow-lg shadow-slate-200/50 backdrop-blur lg:block">
            <p className="text-sm font-semibold text-slate-950">Что заполнить</p>
            <ol className="mt-4 space-y-4 text-sm text-slate-600">
              <li className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-950 text-xs font-semibold text-white">
                  1
                </span>
                Заведение, адрес и контакт для связи.
              </li>
              <li className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-950 text-xs font-semibold text-white">
                  2
                </span>
                Тип заявки, приоритет и ответственного.
              </li>
              <li className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-950 text-xs font-semibold text-white">
                  3
                </span>
                Временной интервал и описание проблемы.
              </li>
            </ol>
          </aside>

          <RequestCreateForm
            employees={employees}
            initialLocationId={locationId}
            locations={locations}
          />
        </div>
      </div>
    </main>
  );
}
