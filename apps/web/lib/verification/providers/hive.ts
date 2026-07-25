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

// This is Hive's model-only binary upload endpoint. The API key/project must be
// provisioned for AI-generated media detection; Humn never makes the private
// original publicly accessible merely to satisfy a detector URL input.
const DEFAULT_ENDPOINT = 'https://api.thehive.ai/api/v2/task/sync';

export function createHiveProvider(role: DetectorRole): DetectorProvider {
  const apiKey = process.env.HIVE_API_KEY?.trim() ?? '';
  const endpoint = process.env.HIVE_API_URL?.trim() || DEFAULT_ENDPOINT;
  const modelVersion = process.env.HIVE_MODEL_NAME?.trim() || 'ai_generated_media';
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
            headers: { authorization: `Token ${apiKey}` },
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
