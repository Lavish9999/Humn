import { NextResponse } from 'next/server';
import sharp from 'sharp';
import { createHiveProvider } from '../../../../lib/verification/providers/hive';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export async function GET() {
  const provider = createHiveProvider('secondary');
  if (!provider.configured) {
    return NextResponse.json({
      ok: false,
      configured: false,
      providerAccepted: false,
      errorCode: 'HIVE_V3_ENV_MISSING',
    }, { status: 503 });
  }

  const image = await sharp({
    create: {
      width: 96,
      height: 96,
      channels: 3,
      background: { r: 242, g: 241, b: 237 },
    },
  }).jpeg({ quality: 90 }).toBuffer();

  const result = await provider.analyze({
    bytes: image,
    mimeType: 'image/jpeg',
    fileName: 'humn-hive-v3-health.jpg',
    workId: '00000000-0000-0000-0000-000000000000',
    creatorId: '00000000-0000-0000-0000-000000000000',
    timeoutMs: 20_000,
  });

  const accepted = result.status === 'ok' && result.aiScore !== null;
  return NextResponse.json({
    ok: accepted,
    configured: true,
    providerAccepted: accepted,
    providerStatus: result.status,
    hasAiScore: result.aiScore !== null,
    hasDeepfakeScore: result.deepfakeScore !== null,
    errorCode: result.errorCode,
    latencyMs: result.latencyMs,
    modelVersion: result.modelVersion,
  }, { status: accepted ? 200 : 502 });
}
