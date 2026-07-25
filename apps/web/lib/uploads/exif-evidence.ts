export type NormalizedExifEvidence = {
  make: string | null;
  model: string | null;
  captureDevice: string | null;
  lens: string | null;
  iso: number | null;
  exposureTimeSeconds: number | null;
  shutter: string | null;
  focalLengthMm: number | null;
  capturedAt: string | null;
  orientation: number | null;
  gpsMetadataPresent: boolean;
  usableFieldCount: number;
};

export type ClientOriginalEvidence = {
  scanStatus: 'complete' | 'failed';
  sha256: string | null;
  byteLength: number;
  mimeType: string;
  exif: NormalizedExifEvidence | null;
  errorClass?: string | null;
};

function textValue(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed || null;
}

function numericValue(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function positiveNumber(value: unknown): number | null {
  const numeric = numericValue(value);
  return numeric !== null && numeric > 0 ? numeric : null;
}

function isoValue(raw: Record<string, unknown>): number | null {
  const value = raw.ISO
    ?? raw.PhotographicSensitivity
    ?? raw.ISOSpeedRatings
    ?? raw.RecommendedExposureIndex;
  const numeric = positiveNumber(value);
  return numeric === null ? null : Math.round(numeric);
}

function exposureSeconds(raw: Record<string, unknown>): number | null {
  const direct = positiveNumber(raw.ExposureTime);
  if (direct !== null) return direct;

  const apex = numericValue(raw.ShutterSpeedValue);
  if (apex === null) return null;
  const seconds = 2 ** (-apex);
  return Number.isFinite(seconds) && seconds > 0 ? seconds : null;
}

function shutterLabel(seconds: number | null): string | null {
  if (seconds === null) return null;
  if (seconds >= 1) return `${Number(seconds.toFixed(3))} s`;
  const denominator = Math.round(1 / seconds);
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

function captureDevice(make: string | null, model: string | null): string | null {
  if (!make) return model;
  if (!model) return make;
  if (model.toLowerCase().startsWith(make.toLowerCase())) return model;
  return `${make} ${model}`;
}

function orientationValue(value: unknown): number | null {
  const numeric = numericValue(value);
  if (numeric === null) return null;
  const rounded = Math.round(numeric);
  return rounded >= 1 && rounded <= 8 ? rounded : null;
}

function hasCoordinate(raw: Record<string, unknown>): boolean {
  return [raw.latitude, raw.longitude, raw.GPSLatitude, raw.GPSLongitude]
    .some(value => {
      if (Array.isArray(value)) return value.length > 0;
      return value !== null && value !== undefined && value !== '';
    });
}

export function normalizeExifEvidence(raw: Record<string, unknown> | null | undefined): NormalizedExifEvidence {
  const source = raw ?? {};
  const make = textValue(source.Make);
  const model = textValue(source.Model);
  const lensModel = textValue(source.LensModel);
  const lensMake = textValue(source.LensMake);
  const lens = lensModel ?? lensMake;
  const iso = isoValue(source);
  const exposureTimeSeconds = exposureSeconds(source);
  const focalLengthMm = positiveNumber(source.FocalLength);
  const capturedAt = timestampValue(source.DateTimeOriginal)
    ?? timestampValue(source.CreateDate)
    ?? timestampValue(source.ModifyDate);
  const orientation = orientationValue(source.Orientation);
  const gpsMetadataPresent = hasCoordinate(source);
  const device = captureDevice(make, model);
  const shutter = shutterLabel(exposureTimeSeconds);
  const usableFieldCount = [device, lens, iso, shutter, focalLengthMm, capturedAt]
    .filter(value => value !== null).length;

  return {
    make,
    model,
    captureDevice: device,
    lens,
    iso,
    exposureTimeSeconds,
    shutter,
    focalLengthMm,
    capturedAt,
    orientation,
    gpsMetadataPresent,
    usableFieldCount,
  };
}

export function isSha256(value: unknown): value is string {
  return typeof value === 'string' && /^[a-f0-9]{64}$/i.test(value);
}
