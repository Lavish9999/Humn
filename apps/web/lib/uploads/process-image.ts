import 'server-only';

import { createHash } from 'node:crypto';
import * as exifr from 'exifr';
import sharp from 'sharp';
import { isAcceptedImageType, MAX_UPLOAD_BYTES, type AcceptedImageType } from './constants';

const SUPPORTED_SHARP_FORMATS = new Set(['jpeg', 'png', 'webp']);

type ExifPayload = {
  Make?: unknown;
  Model?: unknown;
  LensModel?: unknown;
  ISO?: unknown;
  ExposureTime?: unknown;
  DateTimeOriginal?: unknown;
  CreateDate?: unknown;
};

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

function textValue(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed || null;
}

function captureDevice(exif: ExifPayload | undefined): string | null {
  if (!exif) return null;
  const make = textValue(exif.Make);
  const model = textValue(exif.Model);
  if (!make) return model;
  if (!model) return make;
  if (model.toLowerCase().startsWith(make.toLowerCase())) return model;
  return `${make} ${model}`;
}

function isoValue(value: unknown): number | null {
  const numeric = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : Number.NaN;
  if (!Number.isFinite(numeric) || numeric <= 0) return null;
  return Math.round(numeric);
}

function shutterValue(value: unknown): string | null {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return null;
  if (value >= 1) return `${Number(value.toFixed(3))} s`;
  const denominator = Math.round(1 / value);
  return denominator > 0 ? `1/${denominator} s` : null;
}

function timestampValue(value: unknown): string | null {
  const date = value instanceof Date
    ? value
    : typeof value === 'string' || typeof value === 'number'
      ? new Date(value)
      : null;
  if (!date || Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

function extensionFor(mimeType: AcceptedImageType): 'jpg' | 'png' | 'webp' {
  if (mimeType === 'image/png') return 'png';
  if (mimeType === 'image/webp') return 'webp';
  return 'jpg';
}

export async function processUploadedImage(file: File): Promise<ProcessedUpload> {
  if (!isAcceptedImageType(file.type)) {
    throw new Error('Choose a JPEG, PNG, or WebP image.');
  }
  const originalMimeType = file.type;
  if (file.size <= 0) throw new Error('The selected file is empty.');
  if (file.size > MAX_UPLOAD_BYTES) throw new Error('The image must be 15 MB or smaller.');

  const original = Buffer.from(await file.arrayBuffer());
  const source = sharp(original, { limitInputPixels: 100_000_000, failOn: 'error' });
  const metadata = await source.metadata();

  if (!metadata.format || !SUPPORTED_SHARP_FORMATS.has(metadata.format)) {
    throw new Error('The file contents are not a supported JPEG, PNG, or WebP image.');
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

  let exif: ExifPayload | undefined;
  try {
    exif = await exifr.parse(original, [
      'Make',
      'Model',
      'LensModel',
      'ISO',
      'ExposureTime',
      'DateTimeOriginal',
      'CreateDate',
    ]) as ExifPayload | undefined;
  } catch {
    exif = undefined;
  }

  const capturedAt = timestampValue(exif?.DateTimeOriginal) ?? timestampValue(exif?.CreateDate);
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
    captureDevice: captureDevice(exif),
    lens: textValue(exif?.LensModel),
    iso: isoValue(exif?.ISO),
    shutter: shutterValue(exif?.ExposureTime),
    capturedAt,
  };
}
