import 'server-only';

import { createHash } from 'node:crypto';
import * as exifr from 'exifr';
import sharp from 'sharp';
import { isAcceptedImageType, MAX_UPLOAD_BYTES, type AcceptedImageType } from './constants';
import { normalizeExifEvidence, type NormalizedExifEvidence } from './exif-evidence';

const SUPPORTED_SHARP_FORMATS = new Set(['jpeg', 'png', 'webp']);

export class ExifParsingError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'ExifParsingError';
  }
}

export type ProcessedUpload = {
  original: Buffer;
  display: Buffer;
  thumbnail: Buffer;
  originalMimeType: AcceptedImageType;
  originalExtension: 'jpg' | 'png' | 'webp';
  width: number;
  height: number;
  aspectRatio: string;
  fileFormat: string;
  sha256: string;
  captureDevice: string | null;
  lens: string | null;
  iso: number | null;
  shutter: string | null;
  capturedAt: string | null;
  exif: NormalizedExifEvidence;
  exifSegmentBytes: number;
};

function greatestCommonDivisor(a: number, b: number): number {
  let left = Math.abs(a);
  let right = Math.abs(b);
  while (right !== 0) {
    const remainder = left % right;
    left = right;
    right = remainder;
  }
  return left || 1;
}

function reducedRatio(width: number, height: number): string {
  const divisor = greatestCommonDivisor(width, height);
  return `${Math.round(width / divisor)}:${Math.round(height / divisor)}`;
}

function extensionFor(mimeType: AcceptedImageType): 'jpg' | 'png' | 'webp' {
  if (mimeType === 'image/png') return 'png';
  if (mimeType === 'image/webp') return 'webp';
  return 'jpg';
}

function mimeTypeForSharpFormat(format: string): AcceptedImageType | null {
  if (format === 'jpeg') return 'image/jpeg';
  if (format === 'png') return 'image/png';
  if (format === 'webp') return 'image/webp';
  return null;
}

export async function processUploadedImage(file: File): Promise<ProcessedUpload> {
  if (!isAcceptedImageType(file.type)) {
    throw new Error('Choose a JPEG, PNG, or WebP image.');
  }
  const originalMimeType = file.type;
  if (file.size <= 0) throw new Error('The selected file is empty.');
  if (file.size > MAX_UPLOAD_BYTES) throw new Error('Image exceeds the 15 MB limit.');

  // This buffer is the untouched object downloaded from work-originals. It is
  // the sole input for the original hash, EXIF/C2PA analysis and derivatives.
  const original = Buffer.from(await file.arrayBuffer());
  const source = sharp(original, { limitInputPixels: 100_000_000, failOn: 'error' });
  const metadata = await source.metadata();

  if (!metadata.format || !SUPPORTED_SHARP_FORMATS.has(metadata.format)) {
    throw new Error('The file contents are not a supported JPEG, PNG, or WebP image.');
  }
  const detectedMimeType = mimeTypeForSharpFormat(metadata.format);
  if (!detectedMimeType || detectedMimeType !== originalMimeType) {
    throw new Error('The image contents do not match the declared file type.');
  }
  if (!metadata.width || !metadata.height) {
    throw new Error('The image dimensions could not be read.');
  }

  const rawWidth = metadata.width;
  const rawHeight = metadata.height;
  const orientation = metadata.orientation ?? 1;
  const swapsDimensions = orientation >= 5 && orientation <= 8;
  const width = swapsDimensions ? rawHeight : rawWidth;
  const height = swapsDimensions ? rawWidth : rawHeight;

  let parsedExif: Record<string, unknown> | null;
  try {
    parsedExif = await exifr.parse(original, true) as Record<string, unknown> | null;
  } catch (error) {
    throw new ExifParsingError(
      'The original image contains metadata that Humn could not parse safely.',
      { cause: error },
    );
  }
  const exif = normalizeExifEvidence(parsedExif);

  // Display derivatives are intentionally re-encoded and contain no sensitive
  // original metadata. They never replace the private original object.
  const display = await sharp(original, { limitInputPixels: 100_000_000, failOn: 'error' })
    .autoOrient()
    .resize({ width: 2400, height: 2400, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 88, effort: 4 })
    .toBuffer();

  const thumbnail = await sharp(original, { limitInputPixels: 100_000_000, failOn: 'error' })
    .autoOrient()
    .resize({ width: 640, height: 640, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 80, effort: 4 })
    .toBuffer();

  const fileFormat = metadata.format === 'jpeg' ? 'JPEG' : metadata.format.toUpperCase();

  return {
    original,
    display,
    thumbnail,
    originalMimeType,
    originalExtension: extensionFor(originalMimeType),
    width,
    height,
    aspectRatio: reducedRatio(width, height),
    fileFormat,
    sha256: createHash('sha256').update(original).digest('hex'),
    captureDevice: exif.captureDevice,
    lens: exif.lens,
    iso: exif.iso,
    shutter: exif.shutter,
    capturedAt: exif.capturedAt,
    exif,
    exifSegmentBytes: metadata.exif?.length ?? 0,
  };
}
