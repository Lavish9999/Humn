import type { CategorySlug } from '@human/config';

export const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;
export const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
export type AcceptedImageType = (typeof ACCEPTED_IMAGE_TYPES)[number];

export const ORIGINAL_BUCKET = 'work-originals';
export const DISPLAY_BUCKET = 'work-display';

export type OriginInput = 'uploaded' | 'captured_in_app';

export type UploadFieldErrors = Partial<Record<'file' | 'title' | 'description' | 'category', string>>;

export function isAcceptedImageType(value: string): value is AcceptedImageType {
  return ACCEPTED_IMAGE_TYPES.includes(value as AcceptedImageType);
}

export function isCanonicalCategory(value: string, categories: readonly CategorySlug[]): value is CategorySlug {
  return categories.includes(value as CategorySlug);
}
