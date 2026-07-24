import { signOutAction } from "@/app/auth/actions";
import { requireMechanicUser } from "@/lib/auth/current-user";

export const dynamic = "force-dynamic";

const roleLabels: Record<string, string> = {
  admin: "Администратор",
  manager: "Менеджер",
  mechanic: "Механик",
};

export default async function WorkProfilePage() {
  const context = await requireMechanicUser();

  return (
    <main className="min-h-screen px-3 py-4 sm:px-4 lg:px-6">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
        <header className="rounded-2xl border border-white/70 bg-white/90 p-4 shadow-xl shadow-slate-200/60 backdrop-blur sm:p-5">
          <h1 className="text-3xl font-semibold tracking-tight text-slate-950">
            Профиль
          </h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Личные данные и выход из аккаунта.
          </p>
        </header>

        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-lg shadow-slate-200/50 sm:p-5">
          <dl className="grid gap-2 sm:grid-cols-2">
            <Info label="Имя" value={context.profile.full_name} />
            <Info
              label="Роль"
              value={roleLabels[context.role] ?? context.role}
            />
            <Info label="Телефон" value={context.profile.phone ?? "Не указан"} />
            <Info label="Email" value={context.authUser?.email ?? "Не указан"} />
            <Info label="Сотрудник" value={context.employee.name} />
          </dl>

          <form action={signOutAction} className="mt-5">
            <button
              className="inline-flex min-h-12 w-full justify-center rounded-xl bg-slate-950 px-5 py-3 text-base font-semibold text-white sm:w-auto"
              type="submit"
            >
              Выйти
            </button>
          </form>
        </section>
      </div>
    </main>
  );
}

function Info({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-xl bg-slate-50 px-3 py-3">
      <dt className="text-xs font-medium text-slate-500">{label}</dt>
      <dd className="mt-1 text-sm font-semibold text-slate-950">{value}</dd>
    </div>
  );
}
