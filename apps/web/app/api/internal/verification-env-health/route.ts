import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const configured = {
    automatedReviewSecret: Boolean(process.env.AUTOMATED_REVIEW_SECRET?.trim()),
    sightengineUser: Boolean(process.env.SIGHTENGINE_API_USER?.trim()),
    sightengineSecret: Boolean(process.env.SIGHTENGINE_API_SECRET?.trim()),
    hiveV3Secret: Boolean(process.env.HIVE_V3_SECRET_KEY?.trim() || process.env.HIVE_API_KEY?.trim()),
    supabaseSecret: Boolean(process.env.SUPABASE_SECRET_KEY?.trim() || process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()),
  };

  return NextResponse.json({
    ok: Object.values(configured).every(Boolean),
    configured,
  }, { status: Object.values(configured).every(Boolean) ? 200 : 503 });
}
