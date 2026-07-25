import { NextResponse } from 'next/server';
import { resolveSupabaseAdminConfig, SupabaseAdminConfigurationError } from '../../../../lib/supabase/admin-config';
import { getAdminSupabase } from '../../../../lib/supabase/admin';
import { DISPLAY_BUCKET, ORIGINAL_BUCKET } from '../../../../lib/uploads/constants';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const config = resolveSupabaseAdminConfig();
    const admin = getAdminSupabase();
    const [original, display] = await Promise.all([
      admin.storage.getBucket(ORIGINAL_BUCKET),
      admin.storage.getBucket(DISPLAY_BUCKET),
    ]);

    return NextResponse.json({
      ok: !original.error && !display.error,
      keySource: config.keySource,
      keyKind: config.key.startsWith('sb_secret_') ? 'secret' : 'legacy-service-role',
      projectHost: new URL(config.url).host,
      buckets: {
        original: {
          exists: Boolean(original.data) && !original.error,
          errorClass: original.error?.name ?? null,
          errorMessage: original.error?.message ?? null,
        },
        display: {
          exists: Boolean(display.data) && !display.error,
          errorClass: display.error?.name ?? null,
          errorMessage: display.error?.message ?? null,
        },
      },
    }, { status: original.error || display.error ? 503 : 200 });
  } catch (error) {
    if (error instanceof SupabaseAdminConfigurationError) {
      return NextResponse.json({
        ok: false,
        errorClass: error.name,
        errorCode: error.code,
        keySource: error.keySource,
        message: error.message,
      }, { status: 503 });
    }

    return NextResponse.json({
      ok: false,
      errorClass: error instanceof Error ? error.name : 'UnknownError',
      message: error instanceof Error ? error.message : String(error),
    }, { status: 500 });
  }
}
