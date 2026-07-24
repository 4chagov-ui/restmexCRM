export function isUndefinedColumnError(error: {
  code?: string;
  message?: string;
} | null): boolean {
  if (!error) {
    return false;
  }

  return (
    error.code === "42703" ||
    /column .* does not exist/i.test(error.message ?? "")
  );
}

export const MISSING_SOFT_DELETE_SQL =
  "SUPABASE_REQUESTS_SOFT_DELETE.sql";

export const MISSING_SOFT_DELETE_MESSAGE =
  "В базе ещё нет колонок корзины (deleted_at). Откройте Supabase → SQL Editor и выполните файл SUPABASE_REQUESTS_SOFT_DELETE.sql, затем обновите страницу.";
