import 'server-only';

import type { ProvenanceTierMode } from './types';
import { getServerSupabase } from '../supabase/server';

export async function getDiscoverDefaultTier(): Promise<ProvenanceTierMode> {
  const supabase = await getServerSupabase();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return 'all';

  const { data } = await supabase
    .from('user_settings')
    .select('strict_human_only,include_awaiting_verification')
    .eq('user_id', auth.user.id)
    .maybeSingle();

  if (data?.strict_human_only) return 'verified';
  if (data?.include_awaiting_verification) return 'reviewed';
  return 'all';
}
