import type {
  DetectorResult,
  ProvenanceDecisionInputs,
  ScreenHeuristicResult,
  VerificationDecision,
  VerificationThresholds,
} from './types';

function requiredResult(results: DetectorResult[], role: 'primary' | 'secondary'): DetectorResult | null {
  return results.find(result => result.role === role) ?? null;
}

function scoreAtLeast(value: number | null, threshold: number): boolean {
  return value !== null && value >= threshold;
}

function scoreAtMost(value: number | null, threshold: number): boolean {
  return value !== null && value <= threshold;
}

export function evaluateVerificationDecision({
  results,
  provenance,
  screen,
  thresholds,
}: {
  results: DetectorResult[];
  provenance: ProvenanceDecisionInputs;
  screen: ScreenHeuristicResult;
  thresholds: VerificationThresholds;
}): VerificationDecision {
  const primary = requiredResult(results, 'primary');
  const secondary = requiredResult(results, 'secondary');
  const required = [primary, secondary].filter((result): result is DetectorResult => result !== null);
  const optional = results.filter(result => result.role === 'optional');
  const strongSignals: string[] = [];
  const uncertaintySignals: string[] = [];

  if (provenance.c2paExplicitAi) {
    strongSignals.push('embedded C2PA explicitly declares synthetic or generative origin');
    return {
      decision: 'rejected',
      reasonCode: 'C2PA_EXPLICIT_AI',
      reason: 'The file’s own Content Credentials explicitly declare synthetic or generative origin.',
      requiredProviderAgreement: false,
      strongSignals,
      uncertaintySignals,
    };
  }

  for (const result of required) {
    if (scoreAtLeast(result.aiScore, thresholds.aiRejectThreshold)) {
      strongSignals.push(`${result.provider} AI score ${result.aiScore?.toFixed(3)}`);
    }
    if (scoreAtLeast(result.deepfakeScore, thresholds.deepfakeRejectThreshold)) {
      strongSignals.push(`${result.provider} deepfake score ${result.deepfakeScore?.toFixed(3)}`);
    }
  }

  if (strongSignals.length > 0) {
    return {
      decision: 'rejected',
      reasonCode: 'STRONG_SYNTHETIC_SIGNAL',
      reason: 'At least one independent content detector returned a strong synthetic-content signal.',
      requiredProviderAgreement: false,
      strongSignals,
      uncertaintySignals,
    };
  }

  if (!primary || !secondary) {
    uncertaintySignals.push('one or more required detector roles were not registered');
  }
  for (const result of required) {
    if (result.status !== 'ok') {
      uncertaintySignals.push(`${result.provider} returned ${result.status}${result.errorCode ? ` (${result.errorCode})` : ''}`);
    }
  }
  if (!primary || !secondary || required.some(result => result.status !== 'ok')) {
    return {
      decision: 'escalate',
      reasonCode: 'REQUIRED_PROVIDER_UNAVAILABLE',
      reason: 'A required detector was unavailable, timed out or returned an invalid response. Humn did not default to VERIFIED.',
      requiredProviderAgreement: false,
      strongSignals,
      uncertaintySignals,
    };
  }

  const recaptureSignals = results.filter(result => (
    result.status === 'ok'
    && scoreAtLeast(result.recaptureScore, thresholds.recaptureEscalateThreshold)
  ));
  if (screen.suspected || recaptureSignals.length > 0) {
    if (screen.suspected) uncertaintySignals.push(`local screen-rephotograph score ${screen.score.toFixed(3)}`);
    for (const result of recaptureSignals) {
      uncertaintySignals.push(`${result.provider} recapture score ${result.recaptureScore?.toFixed(3)}`);
    }
    return {
      decision: 'escalate',
      reasonCode: 'SCREEN_REPHOTOGRAPH_SUSPECTED',
      reason: 'A screen or print rephotograph may be present. V1 coverage is partial, so this case requires escalation rather than an automatic pass.',
      requiredProviderAgreement: false,
      strongSignals,
      uncertaintySignals,
    };
  }

  if (provenance.duplicateHash) {
    uncertaintySignals.push('the untouched original hash exactly matches an existing Work');
    return {
      decision: 'escalate',
      reasonCode: 'DUPLICATE_ORIGINAL_HASH',
      reason: 'The original file duplicates an existing Work. Exact duplication is an integrity concern, but it is not enough by itself to prove AI generation.',
      requiredProviderAgreement: false,
      strongSignals,
      uncertaintySignals,
    };
  }

  const localized = optional.filter(result => (
    result.status === 'ok'
    && scoreAtLeast(result.partialAiScore, thresholds.optionalRegionEscalateThreshold)
  ));
  if (localized.length > 0) {
    for (const result of localized) {
      uncertaintySignals.push(`${result.provider} localized-region score ${result.partialAiScore?.toFixed(3)}`);
    }
    return {
      decision: 'escalate',
      reasonCode: 'LOCALIZED_AI_SUSPECTED',
      reason: 'The optional localized detector found a region that may contain generative editing. Partial-image signals escalate and never reject on their own.',
      requiredProviderAgreement: false,
      strongSignals,
      uncertaintySignals,
    };
  }

  const lowConfidence = required.filter(result => (
    result.confidence === null || result.confidence < thresholds.minConfidence
  ));
  if (lowConfidence.length > 0) {
    for (const result of lowConfidence) {
      uncertaintySignals.push(`${result.provider} confidence ${result.confidence?.toFixed(3) ?? 'missing'}`);
    }
    return {
      decision: 'escalate',
      reasonCode: 'LOW_DETECTOR_CONFIDENCE',
      reason: 'Required detectors returned confidence below Humn’s configured minimum.',
      requiredProviderAgreement: false,
      strongSignals,
      uncertaintySignals,
    };
  }

  const primaryClear = scoreAtMost(primary.aiScore, thresholds.aiClearThreshold);
  const secondaryClear = scoreAtMost(secondary.aiScore, thresholds.aiClearThreshold);
  if (primaryClear && secondaryClear) {
    return {
      decision: 'verified',
      reasonCode: 'TWO_DETECTOR_CLEAR',
      reason: 'Both independent required detectors cleared the image at high confidence, and no adverse provenance or screen-rephotograph signal was present.',
      requiredProviderAgreement: true,
      strongSignals,
      uncertaintySignals,
    };
  }

  uncertaintySignals.push(
    `${primary.provider} AI score ${primary.aiScore?.toFixed(3) ?? 'missing'}`,
    `${secondary.provider} AI score ${secondary.aiScore?.toFixed(3) ?? 'missing'}`,
  );
  return {
    decision: 'escalate',
    reasonCode: 'DETECTOR_DISAGREEMENT_OR_AMBIGUITY',
    reason: 'The required detectors did not both reach the configured clear range. Uncertain or disagreeing results are never auto-passed.',
    requiredProviderAgreement: false,
    strongSignals,
    uncertaintySignals,
  };
}
