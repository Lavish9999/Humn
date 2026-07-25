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

export type VerificationRunAudit = {
  id: string;
  state: 'queued' | 'running' | 'completed';
  decision: 'verified' | 'rejected' | 'escalate' | null;
  reason_code: string | null;
  reason: string | null;
  pipeline_version: string | null;
  thresholds: Record<string, unknown>;
  screen_heuristics: Record<string, unknown>;
  evidence_digest: string | null;
  queued_at: string;
  started_at: string | null;
  completed_at: string | null;
};

export type DetectorResultAudit = {
  provider: string;
  provider_role: 'primary' | 'secondary' | 'optional' | 'local';
  status: 'ok' | 'unavailable' | 'error' | 'timeout';
  model_version: string | null;
  ai_score: number | null;
  authentic_score: number | null;
  confidence: number | null;
  recapture_score: number | null;
  deepfake_score: number | null;
  partial_ai_score: number | null;
  content_flags: Record<string, unknown>;
  raw_response: Record<string, unknown>;
  error_code: string | null;
  latency_ms: number | null;
  created_at: string;
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
  const [reportsResult, requestsResult, runsResult] = await Promise.all([
    supabase.from('reports').select('id, reason, status, created_at, reporter_id').eq('work_id', workId).order('created_at', { ascending: false }),
    supabase.from('review_requests').select('id, trigger_type, state, created_at, requested_by').eq('work_id', workId).order('created_at', { ascending: false }),
    supabase.from('verification_pipeline_runs')
      .select('id, state, decision, reason_code, reason, pipeline_version, thresholds, screen_heuristics, evidence_digest, queued_at, started_at, completed_at')
      .eq('work_id', workId)
      .order('queued_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  if (reportsResult.error) throw new Error(reportsResult.error.message);
  if (requestsResult.error) throw new Error(requestsResult.error.message);
  if (runsResult.error) throw new Error(runsResult.error.message);

  const run = runsResult.data as VerificationRunAudit | null;
  let detectorResults: DetectorResultAudit[] = [];
  if (run) {
    const { data, error } = await supabase.from('verification_detector_results')
      .select('provider, provider_role, status, model_version, ai_score, authentic_score, confidence, recapture_score, deepfake_score, partial_ai_score, content_flags, raw_response, error_code, latency_ms, created_at')
      .eq('run_id', run.id)
      .order('provider_role')
      .order('provider');
    if (error) throw new Error(error.message);
    detectorResults = (data ?? []) as unknown as DetectorResultAudit[];
  }

  return {
    reports: reportsResult.data ?? [],
    requests: requestsResult.data ?? [],
    verificationRun: run,
    detectorResults,
    isEscalated: run?.decision === 'escalate',
  };
}

export async function getModerationDashboard(): Promise<{ works: ModerationQueueItem[]; appeals: StrikeAppealQueueItem[] }> {
  const [works, appeals] = await Promise.all([getModerationQueue(), getPendingStrikeAppeals()]);
  return { works, appeals };
}
