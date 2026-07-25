import { timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { processQueuedVerificationRuns } from '../../../../../lib/verification/pipeline';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

function authorized(request: Request): boolean {
  const configured = process.env.AUTOMATED_REVIEW_SECRET?.trim()
    || process.env.CRON_SECRET?.trim()
    || '';
  if (!configured) return false;
  const header = request.headers.get('authorization') ?? '';
  const supplied = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  if (!supplied) return false;
  const expectedBytes = Buffer.from(configured);
  const suppliedBytes = Buffer.from(supplied);
  return expectedBytes.length === suppliedBytes.length
    && timingSafeEqual(expectedBytes, suppliedBytes);
}

async function run(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ ok: false, error: 'Trusted worker authorization required.' }, { status: 401 });
  }
  const url = new URL(request.url);
  const requestedLimit = Number(url.searchParams.get('limit') ?? 3);
  const limit = Number.isFinite(requestedLimit) ? Math.min(10, Math.max(1, Math.floor(requestedLimit))) : 3;
  try {
    const outcomes = await processQueuedVerificationRuns(limit);
    return NextResponse.json({ ok: true, processed: outcomes.length, outcomes });
  } catch (error) {
    console.error('[automated-verification] Recovery worker failed.', {
      errorClass: error instanceof Error ? error.name : 'UnknownError',
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ ok: false, error: 'The verification worker failed safely.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  return run(request);
}

export async function GET(request: Request) {
  return run(request);
}
