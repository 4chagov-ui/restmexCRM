"use client";

import { signInAction } from "@/app/auth/actions";
import { FormSubmitButton } from "@/components/ui/form-submit-button";

type LoginFormProps = {
  errorMessage?: string | null;
};

export function LoginForm({ errorMessage }: LoginFormProps) {
  return (
    <form action={signInAction} className="grid gap-4 p-6">
      {errorMessage ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
          {errorMessage}
        </div>
      ) : null}

      <label className="text-sm font-medium text-slate-800">
        Email
        <input
          className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-950 shadow-sm outline-none transition placeholder:text-slate-400 hover:border-slate-300 focus:border-slate-950 focus:ring-4 focus:ring-slate-950/5"
          name="email"
          placeholder="user@example.com"
          required
          type="email"
        />
      </label>

      <label className="text-sm font-medium text-slate-800">
        Пароль
        <input
          className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-950 shadow-sm outline-none transition placeholder:text-slate-400 hover:border-slate-300 focus:border-slate-950 focus:ring-4 focus:ring-slate-950/5"
          name="password"
          placeholder="Пароль"
          required
          type="password"
        />
      </label>

      <FormSubmitButton
        className="mt-2 inline-flex justify-center rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-slate-300/80 transition hover:-translate-y-0.5 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
        pendingLabel="Вход…"
      >
        Войти
      </FormSubmitButton>
    </form>
  );
}
