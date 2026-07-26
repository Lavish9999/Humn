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
  const className = typeof record.class === 'string'
    ? record.class
    : typeof record.class_name === 'string'
      ? record.class_name
      : typeof record.label === 'string'
        ? record.label
        : null;
  const rawScore = record.value ?? record.score ?? record.confidence ?? record.probability;
  const score = typeof rawScore === 'number'
    ? rawScore
    : typeof rawScore === 'string' && rawScore.trim()
      ? Number(rawScore)
      : Number.NaN;
  if (className?.trim().toLowerCase() === target && Number.isFinite(score)) return score;

  for (const child of Object.values(record)) {
    const found = findClassScore(child, target);
    if (found !== null) return found;
  }
  return null;
}

export async function GET() {
  const hiveSecret = process.env.HIVE_V3_SECRET_KEY?.trim() || process.env.HIVE_API_KEY?.trim() || '';
  const automatedReviewSecret = process.env.AUTOMATED_REVIEW_SECRET?.trim() ?? '';

  const configured = {
    hiveV3Secret: Boolean(hiveSecret),
    automatedReviewSecret: Boolean(automatedReviewSecret),
  };

  const hive = {
    attempted: false,
    statusCode: null as number | null,
    accepted: false,
    hasAiScore: false,
    hasDeepfakeScore: false,
    errorCode: hiveSecret ? null as string | null : 'HIVE_NOT_CONFIGURED',
  };

  if (hiveSecret) {
    hive.attempted = true;
    try {
      const image = await sharp({
        create: {
          width: 128,
          height: 128,
          channels: 3,
          background: { r: 240, g: 239, b: 235 },
        },
      }).jpeg({ quality: 90 }).toBuffer();

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

  const ok = Object.values(configured).every(Boolean) && hive.accepted;
  return NextResponse.json({ ok, configured, hive }, { status: ok ? 200 : 503 });
}
