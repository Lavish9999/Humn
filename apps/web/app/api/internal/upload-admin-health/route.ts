import { randomUUID } from 'node:crypto';
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

    const signedPath = `health-check/${randomUUID()}.jpg`;
    const signedUpload = original.error
      ? { data: null, error: original.error }
      : await admin.storage.from(ORIGINAL_BUCKET).createSignedUploadUrl(signedPath, { upsert: false });

    const ok = !original.error
      && !display.error
      && !signedUpload.error
      && Boolean(signedUpload.data?.token);

    return NextResponse.json({
      ok,
      keySource: config.keySource,
      keyKind: config.key.startsWith('sb_secret_') ? 'secret' : 'legacy-service-role',
      projectHost: new URL(config.url).host,
      buckets: {
        original: { exists: Boolean(original.data) && !original.error, errorClass: original.error?.name ?? null },
        display: { exists: Boolean(display.data) && !display.error, errorClass: display.error?.name ?? null },
      },
      signedUpload: {
        ready: Boolean(signedUpload.data?.token) && !signedUpload.error,
        errorClass: signedUpload.error?.name ?? null,
      },
    }, { status: ok ? 200 : 503 });
  } catch (error) {
    if (error instanceof SupabaseAdminConfigurationError) {
      return NextResponse.json({
        ok: false,
        errorClass: error.name,
        errorCode: error.code,
        keySource: error.keySource,
      }, { status: 503 });
    }
    return NextResponse.json({
      ok: false,
      errorClass: error instanceof Error ? error.name : 'UnknownError',
    }, { status: 500 });
  }
}
