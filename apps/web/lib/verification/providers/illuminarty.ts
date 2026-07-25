import type {
  DetectorInput,
  DetectorProvider,
  DetectorResult,
  DetectorRole,
  JsonRecord,
} from '../types';
import { unavailableDetectorResult } from '../types';
import {
  bufferAsBlob,
  fetchJsonWithTimeout,
  normalizedAiScores,
  numberAt,
  resultFromFailure,
} from './common';

function maxRegionScore(value: unknown): number | null {
  let maximum: number | null = null;
  const visit = (node: unknown, inLocalizedSection: boolean) => {
    if (Array.isArray(node)) {
      for (const child of node) visit(child, inLocalizedSection);
      return;
    }
    if (!node || typeof node !== 'object') return;
    const record = node as JsonRecord;
    for (const [key, child] of Object.entries(record)) {
      const localized = inLocalizedSection || /region|local|heatmap|segment/i.test(key);
      if (localized && /score|probability|confidence/i.test(key)) {
        const numeric = typeof child === 'number' ? child : Number(child);
        if (Number.isFinite(numeric) && numeric >= 0 && numeric <= 1) {
          maximum = Math.max(maximum ?? 0, numeric);
        }
      }
      visit(child, localized);
    }
  };
  visit(value, false);
  return maximum;
}

export function createIlluminartyProvider(role: DetectorRole): DetectorProvider {
  const endpoint = process.env.ILLUMINARTY_API_URL?.trim() ?? '';
  const apiKey = process.env.ILLUMINARTY_API_KEY?.trim() ?? '';
  const mediaField = process.env.ILLUMINARTY_MEDIA_FIELD?.trim() || 'media';
  const authScheme = process.env.ILLUMINARTY_AUTH_SCHEME?.trim() || 'Bearer';
  const configured = Boolean(endpoint && apiKey);

  return {
    name: 'illuminarty',
    role,
    configured,
    async analyze(input: DetectorInput): Promise<DetectorResult> {
      if (!configured) return unavailableDetectorResult('illuminarty', role, 'ILLUMINARTY_NOT_CONFIGURED');
      const started = Date.now();
      try {
        const form = new FormData();
        form.append(mediaField, bufferAsBlob(input.bytes, input.mimeType), input.fileName);
        const { response, body, latencyMs } = await fetchJsonWithTimeout(
          endpoint,
          {
            method: 'POST',
            headers: { authorization: `${authScheme} ${apiKey}` },
            body: form,
          },
          input.timeoutMs,
        );

        if (!response.ok) {
          return {
            ...unavailableDetectorResult('illuminarty', role, `ILLUMINARTY_HTTP_${response.status}`),
            status: 'error',
            rawResponse: body,
            latencyMs,
          };
        }

        const aiScore = numberAt(body, [
          ['ai_probability'],
          ['aiProbability'],
          ['probability'],
          ['score'],
          ['result', 'ai_probability'],
          ['result', 'probability'],
          ['result', 'score'],
        ]);
        if (aiScore === null) {
          return {
            ...unavailableDetectorResult('illuminarty', role, 'ILLUMINARTY_AI_SCORE_MISSING'),
            status: 'error',
            rawResponse: body,
            latencyMs,
          };
        }

        return {
          provider: 'illuminarty',
          role,
          detectorKind: 'localized_ai_image',
          status: 'ok',
          modelVersion: typeof body.model_version === 'string' ? body.model_version : null,
          ...normalizedAiScores(aiScore),
          recaptureScore: null,
          deepfakeScore: numberAt(body, [['deepfake'], ['result', 'deepfake']]),
          partialAiScore: maxRegionScore(body),
          contentFlags: {},
          rawResponse: body,
          errorCode: null,
          latencyMs,
        };
      } catch (error) {
        return resultFromFailure('illuminarty', role, error, Date.now() - started);
      }
    },
  };
}
