import 'server-only';

import sharp from 'sharp';
import { getAdminSupabase } from '../supabase/admin';
import { ORIGINAL_BUCKET } from '../uploads/constants';
import { loadVerificationThresholds, thresholdSnapshot } from './config';
import { evaluateVerificationDecision } from './decision';
import { createDetectorProvider } from './providers/registry';
import { analyzeScreenRephotographHeuristics } from './screen-heuristics';
import type {
  ClaimedVerificationRun,
  DetectorResult,
  ProvenanceDecisionInputs,
  ScreenHeuristicResult,
  VerificationThresholds,
} from './types';

const ORIGINAL_EXTENSION_MIME: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
};

type PipelineOutcome = {
  processed: boolean;
  workId: string | null;
  runId: string | null;
  decision: string | null;
};

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function serializeResult(result: DetectorResult): Record<string, unknown> {
  return {
    provider: result.provider,
    role: result.role,
    detectorKind: result.detectorKind,
    status: result.status,
    modelVersion: result.modelVersion,
    aiScore: result.aiScore,
    authenticScore: result.authenticScore,
    confidence: result.confidence,
    recaptureScore: result.recaptureScore,
    deepfakeScore: result.deepfakeScore,
    partialAiScore: result.partialAiScore,
    contentFlags: result.contentFlags,
    rawResponse: result.rawResponse,
    errorCode: result.errorCode,
    latencyMs: result.latencyMs,
  };
}

function serializeScreen(screen: ScreenHeuristicResult): Record<string, unknown> {
  return {
    score: screen.score,
    suspected: screen.suspected,
    coverage: screen.coverage,
    signals: screen.signals,
    reasons: screen.reasons,
    limitations: screen.limitations,
  };
}

function pipelineErrorResult(error: unknown): DetectorResult {
  return {
    provider: 'humn_pipeline',
    role: 'local',
    detectorKind: 'pipeline_integrity',
    status: 'error',
    modelVersion: null,
    aiScore: null,
    authenticScore: null,
    confidence: null,
    recaptureScore: null,
    deepfakeScore: null,
    partialAiScore: null,
    contentFlags: {},
    rawResponse: {},
    errorCode: error instanceof Error ? error.name : 'PIPELINE_ERROR',
    latencyMs: null,
  };
}

async function locateOriginal(
  admin: ReturnType<typeof getAdminSupabase>,
  creatorId: string,
  workId: string,
): Promise<{ bytes: Buffer; mimeType: string; fileName: string }> {
  const folder = `${creatorId}/${workId}`;
  const { data: objects, error: listError } = await admin.storage
    .from(ORIGINAL_BUCKET)
    .list(folder, { limit: 20, sortBy: { column: 'name', order: 'asc' } });
  if (listError) throw new Error(`Original storage listing failed: ${listError.message}`);
  const original = (objects ?? []).find(item => /^original\.(jpe?g|png|webp)$/i.test(item.name));
  if (!original) throw new Error('Private untouched original was not found for automated review.');
  const storagePath = `${folder}/${original.name}`;
  const { data: blob, error: downloadError } = await admin.storage.from(ORIGINAL_BUCKET).download(storagePath);
  if (downloadError || !blob) throw new Error(`Private original download failed: ${downloadError?.message ?? 'missing object'}`);
  const extension = original.name.split('.').pop()?.toLowerCase() ?? '';
  const mimeType = ORIGINAL_EXTENSION_MIME[extension] ?? blob.type;
  if (!mimeType) throw new Error('Private original MIME type could not be determined.');
  return {
    bytes: Buffer.from(await blob.arrayBuffer()),
    mimeType,
    fileName: original.name,
  };
}

async function loadProvenanceInputs(
  admin: ReturnType<typeof getAdminSupabase>,
  workId: string,
): Promise<ProvenanceDecisionInputs> {
  const [{ data: work, error: workError }, { data: signals, error: signalError }] = await Promise.all([
    admin.from('works').select('origin_input, ai_declared').eq('id', workId).single(),
    admin.from('provenance_signals').select('signal_name, value').eq('work_id', workId),
  ]);
  if (workError || !work) throw new Error(`Work provenance lookup failed: ${workError?.message ?? 'missing work'}`);
  if (signalError) throw new Error(`Provenance signal lookup failed: ${signalError.message}`);
  const workRecord = work as unknown as { origin_input: string; ai_declared: boolean };
  const rows = (signals ?? []) as unknown as Array<{ signal_name: string; value: unknown }>;
  const c2pa = record(rows.find(row => row.signal_name === 'c2pa')?.value);
  const duplicate = record(rows.find(row => row.signal_name === 'duplicate_hash')?.value);
  const exif = record(rows.find(row => row.signal_name === 'exif_consistency')?.value);
  return {
    c2paExplicitAi: workRecord.ai_declared === true || c2pa.ai_generation_asserted === true,
    duplicateHash: duplicate.duplicate === true,
    c2paCameraCapture: c2pa.camera_capture_asserted === true,
    exifUsableFieldCount: typeof exif.plausible_field_count === 'number' ? exif.plausible_field_count : 0,
    originInput: workRecord.origin_input === 'captured_in_app' ? 'captured_in_app' : 'uploaded',
  };
}

async function completeRun(
  admin: ReturnType<typeof getAdminSupabase>,
  claim: ClaimedVerificationRun,
  thresholds: VerificationThresholds,
  results: DetectorResult[],
  screen: ScreenHeuristicResult,
  decision: ReturnType<typeof evaluateVerificationDecision>,
) {
  const { error } = await admin.rpc('complete_verification_run', {
    p_run_id: claim.run_id,
    p_decision: decision.decision,
    p_reason_code: decision.reasonCode,
    p_reason: decision.reason,
    p_pipeline_version: thresholds.pipelineVersion,
    p_thresholds: thresholdSnapshot(thresholds),
    p_results: results.map(serializeResult),
    p_screen_heuristics: serializeScreen(screen),
  });
  if (error) throw new Error(`Verification completion RPC failed: ${error.message}`);
}

async function executeClaimedRun(
  admin: ReturnType<typeof getAdminSupabase>,
  claim: ClaimedVerificationRun,
): Promise<PipelineOutcome> {
  let thresholds: VerificationThresholds | null = null;
  let screen: ScreenHeuristicResult = {
    score: 0,
    suspected: false,
    coverage: 'partial_v1',
    signals: {
      periodicTexture: 0,
      edgeDensity: 0,
      borderContrast: 0,
      highlightFraction: 0,
      displayAspectMatch: 0,
      displayResolutionMatch: 0,
    },
    reasons: [],
    limitations: ['Screen analysis did not complete.'],
  };

  try {
    const loadedThresholds = await loadVerificationThresholds(admin);
    thresholds = loadedThresholds;
    const original = await locateOriginal(admin, claim.creator_id, claim.work_id);
    const metadata = await sharp(original.bytes, { failOn: 'error', limitInputPixels: 100_000_000 }).metadata();
    if (!metadata.width || !metadata.height) throw new Error('Original dimensions could not be read.');
    const provenance = await loadProvenanceInputs(admin, claim.work_id);

    screen = await analyzeScreenRephotographHeuristics(
      original.bytes,
      metadata.width,
      metadata.height,
      loadedThresholds.localScreenEscalateThreshold,
    );

    const providers = [
      createDetectorProvider(loadedThresholds.primaryProvider, 'primary'),
      createDetectorProvider(loadedThresholds.secondaryProvider, 'secondary'),
    ];
    if (loadedThresholds.optionalProviderEnabled) {
      providers.push(createDetectorProvider('illuminarty', 'optional'));
    }

    const results = await Promise.all(providers.map(provider => provider.analyze({
      bytes: original.bytes,
      mimeType: original.mimeType,
      fileName: original.fileName,
      workId: claim.work_id,
      creatorId: claim.creator_id,
      timeoutMs: loadedThresholds.providerTimeoutMs,
    })));

    const decision = evaluateVerificationDecision({
      results,
      provenance,
      screen,
      thresholds: loadedThresholds,
    });
    await completeRun(admin, claim, loadedThresholds, results, screen, decision);
    return {
      processed: true,
      workId: claim.work_id,
      runId: claim.run_id,
      decision: decision.decision,
    };
  } catch (error) {
    console.error('[automated-verification] Pipeline run failed safely.', {
      runId: claim.run_id,
      workId: claim.work_id,
      errorClass: error instanceof Error ? error.name : 'UnknownError',
      error: error instanceof Error ? error.message : String(error),
    });

    if (thresholds) {
      const failureResult = pipelineErrorResult(error);
      const safeDecision = {
        decision: 'escalate' as const,
        reasonCode: 'PIPELINE_EXECUTION_ERROR',
        reason: 'Automated review could not complete safely. The Work was escalated and was not defaulted to VERIFIED.',
        requiredProviderAgreement: false,
        strongSignals: [],
        uncertaintySignals: [error instanceof Error ? error.message : String(error)],
      };
      try {
        await completeRun(admin, claim, thresholds, [failureResult], screen, safeDecision);
      } catch (completionError) {
        console.error('[automated-verification] Safe escalation could not be persisted.', {
          runId: claim.run_id,
          workId: claim.work_id,
          errorClass: completionError instanceof Error ? completionError.name : 'UnknownError',
          error: completionError instanceof Error ? completionError.message : String(completionError),
        });
      }
    }

    return {
      processed: true,
      workId: claim.work_id,
      runId: claim.run_id,
      decision: 'escalate',
    };
  }
}

async function claimRun(workId: string | null): Promise<{
  admin: ReturnType<typeof getAdminSupabase>;
  claim: ClaimedVerificationRun | null;
}> {
  const admin = getAdminSupabase();
  const { data, error } = await admin.rpc('claim_verification_run', { p_work_id: workId });
  if (error) throw new Error(`Verification claim RPC failed: ${error.message}`);
  return {
    admin,
    claim: data && typeof data === 'object' ? data as ClaimedVerificationRun : null,
  };
}

export async function runVerificationForWork(workId: string): Promise<PipelineOutcome> {
  const { admin, claim } = await claimRun(workId);
  if (!claim) return { processed: false, workId, runId: null, decision: null };
  return executeClaimedRun(admin, claim);
}

export async function processQueuedVerificationRuns(limit = 3): Promise<PipelineOutcome[]> {
  const outcomes: PipelineOutcome[] = [];
  const normalizedLimit = Math.min(10, Math.max(1, Math.floor(limit)));
  for (let index = 0; index < normalizedLimit; index += 1) {
    const { admin, claim } = await claimRun(null);
    if (!claim) break;
    outcomes.push(await executeClaimedRun(admin, claim));
  }
  return outcomes;
}
