import { requireManagerUser } from "@/lib/auth/current-user";
import { getActiveEmployees } from "@/lib/db/employees";

export const dynamic = "force-dynamic";

export default async function MechanicsPage() {
  await requireManagerUser();
  const employees = await getActiveEmployees();

  return (
    <main className="min-h-screen px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
        <header className="rounded-[2rem] border border-white/70 bg-white/85 p-6 shadow-2xl shadow-slate-200/70 backdrop-blur sm:p-8">
          <h1 className="text-4xl font-semibold tracking-tight text-slate-950">
            Механики
          </h1>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            Список активных сотрудников из таблицы <code>employees</code>.
          </p>
        </header>

        <section className="grid gap-3">
          {employees.map((employee) => (
            <article
              className="rounded-3xl border border-slate-200 bg-white/90 px-5 py-4 shadow-lg shadow-slate-200/50"
              key={employee.id}
            >
              <p className="text-lg font-semibold text-slate-950">
                {employee.name}
              </p>
              <p className="mt-1 text-sm text-slate-500">
                {employee.role} · порядок {employee.sort_order}
              </p>
            </article>
          ))}
        </section>
      </div>
    </main>
  );
}
