import 'server-only';

import { NextResponse } from 'next/server';
import { SupabaseAdminConfigurationError } from '../supabase/admin-config';

type UploadFailureContext = 'sign' | 'finalize';

type FailureDetails = Record<string, unknown>;

export function adminConfigurationFailureResponse(
  error: unknown,
  context: UploadFailureContext,
  details: FailureDetails,
): NextResponse | null {
  if (!(error instanceof SupabaseAdminConfigurationError)) return null;

  console.error(`[work-upload:${context}] Supabase admin configuration failure.`, {
    ...details,
    errorClass: error.name,
    errorCode: error.code,
    keySource: error.keySource,
    error: error.message,
  });

  const publicKeyFailure = error.code === 'SUPABASE_ADMIN_KEY_PUBLIC'
    || error.code === 'SUPABASE_ADMIN_KEY_WRONG_ROLE';
  const missingUrl = error.code === 'SUPABASE_ADMIN_URL_MISSING';

  return NextResponse.json({
    ok: false,
    errorClass: error.name,
    errorCode: missingUrl
      ? 'UPLOAD_SUPABASE_URL_MISSING'
      : publicKeyFailure
        ? 'UPLOAD_ADMIN_KEY_INVALID'
        : 'UPLOAD_ADMIN_KEY_MISSING',
    formError: missingUrl
      ? 'Humn’s upload server is missing its Supabase project URL. This is a server configuration issue, not a connection problem.'
      : publicKeyFailure
        ? 'Humn’s upload server is using a public or wrong-role Supabase key. A current server secret is required.'
        : 'Humn’s upload server is missing its current Supabase secret key. This is a server configuration issue, not a connection problem.',
  }, { status: 503 });
}

export function storageAdministrationFailureResponse({
  context,
  step,
  message,
  details,
}: {
  context: UploadFailureContext;
  step: 'bucket-configuration' | 'signed-url' | 'download' | 'display-upload' | 'thumbnail-upload';
  message: string;
  details: FailureDetails;
}): NextResponse {
  const normalized = message.toLowerCase();
  const keyRejected = normalized.includes('invalid api key')
    || normalized.includes('invalid jwt')
    || normalized.includes('jwt expired')
    || normalized.includes('unauthorized')
    || normalized.includes('not authorized');
  const bucketMissing = normalized.includes('bucket not found')
    || normalized.includes('missing bucket')
    || normalized.includes('could not be inspected');
  const policyDenied = normalized.includes('row-level security')
    || normalized.includes('policy')
    || normalized.includes('permission denied')
    || normalized.includes('access denied');

  const errorCode = keyRejected
    ? 'UPLOAD_ADMIN_KEY_REJECTED'
    : bucketMissing
      ? 'UPLOAD_BUCKET_MISSING'
      : policyDenied
        ? 'UPLOAD_STORAGE_POLICY_DENIED'
        : `UPLOAD_${step.replaceAll('-', '_').toUpperCase()}_FAILED`;
  const status = keyRejected || bucketMissing ? 503 : policyDenied ? 403 : 500;
  const formError = keyRejected
    ? 'Supabase rejected Humn’s server key. The rotated Production secret must be updated in Vercel.'
    : bucketMissing
      ? 'The required Supabase Storage bucket is missing or unavailable.'
      : policyDenied
        ? 'Supabase Storage denied this operation under the current bucket policy.'
        : step === 'signed-url'
          ? 'Secure upload permission could not be created.'
          : step === 'bucket-configuration'
            ? 'The upload Storage buckets could not be prepared.'
            : step === 'download'
              ? 'The uploaded original could not be read from Storage.'
              : step === 'display-upload'
                ? 'The display image could not be saved to Storage.'
                : 'The thumbnail could not be saved to Storage.';

  console.error(`[work-upload:${context}] Supabase Storage administration failure.`, {
    ...details,
    step,
    errorClass: 'SupabaseStorageAdministrationError',
    errorCode,
    error: message,
  });

  return NextResponse.json({
    ok: false,
    errorClass: 'SupabaseStorageAdministrationError',
    errorCode,
    formError,
  }, { status });
}
