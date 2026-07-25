'use client';

import * as exifr from 'exifr';
import {
  normalizeExifEvidence,
  type ClientOriginalEvidence,
} from './exif-evidence';

function hexDigest(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer), byte => byte.toString(16).padStart(2, '0')).join('');
}

export async function inspectClientOriginal(file: File): Promise<ClientOriginalEvidence> {
  const bytes = await file.arrayBuffer();
  const sha256 = hexDigest(await crypto.subtle.digest('SHA-256', bytes));

  try {
    const parsed = await exifr.parse(bytes, true) as Record<string, unknown> | null;
    return {
      scanStatus: 'complete',
      sha256,
      byteLength: file.size,
      mimeType: file.type,
      exif: normalizeExifEvidence(parsed),
      errorClass: null,
    };
  } catch (error) {
    return {
      scanStatus: 'failed',
      sha256,
      byteLength: file.size,
      mimeType: file.type,
      exif: null,
      errorClass: error instanceof Error ? error.name : 'UnknownExifScanError',
    };
  }
}
