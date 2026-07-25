import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getCategoryDisplayName } from '@human/config';
import { getServerSupabase } from '../../../lib/supabase/server';
import type { CollectionSaveContext, TechnicalSignalRecord } from '../../../lib/data/types';
import { getWorkById } from '../../../lib/data/works';
import { getCollectionSaveContext } from '../../../lib/data/collections';
import { pluralize } from '../../../lib/pluralize';
import { FollowButton } from '../../../components/follow-button';
import { AUTOMATED_VERIFIED_EXPLANATION, ProvenanceBadge } from '../../../components/provenance-badge';
import { CopyHash } from './copy-hash';
import { WorkActionButtons } from './save-button';
import { RequestVerificationButton } from './request-verification-button';

type VerificationDetectorSummary = {
  provider: string;
  role: string;
  status: string;
  ai_score: number | null;
  authentic_score: number | null;
  confidence: number | null;
  recapture_score: number | null;
  deepfake_score: number | null;
  partial_ai_score: number | null;
  error_code: string | null;
};

type VerificationSummary = {
  state: 'queued' | 'running' | 'completed';
  decision: 'verified' | 'rejected' | 'escalate' | null;
  reason_code: string | null;
  reason: string | null;
  pipeline_version: string | null;
  queued_at: string;
  started_at: string | null;
  completed_at: string | null;
  evidence_digest: string | null;
  screen_rephotograph: { suspected: boolean; coverage: 'partial_v1' };
  detectors: VerificationDetectorSummary[];
};

function formatProofTimestamp(value: string | null | undefined) {
  if (!value) return '—';
  if (/^\d{4}-\d{2}-\d{2} · \d{2}:\d{2}$/.test(value)) return value;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  const iso = date.toISOString();
  return `${iso.slice(0, 10)} · ${iso.slice(11, 16)}`;
}

function formatEvidenceTimestamp(value: string | null | undefined) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  const iso = date.toISOString();
  return `${iso.slice(0, 10)} · ${iso.slice(11, 16)} UTC`;
}

function formatPublishedDate(value: string | null | undefined) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(date);
}

function formatScore(value: number | null | undefined) {
  return value === null || value === undefined ? '—' : value.toFixed(3);
}

function SignalBar({ signal }: { signal: TechnicalSignalRecord }) {
  return (
    <article className="technical-signal">
      <div className="technical-signal-head">
        <h3>{signal.label}</h3>
        <span
          className="signal-segments"
          aria-label={`${signal.label}: ${signal.strength} of 5 supporting segments`}
        >
          {[1, 2, 3, 4, 5].map(segment => (
            <span key={segment} data-active={segment <= signal.strength} />
          ))}
        </span>
      </div>
      <p>{signal.description ?? 'This signal was included as supporting process context.'}</p>
      <p className="signal-qualifier">{signal.qualifier ?? 'This signal is contextual and is not proof or an AI-content verdict on its own.'}</p>
    </article>
  );
}

function provenanceSignalSummary(name: string, value: Record<string, unknown>): string {
  const note = typeof value.note === 'string' ? value.note : null;
  if (note) return note;
  if (name === 'duplicate_hash') return value.duplicate ? 'The original hash matches an existing Work.' : 'No exact original-hash duplicate was found.';
  return 'Recorded as provenance and integrity context for the automated review pipeline.';
}

function evidenceValue(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === '') return '—';
  return String(value);
}

export default async function WorkPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await getServerSupabase();
  const { data: authData } = await supabase.auth.getUser();
  const [work, verificationResult] = await Promise.all([
    getWorkById(id),
    supabase.rpc('get_work_verification_summary', { p_work_id: id }),
  ]);
  if (!work) notFound();
  const verification = verificationResult.error
    ? null
    : verificationResult.data as VerificationSummary | null;
  const saveContext: CollectionSaveContext = await getCollectionSaveContext([work.id]).catch((): CollectionSaveContext => ({
    isSignedIn: Boolean(authData.user),
    collections: [],
    savedByWork: {},
  }));
  const proofStory = work.proof_story;
  const isOwner = authData.user?.id === work.creator_id;
  let initialFollowing = false;
  if (authData.user && !isOwner) {
    const { data: follow } = await supabase
      .from('follows')
      .select('creator_id')
      .eq('follower_id', authData.user.id)
      .eq('creator_id', work.creator_id)
      .maybeSingle();
    initialFollowing = Boolean(follow);
  }

  const signals = work.technical_signals.slice(0, 4);
  const category = work.category_slug ? getCategoryDisplayName(work.category_slug) : 'Uncategorized';
  const evidence = work.file_evidence;
  const originalHash = evidence?.originalHash ?? null;
  const isRemote = work.media_url.startsWith('http');
  const hasCameraCredential = work.provenance_signals.some(signal => (
    signal.name === 'c2pa'
    && signal.value.camera_capture_asserted === true
  ));
  const isBareUnverified = work.badge_variant === 'unverified'
    && work.origin_input !== 'captured_in_app'
    && !hasCameraCredential;

  const fileRows = [
    ['Capture device', evidenceValue(evidence?.captureDevice)],
    ['Lens', evidenceValue(evidence?.lens)],
    ['ISO', evidenceValue(evidence?.iso)],
    ['Shutter', evidenceValue(evidence?.shutter)],
    ['Dimensions', evidenceValue(evidence?.dimensions ?? `${work.width} × ${work.height} px`)],
    ['File format', evidenceValue(evidence?.format)],
    ['Original hash', originalHash],
    ['Captured', formatEvidenceTimestamp(evidence?.capturedAt)],
    ['Uploaded', formatEvidenceTimestamp(evidence?.uploadTimestamp ?? work.published_at)],
    ['Origin input', evidenceValue(evidence?.originInput)],
  ] as const;

  return (
    <main className="section work-page">
      <article className="work-layout page-first-section">
        <div className="work-primary">
          <div className="work-visual">
            <span className="media-skeleton" aria-hidden="true" />
            <Image
              src={work.media_url}
              alt={work.alt_text ?? work.title}
              width={work.width}
              height={work.height}
              priority
              unoptimized={isRemote || work.media_url.endsWith('.svg')}
            />
          </div>

          <section className="work-summary">
            <div className="meta">{category}</div>
            <h1 className="work-title">{work.title}</h1>
            <div className="work-creator-row">
              {work.creator_avatar_url ? (
                <img className="creator-avatar" src={work.creator_avatar_url} alt="" />
              ) : (
                <span className="creator-avatar" aria-hidden="true">
                  {work.creator_username.slice(0, 1).toUpperCase()}
                </span>
              )}
              <Link className="creator-handle creator-profile-link" href={`/creator/${work.creator_username}`}>
                @{work.creator_username}
              </Link>
              <FollowButton
                creatorId={work.creator_id}
                handle={work.creator_username}
                isSignedIn={Boolean(authData.user)}
                isOwner={isOwner}
                initialFollowing={initialFollowing}
                nextPath={`/work/${work.id}`}
              />
            </div>
            <p className="work-description">
              {work.description ?? 'A creator-submitted Work with a public origin record.'}
            </p>
            {isOwner && isBareUnverified && work.status !== 'rejected' ? (
              <aside className="unverified-guidance" aria-label="Unverified Work guidance">
                <span className="panel-label">Not yet in default Discover</span>
                <p>
                  {work.proof_count >= 1
                    ? 'This Work is still unverified until its process evidence and untouched original are submitted to Humn’s automated detector pipeline.'
                    : 'This Work is unverified and self-declared. Add real process evidence, then request automated review.'}
                </p>
                <Link className="text-link" href={`/work/${work.id}/proofs`}>
                  {work.proof_count >= 1 ? 'Review proof story' : 'Add proof story'}
                </Link>
              </aside>
            ) : null}
            {isOwner && work.status === 'rejected' ? (
              <aside className="unverified-guidance danger-zone" aria-label="Rejected Work resubmission">
                <span className="panel-label">Automated review rejected this submission</span>
                <p>{work.review_note ?? verification?.reason ?? 'A strong automated synthetic-content signal was recorded.'}</p>
                <p className="method-hedge">Detector scores are not infallible. Submit a different untouched original with genuine process evidence rather than re-encoding this file.</p>
                <Link className="button secondary" href="/share">RESUBMIT A WORK</Link>
              </aside>
            ) : null}
            <WorkActionButtons
              workId={work.id}
              title={work.title}
              creatorUsername={work.creator_username}
              isDevelopment={false}
              isSignedIn={saveContext.isSignedIn}
              collections={saveContext.collections}
              savedCollectionIds={saveContext.savedByWork[work.id] ?? []}
            />
            {isOwner ? (
              <div className="creator-proof-actions">
                {work.status !== 'rejected' ? <Link className="button secondary" href={`/work/${work.id}/proofs`}>ADD PROOF STORY</Link> : null}
                {work.proof_count >= 1 && work.status === 'declared' && !work.ai_declared
                  ? <RequestVerificationButton workId={work.id} />
                  : null}
                {work.review_note && work.status !== 'rejected' ? <p className="notice">REVIEW NOTE: {work.review_note}</p> : null}
              </div>
            ) : null}
          </section>
        </div>

        <aside className="provenance-panel" aria-label="Origin record">
          <section className="provenance-block origin-record-head">
            <div className="origin-record-title">
              <span className="panel-label">Origin record</span>
              <ProvenanceBadge variant={work.badge_variant} label={work.badge_label} />
            </div>
            {work.status === 'verified' ? <p className="method-hedge">{AUTOMATED_VERIFIED_EXPLANATION} This is a cross-validated automated result, not a claim of certainty or human authorship proof.</p> : null}
          </section>

          {verification ? (
            <section className="provenance-block">
              <div className="provenance-heading">
                <div>
                  <div className="panel-label">Automated verification</div>
                  <h2>{verification.decision ?? verification.state}</h2>
                </div>
                <span className="meta">{verification.pipeline_version ?? 'VERSION PENDING'}</span>
              </div>
              {verification.reason && isOwner ? <p>{verification.reason}</p> : null}
              <dl className="file-evidence-list">
                {verification.detectors.map(detector => (
                  <div className="file-evidence-row" key={`${detector.role}-${detector.provider}`}>
                    <dt>{detector.provider} · {detector.role}</dt>
                    <dd>AI {formatScore(detector.ai_score)} · confidence {formatScore(detector.confidence)} · {detector.status}</dd>
                  </div>
                ))}
                <div className="file-evidence-row"><dt>Screen rephotograph</dt><dd>{verification.screen_rephotograph.suspected ? 'Suspected · escalated' : 'Not flagged · partial v1 coverage'}</dd></div>
                <div className="file-evidence-row"><dt>Evidence digest</dt><dd>{verification.evidence_digest ? <CopyHash value={verification.evidence_digest} /> : 'Pending'}</dd></div>
              </dl>
              <p className="method-hedge">Every detector score is a signal, not a verdict. Disagreement, low confidence, provider failure, duplicate originals and screen-rephotograph suspicion do not auto-pass.</p>
            </section>
          ) : null}

          <section className="provenance-block" id="proof-story">
            <div className="provenance-heading">
              <div>
                <div className="panel-label">Proof story</div>
                <h2>Process record</h2>
              </div>
              <span className="meta">{pluralize(proofStory.length, 'ENTRY', 'ENTRIES')}</span>
            </div>
            {proofStory.length ? (
              <ol className="proof-timeline">
                {proofStory.map(item => (
                  <li key={item.id}>
                    <time className="meta">{formatProofTimestamp(item.timestamp)}</time>
                    <div className={item.thumbnail_url ? 'proof-entry-body has-thumbnail' : 'proof-entry-body'}>
                      {item.thumbnail_url ? (
                        <Image src={item.thumbnail_url} alt={`Process stage: ${item.label}`} width={80} height={80} unoptimized />
                      ) : null}
                      <div>
                        <h3>{item.label}</h3>
                        <p>{item.note}</p>
                      </div>
                    </div>
                  </li>
                ))}
              </ol>
            ) : (
              <div className="proof-empty">
                <span className="panel-label">No process evidence attached</span>
                <p>
                  The creator attached no process evidence. This Work is UNVERIFIED · SELF-DECLARED: the human-made claim comes from the uploader and has not been cleared by Humn.
                </p>
              </div>
            )}
          </section>

          <section className="provenance-block catalogue-record">
            <div className="panel-label">Catalogue</div>
            <dl className="catalogue-list">
              <div><dt>Category</dt><dd>{category}</dd></div>
              <div><dt>Published</dt><dd>{formatPublishedDate(work.published_at)}</dd></div>
            </dl>
          </section>

          <section className="provenance-block">
            <div className="panel-label">File evidence</div>
            <dl className="file-evidence-list">
              {fileRows.map(([label, value]) => (
                <div className="file-evidence-row" key={label}>
                  <dt>{label}</dt>
                  <dd>
                    {label === 'Original hash' && originalHash ? <CopyHash value={originalHash} /> : evidenceValue(value)}
                  </dd>
                </div>
              ))}
            </dl>
          </section>

          <section className="provenance-block">
            <div className="provenance-heading">
              <div className="panel-label">Recorded provenance</div>
              <span className="meta">{pluralize(work.provenance_signals.length, 'SIGNAL', 'SIGNALS')}</span>
            </div>
            <div className="provenance-signal-list">
              {work.provenance_signals.map(signal => (
                <article className="provenance-signal" key={signal.name}>
                  <div className="meta">{signal.name.replaceAll('_', ' ')}</div>
                  <p>{provenanceSignalSummary(signal.name, signal.value)}</p>
                </article>
              ))}
            </div>
            <p className="method-hedge">Missing Content Credentials or EXIF is neutral. These signals describe provenance and integrity; they do not detect AI visual content by themselves.</p>
          </section>

          <section className="provenance-block">
            <div className="provenance-heading">
              <div className="panel-label">Technical process signals</div>
              <span className="meta">{pluralize(signals.length, 'SIGNAL', 'SIGNALS')}</span>
            </div>
            <div className="technical-signal-list">
              {signals.map(signal => <SignalBar key={signal.label} signal={signal} />)}
            </div>
            <p className="method-hedge">
              Process signals supplement detector results. They are not AI-content classifiers and are never proof on their own.
            </p>
          </section>

          <footer className="provenance-footer">
            <Link className="report-work-link" href={`/report/${work.id}`}>Report this work</Link>
            <Link href="/style-guide#provenance-method">How verification works</Link>
          </footer>
        </aside>
      </article>
    </main>
  );
}
