import { createHash } from 'node:crypto';
import { NextResponse } from 'next/server';
import * as exifr from 'exifr';
import sharp from 'sharp';
import { getAdminSupabase } from '../../../../lib/supabase/admin';
import { ORIGINAL_BUCKET } from '../../../../lib/uploads/constants';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const TAGS = [
  'Make',
  'Model',
  'LensModel',
  'ISO',
  'ExposureTime',
  'FocalLength',
  'DateTimeOriginal',
  'CreateDate',
  'Orientation',
  'GPSLatitude',
  'GPSLongitude',
  'latitude',
  'longitude',
] as const;

function hasValue(value: unknown): boolean {
  return value !== null && value !== undefined && value !== '';
}

function presentMap(value: Record<string, unknown> | undefined | null) {
  return Object.fromEntries(TAGS.map(tag => [tag, hasValue(value?.[tag])]));
}

function errorShape(error: unknown) {
  return {
    name: error instanceof Error ? error.name : 'UnknownError',
    message: error instanceof Error ? error.message : String(error),
  };
}

export async function GET() {
  const admin = getAdminSupabase();
  const { data: works, error: worksError } = await admin
    .from('works')
    .select('id, creator_id, created_at')
    .order('created_at', { ascending: false })
    .limit(12);

  if (worksError) {
    return NextResponse.json({ ok: false, step: 'works-query', error: worksError.message }, { status: 500 });
  }

  const workIds = (works ?? []).map(work => work.id);
  const { data: evidenceRows } = workIds.length
    ? await admin
      .from('file_evidence')
      .select('work_id, capture_device, lens, iso, shutter, captured_at, original_hash')
      .in('work_id', workIds)
    : { data: [] as Array<Record<string, unknown>> };
  const evidenceByWork = new Map((evidenceRows ?? []).map(row => [String(row.work_id), row]));

  const inspected = [] as Array<Record<string, unknown>>;

  for (const work of works ?? []) {
    let storedObject: Blob | null = null;
    let storagePath = '';
    for (const extension of ['jpg', 'png', 'webp']) {
      const candidate = `${work.creator_id}/${work.id}/original.${extension}`;
      const result = await admin.storage.from(ORIGINAL_BUCKET).download(candidate);
      if (result.data && !result.error) {
        storedObject = result.data;
        storagePath = candidate;
        break;
      }
    }
    if (!storedObject) continue;

    const buffer = Buffer.from(await storedObject.arrayBuffer());
    const hash = createHash('sha256').update(buffer).digest('hex');
    const metadata = await sharp(buffer, { failOn: 'none', limitInputPixels: 100_000_000 }).metadata();
    const exifMarkerPresent = buffer.indexOf(Buffer.from('Exif\0\0', 'binary')) >= 0;
    const evidence = evidenceByWork.get(work.id) as Record<string, unknown> | undefined;

    let picked: Record<string, unknown> | null = null;
    let pickedError: ReturnType<typeof errorShape> | null = null;
    try {
      picked = await exifr.parse(buffer, [...TAGS]) as Record<string, unknown> | null;
    } catch (error) {
      pickedError = errorShape(error);
    }

    let full: Record<string, unknown> | null = null;
    let fullError: ReturnType<typeof errorShape> | null = null;
    try {
      full = await exifr.parse(buffer, true) as Record<string, unknown> | null;
    } catch (error) {
      fullError = errorShape(error);
    }

    inspected.push({
      workId: work.id,
      ageRank: inspected.length + 1,
      storageExtension: storagePath.split('.').pop(),
      byteLength: buffer.length,
      format: metadata.format ?? null,
      width: metadata.width ?? null,
      height: metadata.height ?? null,
      sharpExifBytes: metadata.exif?.length ?? 0,
      exifMarkerPresent,
      pickedTagCount: picked ? Object.keys(picked).length : 0,
      pickedPresent: presentMap(picked),
      pickedError,
      fullTagCount: full ? Object.keys(full).length : 0,
      fullPresent: presentMap(full),
      fullError,
      gpsPresent: Boolean(
        hasValue(full?.latitude)
        || hasValue(full?.longitude)
        || hasValue(full?.GPSLatitude)
        || hasValue(full?.GPSLongitude)
      ),
      recordedEvidencePresent: {
        captureDevice: hasValue(evidence?.capture_device),
        lens: hasValue(evidence?.lens),
        iso: hasValue(evidence?.iso),
        shutter: hasValue(evidence?.shutter),
        capturedAt: hasValue(evidence?.captured_at),
      },
      recordedHashMatchesStoredOriginal: typeof evidence?.original_hash === 'string'
        ? evidence.original_hash === hash
        : null,
    });
  }

  const iphoneSized = inspected.find(item => (
    item.format === 'jpeg'
    && ((item.width === 3024 && item.height === 4032) || (item.width === 4032 && item.height === 3024))
  ));

  return NextResponse.json({
    ok: true,
    inspectedCount: inspected.length,
    iphoneSized: iphoneSized ?? null,
    recent: inspected.slice(0, 5),
  });
}
