import { NextResponse } from 'next/server';
import { productConfig } from '@human/config';
import { getServerSupabase } from '../../../../../lib/supabase/server';
import { getAdminSupabase } from '../../../../../lib/supabase/admin';
import {
  DISPLAY_BUCKET,
  isAcceptedImageType,
  isCanonicalCategory,
  MAX_UPLOAD_BYTES,
  ORIGINAL_BUCKET,
  type AcceptedImageType,
  type OriginInput,
  type UploadFieldErrors,
} from '../../../../../lib/uploads/constants';
import {
  isSha256,
  type ClientOriginalEvidence,
  type NormalizedExifEvidence,
} from '../../../../../lib/uploads/exif-evidence';
import {
  ExifParsingError,
  processUploadedImage,
} from '../../../../../lib/uploads/process-image';
import { analyzeUploadedProvenance } from '../../../../../lib/provenance/analyze';
import { getPostingRestriction, firstRow } from '../../../../../lib/uploads/posting-access';
import {
  adminConfigurationFailureResponse,
  storageAdministrationFailureResponse,
} from '../../../../../lib/uploads/admin-failures';
import {
  isOwnedOriginalStoragePath,
  isUuid,
  validateUploadDescriptor,
} from '../../../../../lib/uploads/work-upload-security';

export const runtime = 'nodejs';
export const maxDuration = 60;

type FinalizeUploadRequest = {
  workId?: unknown;
  storagePath?: unknown;
  fileName?: unknown;
  fileSize?: unknown;
  mimeType?: unknown;
  title?: unknown;
  description?: unknown;
  category?: unknown;
  clientOriginalEvidence?: unknown;
};

type AiStrikeResult = {
  strike_id: string;
  collapsed: boolean;
  active_count: number;
  strike_level: number;
  posting_cooldown_until: string | null;
  suspended_at: string | null;
  can_post: boolean;
};

type SupabaseOperationError = {
  code?: string;
  message: string;
  details?: string;
  hint?: string;
};

function stringValue(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function numberValue(value: unknown): number {
  return typeof value === 'number' ? value : Number.NaN;
}

function objectValue(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function validateMetadata(payload: FinalizeUploadRequest): UploadFieldErrors {
  const errors: UploadFieldErrors = {};
  const title = stringValue(payload.title);
  const description = stringValue(payload.description);
  const category = stringValue(payload.category);
  const fileName = stringValue(payload.fileName);
  const mimeType = stringValue(payload.mimeType);
  const fileSize = numberValue(payload.fileSize);

  if (!title) errors.title = 'Enter a title.';
  else if (title.length > 160) errors.title = 'Title must be 160 characters or fewer.';

  if (!description) errors.description = 'Describe the specific work shown in the image.';
  else if (description.length > 5000) errors.description = 'Description must be 5,000 characters or fewer.';

  if (!isCanonicalCategory(category, productConfig.launchCategories)) {
    errors.category = 'Choose a category from the catalogue.';
  }

  Object.assign(errors, validateUploadDescriptor({ fileName, fileSize, mimeType }));
  return errors;
}

function logFinalizeError(message: string, details: Record<string, unknown>) {
  console.error('[work-upload:finalize]', message, details);
}

function emptyClientExif(source: Record<string, unknown>): NormalizedExifEvidence {
  const usableFieldCount = Number.isSafeInteger(source.usableFieldCount)
    ? Math.max(0, Math.min(10, Number(source.usableFieldCount)))
    : 0;
  const orientation = Number.isSafeInteger(source.orientation)
    && Number(source.orientation) >= 1
    && Number(source.orientation) <= 8
      ? Number(source.orientation)
      : null;

  return {
    make: null,
    model: null,
    captureDevice: null,
    lens: null,
    iso: null,
    exposureTimeSeconds: null,
    shutter: null,
    focalLengthMm: null,
    capturedAt: null,
    orientation,
    gpsMetadataPresent: source.gpsMetadataPresent === true,
    usableFieldCount,
  };
}

function sanitizeClientOriginalEvidence(
  value: unknown,
  claimedSize: number,
  mimeType: string,
): ClientOriginalEvidence | null {
  const source = objectValue(value);
  if (!source) return null;
  const scanStatus = source.scanStatus === 'complete' || source.scanStatus === 'failed'
    ? source.scanStatus
    : null;
  const sha256 = isSha256(source.sha256) ? source.sha256.toLowerCase() : null;
  const byteLength = typeof source.byteLength === 'number' && Number.isSafeInteger(source.byteLength)
    ? source.byteLength
    : Number.NaN;
  const clientMimeType = stringValue(source.mimeType);
  if (!scanStatus || !sha256 || byteLength !== claimedSize || clientMimeType !== mimeType) return null;

  const exifSource = objectValue(source.exif);
  return {
    scanStatus,
    sha256,
    byteLength,
    mimeType: clientMimeType,
    exif: exifSource ? emptyClientExif(exifSource) : null,
    errorClass: typeof source.errorClass === 'string' ? source.errorClass : null,
  };
}

function metadataPresent(exif: NormalizedExifEvidence | null | undefined): boolean {
  return Boolean(
    exif
    && (exif.usableFieldCount > 0 || exif.orientation !== null || exif.gpsMetadataPresent)
  );
}

function clientServerExifAgrees(
  client: ClientOriginalEvidence,
  server: NormalizedExifEvidence,
): boolean {
  if (client.scanStatus !== 'complete' || !client.exif) return true;
  return client.exif.usableFieldCount === server.usableFieldCount
    && Boolean(client.exif.orientation) === Boolean(server.orientation)
    && client.exif.gpsMetadataPresent === server.gpsMetadataPresent;
}

async function removeUploadedFiles(
  admin: ReturnType<typeof getAdminSupabase>,
  originalPath: string,
  displayPaths: string[],
) {
  const results = await Promise.allSettled([
    admin.storage.from(ORIGINAL_BUCKET).remove([originalPath]),
    displayPaths.length
      ? admin.storage.from(DISPLAY_BUCKET).remove(displayPaths)
      : Promise.resolve({ error: null }),
  ]);
  for (const result of results) {
    if (result.status === 'rejected') {
      logFinalizeError('Storage cleanup rejected.', {
        originalPath,
        displayPaths,
        errorClass: result.reason instanceof Error ? result.reason.name : 'UnknownError',
        error: result.reason instanceof Error ? result.reason.message : String(result.reason),
      });
    } else if (result.value.error) {
      logFinalizeError('Storage cleanup returned an error.', {
        originalPath,
        displayPaths,
        errorClass: result.value.error.name ?? 'StorageError',
        error: result.value.error.message,
      });
    }
  }
}

function aiCredentialMessage(result: AiStrikeResult): string {
  const basis = 'This upload was blocked because the file’s own embedded Content Credentials explicitly declare AI-generated origin. Humn is not using a detector or making a visual guess.';
  if (result.collapsed) return `${basis} This identical attempt matches a recent warning, so it did not add another strike.`;
  if (result.strike_level >= 3) return `${basis} This is your third active strike, so posting is suspended pending appeal. Browsing remains available.`;
  if (result.strike_level === 2) {
    const until = result.posting_cooldown_until
      ? new Date(result.posting_cooldown_until).toLocaleString('en-US')
      : 'seven days';
    return `${basis} This is your second active strike. Posting is paused until ${until}; browsing remains available.`;
  }
  return `${basis} This is an educational first warning. The upload was not published, and you may continue posting files whose credentials do not declare AI generation.`;
}

function workRecordFailureResponse(
  error: SupabaseOperationError,
  details: Record<string, unknown>,
): NextResponse {
  const normalized = error.message.toLowerCase();
  const profileRelationMissing = error.code === '23503'
    || normalized.includes('foreign key')
    || normalized.includes('creator_id');
  const policyDenied = error.code === '42501'
    || normalized.includes('row-level security')
    || normalized.includes('permission denied');
  const rpcMissing = error.code === '42883'
    || error.code === 'PGRST202'
    || normalized.includes('function') && normalized.includes('does not exist');
  const errorCode = profileRelationMissing
    ? 'CREATOR_PROFILE_RELATION_MISSING'
    : policyDenied
      ? 'WORK_RECORD_POLICY_DENIED'
      : rpcMissing
        ? 'WORK_RECORD_RPC_MISSING'
        : 'WORK_RECORD_FAILED';
  const status = profileRelationMissing ? 409 : policyDenied ? 403 : rpcMissing ? 503 : 500;
  const formError = profileRelationMissing
    ? 'Your creator profile is not ready for publishing yet. Complete or refresh your profile, then try again.'
    : policyDenied
      ? 'Supabase denied creation of this Work under the current database policy.'
      : rpcMissing
        ? 'The database function required to publish this Work is unavailable.'
        : 'The images were processed, but the Work record could not be created.';

  logFinalizeError('Work record and provenance RPC failed.', {
    ...details,
    errorClass: 'WorkRecordRpcError',
    errorCode,
    supabaseCode: error.code ?? null,
    error: error.message,
    details: error.details ?? null,
    hint: error.hint ?? null,
  });
  return NextResponse.json({ ok: false, errorClass: 'WorkRecordRpcError', errorCode, formError }, { status });
}

export async function POST(request: Request) {
  const supabase = await getServerSupabase();
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) {
    return NextResponse.json({
      ok: false,
      errorClass: 'UploadAuthenticationError',
      errorCode: 'AUTH_REQUIRED',
      formError: 'Your session expired. Sign in again before publishing.',
      redirectTo: '/signin?next=%2Fshare',
    }, { status: 401 });
  }

  let payload: FinalizeUploadRequest;
  try {
    payload = await request.json() as FinalizeUploadRequest;
  } catch (error) {
    logFinalizeError('Request JSON could not be read.', {
      userId: authData.user.id,
      errorClass: error instanceof Error ? error.name : 'UnknownError',
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({
      ok: false,
      errorClass: 'UploadRequestParseError',
      errorCode: 'INVALID_REQUEST',
      formError: 'The publish request could not be read.',
    }, { status: 400 });
  }

  const fieldErrors = validateMetadata(payload);
  if (Object.keys(fieldErrors).length) {
    const fileSize = numberValue(payload.fileSize);
    const fileTooLarge = fileSize > MAX_UPLOAD_BYTES;
    return NextResponse.json({
      ok: false,
      errorClass: fileTooLarge ? 'UploadSizeLimitError' : 'UploadValidationError',
      errorCode: fileTooLarge ? 'FILE_TOO_LARGE' : 'INVALID_METADATA',
      fieldErrors,
    }, { status: fileTooLarge ? 413 : 400 });
  }

  const workId = stringValue(payload.workId);
  const storagePath = stringValue(payload.storagePath);
  const mimeType = stringValue(payload.mimeType) as AcceptedImageType;
  const claimedSize = numberValue(payload.fileSize);
  const title = stringValue(payload.title);
  const description = stringValue(payload.description);
  const category = stringValue(payload.category);
  const clientEvidence = sanitizeClientOriginalEvidence(
    payload.clientOriginalEvidence,
    claimedSize,
    mimeType,
  );

  if (!clientEvidence) {
    return NextResponse.json({
      ok: false,
      errorClass: 'ClientOriginalEvidenceError',
      errorCode: 'ORIGINAL_SCAN_REQUIRED',
      formError: 'Humn could not verify the untouched browser file. Select the image again before publishing.',
    }, { status: 400 });
  }
  if (!isUuid(workId) || !isAcceptedImageType(mimeType)) {
    return NextResponse.json({
      ok: false,
      errorClass: 'UploadValidationError',
      errorCode: 'INVALID_UPLOAD',
      formError: 'The upload identifier or file type is invalid. Select the image again.',
    }, { status: 400 });
  }
  if (!isOwnedOriginalStoragePath({ path: storagePath, userId: authData.user.id, workId, mimeType })) {
    logFinalizeError('Rejected a storage path outside the authenticated user folder.', {
      userId: authData.user.id,
      workId,
      storagePath,
      errorClass: 'StoragePathAuthorizationError',
    });
    return NextResponse.json({
      ok: false,
      errorClass: 'StoragePathAuthorizationError',
      errorCode: 'STORAGE_PATH_DENIED',
      formError: 'Upload permission was denied for that storage path.',
    }, { status: 403 });
  }

  const { data: profile, error: profileError } = await supabase
    .from('users')
    .select('id')
    .eq('id', authData.user.id)
    .maybeSingle();
  if (profileError) {
    logFinalizeError('Profile lookup failed.', {
      userId: authData.user.id,
      workId,
      errorClass: 'CreatorProfileLookupError',
      error: profileError.message,
    });
    return NextResponse.json({
      ok: false,
      errorClass: 'CreatorProfileLookupError',
      errorCode: 'PROFILE_LOOKUP_FAILED',
      formError: 'Your creator profile could not be checked. Try again.',
    }, { status: 500 });
  }
  if (!profile) {
    return NextResponse.json({
      ok: false,
      errorClass: 'CreatorProfileRequiredError',
      errorCode: 'PROFILE_REQUIRED',
      formError: 'Complete your creator profile before publishing.',
      redirectTo: '/complete-profile',
    }, { status: 409 });
  }

  let admin: ReturnType<typeof getAdminSupabase>;
  try {
    admin = getAdminSupabase();
  } catch (error) {
    const configurationFailure = adminConfigurationFailureResponse(error, 'finalize', {
      userId: authData.user.id,
      workId,
      storagePath,
    });
    if (configurationFailure) return configurationFailure;
    throw error;
  }

  const posting = await getPostingRestriction(admin, authData.user.id);
  if (posting.error) {
    logFinalizeError('Posting status RPC failed.', {
      userId: authData.user.id,
      workId,
      errorClass: 'PostingStatusRpcError',
      error: posting.error,
    });
    return NextResponse.json({
      ok: false,
      errorClass: 'PostingStatusRpcError',
      errorCode: 'POSTING_STATUS_FAILED',
      formError: 'Posting status could not be checked. Try again.',
    }, { status: 500 });
  }
  if (posting.restriction) {
    await removeUploadedFiles(admin, storagePath, []);
    return NextResponse.json({
      ok: false,
      errorClass: 'PostingRestrictionError',
      errorCode: 'POSTING_RESTRICTED',
      formError: posting.restriction,
    }, { status: 403 });
  }

  const { data: storedObject, error: downloadError } = await admin.storage
    .from(ORIGINAL_BUCKET)
    .download(storagePath);
  if (downloadError || !storedObject) {
    return storageAdministrationFailureResponse({
      context: 'finalize',
      step: 'download',
      message: downloadError?.message ?? 'Stored object was not returned.',
      details: { userId: authData.user.id, workId, storagePath },
    });
  }

  const actualSize = storedObject.size;
  if (actualSize > MAX_UPLOAD_BYTES) {
    await removeUploadedFiles(admin, storagePath, []);
    return NextResponse.json({
      ok: false,
      errorClass: 'UploadSizeLimitError',
      errorCode: 'FILE_TOO_LARGE',
      fieldErrors: { file: 'Image exceeds the 15 MB limit.' },
    }, { status: 413 });
  }
  if (actualSize <= 0 || actualSize !== claimedSize || clientEvidence.byteLength !== actualSize) {
    await removeUploadedFiles(admin, storagePath, []);
    logFinalizeError('Stored object size did not match the browser original.', {
      userId: authData.user.id,
      workId,
      storagePath,
      claimedSize,
      clientSize: clientEvidence.byteLength,
      actualSize,
      errorClass: 'UploadIntegrityError',
    });
    return NextResponse.json({
      ok: false,
      errorClass: 'UploadIntegrityError',
      errorCode: 'FILE_SIZE_MISMATCH',
      fieldErrors: { file: 'The stored upload does not match the selected original. Select the image and try again.' },
    }, { status: 400 });
  }

  const storedFile = new File(
    [storedObject],
    stringValue(payload.fileName) || storagePath.split('/').pop() || 'original',
    { type: mimeType },
  );

  let processed;
  try {
    processed = await processUploadedImage(storedFile);
  } catch (error) {
    await removeUploadedFiles(admin, storagePath, []);
    const message = error instanceof Error ? error.message : 'The image could not be processed.';
    const isExifFailure = error instanceof ExifParsingError;
    logFinalizeError('Stored image processing failed.', {
      userId: authData.user.id,
      workId,
      storagePath,
      errorClass: error instanceof Error ? error.name : 'ImageProcessingError',
      error: message,
    });
    return NextResponse.json({
      ok: false,
      errorClass: isExifFailure ? 'ExifParsingError' : 'ImageProcessingError',
      errorCode: isExifFailure ? 'EXIF_PARSE_FAILED' : 'IMAGE_PROCESSING_FAILED',
      fieldErrors: { file: message },
    }, { status: isExifFailure ? 422 : 400 });
  }

  if (clientEvidence.sha256 !== processed.sha256) {
    await removeUploadedFiles(admin, storagePath, []);
    logFinalizeError('Stored original hash did not match the browser original hash.', {
      userId: authData.user.id,
      workId,
      storagePath,
      errorClass: 'OriginalHashMismatchError',
    });
    return NextResponse.json({
      ok: false,
      errorClass: 'OriginalHashMismatchError',
      errorCode: 'ORIGINAL_HASH_MISMATCH',
      fieldErrors: { file: 'The stored file does not match the untouched original selected in your browser.' },
    }, { status: 409 });
  }

  if (!clientServerExifAgrees(clientEvidence, processed.exif)) {
    await removeUploadedFiles(admin, storagePath, []);
    logFinalizeError('EXIF changed between browser selection and server finalization.', {
      userId: authData.user.id,
      workId,
      storagePath,
      errorClass: 'ExifPipelineMismatchError',
      clientMetadataPresent: metadataPresent(clientEvidence.exif),
      serverMetadataPresent: metadataPresent(processed.exif),
      clientUsableFieldCount: clientEvidence.exif?.usableFieldCount ?? null,
      serverUsableFieldCount: processed.exif.usableFieldCount,
    });
    return NextResponse.json({
      ok: false,
      errorClass: 'ExifPipelineMismatchError',
      errorCode: 'EXIF_PIPELINE_MISMATCH',
      fieldErrors: { file: 'Camera metadata changed after file selection, so Humn refused to publish an inaccurate provenance record.' },
    }, { status: 409 });
  }

  const originInput: OriginInput = 'uploaded';
  let provenance;
  try {
    provenance = await analyzeUploadedProvenance(processed, originInput, clientEvidence);
  } catch (error) {
    await removeUploadedFiles(admin, storagePath, []);
    logFinalizeError('Origin and Content Credentials analysis failed.', {
      userId: authData.user.id,
      workId,
      storagePath,
      errorClass: error instanceof Error ? error.name : 'OriginAnalysisError',
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({
      ok: false,
      errorClass: 'OriginAnalysisError',
      errorCode: 'ORIGIN_ANALYSIS_FAILED',
      formError: 'The image reached Storage, but its origin record could not be analyzed.',
    }, { status: 500 });
  }

  if (provenance.aiDeclared) {
    const { data: strikeData, error: strikeError } = await admin.rpc('record_ai_upload_strike', {
      p_user_id: authData.user.id,
      p_original_hash: processed.sha256,
      p_reason: 'The uploaded file’s embedded Content Credentials explicitly declared trained-algorithmic or synthetic origin.',
      p_evidence: {
        c2pa_state: provenance.c2pa.state,
        issuer: provenance.c2pa.issuer,
        embedded: provenance.c2pa.embedded,
        digital_source_types: provenance.c2pa.digitalSourceTypes,
        validation_status: provenance.c2pa.validationStatus,
      },
    });
    await removeUploadedFiles(admin, storagePath, []);
    if (strikeError) {
      logFinalizeError('AI upload strike could not be recorded.', {
        userId: authData.user.id,
        workId,
        originalHash: processed.sha256,
        errorClass: 'AiStrikeRpcError',
        supabaseCode: strikeError.code ?? null,
        error: strikeError.message,
      });
      return NextResponse.json({
        ok: false,
        errorClass: 'AiStrikeRpcError',
        errorCode: 'AI_STRIKE_SAVE_FAILED',
        fieldErrors: { file: 'The file’s Content Credentials declare AI-generated origin, so it cannot be published.' },
        formError: 'The upload was blocked, but the accountability record could not be saved.',
      }, { status: 500 });
    }
    const strike = firstRow(strikeData as AiStrikeResult | AiStrikeResult[] | null);
    return NextResponse.json({
      ok: false,
      errorClass: 'AiDeclaredOriginError',
      errorCode: 'AI_DECLARED',
      fieldErrors: { file: 'This file’s embedded Content Credentials declare AI-generated origin.' },
      formError: strike
        ? aiCredentialMessage(strike)
        : 'The file’s own Content Credentials declare AI-generated origin, so the upload was blocked.',
      strike,
    }, { status: 422 });
  }

  const basePath = `${authData.user.id}/${workId}`;
  const displayPath = `${basePath}/display.webp`;
  const thumbnailPath = `${basePath}/thumbnail.webp`;
  const displayUpload = await admin.storage.from(DISPLAY_BUCKET).upload(displayPath, processed.display, {
    contentType: 'image/webp',
    cacheControl: '31536000',
    upsert: false,
  });
  if (displayUpload.error) {
    await removeUploadedFiles(admin, storagePath, []);
    return storageAdministrationFailureResponse({
      context: 'finalize',
      step: 'display-upload',
      message: displayUpload.error.message,
      details: { userId: authData.user.id, workId, displayPath },
    });
  }
  const thumbnailUpload = await admin.storage.from(DISPLAY_BUCKET).upload(thumbnailPath, processed.thumbnail, {
    contentType: 'image/webp',
    cacheControl: '31536000',
    upsert: false,
  });
  if (thumbnailUpload.error) {
    await removeUploadedFiles(admin, storagePath, [displayPath]);
    return storageAdministrationFailureResponse({
      context: 'finalize',
      step: 'thumbnail-upload',
      message: thumbnailUpload.error.message,
      details: { userId: authData.user.id, workId, thumbnailPath },
    });
  }

  const imageUrl = admin.storage.from(DISPLAY_BUCKET).getPublicUrl(displayPath).data.publicUrl;
  const thumbUrl = admin.storage.from(DISPLAY_BUCKET).getPublicUrl(thumbnailPath).data.publicUrl;
  const uploadedAt = new Date().toISOString();
  const { data: insertedId, error: insertError } = await admin.rpc('create_origin_work_with_provenance', {
    p_work_id: workId,
    p_creator_id: authData.user.id,
    p_title: title,
    p_description: description,
    p_category: category,
    p_aspect_ratio: processed.aspectRatio,
    p_image_url: imageUrl,
    p_thumb_url: thumbUrl,
    p_origin_input: originInput,
    p_capture_device: processed.captureDevice,
    p_lens: processed.lens,
    p_iso: processed.iso,
    p_shutter: processed.shutter,
    p_dimensions: `${processed.width} × ${processed.height} px`,
    p_file_format: processed.fileFormat,
    p_original_hash: processed.sha256,
    p_captured_at: processed.capturedAt,
    p_uploaded_at: uploadedAt,
    p_signals: provenance.signals,
    p_ai_declared: provenance.aiDeclared,
  });
  if (insertError) {
    await removeUploadedFiles(admin, storagePath, [displayPath, thumbnailPath]);
    return workRecordFailureResponse(insertError, {
      userId: authData.user.id,
      workId,
      originalHash: processed.sha256,
    });
  }

  return NextResponse.json({
    ok: true,
    workId: String(insertedId ?? workId),
    origin: {
      originalHash: processed.sha256,
      captureDevice: processed.captureDevice,
      lens: processed.lens,
      iso: processed.iso,
      shutter: processed.shutter,
      focalLengthMm: processed.exif.focalLengthMm,
      capturedAt: processed.capturedAt,
      orientation: processed.exif.orientation,
      gpsMetadataPresent: processed.exif.gpsMetadataPresent,
      c2paState: provenance.c2pa.state,
      aiDeclared: provenance.aiDeclared,
    },
  }, { status: 201 });
}
