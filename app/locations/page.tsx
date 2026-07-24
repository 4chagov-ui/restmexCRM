import { LocationsBrowser } from "@/components/locations/locations-browser";
import { requireManagerUser } from "@/lib/auth/current-user";
import { getLocationList } from "@/lib/db/locations";

export const dynamic = "force-dynamic";

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white/85 px-5 py-4 text-slate-950 shadow-sm">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-2 text-3xl font-semibold tracking-tight">{value}</p>
    </div>
  );
}

export default async function LocationsPage() {
  await requireManagerUser();

  const locations = await getLocationList();
  const openRequests = locations.reduce(
    (sum, location) => sum + location.open_requests,
    0,
  );

  return (
    <main className="min-h-screen px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
        <header className="overflow-hidden rounded-[2rem] border border-white/70 bg-white/85 p-6 shadow-2xl shadow-slate-200/70 backdrop-blur sm:p-8">
          <div className="grid gap-6 xl:grid-cols-[1fr_24rem] xl:items-end">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600 shadow-sm">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                CRM / Locations
              </div>
              <h1 className="mt-5 text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl">
                Заведения
              </h1>
              <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600">
                Справочник заведений из Supabase. Здесь видны контакты,
                количество заявок и история работ по каждому объекту.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-3xl border border-slate-950 bg-slate-950 px-5 py-4 text-white shadow-sm shadow-slate-300/60">
                <p className="text-sm text-slate-300">Всего заведений</p>
                <p className="mt-2 text-3xl font-semibold tracking-tight">
                  {locations.length}
                </p>
              </div>
              <StatCard label="Открытых заявок" value={openRequests} />
            </div>
          </div>
        </header>

        <LocationsBrowser locations={locations} />
      </div>
    </main>
  );
}
