import assert from 'node:assert/strict';
import test from 'node:test';
import { evaluateVerificationDecision } from './decision';
import type {
  DetectorResult,
  ProvenanceDecisionInputs,
  ScreenHeuristicResult,
  VerificationThresholds,
} from './types';

const thresholds: VerificationThresholds = {
  pipelineVersion: 'test.1',
  primaryProvider: 'primary-test',
  secondaryProvider: 'secondary-test',
  aiRejectThreshold: 0.9,
  aiClearThreshold: 0.1,
  minConfidence: 0.8,
  deepfakeRejectThreshold: 0.9,
  recaptureEscalateThreshold: 0.5,
  localScreenEscalateThreshold: 0.6,
  optionalRegionEscalateThreshold: 0.5,
  providerTimeoutMs: 15000,
  optionalProviderEnabled: false,
};

const provenance: ProvenanceDecisionInputs = {
  c2paExplicitAi: false,
  duplicateHash: false,
  c2paCameraCapture: false,
  exifUsableFieldCount: 5,
  originInput: 'uploaded',
};

const cleanScreen: ScreenHeuristicResult = {
  score: 0.12,
  suspected: false,
  coverage: 'partial_v1',
  signals: {
    periodicTexture: 0.1,
    edgeDensity: 0.2,
    borderContrast: 0.1,
    highlightFraction: 0.1,
    displayAspectMatch: 0,
    displayResolutionMatch: 0,
  },
  reasons: [],
  limitations: [],
};

function detector(role: 'primary' | 'secondary', aiScore: number): DetectorResult {
  return {
    provider: `${role}-test`,
    role,
    detectorKind: 'ai_image',
    status: 'ok',
    modelVersion: 'fixture',
    aiScore,
    authenticScore: 1 - aiScore,
    confidence: Math.abs(aiScore - 0.5) * 2,
    recaptureScore: null,
    deepfakeScore: 0.02,
    partialAiScore: null,
    contentFlags: { recapture_enabled: false, recapture_status: 'disabled' },
    rawResponse: {},
    errorCode: null,
    latencyMs: 10,
  };
}

test('clean result requires two independent clears before VERIFIED without recapture', () => {
  const result = evaluateVerificationDecision({
    results: [detector('primary', 0.04), detector('secondary', 0.03)],
    provenance,
    screen: cleanScreen,
    thresholds,
  });
  assert.equal(result.decision, 'verified');
  assert.equal(result.reasonCode, 'TWO_DETECTOR_CLEAR');
  assert.equal(result.requiredProviderAgreement, true);
});

test('a strong AI result from either required detector rejects', () => {
  const result = evaluateVerificationDecision({
    results: [detector('primary', 0.96), detector('secondary', 0.08)],
    provenance,
    screen: cleanScreen,
    thresholds,
  });
  assert.equal(result.decision, 'rejected');
  assert.equal(result.reasonCode, 'STRONG_SYNTHETIC_SIGNAL');
});

test('AI image photographed from a screen returns to SELF-DECLARED instead of auto-clearing', () => {
  const screen: ScreenHeuristicResult = {
    ...cleanScreen,
    score: 0.82,
    suspected: true,
    reasons: ['periodic high-frequency texture consistent with moire or a pixel grid'],
  };
  const result = evaluateVerificationDecision({
    results: [detector('primary', 0.06), detector('secondary', 0.05)],
    provenance,
    screen,
    thresholds,
  });
  assert.equal(result.decision, 'self_declared');
  assert.equal(result.reasonCode, 'SCREEN_REPHOTOGRAPH_SUSPECTED');
});

test('missing recapture is neutral and does not block a positive two-provider clear', () => {
  const primary = detector('primary', 0.04);
  primary.recaptureScore = null;
  primary.contentFlags = {
    recapture_enabled: false,
    recapture_status: 'disabled',
  };
  const result = evaluateVerificationDecision({
    results: [primary, detector('secondary', 0.03)],
    provenance,
    screen: cleanScreen,
    thresholds,
  });
  assert.equal(result.decision, 'verified');
  assert.equal(result.reasonCode, 'TWO_DETECTOR_CLEAR');
  assert.doesNotMatch(result.uncertaintySignals.join(' '), /recapture signal unavailable/);
});

test('required provider timeout publishes SELF-DECLARED and never defaults to VERIFIED', () => {
  const secondary = detector('secondary', 0.03);
  secondary.status = 'timeout';
  secondary.aiScore = null;
  secondary.authenticScore = null;
  secondary.confidence = null;
  secondary.deepfakeScore = null;
  secondary.errorCode = 'PROVIDER_TIMEOUT';
  const result = evaluateVerificationDecision({
    results: [detector('primary', 0.02), secondary],
    provenance,
    screen: cleanScreen,
    thresholds,
  });
  assert.equal(result.decision, 'self_declared');
  assert.equal(result.reasonCode, 'REQUIRED_PROVIDER_UNAVAILABLE');
});

test('detector disagreement remains SELF-DECLARED', () => {
  const result = evaluateVerificationDecision({
    results: [detector('primary', 0.05), detector('secondary', 0.55)],
    provenance,
    screen: cleanScreen,
    thresholds,
  });
  assert.equal(result.decision, 'self_declared');
  assert.equal(result.reasonCode, 'LOW_DETECTOR_CONFIDENCE');
});

test('duplicate original hash remains SELF-DECLARED without fabricating an AI verdict', () => {
  const result = evaluateVerificationDecision({
    results: [detector('primary', 0.03), detector('secondary', 0.02)],
    provenance: { ...provenance, duplicateHash: true },
    screen: cleanScreen,
    thresholds,
  });
  assert.equal(result.decision, 'self_declared');
  assert.equal(result.reasonCode, 'DUPLICATE_ORIGINAL_HASH');
});

test('missing deepfake score prevents VERIFIED and returns SELF-DECLARED', () => {
  const primary = detector('primary', 0.03);
  primary.deepfakeScore = null;
  const result = evaluateVerificationDecision({
    results: [primary, detector('secondary', 0.02)],
    provenance,
    screen: cleanScreen,
    thresholds,
  });
  assert.equal(result.decision, 'self_declared');
  assert.equal(result.reasonCode, 'REQUIRED_SCORE_MISSING');
});
