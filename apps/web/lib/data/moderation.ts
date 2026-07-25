import 'server-only';

import { getServerSupabase } from '../supabase/server';
import { getPendingStrikeAppeals, type StrikeAppealQueueItem } from './strikes';

export type ModerationQueueItem = {
  work_id: string;
  title: string;
  creator_handle: string;
  image_url: string;
  status: 'declared' | 'awaiting' | 'verified' | 'rejected';
  proof_count: number;
  report_count: number;
  ai_declared: boolean;
  triggers: string[];
  requested_at: string;
  badge_variant: 'verified' | 'awaiting' | 'unverified';
  badge_label: string;
};

export async function getReviewerContext() {
  const supabase = await getServerSupabase();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { user: null, canReview: false, isAdmin: false, reviewerLevel: 0 };
  await supabase.rpc('refresh_my_tenure_reputation');
  const { data: profile } = await supabase.from('users').select('is_admin, reviewer_level').eq('id', auth.user.id).maybeSingle();
  return {
    user: auth.user,
    canReview: Boolean(profile?.is_admin || (profile?.reviewer_level ?? 0) > 0),
    isAdmin: Boolean(profile?.is_admin),
    reviewerLevel: profile?.reviewer_level ?? 0,
  };
}

export async function getModerationQueue(): Promise<ModerationQueueItem[]> {
  const supabase = await getServerSupabase();
  const { data, error } = await supabase.rpc('get_moderation_queue', { p_limit: 50 });
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as ModerationQueueItem[];
}

export async function getModerationContext(workId: string) {
  const supabase = await getServerSupabase();
  const [reportsResult, requestsResult] = await Promise.all([
    supabase.from('reports').select('id, reason, status, created_at, reporter_id').eq('work_id', workId).order('created_at', { ascending: false }),
    supabase.from('review_requests').select('id, trigger_type, state, created_at, requested_by').eq('work_id', workId).order('created_at', { ascending: false }),
  ]);
  if (reportsResult.error) throw new Error(reportsResult.error.message);
  if (requestsResult.error) throw new Error(requestsResult.error.message);
  return { reports: reportsResult.data ?? [], requests: requestsResult.data ?? [] };
}


export async function getModerationDashboard(): Promise<{ works: ModerationQueueItem[]; appeals: StrikeAppealQueueItem[] }> {
  const [works, appeals] = await Promise.all([getModerationQueue(), getPendingStrikeAppeals()]);
  return { works, appeals };
}
