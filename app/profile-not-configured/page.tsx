import { signOutAction } from "@/app/auth/actions";
import { getCurrentUser } from "@/lib/auth/current-user";

export const dynamic = "force-dynamic";

export default async function ProfileNotConfiguredPage() {
  const context = await getCurrentUser();

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <section className="w-full max-w-lg rounded-2xl border border-amber-200 bg-amber-50/90 p-6 shadow-xl shadow-slate-200/60 sm:p-8">
        <h1 className="text-2xl font-semibold tracking-tight text-amber-950 sm:text-3xl">
          Профиль сотрудника не настроен
        </h1>
        <p className="mt-4 text-sm leading-6 text-amber-900">
          Вы вошли в систему, но доступ ещё не настроен. Обратитесь к
          администратору, чтобы вам назначили роль и привязали профиль
          сотрудника.
        </p>

        {context.authUser?.email ? (
          <p className="mt-4 rounded-xl bg-white/80 px-4 py-3 text-sm text-slate-700">
            Аккаунт: <span className="font-semibold">{context.authUser.email}</span>
          </p>
        ) : null}

        <form action={signOutAction} className="mt-6">
          <button
            className="inline-flex min-h-12 w-full justify-center rounded-xl bg-slate-950 px-5 py-3 text-base font-semibold text-white"
            type="submit"
          >
            Выйти
          </button>
        </form>
      </section>
    </main>
  );
}
