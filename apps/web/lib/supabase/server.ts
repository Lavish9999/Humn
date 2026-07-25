import { cookies } from 'next/headers';
import { createServerSupabaseClient } from '@human/database/server';

export async function getServerSupabase() {
  const store = await cookies();
  return createServerSupabaseClient({
    getAll: () => store.getAll(),
    setAll: (items) => {
      try { for (const item of items) store.set(item.name, item.value, item.options as never); } catch { /* Server Components cannot always set cookies. */ }
    },
  });
}
