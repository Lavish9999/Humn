import { createHash } from 'node:crypto';
import { NextResponse } from 'next/server';
import * as exifr from 'exifr';
import sharp from 'sharp';
import { processUploadedImage } from '../../../../lib/uploads/process-image';
import { analyzeUploadedProvenance } from '../../../../lib/provenance/analyze';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET() {
  const original = await sharp({
    create: {
      width: 3024,
      height: 4032,
      channels: 3,
      background: { r: 120, g: 140, b: 160 },
    },
  })
    .jpeg({ quality: 92 })
    .withExif({
      IFD0: {
        Make: 'Apple',
        Model: 'iPhone 15 Pro',
      },
      IFD2: {
        LensModel: 'iPhone 15 Pro back triple camera 6.86mm f/1.78',
        PhotographicSensitivity: '125',
        ISOSpeedRatings: '125',
        ExposureTime: '1/120',
        FocalLength: '686/100',
        DateTimeOriginal: '2026:07:25 16:00:00',
      },
      IFD3: {
        GPSLatitudeRef: 'N',
        GPSLatitude: '28/1 2/1 0/1',
        GPSLongitudeRef: 'W',
        GPSLongitude: '81/1 44/1 0/1',
      },
    })
    .withMetadata({ orientation: 1 })
    .toBuffer();

  const originalBytes = Uint8Array.from(original);
  const file = new File([originalBytes], 'iphone-original.jpg', { type: 'image/jpeg' });
  const processed = await processUploadedImage(file);
  const provenance = await analyzeUploadedProvenance(processed, 'uploaded', {
    scanStatus: 'complete',
    sha256: createHash('sha256').update(original).digest('hex'),
    byteLength: original.length,
    mimeType: 'image/jpeg',
    exif: processed.exif,
    errorClass: null,
  });
  const originalExif = await exifr.parse(original, true) as Record<string, unknown> | null;
  let displayExif: Record<string, unknown> | null = null;
  try {
    displayExif = await exifr.parse(processed.display, true) as Record<string, unknown> | null;
  } catch {
    displayExif = null;
  }
  const exifSignal = provenance.signals.find(signal => signal.signal_name === 'exif_consistency');
  const publicSignalText = JSON.stringify(exifSignal?.value ?? {});

  const assertions = {
    dimensionsPreserved: processed.width === 3024 && processed.height === 4032,
    originalHashMatches: processed.sha256 === createHash('sha256').update(original).digest('hex'),
    deviceParsed: processed.captureDevice === 'Apple iPhone 15 Pro',
    lensParsed: Boolean(processed.lens?.includes('iPhone 15 Pro')),
    isoParsed: processed.iso === 125,
    shutterParsed: processed.shutter === '1/120 s',
    focalLengthParsed: processed.exif.focalLengthMm === 6.86,
    capturedAtParsed: Boolean(processed.capturedAt),
    orientationParsed: processed.exif.orientation === 1,
    gpsPresenceParsed: processed.exif.gpsMetadataPresent,
    originalContainsRichExif: Boolean(originalExif?.Make && originalExif?.Model),
    displayDerivativeHasNoCameraExif: !displayExif?.Make
      && !displayExif?.Model
      && !displayExif?.ISO
      && !displayExif?.PhotographicSensitivity,
    publicSignalHasNoCoordinates: !publicSignalText.includes('28/1')
      && !publicSignalText.includes('81/1')
      && !publicSignalText.includes('latitude')
      && !publicSignalText.includes('longitude'),
  };

  const relevantRawExif = Object.fromEntries(
    Object.entries(originalExif ?? {}).filter(([key]) => /iso|sensitivity|orientation|make|model|exposure|focal|date/i.test(key)),
  );

  return NextResponse.json({
    ok: Object.values(assertions).every(Boolean),
    assertions,
    parsed: {
      captureDevice: processed.captureDevice,
      lensPresent: Boolean(processed.lens),
      iso: processed.iso,
      shutter: processed.shutter,
      focalLengthMm: processed.exif.focalLengthMm,
      capturedAtPresent: Boolean(processed.capturedAt),
      orientation: processed.exif.orientation,
      gpsMetadataPresent: processed.exif.gpsMetadataPresent,
      originalHashMatches: assertions.originalHashMatches,
    },
    fixtureRawExif: relevantRawExif,
  }, { status: Object.values(assertions).every(Boolean) ? 200 : 500 });
}
