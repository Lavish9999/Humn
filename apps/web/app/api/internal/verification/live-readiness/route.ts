import { NextResponse } from 'next/server';
import sharp from 'sharp';
import { getAdminSupabase } from '../../../../../lib/supabase/admin';
import { createSightengineProvider } from '../../../../../lib/verification/providers/sightengine';
import { createHiveProvider } from '../../../../../lib/verification/providers/hive';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

function safeProvider(result: Awaited<ReturnType<ReturnType<typeof createSightengineProvider>['analyze']>>) {
  const recapture = result.rawResponse && typeof result.rawResponse === 'object'
    ? (result.rawResponse as Record<string, unknown>).recapture
    : null;
  const recaptureError = recapture && typeof recapture === 'object'
    ? (recapture as Record<string, unknown>).error
    : null;
  const recaptureMessage = recaptureError && typeof recaptureError === 'object'
    ? (recaptureError as Record<string, unknown>).message
    : null;

  return {
    status: result.status,
    aiScore: result.aiScore,
    authenticScore: result.authenticScore,
    confidence: result.confidence,
    recaptureScore: result.recaptureScore,
    deepfakeScore: result.deepfakeScore,
    errorCode: result.errorCode,
    recaptureErrorMessage: typeof recaptureMessage === 'string'
      ? recaptureMessage.slice(0, 240)
      : null,
    latencyMs: result.latencyMs,
  };
}

export async function GET() {
  const image = await sharp({
    create: {
      width: 512,
      height: 512,
      channels: 3,
      background: { r: 236, g: 233, b: 225 },
    },
  }).jpeg({ quality: 92 }).toBuffer();

  const input = {
    bytes: image,
    mimeType: 'image/jpeg',
    fileName: 'humn-live-readiness.jpg',
    workId: '00000000-0000-0000-0000-000000000000',
    creatorId: '00000000-0000-0000-0000-000000000000',
    timeoutMs: 20_000,
  } as const;

  const previousRecapture = process.env.SIGHTENGINE_RECAPTURE_ENABLED;
  process.env.SIGHTENGINE_RECAPTURE_ENABLED = 'true';
  const sightengine = createSightengineProvider('primary');
  if (previousRecapture === undefined) delete process.env.SIGHTENGINE_RECAPTURE_ENABLED;
  else process.env.SIGHTENGINE_RECAPTURE_ENABLED = previousRecapture;

  const hive = createHiveProvider('secondary');
  const [sightengineResult, hiveResult] = await Promise.all([
    sightengine.analyze(input),
    hive.analyze(input),
  ]);

  const admin = getAdminSupabase();
  const { error: queueRpcError } = await admin.rpc('claim_verification_run', {
    p_work_id: '00000000-0000-0000-0000-000000000000',
  });

  const response = {
    configured: {
      sightengine: sightengine.configured,
      hive: hive.configured,
      workerSecret: Boolean(process.env.AUTOMATED_REVIEW_SECRET?.trim()),
      supabaseSecret: Boolean(
        process.env.SUPABASE_SECRET_KEY?.trim()
        || process.env.SUPABASE_SERVICE_ROLE_KEY?.trim(),
      ),
    },
    sightengine: safeProvider(sightengineResult),
    hive: safeProvider(hiveResult),
    database: {
      claimVerificationRunAvailable: !queueRpcError,
      errorCode: queueRpcError?.code ?? null,
      errorMessage: queueRpcError?.message?.slice(0, 240) ?? null,
    },
  };

  const ok = Object.values(response.configured).every(Boolean)
    && sightengineResult.status === 'ok'
    && sightengineResult.aiScore !== null
    && sightengineResult.recaptureScore !== null
    && sightengineResult.deepfakeScore !== null
    && hiveResult.status === 'ok'
    && hiveResult.aiScore !== null
    && response.database.claimVerificationRunAvailable;

  return NextResponse.json({ ok, ...response }, { status: ok ? 200 : 503 });
}
