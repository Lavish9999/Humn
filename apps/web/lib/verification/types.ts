export type DetectorRole = 'primary' | 'secondary' | 'optional' | 'local';
export type DetectorStatus = 'ok' | 'unavailable' | 'error' | 'timeout';
export type VerificationDecisionName = 'verified' | 'rejected' | 'self_declared';

export type JsonRecord = Record<string, unknown>;

export type DetectorInput = {
  bytes: Buffer;
  mimeType: string;
  fileName: string;
  workId: string;
  creatorId: string;
  timeoutMs: number;
};

export type DetectorResult = {
  provider: string;
  role: DetectorRole;
  detectorKind: string;
  status: DetectorStatus;
  modelVersion: string | null;
  aiScore: number | null;
  authenticScore: number | null;
  confidence: number | null;
  recaptureScore: number | null;
  deepfakeScore: number | null;
  partialAiScore: number | null;
  contentFlags: JsonRecord;
  rawResponse: JsonRecord;
  errorCode: string | null;
  latencyMs: number | null;
};

export type DetectorProvider = {
  readonly name: string;
  readonly role: DetectorRole;
  readonly configured: boolean;
  analyze(input: DetectorInput): Promise<DetectorResult>;
};

export type VerificationThresholds = {
  pipelineVersion: string;
  primaryProvider: string;
  secondaryProvider: string;
  aiRejectThreshold: number;
  aiClearThreshold: number;
  minConfidence: number;
  deepfakeRejectThreshold: number;
  // Dormant optional threshold retained only so a future provisioned recapture
  // adapter can be re-enabled without becoming a required clearance input.
  recaptureEscalateThreshold: number;
  localScreenEscalateThreshold: number;
  optionalRegionEscalateThreshold: number;
  providerTimeoutMs: number;
  optionalProviderEnabled: boolean;
};

export type ProvenanceDecisionInputs = {
  c2paExplicitAi: boolean;
  duplicateHash: boolean;
  c2paCameraCapture: boolean;
  exifUsableFieldCount: number;
  originInput: 'captured_in_app' | 'uploaded';
};

export type ScreenHeuristicResult = {
  score: number;
  suspected: boolean;
  coverage: 'partial_v1';
  signals: {
    periodicTexture: number;
    edgeDensity: number;
    borderContrast: number;
    highlightFraction: number;
    displayAspectMatch: number;
    displayResolutionMatch: number;
  };
  reasons: string[];
  limitations: string[];
};

export type VerificationDecision = {
  decision: VerificationDecisionName;
  reasonCode: string;
  reason: string;
  requiredProviderAgreement: boolean;
  strongSignals: string[];
  uncertaintySignals: string[];
};

export type ClaimedVerificationRun = {
  run_id: string;
  work_id: string;
  creator_id: string;
  attempt_count: number;
  pipeline_version: string;
  config: Record<string, unknown>;
};

export function clampScore(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  return Math.min(1, Math.max(0, value));
}

export function derivedMarginConfidence(aiScore: number): number {
  return Math.min(1, Math.max(0, Math.abs(aiScore - 0.5) * 2));
}

export function unavailableDetectorResult(
  provider: string,
  role: DetectorRole,
  errorCode: string,
): DetectorResult {
  return {
    provider,
    role,
    detectorKind: 'ai_image',
    status: 'unavailable',
    modelVersion: null,
    aiScore: null,
    authenticScore: null,
    confidence: null,
    recaptureScore: null,
    deepfakeScore: null,
    partialAiScore: null,
    contentFlags: {},
    rawResponse: {},
    errorCode,
    latencyMs: 0,
  };
}
