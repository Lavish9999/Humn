import { NextResponse } from 'next/server';
import sharp from 'sharp';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

function findClassScore(value: unknown, target: string): number | null {
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findClassScore(item, target);
      if (found !== null) return found;
    }
    return null;
  }

  if (!value || typeof value !== 'object') return null;
  const record = value as Record<string, unknown>;
  if (record.class === target && typeof record.value === 'number' && Number.isFinite(record.value)) {
    return record.value;
  }

  for (const child of Object.values(record)) {
    const found = findClassScore(child, target);
    if (found !== null) return found;
  }
  return null;
}

export async function GET() {
  const sightengineUser = process.env.SIGHTENGINE_API_USER?.trim() ?? '';
  const sightengineSecret = process.env.SIGHTENGINE_API_SECRET?.trim() ?? '';
  const hiveSecret = process.env.HIVE_V3_SECRET_KEY?.trim() || process.env.HIVE_API_KEY?.trim() || '';
  const automatedReviewSecret = process.env.AUTOMATED_REVIEW_SECRET?.trim() ?? '';
  const supabaseSecret = process.env.SUPABASE_SECRET_KEY?.trim() || process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || '';

  const configured = {
    sightengineUser: Boolean(sightengineUser),
    sightengineSecret: Boolean(sightengineSecret),
    hiveV3Secret: Boolean(hiveSecret),
    automatedReviewSecret: Boolean(automatedReviewSecret),
    supabaseSecret: Boolean(supabaseSecret),
  };

  const image = await sharp({
    create: {
      width: 128,
      height: 128,
      channels: 3,
      background: { r: 240, g: 239, b: 235 },
    },
  }).jpeg({ quality: 90 }).toBuffer();

  const sightengine = {
    configured: Boolean(sightengineUser && sightengineSecret),
    statusCode: null as number | null,
    accepted: false,
    hasAiScore: false,
    errorCode: null as string | null,
  };

  if (sightengine.configured) {
    try {
      const form = new FormData();
      form.append('media', new Blob([image], { type: 'image/jpeg' }), 'humn-provider-health.jpg');
      form.append('models', 'genai,recapture,deepfake');
      form.append('api_user', sightengineUser);
      form.append('api_secret', sightengineSecret);
      const response = await fetch('https://api.sightengine.com/1.0/check.json', {
        method: 'POST',
        body: form,
        cache: 'no-store',
        signal: AbortSignal.timeout(20_000),
      });
      const body = await response.json().catch(() => ({})) as Record<string, unknown>;
      const aiScore = body.type && typeof body.type === 'object'
        ? (body.type as Record<string, unknown>).ai_generated
        : null;
      sightengine.statusCode = response.status;
      sightengine.hasAiScore = typeof aiScore === 'number' && Number.isFinite(aiScore);
      sightengine.accepted = response.ok && body.status !== 'failure' && sightengine.hasAiScore;
      if (!sightengine.accepted) {
        const error = body.error && typeof body.error === 'object'
          ? body.error as Record<string, unknown>
          : null;
        sightengine.errorCode = typeof error?.code === 'string'
          ? error.code
          : `SIGHTENGINE_HTTP_${response.status}`;
      }
    } catch (error) {
      sightengine.errorCode = error instanceof DOMException && error.name === 'TimeoutError'
        ? 'SIGHTENGINE_TIMEOUT'
        : 'SIGHTENGINE_REQUEST_FAILED';
    }
  }

  const hive = {
    configured: Boolean(hiveSecret),
    statusCode: null as number | null,
    accepted: false,
    hasAiScore: false,
    hasDeepfakeScore: false,
    errorCode: null as string | null,
  };

  if (hive.configured) {
    try {
      const response = await fetch(
        'https://api.thehive.ai/api/v3/hive/ai-generated-and-deepfake-content-detection',
        {
          method: 'POST',
          headers: {
            authorization: `Bearer ${hiveSecret}`,
            'content-type': 'application/json',
          },
          body: JSON.stringify({
            media_metadata: true,
            input: [{ media_base64: `data:image/jpeg;base64,${image.toString('base64')}` }],
          }),
          cache: 'no-store',
          signal: AbortSignal.timeout(20_000),
        },
      );
      const body = await response.json().catch(() => ({})) as Record<string, unknown>;
      const aiScore = findClassScore(body, 'ai_generated');
      const deepfakeScore = findClassScore(body, 'deepfake');
      hive.statusCode = response.status;
      hive.hasAiScore = aiScore !== null;
      hive.hasDeepfakeScore = deepfakeScore !== null;
      hive.accepted = response.ok && hive.hasAiScore;
      if (!hive.accepted) hive.errorCode = `HIVE_HTTP_${response.status}`;
    } catch (error) {
      hive.errorCode = error instanceof DOMException && error.name === 'TimeoutError'
        ? 'HIVE_TIMEOUT'
        : 'HIVE_REQUEST_FAILED';
    }
  }

  const ok = Object.values(configured).every(Boolean) && sightengine.accepted && hive.accepted;
  return NextResponse.json({ ok, configured, sightengine, hive }, { status: ok ? 200 : 503 });
}
