import { NextResponse } from 'next/server';
import sharp from 'sharp';
import { createSightengineProvider } from '../../../../../lib/verification/providers/sightengine';
import { createHiveProvider } from '../../../../../lib/verification/providers/hive';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET() {
  const image = await sharp({
    create: {
      width: 128,
      height: 128,
      channels: 3,
      background: { r: 240, g: 239, b: 235 },
    },
  }).jpeg({ quality: 90 }).toBuffer();

  const input = {
    bytes: image,
    mimeType: 'image/jpeg',
    fileName: 'humn-provider-health.jpg',
    workId: '00000000-0000-0000-0000-000000000000',
    creatorId: '00000000-0000-0000-0000-000000000000',
    timeoutMs: 20_000,
  } as const;

  const sightengine = createSightengineProvider('primary');
  const hive = createHiveProvider('secondary');
  const [sightengineResult, hiveResult] = await Promise.all([
    sightengine.analyze(input),
    hive.analyze(input),
  ]);

  const configured = {
    automatedReviewSecret: Boolean(process.env.AUTOMATED_REVIEW_SECRET?.trim()),
    sightengine: sightengine.configured,
    hive: hive.configured,
    supabaseSecret: Boolean(
      process.env.SUPABASE_SECRET_KEY?.trim()
      || process.env.SUPABASE_SERVICE_ROLE_KEY?.trim(),
    ),
  };

  const providers = {
    sightengine: {
      status: sightengineResult.status,
      hasAiScore: sightengineResult.aiScore !== null,
      hasDeepfakeScore: sightengineResult.deepfakeScore !== null,
      hasRecaptureScore: sightengineResult.recaptureScore !== null,
      errorCode: sightengineResult.errorCode,
      latencyMs: sightengineResult.latencyMs,
    },
    hive: {
      status: hiveResult.status,
      hasAiScore: hiveResult.aiScore !== null,
      hasDeepfakeScore: hiveResult.deepfakeScore !== null,
      errorCode: hiveResult.errorCode,
      latencyMs: hiveResult.latencyMs,
    },
  };

  const ok = Object.values(configured).every(Boolean)
    && sightengineResult.status === 'ok'
    && sightengineResult.aiScore !== null
    && hiveResult.status === 'ok'
    && hiveResult.aiScore !== null;

  return NextResponse.json({ ok, configured, providers }, { status: ok ? 200 : 503 });
}
