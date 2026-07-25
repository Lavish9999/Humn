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

const DEFAULT_ENDPOINT = 'https://api.sightengine.com/1.0/check.json';
const DEFAULT_MODELS = 'genai,recapture,deepfake,nudity-2.1,violence,gore-2.0';

function contentFlags(raw: JsonRecord): JsonRecord {
  return {
    nudity: raw.nudity ?? null,
    violence: raw.violence ?? null,
    gore: raw.gore ?? null,
  };
}

export function createSightengineProvider(role: DetectorRole): DetectorProvider {
  const apiUser = process.env.SIGHTENGINE_API_USER?.trim() ?? '';
  const apiSecret = process.env.SIGHTENGINE_API_SECRET?.trim() ?? '';
  const endpoint = process.env.SIGHTENGINE_API_URL?.trim() || DEFAULT_ENDPOINT;
  const models = process.env.SIGHTENGINE_MODELS?.trim() || DEFAULT_MODELS;
  const configured = Boolean(apiUser && apiSecret);

  return {
    name: 'sightengine',
    role,
    configured,
    async analyze(input: DetectorInput): Promise<DetectorResult> {
      if (!configured) return unavailableDetectorResult('sightengine', role, 'SIGHTENGINE_NOT_CONFIGURED');
      const started = Date.now();
      try {
        const form = new FormData();
        form.append('media', bufferAsBlob(input.bytes, input.mimeType), input.fileName);
        form.append('models', models);
        form.append('api_user', apiUser);
        form.append('api_secret', apiSecret);

        const { response, body, latencyMs } = await fetchJsonWithTimeout(
          endpoint,
          { method: 'POST', body: form },
          input.timeoutMs,
        );

        if (!response.ok || body.status === 'failure') {
          return {
            ...unavailableDetectorResult('sightengine', role, `SIGHTENGINE_HTTP_${response.status}`),
            status: 'error',
            rawResponse: body,
            latencyMs,
          };
        }

        const aiScore = numberAt(body, [
          ['type', 'ai_generated'],
          ['type', 'ai_generated_probability'],
          ['ai_generated'],
        ]);
        if (aiScore === null) {
          return {
            ...unavailableDetectorResult('sightengine', role, 'SIGHTENGINE_AI_SCORE_MISSING'),
            status: 'error',
            rawResponse: body,
            latencyMs,
          };
        }

        const recaptureScore = numberAt(body, [
          ['recapture', 'score'],
          ['recapture', 'probability'],
          ['type', 'recapture'],
        ]);
        const deepfakeScore = numberAt(body, [
          ['deepfake', 'score'],
          ['deepfake', 'probability'],
          ['type', 'deepfake'],
        ]);

        return {
          provider: 'sightengine',
          role,
          detectorKind: 'ai_image',
          status: 'ok',
          modelVersion: models,
          ...normalizedAiScores(aiScore),
          recaptureScore,
          deepfakeScore,
          partialAiScore: null,
          contentFlags: contentFlags(body),
          rawResponse: body,
          errorCode: null,
          latencyMs,
        };
      } catch (error) {
        return resultFromFailure('sightengine', role, error, Date.now() - started);
      }
    },
  };
}
