import process from 'node:process';

let input = '';
for await (const chunk of process.stdin) input += chunk;

const lines = input.split(/\r?\n/);
for (const line of lines) {
  if (!line.startsWith('HUMN_VERIFICATION_SMOKE_RESULT ')) {
    if (line.trim()) console.log(line);
    continue;
  }

  const payload = JSON.parse(line.slice('HUMN_VERIFICATION_SMOKE_RESULT '.length));
  if (!payload.ok) {
    console.log('HUMN_SMOKE_ERROR', JSON.stringify(payload));
    continue;
  }

  console.log('HUMN_SMOKE_READINESS', JSON.stringify({
    smokeKey: payload.smokeKey,
    preview: payload.preview,
  }));

  for (const report of payload.reports ?? []) {
    console.log(`HUMN_SMOKE_SAMPLE_${String(report.sample).toUpperCase()}`, JSON.stringify({
      sample: report.sample,
      label: report.label,
      expected: report.expected,
      workId: report.workId,
      runId: report.runId,
      finalWorkState: report.finalWorkState,
      decision: report.decision,
      reasonCode: report.reasonCode,
      reason: report.reason,
      thresholds: report.thresholds,
      screenHeuristics: report.screenHeuristics,
      evidenceDigest: report.evidenceDigest,
      detectors: (report.detectors ?? []).map(detector => ({
        provider: detector.provider,
        role: detector.role,
        status: detector.status,
        modelVersion: detector.modelVersion,
        normalized: detector.normalized,
        rawScoreFields: detector.rawScoreFields,
        errorCode: detector.errorCode,
        latencyMs: detector.latencyMs,
        rawResponseStored: detector.rawResponseStored,
      })),
      audit: report.audit,
    }));
  }

  console.log('HUMN_SMOKE_NOTE', JSON.stringify({ note: payload.note }));
}
