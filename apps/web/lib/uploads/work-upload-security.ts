import 'server-only';

import {
  ACCEPTED_IMAGE_TYPES,
  MAX_UPLOAD_BYTES,
  type AcceptedImageType,
  type UploadFieldErrors,
} from './constants';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type WorkUploadDescriptor = {
  fileName: string;
  fileSize: number;
  mimeType: string;
};

export function isUuid(value: string): boolean {
  return UUID_PATTERN.test(value);
}

export function extensionForMimeType(mimeType: AcceptedImageType): 'jpg' | 'png' | 'webp' {
  if (mimeType === 'image/png') return 'png';
  if (mimeType === 'image/webp') return 'webp';
  return 'jpg';
}

export function validateUploadDescriptor(descriptor: WorkUploadDescriptor): UploadFieldErrors {
  const errors: UploadFieldErrors = {};

  if (!descriptor.fileName.trim()) {
    errors.file = 'Choose one image to upload.';
  } else if (!ACCEPTED_IMAGE_TYPES.includes(descriptor.mimeType as AcceptedImageType)) {
    errors.file = 'Choose a JPEG, PNG, or WebP image.';
  } else if (!Number.isSafeInteger(descriptor.fileSize) || descriptor.fileSize <= 0) {
    errors.file = 'The selected file is empty.';
  } else if (descriptor.fileSize > MAX_UPLOAD_BYTES) {
    errors.file = 'Image exceeds the 15 MB limit.';
  }

  return errors;
}

export function buildOriginalStoragePath(
  userId: string,
  workId: string,
  mimeType: AcceptedImageType,
): string {
  return `${userId}/${workId}/original.${extensionForMimeType(mimeType)}`;
}

export function isOwnedOriginalStoragePath({
  path,
  userId,
  workId,
  mimeType,
}: {
  path: string;
  userId: string;
  workId: string;
  mimeType: AcceptedImageType;
}): boolean {
  if (!isUuid(userId) || !isUuid(workId)) return false;
  return path === buildOriginalStoragePath(userId, workId, mimeType);
}
