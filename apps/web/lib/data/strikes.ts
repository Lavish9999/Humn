import 'server-only';

import { getServerSupabase } from '../supabase/server';

export type StrikeSource = 'c2pa_ai' | 'review_upheld';
export type AppealStatus = 'none' | 'pending' | 'upheld' | 'denied';

export type StrikeState = {
  active_count: number;
  strike_level: number;
  posting_cooldown_until: string | null;
  suspended_at: string | null;
  can_post: boolean;
  status_label: string;
};

export type StrikeRecord = {
  id: string;
  user_id: string;
  work_id: string | null;
  reason: string;
  source: StrikeSource;
  evidence_hash: string | null;
  evidence: Record<string, unknown>;
  created_at: string;
  expires_at: string;
  appeal_status: AppealStatus;
  appeal_reason: string | null;
  appealed_at: string | null;
  appeal_reviewed_at: string | null;
  appeal_reviewed_by: string | null;
  appeal_resolution_reason: string | null;
};

export type StrikeAppealQueueItem = {
  strike_id: string;
  user_id: string;
  handle: string;
  source: StrikeSource;
  reason: string;
  appeal_reason: string;
  created_at: string;
  appealed_at: string;
  active_count: number;
};

function firstRow<T>(value: T | T[] | null): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

export async function getMyStrikeOverview(): Promise<{
  userId: string | null;
  state: StrikeState | null;
  strikes: StrikeRecord[];
}> {
  const supabase = await getServerSupabase();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { userId: null, state: null, strikes: [] };

  const [stateResult, strikesResult] = await Promise.all([
    supabase.rpc('get_user_strike_state', { p_user_id: auth.user.id }),
    supabase
      .from('strikes')
      .select('id, user_id, work_id, reason, source, evidence_hash, evidence, created_at, expires_at, appeal_status, appeal_reason, appealed_at, appeal_reviewed_at, appeal_reviewed_by, appeal_resolution_reason')
      .eq('user_id', auth.user.id)
      .order('created_at', { ascending: false }),
  ]);

  if (stateResult.error) throw new Error(stateResult.error.message);
  if (strikesResult.error) throw new Error(strikesResult.error.message);

  return {
    userId: auth.user.id,
    state: firstRow(stateResult.data as StrikeState | StrikeState[] | null),
    strikes: (strikesResult.data ?? []) as unknown as StrikeRecord[],
  };
}

export async function getPendingStrikeAppeals(): Promise<StrikeAppealQueueItem[]> {
  const supabase = await getServerSupabase();
  const { data, error } = await supabase.rpc('get_pending_strike_appeals', { p_limit: 50 });
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as StrikeAppealQueueItem[];
}

export async function getStrikeAppealDetail(strikeId: string): Promise<{
  strike: StrikeRecord;
  handle: string;
  displayName: string;
  state: StrikeState | null;
  history: StrikeRecord[];
} | null> {
  const supabase = await getServerSupabase();
  const { data: strikeData, error: strikeError } = await supabase
    .from('strikes')
    .select('id, user_id, work_id, reason, source, evidence_hash, evidence, created_at, expires_at, appeal_status, appeal_reason, appealed_at, appeal_reviewed_at, appeal_reviewed_by, appeal_resolution_reason')
    .eq('id', strikeId)
    .maybeSingle();
  if (strikeError) throw new Error(strikeError.message);
  if (!strikeData) return null;

  const strike = strikeData as unknown as StrikeRecord;
  const [profileResult, stateResult, historyResult] = await Promise.all([
    supabase.from('users').select('handle, display_name').eq('id', strike.user_id).maybeSingle(),
    supabase.rpc('get_user_strike_state', { p_user_id: strike.user_id }),
    supabase
      .from('strikes')
      .select('id, user_id, work_id, reason, source, evidence_hash, evidence, created_at, expires_at, appeal_status, appeal_reason, appealed_at, appeal_reviewed_at, appeal_reviewed_by, appeal_resolution_reason')
      .eq('user_id', strike.user_id)
      .order('created_at', { ascending: false }),
  ]);

  if (profileResult.error) throw new Error(profileResult.error.message);
  if (stateResult.error) throw new Error(stateResult.error.message);
  if (historyResult.error) throw new Error(historyResult.error.message);

  return {
    strike,
    handle: String(profileResult.data?.handle ?? 'unknown'),
    displayName: String(profileResult.data?.display_name ?? profileResult.data?.handle ?? 'Unknown creator'),
    state: firstRow(stateResult.data as StrikeState | StrikeState[] | null),
    history: (historyResult.data ?? []) as unknown as StrikeRecord[],
  };
}
