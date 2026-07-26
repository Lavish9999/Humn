import type { SupabaseClient } from '@supabase/supabase-js';
import type { VerificationThresholds } from './types';

function requiredString(value: unknown, field: string): string {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`Verification config ${field} is invalid.`);
  return value.trim();
}

function requiredNumber(value: unknown, field: string): number {
  const numeric = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(numeric)) throw new Error(`Verification config ${field} is invalid.`);
  return numeric;
}

export function parseVerificationThresholds(row: Record<string, unknown>): VerificationThresholds {
  return {
    pipelineVersion: requiredString(row.pipeline_version, 'pipeline_version'),
    primaryProvider: requiredString(row.primary_provider, 'primary_provider'),
    secondaryProvider: requiredString(row.secondary_provider, 'secondary_provider'),
    aiRejectThreshold: requiredNumber(row.ai_reject_threshold, 'ai_reject_threshold'),
    aiClearThreshold: requiredNumber(row.ai_clear_threshold, 'ai_clear_threshold'),
    minConfidence: requiredNumber(row.min_confidence, 'min_confidence'),
    deepfakeRejectThreshold: requiredNumber(row.deepfake_reject_threshold, 'deepfake_reject_threshold'),
    recaptureEscalateThreshold: requiredNumber(row.recapture_escalate_threshold, 'recapture_escalate_threshold'),
    localScreenEscalateThreshold: requiredNumber(row.local_screen_escalate_threshold, 'local_screen_escalate_threshold'),
    optionalRegionEscalateThreshold: requiredNumber(row.optional_region_escalate_threshold, 'optional_region_escalate_threshold'),
    providerTimeoutMs: requiredNumber(row.provider_timeout_ms, 'provider_timeout_ms'),
    optionalProviderEnabled: row.optional_provider_enabled === true,
  };
}

export async function loadVerificationThresholds(admin: SupabaseClient): Promise<VerificationThresholds> {
  const { data, error } = await admin
    .from('verification_pipeline_config')
    .select('*')
    .eq('singleton', true)
    .single();
  if (error || !data) throw new Error(`Verification configuration could not be loaded: ${error?.message ?? 'missing row'}`);
  return parseVerificationThresholds(data as Record<string, unknown>);
}

export function thresholdSnapshot(thresholds: VerificationThresholds): Record<string, unknown> {
  return {
    pipeline_version: thresholds.pipelineVersion,
    primary_provider: thresholds.primaryProvider,
    secondary_provider: thresholds.secondaryProvider,
    ai_reject_threshold: thresholds.aiRejectThreshold,
    ai_clear_threshold: thresholds.aiClearThreshold,
    min_confidence: thresholds.minConfidence,
    deepfake_reject_threshold: thresholds.deepfakeRejectThreshold,
    recapture_escalate_threshold: thresholds.recaptureEscalateThreshold,
    local_screen_escalate_threshold: thresholds.localScreenEscalateThreshold,
    optional_region_escalate_threshold: thresholds.optionalRegionEscalateThreshold,
    provider_timeout_ms: thresholds.providerTimeoutMs,
    optional_provider_enabled: thresholds.optionalProviderEnabled,
  };
}
