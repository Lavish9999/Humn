import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import sharp from 'sharp';
import { evaluateVerificationDecision } from '../apps/web/lib/verification/decision.ts';
import { createDetectorProvider } from '../apps/web/lib/verification/providers/registry.ts';
import { analyzeScreenRephotographHeuristics } from '../apps/web/lib/verification/screen-heuristics.ts';
import type {
  DetectorResult,
  ProvenanceDecisionInputs,
  ScreenHeuristicResult,
  VerificationDecision,
  VerificationThresholds,
} from '../apps/web/lib/verification/types.ts';

type BenchmarkLabel = 'real' | 'ai' | 'partial_ai' | 'screen_rephoto_ai' | 'screen_rephoto_real';
type ManifestRow = {
  id: string;
  path: string;
  label: BenchmarkLabel;
  source_type: string;
  generator: string | null;
  edited: boolean;
  compressed: boolean;
  screen_rephotograph: boolean;
  license: string;
  notes?: string;
};
type SampleResult = {
  id: string;
  path: string;
  label: BenchmarkLabel;
  generator: string | null;
  sha256: string;
  decision: VerificationDecision;
  screen: ScreenHeuristicResult;
  detectors: DetectorResult[];
};
type BinaryMetrics = {
  total: number;
  evaluated: number;
  truePositive: number;
  falsePositive: number;
  trueNegative: number;
  falseNegative: number;
  precision: number | null;
  recall: number | null;
  falsePositiveRate: number | null;
  specificity: number | null;
  coverage: number;
};

function parseArgs(argv: string[]) {
  const values = new Map<string, string>();
  const flags = new Set<string>();
  for (let index = 0; index < argv.length; index += 1) {
    const item = argv[index] ?? '';
    if (!item.startsWith('--')) continue;
    const key = item.slice(2);
    const next = argv[index + 1];
    if (next && !next.startsWith('--')) {
      values.set(key, next);
      index += 1;
    } else {
      flags.add(key);
    }
  }
  return { values, flags };
}

function envNumber(name: string, fallback: number): number {
  const parsed = Number(process.env[name]);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function defaultThresholds(optionalProviderEnabled: boolean): VerificationThresholds {
  return {
    pipelineVersion: process.env.DETECTION_PIPELINE_VERSION?.trim() || 'benchmark-2026-07-26.1',
    primaryProvider: process.env.DETECTION_PRIMARY_PROVIDER?.trim() || 'sightengine',
    secondaryProvider: process.env.DETECTION_SECONDARY_PROVIDER?.trim() || 'hive',
    aiRejectThreshold: envNumber('DETECTION_AI_REJECT_THRESHOLD', 0.9),
    aiClearThreshold: envNumber('DETECTION_AI_CLEAR_THRESHOLD', 0.1),
    minConfidence: envNumber('DETECTION_MIN_CONFIDENCE', 0.8),
    deepfakeRejectThreshold: envNumber('DETECTION_DEEPFAKE_REJECT_THRESHOLD', 0.9),
    recaptureEscalateThreshold: envNumber('DETECTION_RECAPTURE_ESCALATE_THRESHOLD', 0.5),
    localScreenEscalateThreshold: envNumber('DETECTION_LOCAL_SCREEN_ESCALATE_THRESHOLD', 0.6),
    optionalRegionEscalateThreshold: envNumber('DETECTION_OPTIONAL_REGION_ESCALATE_THRESHOLD', 0.5),
    providerTimeoutMs: envNumber('DETECTION_PROVIDER_TIMEOUT_MS', 15000),
    optionalProviderEnabled,
  };
}

function isAiLabel(label: BenchmarkLabel): boolean {
  return label === 'ai' || label === 'partial_ai' || label === 'screen_rephoto_ai';
}

function isScreenLabel(label: BenchmarkLabel): boolean {
  return label === 'screen_rephoto_ai' || label === 'screen_rephoto_real';
}

function isAbstention(decision: string): boolean {
  return decision === 'self_declared' || decision === 'escalate';
}

function divide(numerator: number, denominator: number): number | null {
  return denominator === 0 ? null : numerator / denominator;
}

function percent(value: number | null): string {
  return value === null ? 'n/a' : `${(value * 100).toFixed(2)}%`;
}

function csvCell(value: unknown): string {
  const text = value === null || value === undefined ? '' : String(value);
  return `"${text.replaceAll('"', '""')}"`;
}

function binaryMetrics(
  samples: SampleResult[],
  prediction: (sample: SampleResult) => boolean | null,
  actual: (sample: SampleResult) => boolean,
): BinaryMetrics {
  let evaluated = 0;
  let truePositive = 0;
  let falsePositive = 0;
  let trueNegative = 0;
  let falseNegative = 0;
  for (const sample of samples) {
    const predicted = prediction(sample);
    if (predicted === null) continue;
    evaluated += 1;
    const expected = actual(sample);
    if (predicted && expected) truePositive += 1;
    else if (predicted && !expected) falsePositive += 1;
    else if (!predicted && expected) falseNegative += 1;
    else trueNegative += 1;
  }
  return {
    total: samples.length,
    evaluated,
    truePositive,
    falsePositive,
    trueNegative,
    falseNegative,
    precision: divide(truePositive, truePositive + falsePositive),
    recall: divide(truePositive, truePositive + falseNegative),
    falsePositiveRate: divide(falsePositive, falsePositive + trueNegative),
    specificity: divide(trueNegative, trueNegative + falsePositive),
    coverage: samples.length === 0 ? 0 : evaluated / samples.length,
  };
}

async function parseManifest(manifestPath: string): Promise<ManifestRow[]> {
  const text = await readFile(manifestPath, 'utf8');
  const rows: ManifestRow[] = [];
  for (const [index, line] of text.split(/\r?\n/).entries()) {
    if (!line.trim()) continue;
    const parsed = JSON.parse(line) as Partial<ManifestRow>;
    if (!parsed.id || !parsed.path || !parsed.label) {
      throw new Error(`Manifest line ${index + 1} is missing id, path or label.`);
    }
    if (!['real', 'ai', 'partial_ai', 'screen_rephoto_ai', 'screen_rephoto_real'].includes(parsed.label)) {
      throw new Error(`Manifest line ${index + 1} has unsupported label ${parsed.label}.`);
    }
    rows.push({
      id: parsed.id,
      path: parsed.path,
      label: parsed.label,
      source_type: parsed.source_type ?? 'unknown',
      generator: parsed.generator ?? null,
      edited: parsed.edited ?? false,
      compressed: parsed.compressed ?? false,
      screen_rephotograph: parsed.screen_rephotograph ?? isScreenLabel(parsed.label),
      license: parsed.license ?? 'unspecified',
      ...(parsed.notes === undefined ? {} : { notes: parsed.notes }),
    });
  }
  return rows;
}

function providerConfigured(name: string): boolean {
  if (name === 'sightengine') return Boolean(process.env.SIGHTENGINE_API_USER && process.env.SIGHTENGINE_API_SECRET);
  if (name === 'hive') return Boolean(process.env.HIVE_V3_SECRET_KEY || process.env.HIVE_API_KEY);
  if (name === 'illuminarty') return Boolean(process.env.ILLUMINARTY_API_URL && process.env.ILLUMINARTY_API_KEY);
  return false;
}

async function readCache(cachePath: string): Promise<{ detectors: DetectorResult[]; screen: ScreenHeuristicResult } | null> {
  try {
    return JSON.parse(await readFile(cachePath, 'utf8')) as { detectors: DetectorResult[]; screen: ScreenHeuristicResult };
  } catch {
    return null;
  }
}

async function runSample(
  row: ManifestRow,
  manifestDirectory: string,
  thresholds: VerificationThresholds,
  cacheDirectory: string,
): Promise<SampleResult> {
  const absolutePath = path.resolve(manifestDirectory, row.path);
  const bytes = await readFile(absolutePath);
  const sha256 = createHash('sha256').update(bytes).digest('hex');
  const cacheKey = createHash('sha256')
    .update(`${sha256}|${thresholds.pipelineVersion}|${thresholds.primaryProvider}|${thresholds.secondaryProvider}|${thresholds.optionalProviderEnabled}`)
    .digest('hex');
  const cachePath = path.join(cacheDirectory, `${cacheKey}.json`);
  let cached = await readCache(cachePath);

  if (!cached) {
    const metadata = await sharp(bytes).metadata();
    if (!metadata.width || !metadata.height) throw new Error(`${row.id}: dimensions could not be read.`);
    const screen = await analyzeScreenRephotographHeuristics(
      bytes,
      metadata.width,
      metadata.height,
      thresholds.localScreenEscalateThreshold,
    );
    const providers = [
      createDetectorProvider(thresholds.primaryProvider, 'primary'),
      createDetectorProvider(thresholds.secondaryProvider, 'secondary'),
    ];
    if (thresholds.optionalProviderEnabled) providers.push(createDetectorProvider('illuminarty', 'optional'));
    const mimeType = metadata.format === 'png'
      ? 'image/png'
      : metadata.format === 'webp'
        ? 'image/webp'
        : 'image/jpeg';
    const detectors = await Promise.all(providers.map(provider => provider.analyze({
      bytes,
      mimeType,
      fileName: path.basename(absolutePath),
      workId: row.id,
      creatorId: 'benchmark-user',
      timeoutMs: thresholds.providerTimeoutMs,
    })));
    cached = { detectors, screen };
    await writeFile(cachePath, JSON.stringify(cached), 'utf8');
  }

  const provenance: ProvenanceDecisionInputs = {
    c2paExplicitAi: false,
    duplicateHash: false,
    c2paCameraCapture: false,
    exifUsableFieldCount: 0,
    originInput: 'uploaded',
  };
  return {
    id: row.id,
    path: row.path,
    label: row.label,
    generator: row.generator,
    sha256,
    decision: evaluateVerificationDecision({ results: cached.detectors, provenance, screen: cached.screen, thresholds }),
    screen: cached.screen,
    detectors: cached.detectors,
  };
}

function markdownReport(
  samples: SampleResult[],
  thresholds: VerificationThresholds,
  providerMetrics: Record<string, BinaryMetrics>,
  combined: BinaryMetrics,
  screenMetrics: BinaryMetrics,
): string {
  const verified = samples.filter(sample => sample.decision.decision === 'verified');
  const rejected = samples.filter(sample => sample.decision.decision === 'rejected');
  const selfDeclared = samples.filter(sample => isAbstention(sample.decision.decision));
  const aiSamples = samples.filter(sample => isAiLabel(sample.label));
  const realSamples = samples.filter(sample => !isAiLabel(sample.label));
  const falseVerified = verified.filter(sample => isAiLabel(sample.label));
  const falseRejected = rejected.filter(sample => !isAiLabel(sample.label));
  const automatic = verified.length + rejected.length;
  const automaticCorrect = verified.filter(sample => !isAiLabel(sample.label)).length
    + rejected.filter(sample => isAiLabel(sample.label)).length;
  const providerRows = Object.entries(providerMetrics).map(([provider, metric]) => (
    `| ${provider} | ${metric.evaluated}/${metric.total} | ${percent(metric.precision)} | ${percent(metric.recall)} | ${percent(metric.falsePositiveRate)} |`
  )).join('\n');

  return `# Humn automated verification benchmark\n\nGenerated: ${new Date().toISOString()}\n\n## Threshold snapshot\n\n\`\`\`json\n${JSON.stringify(thresholds, null, 2)}\n\`\`\`\n\nThese are starting configuration values, not validated claims. Change them only after examining held-out results.\n\n## Dataset\n\n- Total: ${samples.length}\n- AI/partial/screen-AI: ${aiSamples.length}\n- Real/screen-real: ${realSamples.length}\n- VERIFIED: ${verified.length}\n- REJECTED: ${rejected.length}\n- SELF-DECLARED / abstained: ${selfDeclared.length} (${percent(divide(selfDeclared.length, samples.length))})\n- Automatic decision coverage: ${percent(divide(automatic, samples.length))}\n- Automatic accuracy among non-abstained cases: ${percent(divide(automaticCorrect, automatic))}\n- **False-verification rate:** ${percent(divide(falseVerified.length, aiSamples.length))} (${falseVerified.length}/${aiSamples.length})\n- **Real-image auto-rejection rate:** ${percent(divide(falseRejected.length, realSamples.length))} (${falseRejected.length}/${realSamples.length})\n\n## Per-detector AI classification\n\n| Detector | Coverage | Precision | Recall | False-positive rate |\n|---|---:|---:|---:|---:|\n${providerRows || '| No configured providers | 0 | n/a | n/a | n/a |'}\n\n## Combined two-detector rule\n\n- Precision of automatic AI rejection: ${percent(combined.precision)}\n- Recall of automatic AI rejection: ${percent(combined.recall)}\n- False-positive rate: ${percent(combined.falsePositiveRate)}\n- Decision coverage: ${percent(combined.coverage)}\n\nSELF-DECLARED is treated as abstention, not a correct automatic answer.\n\n## Screen/rephotograph coverage\n\n- Precision: ${percent(screenMetrics.precision)}\n- Recall: ${percent(screenMetrics.recall)}\n- False-positive rate: ${percent(screenMetrics.falsePositiveRate)}\n- Coverage: ${percent(screenMetrics.coverage)}\n\nCurrent free-path screen coverage uses the local periodic-texture, border, reflection and dimension heuristic. An optional provider Recapture score is included only when deliberately enabled and present. Coverage remains partial and can miss tightly cropped, defocused, high-quality and partial-region recaptures.\n\n## Review before changing thresholds\n\nInspect every false verification and false rejection in \`samples.csv\`. Tune on a training split, then regenerate this report from a held-out test split. Do not publish vendor-claimed accuracy as Humn accuracy.\n`;
}

async function main() {
  const { values, flags } = parseArgs(process.argv.slice(2));
  const manifestPath = path.resolve(values.get('manifest') ?? 'datasets/verification/manifest.jsonl');
  const outputDirectory = path.resolve(values.get('output') ?? 'reports/verification-benchmark/latest');
  const cacheDirectory = path.resolve(values.get('cache') ?? '.verification-benchmark-cache');
  const optionalProviderEnabled = flags.has('optional-illuminarty');
  const allowUnavailable = flags.has('allow-unavailable');
  const thresholds = defaultThresholds(optionalProviderEnabled);
  const missing = [thresholds.primaryProvider, thresholds.secondaryProvider]
    .filter(provider => !providerConfigured(provider));
  if (missing.length && !allowUnavailable) {
    throw new Error(`Required detector keys are missing for: ${missing.join(', ')}. Provision them or pass --allow-unavailable only to test SELF-DECLARED fallback behavior.`);
  }

  const manifest = await parseManifest(manifestPath);
  const requestedLimit = Number(values.get('limit') ?? manifest.length);
  const rows = manifest.slice(0, Number.isFinite(requestedLimit) ? Math.max(0, Math.floor(requestedLimit)) : manifest.length);
  if (!rows.length) throw new Error('The benchmark manifest contains no samples.');
  await mkdir(outputDirectory, { recursive: true });
  await mkdir(cacheDirectory, { recursive: true });

  const samples: SampleResult[] = [];
  for (const [index, row] of rows.entries()) {
    process.stdout.write(`[${index + 1}/${rows.length}] ${row.id}\n`);
    samples.push(await runSample(row, path.dirname(manifestPath), thresholds, cacheDirectory));
  }

  const providerNames = Array.from(new Set(samples.flatMap(sample => sample.detectors.map(result => result.provider))));
  const providerMetrics: Record<string, BinaryMetrics> = {};
  for (const provider of providerNames) {
    providerMetrics[provider] = binaryMetrics(
      samples,
      sample => {
        const result = sample.detectors.find(item => item.provider === provider);
        return result?.status === 'ok' && result.aiScore !== null
          ? result.aiScore >= thresholds.aiRejectThreshold
          : null;
      },
      sample => isAiLabel(sample.label),
    );
  }

  const combined = binaryMetrics(
    samples,
    sample => isAbstention(sample.decision.decision)
      ? null
      : sample.decision.decision === 'rejected',
    sample => isAiLabel(sample.label),
  );
  const screenMetrics = binaryMetrics(
    samples,
    sample => {
      const optionalProviderRecapture = sample.detectors.some(result => (
        result.status === 'ok'
        && result.recaptureScore !== null
        && result.recaptureScore >= thresholds.recaptureEscalateThreshold
      ));
      return sample.screen.suspected || optionalProviderRecapture;
    },
    sample => isScreenLabel(sample.label),
  );

  const report = {
    generatedAt: new Date().toISOString(),
    thresholds,
    providerMetrics,
    combined,
    screenMetrics,
    samples,
  };
  await writeFile(path.join(outputDirectory, 'report.json'), JSON.stringify(report, null, 2), 'utf8');
  await writeFile(path.join(outputDirectory, 'report.md'), markdownReport(samples, thresholds, providerMetrics, combined, screenMetrics), 'utf8');

  const csvHeader = ['id','path','label','generator','decision','reason_code','screen_score','screen_suspected','primary_ai','secondary_ai','primary_status','secondary_status'];
  const csvLines = [csvHeader.map(csvCell).join(',')];
  for (const sample of samples) {
    const primary = sample.detectors.find(result => result.role === 'primary');
    const secondary = sample.detectors.find(result => result.role === 'secondary');
    csvLines.push([
      sample.id,
      sample.path,
      sample.label,
      sample.generator,
      sample.decision.decision,
      sample.decision.reasonCode,
      sample.screen.score,
      sample.screen.suspected,
      primary?.aiScore,
      secondary?.aiScore,
      primary?.status,
      secondary?.status,
    ].map(csvCell).join(','));
  }
  await writeFile(path.join(outputDirectory, 'samples.csv'), `${csvLines.join('\n')}\n`, 'utf8');
  process.stdout.write(`Benchmark report written to ${outputDirectory}\n`);
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
