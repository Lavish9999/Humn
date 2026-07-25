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
          <section className="provenance-block">
            <div className="meta">Proof story · {work.proof_story.length} entries</div>
            {work.proof_story.map(entry => <article key={entry.id}><h3>{entry.label}</h3><p>{entry.note}</p><time className="meta">{entry.timestamp}</time></article>)}
          </section>
          <section className="provenance-block">
            <div className="meta">Provenance signals</div>
            {work.provenance_signals.map(signal => <article className="signal-record" key={signal.name}><h3>{signal.name}</h3><pre>{signalValue(signal.value)}</pre></article>)}
          </section>
          <section className="provenance-block">
            <div className="meta">Reports</div>
            {context.reports.length ? context.reports.map(report => <article key={report.id}><p>{report.reason}</p><time className="meta">{report.created_at}</time></article>) : <p className="meta">NO REPORTS</p>}
          </section>
          <ModerationActionForm workId={work.id} />
        </aside>
      </div>
    </main>
  );
}
