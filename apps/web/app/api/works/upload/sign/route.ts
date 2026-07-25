import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { getServerSupabase } from '../../../../../lib/supabase/server';
import { getAdminSupabase } from '../../../../../lib/supabase/admin';
import {
  ORIGINAL_BUCKET,
  type AcceptedImageType,
} from '../../../../../lib/uploads/constants';
import { getPostingRestriction } from '../../../../../lib/uploads/posting-access';
import {
  buildOriginalStoragePath,
  validateUploadDescriptor,
  type WorkUploadDescriptor,
} from '../../../../../lib/uploads/work-upload-security';

export const runtime = 'nodejs';
export const maxDuration = 30;

type SignUploadRequest = Partial<WorkUploadDescriptor>;

function logSignError(message: string, details: Record<string, unknown>) {
  console.error('[work-upload:sign]', message, details);
}

export async function POST(request: Request) {
  const supabase = await getServerSupabase();
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) {
    return NextResponse.json({
      ok: false,
      errorCode: 'AUTH_REQUIRED',
      formError: 'Your session expired. Sign in again before uploading.',
      redirectTo: '/signin?next=%2Fshare',
    }, { status: 401 });
  }

  const { data: profile, error: profileError } = await supabase
    .from('users')
    .select('id')
    .eq('id', authData.user.id)
    .maybeSingle();
  if (profileError) {
    logSignError('Profile lookup failed.', {
      userId: authData.user.id,
      error: profileError.message,
    });
    return NextResponse.json({
      ok: false,
      errorCode: 'PROFILE_LOOKUP_FAILED',
      formError: 'Your creator profile could not be checked. Try again.',
    }, { status: 500 });
  }
  if (!profile) {
    return NextResponse.json({
      ok: false,
      errorCode: 'PROFILE_REQUIRED',
      redirectTo: '/complete-profile',
    }, { status: 409 });
  }

  let payload: SignUploadRequest;
  try {
    payload = await request.json() as SignUploadRequest;
  } catch (error) {
    logSignError('Request JSON could not be read.', {
      userId: authData.user.id,
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({
      ok: false,
      errorCode: 'INVALID_REQUEST',
      formError: 'The upload request could not be read.',
    }, { status: 400 });
  }

  const descriptor: WorkUploadDescriptor = {
    fileName: typeof payload.fileName === 'string' ? payload.fileName : '',
    fileSize: typeof payload.fileSize === 'number' ? payload.fileSize : Number.NaN,
    mimeType: typeof payload.mimeType === 'string' ? payload.mimeType : '',
  };
  const fieldErrors = validateUploadDescriptor(descriptor);
  if (Object.keys(fieldErrors).length) {
    return NextResponse.json({
      ok: false,
      errorCode: descriptor.fileSize > 15 * 1024 * 1024 ? 'FILE_TOO_LARGE' : 'INVALID_FILE',
      fieldErrors,
    }, { status: descriptor.fileSize > 15 * 1024 * 1024 ? 413 : 400 });
  }

  const admin = getAdminSupabase();
  const posting = await getPostingRestriction(admin, authData.user.id);
  if (posting.error) {
    logSignError('Posting status RPC failed.', {
      userId: authData.user.id,
      error: posting.error,
    });
    return NextResponse.json({
      ok: false,
      errorCode: 'POSTING_STATUS_FAILED',
      formError: 'Posting status could not be checked. Try again.',
    }, { status: 500 });
  }
  if (posting.restriction) {
    return NextResponse.json({
      ok: false,
      errorCode: 'POSTING_RESTRICTED',
      formError: posting.restriction,
    }, { status: 403 });
  }

  const workId = randomUUID();
  const path = buildOriginalStoragePath(
    authData.user.id,
    workId,
    descriptor.mimeType as AcceptedImageType,
  );
  const { data, error } = await admin.storage
    .from(ORIGINAL_BUCKET)
    .createSignedUploadUrl(path, { upsert: false });

  if (error || !data?.token) {
    logSignError('Supabase signed upload URL creation failed.', {
      userId: authData.user.id,
      workId,
      path,
      error: error?.message ?? 'Missing upload token.',
    });
    return NextResponse.json({
      ok: false,
      errorCode: 'SIGNED_URL_FAILED',
      formError: 'Upload permission could not be created. Try again.',
    }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    upload: {
      bucket: ORIGINAL_BUCKET,
      workId,
      path,
      token: data.token,
      signedUrl: data.signedUrl,
      expiresInSeconds: 7200,
    },
  });
}
