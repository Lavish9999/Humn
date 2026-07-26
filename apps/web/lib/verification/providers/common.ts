import {
  clampScore,
  derivedMarginConfidence,
  type DetectorResult,
  type DetectorRole,
  type JsonRecord,
} from '../types';

export function asJsonRecord(value: unknown): JsonRecord {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as JsonRecord
    : {};
}

export function firstNumeric(value: unknown): number | null {
  if (typeof value === 'number') return clampScore(value);
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    return clampScore(parsed);
  }
  return null;
}

export function numberAt(root: unknown, paths: string[][]): number | null {
  for (const path of paths) {
    let value: unknown = root;
    for (const segment of path) {
      if (!value || typeof value !== 'object' || Array.isArray(value)) {
        value = null;
        break;
      }
      value = (value as JsonRecord)[segment];
    }
    const numeric = firstNumeric(value);
    if (numeric !== null) return numeric;
  }
  return null;
}

export function recursiveClassScores(root: unknown): Map<string, number> {
  const scores = new Map<string, number>();
  const visit = (value: unknown) => {
    if (Array.isArray(value)) {
      for (const item of value) visit(item);
      return;
    }
    if (!value || typeof value !== 'object') return;
    const record = value as JsonRecord;
    const className = typeof record.class === 'string'
      ? record.class
      : typeof record.class_name === 'string'
        ? record.class_name
        : typeof record.label === 'string'
          ? record.label
          : null;
    const score = firstNumeric(
      record.value
      ?? record.score
      ?? record.confidence
      ?? record.probability,
    );
    if (className && score !== null) {
      const normalized = className.trim().toLowerCase();
      scores.set(normalized, Math.max(scores.get(normalized) ?? 0, score));
    }
    for (const child of Object.values(record)) visit(child);
  };
  visit(root);
  return scores;
}

export async function fetchJsonWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<{ response: Response; body: JsonRecord; latencyMs: number }> {
  const controller = new AbortController();
  const started = Date.now();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    const body = asJsonRecord(await response.json().catch(() => ({})));
    return { response, body, latencyMs: Date.now() - started };
  } finally {
    clearTimeout(timeout);
  }
}

export function resultFromFailure(
  provider: string,
  role: DetectorRole,
  error: unknown,
  latencyMs: number,
): DetectorResult {
  const timedOut = error instanceof Error && error.name === 'AbortError';
  return {
    provider,
    role,
    detectorKind: 'ai_image',
    status: timedOut ? 'timeout' : 'error',
    modelVersion: null,
    aiScore: null,
    authenticScore: null,
    confidence: null,
    recaptureScore: null,
    deepfakeScore: null,
    partialAiScore: null,
    contentFlags: {},
    rawResponse: {},
    errorCode: timedOut
      ? 'PROVIDER_TIMEOUT'
      : error instanceof Error
        ? error.name
        : 'PROVIDER_ERROR',
    latencyMs,
  };
}

export function normalizedAiScores(aiScore: number): Pick<DetectorResult, 'aiScore' | 'authenticScore' | 'confidence'> {
  return {
    aiScore,
    authenticScore: 1 - aiScore,
    confidence: derivedMarginConfidence(aiScore),
  };
}

export function bufferAsBlob(bytes: Buffer, mimeType: string): Blob {
  return new Blob([Uint8Array.from(bytes)], { type: mimeType });
}
