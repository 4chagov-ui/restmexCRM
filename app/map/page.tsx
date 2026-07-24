import { requireManagerUser } from "@/lib/auth/current-user";

export const dynamic = "force-dynamic";

export default async function MapPage() {
  await requireManagerUser();

  return (
    <main className="min-h-screen px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-3xl rounded-[2rem] border border-dashed border-slate-300 bg-white/85 p-10 text-center shadow-xl shadow-slate-200/50 backdrop-blur">
        <h1 className="text-3xl font-semibold tracking-tight text-slate-950">
          Карта
        </h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          Экран карты будет добавлен позже. Маршрут уже защищён для менеджера и
          администратора.
        </p>
      </div>
    </main>
  );
}
