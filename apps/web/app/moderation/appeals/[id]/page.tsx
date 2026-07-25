import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { getReviewerContext } from '../../../../lib/data/moderation';
import { getStrikeAppealDetail } from '../../../../lib/data/strikes';
import { AppealReviewForm } from './appeal-review-form';

function formatDate(value: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
  }).format(date);
}

export default async function StrikeAppealPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const reviewer = await getReviewerContext();
  if (!reviewer.user) redirect(`/signin?next=${encodeURIComponent(`/moderation/appeals/${id}`)}`);
  if (!reviewer.canReview) notFound();

  const detail = await getStrikeAppealDetail(id);
  if (!detail) notFound();
  const { strike, state } = detail;

  return (
    <main className="shell section page-first-section">
      <div className="page-intro">
        <div className="meta">Strike review</div>
        <h1><Link href={`/creator/${detail.handle}`}>@{detail.handle}</Link></h1>
        <p>{detail.displayName} · {state?.active_count ?? 0} active strikes</p>
      </div>

      <div className="settings-grid">
        <section className="settings-panel settings-primary">
          <div className="meta">Current strike</div>
          <h2>{strike.reason}</h2>
          <dl className="meta-list">
            <dt>Source</dt><dd>{strike.source}</dd>
            <dt>Created</dt><dd>{formatDate(strike.created_at)}</dd>
            <dt>Expires</dt><dd>{formatDate(strike.expires_at)}</dd>
            <dt>Appeal</dt><dd>{strike.appeal_status}</dd>
            <dt>Work</dt><dd>{strike.work_id ? <Link className="text-link" href={`/work/${strike.work_id}`}>OPEN WORK</Link> : '—'}</dd>
          </dl>
          {strike.appeal_reason ? <><div className="meta">Creator appeal</div><p>{strike.appeal_reason}</p></> : <p className="meta">NO APPEAL TEXT</p>}
          {strike.evidence && Object.keys(strike.evidence).length ? <pre>{JSON.stringify(strike.evidence, null, 2)}</pre> : null}
        </section>

        <section className="settings-panel">
          <div className="meta">Current account state</div>
          <dl className="meta-list">
            <dt>Active strikes</dt><dd>{state?.active_count ?? 0}</dd>
            <dt>Posting</dt><dd>{state?.can_post ? 'AVAILABLE' : 'RESTRICTED'}</dd>
            <dt>Cooldown</dt><dd>{formatDate(state?.posting_cooldown_until ?? null)}</dd>
            <dt>Suspended</dt><dd>{formatDate(state?.suspended_at ?? null)}</dd>
          </dl>
        </section>

        <AppealReviewForm strikeId={strike.id} hasPendingAppeal={strike.appeal_status === 'pending'} />
      </div>

      <section className="section">
        <div className="section-head"><div><div className="meta">User history</div><h2>All strikes</h2></div></div>
        <div className="moderation-list">
          {detail.history.map(item => (
            <article className="moderation-row" key={item.id}>
              <div className="meta">{item.appeal_status.toUpperCase()}</div>
              <div>
                <h2>{item.reason}</h2>
                <p>{item.source} · {formatDate(item.created_at)} · expires {formatDate(item.expires_at)}</p>
              </div>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
