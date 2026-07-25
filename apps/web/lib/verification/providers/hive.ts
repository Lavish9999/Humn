import type {
  DetectorInput,
  DetectorProvider,
  DetectorResult,
  DetectorRole,
} from '../types';
import { derivedMarginConfidence, unavailableDetectorResult } from '../types';
import {
  bufferAsBlob,
  fetchJsonWithTimeout,
  recursiveClassScores,
  resultFromFailure,
} from './common';

// Hive V3 Playground model for AI-generated and deepfake content detection.
// The private original is streamed directly as multipart bytes; Humn never makes
// the source object publicly accessible merely to satisfy a detector URL input.
const DEFAULT_ENDPOINT = 'https://api.thehive.ai/api/v3/hive/ai-generated-and-deepfake-content-detection';
const DEFAULT_MODEL = 'hive/ai-generated-and-deepfake-content-detection';

export function createHiveProvider(role: DetectorRole): DetectorProvider {
  // Prefer the explicit V3 name. HIVE_API_KEY remains as a temporary legacy
  // fallback for environments that already stored the same V3 secret there.
  const apiKey = process.env.HIVE_V3_SECRET_KEY?.trim()
    || process.env.HIVE_API_KEY?.trim()
    || '';
  const endpoint = process.env.HIVE_API_URL?.trim() || DEFAULT_ENDPOINT;
  const modelVersion = process.env.HIVE_MODEL_NAME?.trim() || DEFAULT_MODEL;
  const configured = Boolean(apiKey);

  return {
    name: 'hive',
    role,
    configured,
    async analyze(input: DetectorInput): Promise<DetectorResult> {
      if (!configured) return unavailableDetectorResult('hive', role, 'HIVE_NOT_CONFIGURED');
      const started = Date.now();
      try {
        const form = new FormData();
        form.append('media', bufferAsBlob(input.bytes, input.mimeType), input.fileName);

        const { response, body, latencyMs } = await fetchJsonWithTimeout(
          endpoint,
          {
            method: 'POST',
            headers: { authorization: `Bearer ${apiKey}` },
            body: form,
          },
          input.timeoutMs,
        );

        if (!response.ok) {
          return {
            ...unavailableDetectorResult('hive', role, `HIVE_HTTP_${response.status}`),
            status: 'error',
            rawResponse: body,
            latencyMs,
          };
        }

        const scores = recursiveClassScores(body);
        const aiScore = scores.get('ai_generated') ?? null;
        const notAiScore = scores.get('not_ai_generated') ?? null;
        const deepfakeScore = scores.get('deepfake') ?? null;
        if (aiScore === null) {
          return {
            ...unavailableDetectorResult('hive', role, 'HIVE_AI_SCORE_MISSING'),
            status: 'error',
            rawResponse: body,
            latencyMs,
          };
        }

        return {
          provider: 'hive',
          role,
          detectorKind: 'ai_image',
          status: 'ok',
          modelVersion,
          aiScore,
          authenticScore: notAiScore ?? 1 - aiScore,
          confidence: notAiScore === null
            ? derivedMarginConfidence(aiScore)
            : Math.max(aiScore, notAiScore),
          recaptureScore: null,
          deepfakeScore,
          partialAiScore: null,
          contentFlags: {
            api_version: 'v3_playground',
            confidence_basis: notAiScore === null
              ? 'derived_distance_from_0.5'
              : 'maximum_binary_class_confidence',
          },
          rawResponse: body,
          errorCode: null,
          latencyMs,
        };
      } catch (error) {
        return resultFromFailure('hive', role, error, Date.now() - started);
      }
    },
  };
}
