import Link from "next/link";
import { requireManagerUser } from "@/lib/auth/current-user";

export default async function HomePage() {
  await requireManagerUser();

  return (
    <main className="min-h-screen px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto flex min-h-[calc(100vh-3rem)] w-full max-w-6xl items-center">
        <section className="grid w-full gap-6 lg:grid-cols-[1.15fr_0.85fr]">
          <div className="rounded-[2rem] border border-white/70 bg-white/85 p-6 shadow-2xl shadow-slate-200/70 backdrop-blur sm:p-10">
            <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600 shadow-sm">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              RestMex CRM
            </div>
            <h1 className="mt-6 max-w-3xl text-4xl font-semibold tracking-tight text-slate-950 sm:text-6xl">
              Современная CRM для заявок и маршрута механика
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-slate-600 sm:text-lg">
              Диспетчерская, кабинет механика и журнал заявок работают на
              реальных данных Supabase.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                className="inline-flex justify-center rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-slate-300/80 transition hover:-translate-y-0.5 hover:bg-slate-800"
                href="/today"
              >
                Открыть план на сегодня
              </Link>
              <Link
                className="inline-flex justify-center rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-950 shadow-sm transition hover:bg-slate-50"
                href="/requests"
              >
                Журнал заявок
              </Link>
            </div>
          </div>

          <aside className="rounded-[2rem] border border-slate-200 bg-slate-950 p-6 text-white shadow-2xl shadow-slate-300/60 sm:p-8">
            <p className="text-sm font-semibold text-slate-300">Статус проекта</p>
            <div className="mt-6 space-y-4">
              {[
                "Роли: диспетчер и механик",
                "План дня с Drag & Drop",
                "История изменений заявок",
              ].map((item) => (
                <div
                  className="rounded-2xl border border-white/10 bg-white/5 p-4"
                  key={item}
                >
                  <p className="text-sm font-medium text-white">{item}</p>
                </div>
              ))}
            </div>
          </aside>
        </section>
      </div>
    </main>
  );
}
