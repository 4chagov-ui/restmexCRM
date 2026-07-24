/**
 * Resolve Supabase URL/key at runtime.
 * Bracket access avoids Next.js build-time inlining of missing NEXT_PUBLIC_* as undefined.
 */
export function getSupabaseEnv() {
  const supabaseUrl =
    process.env["SUPABASE_URL"] ??
    process.env["NEXT_PUBLIC_SUPABASE_URL"] ??
    "";
  const supabaseAnonKey =
    process.env["SUPABASE_ANON_KEY"] ??
    process.env["NEXT_PUBLIC_SUPABASE_ANON_KEY"] ??
    "";

  return {
    supabaseUrl: supabaseUrl.trim(),
    supabaseAnonKey: supabaseAnonKey.trim(),
  };
}

export function hasSupabaseEnv() {
  const { supabaseUrl, supabaseAnonKey } = getSupabaseEnv();
  return Boolean(supabaseUrl && supabaseAnonKey);
}
