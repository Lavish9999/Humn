import Link from 'next/link';
import Image from 'next/image';
import { notFound, redirect } from 'next/navigation';
import { getWorkById } from '../../../lib/data/works';
import { getModerationContext, getReviewerContext } from '../../../lib/data/moderation';
import { ProvenanceBadge } from '../../../components/provenance-badge';
import { ModerationActionForm } from './moderation-action-form';

function signalValue(value: Record<string, unknown>) {
  return JSON.stringify(value, null, 2);
}

function score(value: number | null) {
  return value === null ? '—' : value.toFixed(3);
}

export default async function ModerationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const reviewer = await getReviewerContext();
  if (!reviewer.user) redirect(`/signin?next=${encodeURIComponent(`/moderation/${id}`)}`);
  if (!reviewer.canReview) notFound();
  const [work, context] = await Promise.all([getWorkById(id), getModerationContext(id)]);
  if (!work) notFound();

  return (
    <main className="section page-first-section">
      <div className="moderation-detail">
        <div>
          <Image src={work.media_url} alt={work.title} width={work.width} height={work.height} unoptimized />
          <h1>{work.title}</h1>
          <p><Link className="creator-profile-link" href={`/creator/${work.creator_username}`}>@{work.creator_username}</Link></p>
          <ProvenanceBadge variant={work.badge_variant} label={work.badge_label} />
        </div>
        <aside className="provenance-panel moderation-panel">
          {context.verificationRun ? (
            <section className="provenance-block">
              <div className="meta">Automated detector run</div>
              <dl className="facts">
                <div><dt>Decision</dt><dd>{context.verificationRun.decision ?? context.verificationRun.state}</dd></div>
                <div><dt>Reason code</dt><dd>{context.verificationRun.reason_code ?? '—'}</dd></div>
                <div><dt>Pipeline</dt><dd>{context.verificationRun.pipeline_version ?? '—'}</dd></div>
                <div><dt>Evidence digest</dt><dd className="mono evidence-hash">{context.verificationRun.evidence_digest ?? 'Pending'}</dd></div>
              </dl>
              {context.verificationRun.reason ? <p>{context.verificationRun.reason}</p> : null}
              <p className="meta">Scores are independent signals, not conclusive proof. Provider failure, ambiguity and recapture suspicion always escalate.</p>
              <details>
                <summary>Threshold snapshot</summary>
                <pre>{signalValue(context.verificationRun.thresholds)}</pre>
              </details>
              <details>
                <summary>Screen/rephotograph heuristics · partial v1</summary>
                <pre>{signalValue(context.verificationRun.screen_heuristics)}</pre>
              </details>
            </section>
          ) : null}

          {context.detectorResults.length ? (
            <section className="provenance-block">
              <div className="meta">Per-provider detector evidence</div>
              {context.detectorResults.map(result => (
                <article className="signal-record" key={`${result.provider_role}-${result.provider}`}>
                  <h3>{result.provider} · {result.provider_role}</h3>
                  <dl className="facts">
                    <div><dt>Status</dt><dd>{result.status}</dd></div>
                    <div><dt>AI</dt><dd>{score(result.ai_score)}</dd></div>
                    <div><dt>Authentic</dt><dd>{score(result.authentic_score)}</dd></div>
                    <div><dt>Confidence</dt><dd>{score(result.confidence)}</dd></div>
                    <div><dt>Recapture</dt><dd>{score(result.recapture_score)}</dd></div>
                    <div><dt>Deepfake</dt><dd>{score(result.deepfake_score)}</dd></div>
                    <div><dt>Partial AI</dt><dd>{score(result.partial_ai_score)}</dd></div>
                    <div><dt>Latency</dt><dd>{result.latency_ms === null ? '—' : `${result.latency_ms} ms`}</dd></div>
                  </dl>
                  {result.error_code ? <p className="notice">{result.error_code}</p> : null}
                  <details>
                    <summary>Raw provider response</summary>
                    <pre>{signalValue(result.raw_response)}</pre>
                  </details>
                </article>
              ))}
            </section>
          ) : null}

          <section className="provenance-block">
            <div className="meta">Proof story · {work.proof_story.length} entries</div>
            {work.proof_story.map(entry => <article key={entry.id}><h3>{entry.label}</h3><p>{entry.note}</p><time className="meta">{entry.timestamp}</time></article>)}
          </section>
          <section className="provenance-block">
            <div className="meta">Provenance and integrity signals</div>
            {work.provenance_signals.map(signal => <article className="signal-record" key={signal.name}><h3>{signal.name}</h3><pre>{signalValue(signal.value)}</pre></article>)}
          </section>
          <section className="provenance-block">
            <div className="meta">Reports</div>
            {context.reports.length ? context.reports.map(report => <article key={report.id}><p>{report.reason}</p><time className="meta">{report.created_at}</time></article>) : <p className="meta">NO REPORTS</p>}
          </section>
          <ModerationActionForm workId={work.id} isEscalated={context.isEscalated} />
        </aside>
      </div>
    </main>
  );
}
