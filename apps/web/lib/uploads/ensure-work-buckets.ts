import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import {
  ACCEPTED_IMAGE_TYPES,
  DISPLAY_BUCKET,
  MAX_UPLOAD_BYTES,
  ORIGINAL_BUCKET,
} from './constants';

type BucketRequirement = {
  id: string;
  public: boolean;
  allowedMimeTypes: string[];
};

const REQUIREMENTS: BucketRequirement[] = [
  {
    id: ORIGINAL_BUCKET,
    public: false,
    allowedMimeTypes: [...ACCEPTED_IMAGE_TYPES],
  },
  {
    id: DISPLAY_BUCKET,
    public: true,
    allowedMimeTypes: ['image/webp'],
  },
];

function normalizeMimeTypes(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string').sort();
}

function sameStrings(left: string[], right: string[]): boolean {
  const normalizedLeft = [...left].sort();
  const normalizedRight = [...right].sort();
  return normalizedLeft.length === normalizedRight.length
    && normalizedLeft.every((value, index) => value === normalizedRight[index]);
}

export async function ensureWorkUploadBuckets(admin: SupabaseClient): Promise<void> {
  for (const requirement of REQUIREMENTS) {
    const { data: bucket, error: getError } = await admin.storage.getBucket(requirement.id);
    if (getError || !bucket) {
      throw new Error(`Storage bucket ${requirement.id} could not be inspected: ${getError?.message ?? 'missing bucket'}`);
    }

    const currentLimit = typeof bucket.file_size_limit === 'number'
      ? bucket.file_size_limit
      : Number(bucket.file_size_limit);
    const currentMimeTypes = normalizeMimeTypes(bucket.allowed_mime_types);
    const needsUpdate = bucket.public !== requirement.public
      || currentLimit !== MAX_UPLOAD_BYTES
      || !sameStrings(currentMimeTypes, requirement.allowedMimeTypes);

    if (!needsUpdate) continue;

    const { error: updateError } = await admin.storage.updateBucket(requirement.id, {
      public: requirement.public,
      fileSizeLimit: MAX_UPLOAD_BYTES,
      allowedMimeTypes: requirement.allowedMimeTypes,
    });
    if (updateError) {
      throw new Error(`Storage bucket ${requirement.id} could not be hardened: ${updateError.message}`);
    }
  }
}
