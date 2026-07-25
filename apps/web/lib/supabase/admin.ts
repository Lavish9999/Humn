import 'server-only';

import { createClient } from '@supabase/supabase-js';
import { resolveSupabaseAdminConfig } from './admin-config';

export function getAdminSupabase() {
  const { url, key } = resolveSupabaseAdminConfig();
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
