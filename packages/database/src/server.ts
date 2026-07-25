import { createServerClient } from '@supabase/ssr';
import { getPublicSupabaseConfig } from './config';

export function createServerSupabaseClient(
  cookieStore: {
    getAll(): { name: string; value: string }[];
    setAll(cookies: { name: string; value: string; options?: Record<string, unknown> }[]): void;
  },
) {
  const { url, publishableKey } = getPublicSupabaseConfig();
  return createServerClient(url, publishableKey, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (cookies) => cookieStore.setAll(cookies),
    },
  });
}
