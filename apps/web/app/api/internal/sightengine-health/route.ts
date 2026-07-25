import { NextResponse } from 'next/server';
import sharp from 'sharp';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

function numberAt(value: unknown, path: string[]): number | null {
  let current: unknown = value;
  for (const key of path) {
    if (!current || typeof current !== 'object' || !(key in current)) return null;
    current = (current as Record<string, unknown>)[key];
  }
  return typeof current === 'number' && Number.isFinite(current) ? current : null;
}

export async function GET() {
  const apiUser = process.env.SIGHTENGINE_API_USER?.trim() ?? '';
  const apiSecret = process.env.SIGHTENGINE_API_SECRET?.trim() ?? '';
  const endpoint = process.env.SIGHTENGINE_API_URL?.trim() || 'https://api.sightengine.com/1.0/check.json';

  if (!apiUser || !apiSecret) {
    return NextResponse.json({
      ok: false,
      configured: {
        apiUser: Boolean(apiUser),
        apiSecret: Boolean(apiSecret),
      },
      providerAccepted: false,
      errorCode: 'SIGHTENGINE_ENV_MISSING',
    }, { status: 503 });
  }

  try {
    const image = await sharp({
      create: {
        width: 64,
        height: 64,
        channels: 3,
        background: { r: 244, g: 244, b: 240 },
      },
    }).png().toBuffer();

    const form = new FormData();
    form.append('media', new Blob([image], { type: 'image/png' }), 'humn-health.png');
    form.append('models', 'genai');
    form.append('api_user', apiUser);
    form.append('api_secret', apiSecret);

    const response = await fetch(endpoint, {
      method: 'POST',
      body: form,
      cache: 'no-store',
      signal: AbortSignal.timeout(20_000),
    });
    const body = await response.json().catch(() => ({})) as Record<string, unknown>;
    const providerStatus = typeof body.status === 'string' ? body.status : null;
    const error = body.error && typeof body.error === 'object'
      ? body.error as Record<string, unknown>
      : null;
    const errorCode = typeof error?.code === 'string' ? error.code : null;
    const aiScore = numberAt(body, ['type', 'ai_generated']);
    const accepted = response.ok && providerStatus !== 'failure' && aiScore !== null;

    return NextResponse.json({
      ok: accepted,
      configured: {
        apiUser: true,
        apiSecret: true,
      },
      providerAccepted: accepted,
      statusCode: response.status,
      providerStatus,
      hasAiScore: aiScore !== null,
      errorCode,
    }, { status: accepted ? 200 : 502 });
  } catch (error) {
    return NextResponse.json({
      ok: false,
      configured: {
        apiUser: true,
        apiSecret: true,
      },
      providerAccepted: false,
      errorCode: error instanceof DOMException && error.name === 'TimeoutError'
        ? 'SIGHTENGINE_TIMEOUT'
        : 'SIGHTENGINE_REQUEST_FAILED',
    }, { status: 502 });
  }
}
