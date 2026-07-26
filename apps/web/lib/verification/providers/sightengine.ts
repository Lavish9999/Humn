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
const DEFAULT_CORE_MODELS = 'genai,deepfake';
const DEFAULT_SAFETY_MODELS = 'nudity-2.1,violence,gore-2.0';

type SightengineCall = Awaited<ReturnType<typeof fetchJsonWithTimeout>>;

function enabled(value: string | undefined): boolean {
  return ['1', 'true', 'yes', 'on'].includes(value?.trim().toLowerCase() ?? '');
}

function errorCode(body: JsonRecord, status: number, prefix: string): string {
  const error = body.error && typeof body.error === 'object'
    ? body.error as JsonRecord
    : null;
  return typeof error?.code === 'string' ? error.code : `${prefix}_HTTP_${status}`;
}

function contentFlags({
  safety,
  recaptureEnabled,
  recaptureStatus,
}: {
  safety: SightengineCall | null;
  recaptureEnabled: boolean;
  recaptureStatus: string;
}): JsonRecord {
  return {
    nudity: safety?.body.nudity ?? null,
    violence: safety?.body.violence ?? null,
    gore: safety?.body.gore ?? null,
    safety_status: safety
      ? safety.response.ok && safety.body.status !== 'failure'
        ? 'ok'
        : 'error'
      : 'disabled',
    recapture_enabled: recaptureEnabled,
    recapture_status: recaptureStatus,
  };
}

function makeForm(input: DetectorInput, models: string, apiUser: string, apiSecret: string): FormData {
  const form = new FormData();
  form.append('media', bufferAsBlob(input.bytes, input.mimeType), input.fileName);
  form.append('models', models);
  form.append('api_user', apiUser);
  form.append('api_secret', apiSecret);
  return form;
}

export function createSightengineProvider(role: DetectorRole): DetectorProvider {
  const apiUser = process.env.SIGHTENGINE_API_USER?.trim() ?? '';
  const apiSecret = process.env.SIGHTENGINE_API_SECRET?.trim() ?? '';
  const endpoint = process.env.SIGHTENGINE_API_URL?.trim() || DEFAULT_ENDPOINT;
  const coreModels = process.env.SIGHTENGINE_CORE_MODELS?.trim() || DEFAULT_CORE_MODELS;
  const safetyModels = process.env.SIGHTENGINE_SAFETY_MODELS?.trim() || DEFAULT_SAFETY_MODELS;
  const recaptureEnabled = enabled(process.env.SIGHTENGINE_RECAPTURE_ENABLED);
  const configured = Boolean(apiUser && apiSecret);

  return {
    name: 'sightengine',
    role,
    configured,
    async analyze(input: DetectorInput): Promise<DetectorResult> {
      if (!configured) return unavailableDetectorResult('sightengine', role, 'SIGHTENGINE_NOT_CONFIGURED');
      const started = Date.now();

      let core: SightengineCall;
      try {
        core = await fetchJsonWithTimeout(
          endpoint,
          { method: 'POST', body: makeForm(input, coreModels, apiUser, apiSecret) },
          input.timeoutMs,
        );
      } catch (error) {
        return resultFromFailure('sightengine', role, error, Date.now() - started);
      }

      if (!core.response.ok || core.body.status === 'failure') {
        return {
          ...unavailableDetectorResult(
            'sightengine',
            role,
            errorCode(core.body, core.response.status, 'SIGHTENGINE_CORE'),
          ),
          status: 'error',
          modelVersion: coreModels,
          rawResponse: { core: core.body },
          latencyMs: Date.now() - started,
        };
      }

      const aiScore = numberAt(core.body, [
        ['type', 'ai_generated'],
        ['type', 'ai_generated_probability'],
        ['ai_generated'],
      ]);
      if (aiScore === null) {
        return {
          ...unavailableDetectorResult('sightengine', role, 'SIGHTENGINE_AI_SCORE_MISSING'),
          status: 'error',
          modelVersion: coreModels,
          rawResponse: { core: core.body },
          latencyMs: Date.now() - started,
        };
      }

      const deepfakeScore = numberAt(core.body, [
        ['deepfake', 'score'],
        ['deepfake', 'probability'],
        ['type', 'deepfake'],
      ]);

      let recapture: SightengineCall | null = null;
      let recaptureScore: number | null = null;
      let recaptureStatus = recaptureEnabled ? 'pending' : 'disabled_not_entitled';

      if (recaptureEnabled) {
        try {
          recapture = await fetchJsonWithTimeout(
            endpoint,
            { method: 'POST', body: makeForm(input, 'recapture', apiUser, apiSecret) },
            input.timeoutMs,
          );
        } catch (error) {
          const failed = resultFromFailure('sightengine', role, error, Date.now() - started);
          return {
            ...failed,
            modelVersion: `${coreModels}+recapture`,
            aiScore,
            authenticScore: 1 - aiScore,
            confidence: normalizedAiScores(aiScore).confidence,
            deepfakeScore,
            rawResponse: { core: core.body, recapture: {} },
            errorCode: failed.status === 'timeout'
              ? 'SIGHTENGINE_RECAPTURE_TIMEOUT'
              : 'SIGHTENGINE_RECAPTURE_REQUEST_FAILED',
          };
        }

        if (!recapture.response.ok || recapture.body.status === 'failure') {
          return {
            ...unavailableDetectorResult(
              'sightengine',
              role,
              errorCode(recapture.body, recapture.response.status, 'SIGHTENGINE_RECAPTURE'),
            ),
            status: 'error',
            modelVersion: `${coreModels}+recapture`,
            aiScore,
            authenticScore: 1 - aiScore,
            confidence: normalizedAiScores(aiScore).confidence,
            deepfakeScore,
            rawResponse: { core: core.body, recapture: recapture.body },
            latencyMs: Date.now() - started,
          };
        }

        recaptureScore = numberAt(recapture.body, [
          ['recapture', 'score'],
          ['recapture', 'probability'],
          ['type', 'recapture'],
        ]);
        if (recaptureScore === null) {
          return {
            ...unavailableDetectorResult('sightengine', role, 'SIGHTENGINE_RECAPTURE_SCORE_MISSING'),
            status: 'error',
            modelVersion: `${coreModels}+recapture`,
            aiScore,
            authenticScore: 1 - aiScore,
            confidence: normalizedAiScores(aiScore).confidence,
            deepfakeScore,
            rawResponse: { core: core.body, recapture: recapture.body },
            latencyMs: Date.now() - started,
          };
        }
        recaptureStatus = 'ok';
      }

      let safety: SightengineCall | null = null;
      if (safetyModels) {
        try {
          safety = await fetchJsonWithTimeout(
            endpoint,
            { method: 'POST', body: makeForm(input, safetyModels, apiUser, apiSecret) },
            input.timeoutMs,
          );
        } catch {
          safety = null;
        }
      }

      return {
        provider: 'sightengine',
        role,
        detectorKind: 'ai_image',
        status: 'ok',
        modelVersion: [
          coreModels,
          recaptureEnabled ? 'recapture' : null,
          safetyModels || null,
        ].filter(Boolean).join('+'),
        ...normalizedAiScores(aiScore),
        recaptureScore,
        deepfakeScore,
        partialAiScore: null,
        contentFlags: contentFlags({ safety, recaptureEnabled, recaptureStatus }),
        rawResponse: {
          core: core.body,
          recapture: recapture?.body ?? null,
          safety: safety?.body ?? null,
        },
        errorCode: null,
        latencyMs: Date.now() - started,
      };
    },
  };
}
