import { NextResponse } from 'next/server';
import sharp from 'sharp';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

type ProviderCheck = {
  statusCode: number | null;
  accepted: boolean;
  hasExpectedScore: boolean;
  errorCode: string | null;
  errorMessage: string | null;
};

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

function errorDetails(body: Record<string, unknown>, fallback: string) {
  const error = body.error && typeof body.error === 'object'
    ? body.error as Record<string, unknown>
    : null;
  return {
    errorCode: typeof error?.code === 'string' ? error.code : fallback,
    errorMessage: typeof error?.message === 'string'
      ? error.message.slice(0, 240)
      : typeof body.message === 'string'
        ? body.message.slice(0, 240)
        : null,
  };
}

async function checkSightengine({
  image,
  model,
  apiUser,
  apiSecret,
}: {
  image: Buffer;
  model: 'genai' | 'recapture' | 'deepfake';
  apiUser: string;
  apiSecret: string;
}): Promise<ProviderCheck> {
  try {
    const form = new FormData();
    form.append('media', new Blob([new Uint8Array(image)], { type: 'image/jpeg' }), 'humn-provider-health.jpg');
    form.append('models', model);
    form.append('api_user', apiUser);
    form.append('api_secret', apiSecret);
    const response = await fetch('https://api.sightengine.com/1.0/check.json', {
      method: 'POST',
      body: form,
      cache: 'no-store',
      signal: AbortSignal.timeout(20_000),
    });
    const body = await response.json().catch(() => ({})) as Record<string, unknown>;
    const type = body.type && typeof body.type === 'object'
      ? body.type as Record<string, unknown>
      : null;
    const expectedScore = model === 'genai'
      ? type?.ai_generated
      : model === 'deepfake'
        ? type?.deepfake
        : body.recapture && typeof body.recapture === 'object'
          ? (body.recapture as Record<string, unknown>).score
          : null;
    const hasExpectedScore = typeof expectedScore === 'number' && Number.isFinite(expectedScore);
    const accepted = response.ok && body.status !== 'failure' && hasExpectedScore;
    const details = accepted
      ? { errorCode: null, errorMessage: null }
      : errorDetails(body, `SIGHTENGINE_HTTP_${response.status}`);
    return {
      statusCode: response.status,
      accepted,
      hasExpectedScore,
      ...details,
    };
  } catch (error) {
    return {
      statusCode: null,
      accepted: false,
      hasExpectedScore: false,
      errorCode: error instanceof DOMException && error.name === 'TimeoutError'
        ? 'SIGHTENGINE_TIMEOUT'
        : 'SIGHTENGINE_REQUEST_FAILED',
      errorMessage: error instanceof Error ? error.message.slice(0, 240) : null,
    };
  }
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

  const sightengine = sightengineUser && sightengineSecret
    ? {
        genai: await checkSightengine({ image, model: 'genai', apiUser: sightengineUser, apiSecret: sightengineSecret }),
        recapture: await checkSightengine({ image, model: 'recapture', apiUser: sightengineUser, apiSecret: sightengineSecret }),
        deepfake: await checkSightengine({ image, model: 'deepfake', apiUser: sightengineUser, apiSecret: sightengineSecret }),
      }
    : null;

  const hive: ProviderCheck & { hasDeepfakeScore: boolean } = {
    statusCode: null,
    accepted: false,
    hasExpectedScore: false,
    hasDeepfakeScore: false,
    errorCode: hiveSecret ? null : 'HIVE_NOT_CONFIGURED',
    errorMessage: null,
  };

  if (hiveSecret) {
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
      hive.hasExpectedScore = aiScore !== null;
      hive.hasDeepfakeScore = deepfakeScore !== null;
      hive.accepted = response.ok && hive.hasExpectedScore;
      if (!hive.accepted) Object.assign(hive, errorDetails(body, `HIVE_HTTP_${response.status}`));
    } catch (error) {
      hive.errorCode = error instanceof DOMException && error.name === 'TimeoutError'
        ? 'HIVE_TIMEOUT'
        : 'HIVE_REQUEST_FAILED';
      hive.errorMessage = error instanceof Error ? error.message.slice(0, 240) : null;
    }
  }

  const sightengineAccepted = Boolean(
    sightengine?.genai.accepted
    && sightengine.recapture.accepted
    && sightengine.deepfake.accepted,
  );
  const ok = Object.values(configured).every(Boolean) && sightengineAccepted && hive.accepted;
  return NextResponse.json({ ok, configured, sightengine, hive }, { status: ok ? 200 : 503 });
}
