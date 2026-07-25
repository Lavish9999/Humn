import { createServerClient } from '@supabase/ssr';

export function createServerSupabaseClient(
  cookieStore: {
    getAll(): { name: string; value: string }[];
    setAll(cookies: { name: string; value: string; options?: Record<string, unknown> }[]): void;
  },
) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) throw new Error('Missing public Supabase environment variables.');
  return createServerClient(url, anonKey, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (cookies) => cookieStore.setAll(cookies),
    },
  });
}
