import { NextResponse } from 'next/server';
import { productConfig } from '@human/config';
import { getServerSupabase } from '../../../../lib/supabase/server';
import { getAdminSupabase } from '../../../../lib/supabase/admin';
import {
  DISPLAY_BUCKET,
  isAcceptedImageType,
  isCanonicalCategory,
  MAX_UPLOAD_BYTES,
  ORIGINAL_BUCKET,
  type AcceptedImageType,
  type OriginInput,
  type UploadFieldErrors,
} from '../../../../lib/uploads/constants';
import { processUploadedImage } from '../../../../lib/uploads/process-image';
import { analyzeUploadedProvenance } from '../../../../lib/provenance/analyze';
import { getPostingRestriction, firstRow } from '../../../../lib/uploads/posting-access';
import {
  isOwnedOriginalStoragePath,
  isUuid,
  validateUploadDescriptor,
} from '../../../../lib/uploads/work-upload-security';

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

function aiCredentialMessage(result: AiStrikeResult): string {
  const basis = 'This upload was blocked because the file’s own embedded Content Credentials explicitly declare AI-generated origin. Humn is not using a detector or making a visual guess.';
  if (result.collapsed) {
    return `${basis} This identical attempt matches a recent warning, so it did not add another strike.`;
  }
  if (result.strike_level >= 3) {
    return `${basis} This is your third active strike, so posting is suspended pending appeal. Browsing remains available.`;
  }
  if (result.strike_level === 2) {
    const until = result.posting_cooldown_until
      ? new Date(result.posting_cooldown_until).toLocaleString('en-US')
      : 'seven days';
    return `${basis} This is your second active strike. Posting is paused until ${until}; browsing remains available.`;
  }
  return `${basis} This is an educational first warning. The upload was not published, and you may continue posting files whose credentials do not declare AI generation.`;
}

function stringValue(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function numberValue(value: unknown): number {
  return typeof value === 'number' ? value : Number.NaN;
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
        error: result.reason instanceof Error ? result.reason.message : String(result.reason),
      });
    } else if (result.value.error) {
      logFinalizeError('Storage cleanup returned an error.', {
        originalPath,
        displayPaths,
        error: result.value.error.message,
      });
    }
  }
}

export async function POST(request: Request) {
  const supabase = await getServerSupabase();
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) {
    return NextResponse.json({
      ok: false,
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
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({
      ok: false,
      errorCode: 'INVALID_REQUEST',
      formError: 'The publish request could not be read.',
    }, { status: 400 });
  }

  const fieldErrors = validateMetadata(payload);
  if (Object.keys(fieldErrors).length) {
    const fileSize = numberValue(payload.fileSize);
    return NextResponse.json({
      ok: false,
      errorCode: fileSize > MAX_UPLOAD_BYTES ? 'FILE_TOO_LARGE' : 'INVALID_METADATA',
      fieldErrors,
    }, { status: fileSize > MAX_UPLOAD_BYTES ? 413 : 400 });
  }

  const workId = stringValue(payload.workId);
  const storagePath = stringValue(payload.storagePath);
  const mimeType = stringValue(payload.mimeType) as AcceptedImageType;
  const claimedSize = numberValue(payload.fileSize);
  const title = stringValue(payload.title);
  const description = stringValue(payload.description);
  const category = stringValue(payload.category);

  if (!isUuid(workId)) {
    return NextResponse.json({
      ok: false,
      errorCode: 'INVALID_UPLOAD_ID',
      formError: 'The upload identifier is invalid. Select the image again.',
    }, { status: 400 });
  }
  if (!isAcceptedImageType(mimeType)) {
    return NextResponse.json({
      ok: false,
      errorCode: 'INVALID_FILE_TYPE',
      fieldErrors: { file: 'Choose a JPEG, PNG, or WebP image.' },
    }, { status: 400 });
  }
  if (!isOwnedOriginalStoragePath({
    path: storagePath,
    userId: authData.user.id,
    workId,
    mimeType,
  })) {
    logFinalizeError('Rejected a storage path outside the authenticated user folder.', {
      userId: authData.user.id,
      workId,
      storagePath,
    });
    return NextResponse.json({
      ok: false,
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

  const admin = getAdminSupabase();
  const posting = await getPostingRestriction(admin, authData.user.id);
  if (posting.error) {
    logFinalizeError('Posting status RPC failed.', {
      userId: authData.user.id,
      workId,
      error: posting.error,
    });
    return NextResponse.json({
      ok: false,
      errorCode: 'POSTING_STATUS_FAILED',
      formError: 'Posting status could not be checked. Try again.',
    }, { status: 500 });
  }
  if (posting.restriction) {
    await removeUploadedFiles(admin, storagePath, []);
    return NextResponse.json({
      ok: false,
      errorCode: 'POSTING_RESTRICTED',
      formError: posting.restriction,
    }, { status: 403 });
  }

  const { data: storedObject, error: downloadError } = await admin.storage
    .from(ORIGINAL_BUCKET)
    .download(storagePath);
  if (downloadError || !storedObject) {
    logFinalizeError('Stored original could not be downloaded.', {
      userId: authData.user.id,
      workId,
      storagePath,
      error: downloadError?.message ?? 'Missing stored object.',
    });
    return NextResponse.json({
      ok: false,
      errorCode: 'STORED_UPLOAD_MISSING',
      formError: 'The direct upload did not reach storage. Select the image and try again.',
    }, { status: 409 });
  }

  const actualSize = storedObject.size;
  if (actualSize > MAX_UPLOAD_BYTES) {
    await removeUploadedFiles(admin, storagePath, []);
    return NextResponse.json({
      ok: false,
      errorCode: 'FILE_TOO_LARGE',
      fieldErrors: { file: 'Image exceeds the 15 MB limit.' },
    }, { status: 413 });
  }
  if (actualSize <= 0 || actualSize !== claimedSize) {
    await removeUploadedFiles(admin, storagePath, []);
    logFinalizeError('Stored object size did not match the signed request.', {
      userId: authData.user.id,
      workId,
      storagePath,
      claimedSize,
      actualSize,
    });
    return NextResponse.json({
      ok: false,
      errorCode: 'FILE_SIZE_MISMATCH',
      fieldErrors: { file: 'The uploaded file was incomplete. Select the image and try again.' },
    }, { status: 400 });
  }

  const originalBuffer = Buffer.from(await storedObject.arrayBuffer());
  const storedFile = new File(
    [originalBuffer],
    stringValue(payload.fileName) || storagePath.split('/').pop() || 'original',
    { type: mimeType },
  );

  let processed;
  try {
    processed = await processUploadedImage(storedFile);
  } catch (error) {
    await removeUploadedFiles(admin, storagePath, []);
    const message = error instanceof Error ? error.message : 'The image could not be processed.';
    logFinalizeError('Stored image processing failed.', {
      userId: authData.user.id,
      workId,
      storagePath,
      error: message,
    });
    return NextResponse.json({
      ok: false,
      errorCode: 'IMAGE_PROCESSING_FAILED',
      fieldErrors: { file: message },
    }, { status: 400 });
  }

  const originInput: OriginInput = 'uploaded';
  let provenance;
  try {
    provenance = await analyzeUploadedProvenance(processed, originInput);
  } catch (error) {
    await removeUploadedFiles(admin, storagePath, []);
    logFinalizeError('Origin and Content Credentials analysis failed.', {
      userId: authData.user.id,
      workId,
      storagePath,
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({
      ok: false,
      errorCode: 'ORIGIN_ANALYSIS_FAILED',
      formError: 'The image reached storage, but its origin record could not be analyzed. Try again.',
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
        error: strikeError.message,
      });
      return NextResponse.json({
        ok: false,
        errorCode: 'AI_STRIKE_SAVE_FAILED',
        fieldErrors: { file: 'The file’s Content Credentials declare AI-generated origin, so it cannot be published.' },
        formError: 'The upload was blocked, but the accountability record could not be saved. Support has been given the underlying error.',
      }, { status: 500 });
    }

    const strike = firstRow(strikeData as AiStrikeResult | AiStrikeResult[] | null);
    return NextResponse.json({
      ok: false,
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

  const displayUpload = await admin.storage
    .from(DISPLAY_BUCKET)
    .upload(displayPath, processed.display, {
      contentType: 'image/webp',
      cacheControl: '31536000',
      upsert: false,
    });
  if (displayUpload.error) {
    await removeUploadedFiles(admin, storagePath, []);
    logFinalizeError('Display image upload failed.', {
      userId: authData.user.id,
      workId,
      displayPath,
      error: displayUpload.error.message,
    });
    return NextResponse.json({
      ok: false,
      errorCode: 'DISPLAY_UPLOAD_FAILED',
      formError: 'The original reached storage, but the display image could not be created. Try again.',
    }, { status: 500 });
  }

  const thumbnailUpload = await admin.storage
    .from(DISPLAY_BUCKET)
    .upload(thumbnailPath, processed.thumbnail, {
      contentType: 'image/webp',
      cacheControl: '31536000',
      upsert: false,
    });
  if (thumbnailUpload.error) {
    await removeUploadedFiles(admin, storagePath, [displayPath]);
    logFinalizeError('Thumbnail upload failed.', {
      userId: authData.user.id,
      workId,
      thumbnailPath,
      error: thumbnailUpload.error.message,
    });
    return NextResponse.json({
      ok: false,
      errorCode: 'THUMBNAIL_UPLOAD_FAILED',
      formError: 'The original reached storage, but its thumbnail could not be created. Try again.',
    }, { status: 500 });
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
    logFinalizeError('Work record and provenance RPC failed.', {
      userId: authData.user.id,
      workId,
      originalHash: processed.sha256,
      error: insertError.message,
    });
    return NextResponse.json({
      ok: false,
      errorCode: 'WORK_RECORD_FAILED',
      formError: 'The images were processed, but the Work record could not be created. Try again.',
    }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    workId: String(insertedId ?? workId),
    origin: {
      originalHash: processed.sha256,
      captureDevice: processed.captureDevice,
      capturedAt: processed.capturedAt,
      c2paState: provenance.c2pa.state,
      aiDeclared: provenance.aiDeclared,
    },
  }, { status: 201 });
}
