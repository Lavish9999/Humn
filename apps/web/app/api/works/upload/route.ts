import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { productConfig } from '@human/config';
import { getServerSupabase } from '../../../../lib/supabase/server';
import { getAdminSupabase } from '../../../../lib/supabase/admin';
import {
  DISPLAY_BUCKET,
  isCanonicalCategory,
  MAX_UPLOAD_BYTES,
  ORIGINAL_BUCKET,
  type OriginInput,
  type UploadFieldErrors,
} from '../../../../lib/uploads/constants';
import { processUploadedImage } from '../../../../lib/uploads/process-image';
import { analyzeUploadedProvenance } from '../../../../lib/provenance/analyze';

export const runtime = 'nodejs';
export const maxDuration = 60;

type StrikeState = {
  active_count: number;
  strike_level: number;
  posting_cooldown_until: string | null;
  suspended_at: string | null;
  can_post: boolean;
  status_label?: string;
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

function firstRow<T>(value: T | T[] | null): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function formatRestriction(state: StrikeState): string | null {
  if (state.suspended_at) {
    return 'Posting is suspended after three active strikes. You can continue browsing and may appeal from your account page.';
  }
  if (state.posting_cooldown_until) {
    const until = new Date(state.posting_cooldown_until);
    const label = Number.isNaN(until.getTime()) ? state.posting_cooldown_until : until.toLocaleString('en-US');
    if (until.getTime() > Date.now()) {
      return `Posting is paused until ${label}. Browsing remains available, and every strike can be appealed from your account page.`;
    }
  }
  return null;
}

function aiCredentialMessage(result: AiStrikeResult): string {
  const basis = 'This upload was blocked because the file’s own embedded Content Credentials explicitly declare AI-generated origin. Humn is not using a detector or making a visual guess.';
  if (result.collapsed) {
    return `${basis} This identical attempt matches a recent warning, so it did not add another strike.`;
  }
  if (result.strike_level >= 3) {
    return `${basis} This is your third active strike, so posting is suspended pending appeal. Browsing remains available.`;
  }
  if (result.strike_level === 2) {
    const until = result.posting_cooldown_until ? new Date(result.posting_cooldown_until).toLocaleString('en-US') : 'seven days';
    return `${basis} This is your second active strike. Posting is paused until ${until}; browsing remains available.`;
  }
  return `${basis} This is an educational first warning. The upload was not published, and you may continue posting files whose credentials do not declare AI generation.`;
}

function text(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === 'string' ? value.trim() : '';
}

function validateFields(formData: FormData): UploadFieldErrors {
  const errors: UploadFieldErrors = {};
  const title = text(formData, 'title');
  const description = text(formData, 'description');
  const category = text(formData, 'category');
  const file = formData.get('file');

  if (!title) errors.title = 'Enter a title.';
  else if (title.length > 160) errors.title = 'Title must be 160 characters or fewer.';

  if (!description) errors.description = 'Describe the specific work shown in the image.';
  else if (description.length > 5000) errors.description = 'Description must be 5,000 characters or fewer.';

  if (!isCanonicalCategory(category, productConfig.launchCategories)) {
    errors.category = 'Choose a category from the catalogue.';
  }

  if (!(file instanceof File) || file.size <= 0) errors.file = 'Choose one image to upload.';
  else if (file.size > MAX_UPLOAD_BYTES) errors.file = 'The image must be 15 MB or smaller.';

  return errors;
}

async function removeUploadedFiles(
  supabase: Awaited<ReturnType<typeof getServerSupabase>>,
  originalPath: string,
  displayPaths: string[],
) {
  await Promise.allSettled([
    supabase.storage.from(ORIGINAL_BUCKET).remove([originalPath]),
    supabase.storage.from(DISPLAY_BUCKET).remove(displayPaths),
  ]);
}

export async function POST(request: Request) {
  const supabase = await getServerSupabase();
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) {
    return NextResponse.json({ ok: false, redirectTo: '/signin' }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from('users')
    .select('id')
    .eq('id', authData.user.id)
    .maybeSingle();
  if (!profile) {
    return NextResponse.json({ ok: false, redirectTo: '/complete-profile' }, { status: 409 });
  }

  const admin = getAdminSupabase();
  const { data: postingStateData, error: postingStateError } = await admin.rpc('get_user_strike_state', {
    p_user_id: authData.user.id,
  });
  if (postingStateError) {
    return NextResponse.json({ ok: false, formError: `Posting status could not be checked: ${postingStateError.message}` }, { status: 500 });
  }
  const postingState = firstRow(postingStateData as StrikeState | StrikeState[] | null);
  const restriction = postingState ? formatRestriction(postingState) : null;
  if (postingState?.suspended_at && restriction) {
    return NextResponse.json({ ok: false, formError: restriction }, { status: 403 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ ok: false, formError: 'The upload request could not be read.' }, { status: 400 });
  }

  const fieldErrors = validateFields(formData);
  if (Object.keys(fieldErrors).length) {
    return NextResponse.json({ ok: false, fieldErrors }, { status: 400 });
  }

  const file = formData.get('file') as File;
  const title = text(formData, 'title');
  const description = text(formData, 'description');
  const category = text(formData, 'category');
  const originInput: OriginInput = 'uploaded';

  let processed;
  try {
    processed = await processUploadedImage(file);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'The image could not be processed.';
    return NextResponse.json({ ok: false, fieldErrors: { file: message } }, { status: 400 });
  }

  const provenance = await analyzeUploadedProvenance(processed, originInput);

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

    if (strikeError) {
      return NextResponse.json({
        ok: false,
        fieldErrors: { file: 'The file’s Content Credentials declare AI-generated origin, so it cannot be published.' },
        formError: `The upload was blocked, but the accountability record could not be saved: ${strikeError.message}`,
      }, { status: 500 });
    }

    const strike = firstRow(strikeData as AiStrikeResult | AiStrikeResult[] | null);
    return NextResponse.json({
      ok: false,
      fieldErrors: { file: 'This file’s embedded Content Credentials declare AI-generated origin.' },
      formError: strike ? aiCredentialMessage(strike) : 'The file’s own Content Credentials declare AI-generated origin, so the upload was blocked.',
      strike,
    }, { status: 422 });
  }

  if (restriction) {
    return NextResponse.json({ ok: false, formError: restriction }, { status: 403 });
  }

  const workId = randomUUID();
  const basePath = `${authData.user.id}/${workId}`;
  const originalPath = `${basePath}/original.${processed.originalExtension}`;
  const displayPath = `${basePath}/display.webp`;
  const thumbnailPath = `${basePath}/thumbnail.webp`;

  const originalUpload = await supabase.storage
    .from(ORIGINAL_BUCKET)
    .upload(originalPath, processed.original, {
      contentType: processed.originalMimeType,
      cacheControl: '31536000',
      upsert: false,
    });
  if (originalUpload.error) {
    return NextResponse.json({ ok: false, formError: `Original upload failed: ${originalUpload.error.message}` }, { status: 500 });
  }

  const displayUpload = await supabase.storage
    .from(DISPLAY_BUCKET)
    .upload(displayPath, processed.display, {
      contentType: 'image/webp',
      cacheControl: '31536000',
      upsert: false,
    });
  if (displayUpload.error) {
    await removeUploadedFiles(supabase, originalPath, []);
    return NextResponse.json({ ok: false, formError: `Display image upload failed: ${displayUpload.error.message}` }, { status: 500 });
  }

  const thumbnailUpload = await supabase.storage
    .from(DISPLAY_BUCKET)
    .upload(thumbnailPath, processed.thumbnail, {
      contentType: 'image/webp',
      cacheControl: '31536000',
      upsert: false,
    });
  if (thumbnailUpload.error) {
    await removeUploadedFiles(supabase, originalPath, [displayPath]);
    return NextResponse.json({ ok: false, formError: `Thumbnail upload failed: ${thumbnailUpload.error.message}` }, { status: 500 });
  }

  const imageUrl = supabase.storage.from(DISPLAY_BUCKET).getPublicUrl(displayPath).data.publicUrl;
  const thumbUrl = supabase.storage.from(DISPLAY_BUCKET).getPublicUrl(thumbnailPath).data.publicUrl;
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
    await removeUploadedFiles(supabase, originalPath, [displayPath, thumbnailPath]);
    return NextResponse.json({ ok: false, formError: `The Work record could not be created: ${insertError.message}` }, { status: 500 });
  }

  return NextResponse.json({ ok: true, workId: String(insertedId ?? workId) }, { status: 201 });
}
