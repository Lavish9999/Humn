import 'server-only';

import type { OriginInput } from '../uploads/constants';
import type { ProcessedUpload } from '../uploads/process-image';
import { readC2paSummary, type C2paSummary } from './c2pa';

export type StoredProvenanceSignal = {
  signal_name: 'c2pa' | 'exif_consistency' | 'origin_input';
  value: Record<string, unknown>;
  weight: number;
};

export type ProvenanceAnalysis = {
  signals: StoredProvenanceSignal[];
  aiDeclared: boolean;
  c2pa: C2paSummary;
};

function exifSignal(processed: ProcessedUpload): StoredProvenanceSignal {
  const presentFields = [
    processed.captureDevice,
    processed.lens,
    processed.iso,
    processed.shutter,
    processed.capturedAt,
  ].filter(value => value !== null).length;

  return {
    signal_name: 'exif_consistency',
    value: {
      state: presentFields > 0 ? 'present' : 'none',
      present: presentFields > 0,
      plausible_field_count: presentFields,
      capture_timestamp_present: Boolean(processed.capturedAt),
      note: presentFields > 0
        ? 'Camera metadata was recorded from the uploaded file.'
        : 'No usable EXIF fields were present. This is neutral and is not evidence against the creator.',
    },
    weight: presentFields >= 3 ? 8 : presentFields > 0 ? 4 : 0,
  };
}

function c2paSignal(c2pa: C2paSummary): StoredProvenanceSignal {
  const weight = c2pa.aiGenerated ? -100 : c2pa.cameraCapture ? 35 : 0;
  return {
    signal_name: 'c2pa',
    value: {
      state: c2pa.state,
      issuer: c2pa.issuer,
      embedded: c2pa.embedded,
      camera_capture_asserted: c2pa.cameraCapture,
      ai_generation_asserted: c2pa.aiGenerated,
      digital_source_types: c2pa.digitalSourceTypes,
      validation_status: c2pa.validationStatus,
      note: c2pa.state === 'none'
        ? 'No Content Credentials manifest was found. This is neutral.'
        : c2pa.state === 'present'
          ? 'Content Credentials were parsed from the asset.'
          : 'Content Credentials could not be evaluated. This is neutral.',
    },
    weight,
  };
}

function originSignal(originInput: OriginInput): StoredProvenanceSignal {
  return {
    signal_name: 'origin_input',
    value: {
      origin_input: originInput,
      note: originInput === 'captured_in_app'
        ? 'The asset was captured through Humn’s future capture path.'
        : 'The asset was uploaded from the creator’s device. Upload alone remains UNVERIFIED until process evidence or review is added.',
    },
    weight: originInput === 'captured_in_app' ? 50 : 0,
  };
}

export async function analyzeUploadedProvenance(
  processed: ProcessedUpload,
  originInput: OriginInput,
): Promise<ProvenanceAnalysis> {
  const c2pa = await readC2paSummary(processed.original, processed.originalMimeType);
  return {
    c2pa,
    aiDeclared: c2pa.aiGenerated,
    signals: [c2paSignal(c2pa), exifSignal(processed), originSignal(originInput)],
  };
}
