import Link from "next/link";
import { LocationForm } from "@/components/locations/location-form";
import { createLocationAction } from "@/app/locations/new/actions";
import { requireManagerUser } from "@/lib/auth/current-user";

export const dynamic = "force-dynamic";

export default async function NewLocationPage() {
  await requireManagerUser();

  return (
    <main className="min-h-screen px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
        <header className="overflow-hidden rounded-[2rem] border border-white/70 bg-white/85 p-6 shadow-2xl shadow-slate-200/70 backdrop-blur sm:p-8">
          <div className="grid gap-6 lg:grid-cols-[1fr_18rem] lg:items-end">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600 shadow-sm">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                CRM / Заведения
              </div>
              <h1 className="mt-5 text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl">
                Новое заведение
              </h1>
              <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600">
                Добавьте объект в справочник, чтобы затем выбирать его при
                создании заявок без дублей.
              </p>
            </div>

            <Link
              className="inline-flex justify-center rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-950 shadow-sm transition hover:bg-slate-50"
              href="/locations"
            >
              К заведениям
            </Link>
          </div>
        </header>

        <LocationForm action={createLocationAction} submitLabel="Создать заведение" />
      </div>
    </main>
  );
}
