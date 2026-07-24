import { redirect } from "next/navigation";
import { LoginForm } from "@/components/auth/login-form";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getHomePathForRole } from "@/lib/auth/permissions";

export const dynamic = "force-dynamic";

type LoginPageProps = {
  searchParams: Promise<{
    error?: string;
  }>;
};

const errorMessages: Record<string, string> = {
  missing: "Введите email и пароль.",
  invalid: "Не удалось войти. Проверьте email и пароль.",
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const context = await getCurrentUser();
  const { error } = await searchParams;

  if (context.authUser) {
    redirect(getHomePathForRole(context.role));
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <section className="w-full max-w-md overflow-hidden rounded-[2rem] border border-white/70 bg-white/90 shadow-2xl shadow-slate-200/70 backdrop-blur">
        <div className="border-b border-slate-100 px-6 py-6">
          <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600 shadow-sm">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            RestMex CRM
          </div>
          <h1 className="mt-5 text-3xl font-semibold tracking-tight text-slate-950">
            Вход
          </h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Используйте учётную запись, созданную администратором в Supabase Auth.
          </p>
        </div>

        <LoginForm
          errorMessage={
            error ? (errorMessages[error] ?? "Не удалось войти.") : null
          }
        />
      </section>
    </main>
  );
}
