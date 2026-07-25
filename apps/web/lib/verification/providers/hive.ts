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

const DEFAULT_ENDPOINT = 'https://api.thehive.ai/api/v2/task/sync';

export function createHiveProvider(role: DetectorRole): DetectorProvider {
  const apiKey = process.env.HIVE_API_KEY?.trim() ?? '';
  const endpoint = process.env.HIVE_API_URL?.trim() || DEFAULT_ENDPOINT;
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
        form.append('models', JSON.stringify(['ai_generated_media', 'deepfake']));
        form.append('patron_id', input.creatorId.replaceAll('_', '-'));
        form.append('user_id', input.creatorId.replaceAll('_', '-'));
        form.append('post_id', input.workId.replaceAll('_', '-'));

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
          modelVersion: 'ai_generated_media+deepfake',
          aiScore,
          authenticScore: notAiScore ?? 1 - aiScore,
          confidence: notAiScore === null
            ? derivedMarginConfidence(aiScore)
            : Math.max(aiScore, notAiScore),
          recaptureScore: null,
          deepfakeScore,
          partialAiScore: null,
          contentFlags: {},
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
