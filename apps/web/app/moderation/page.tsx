import Image from 'next/image';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { getModerationDashboard, getReviewerContext } from '../../lib/data/moderation';
import { ProvenanceBadge } from '../../components/provenance-badge';

export default async function ModerationPage() {
  const reviewer = await getReviewerContext();
  if (!reviewer.user) redirect('/signin?next=/moderation');
  if (!reviewer.canReview) notFound();
  const dashboard = await getModerationDashboard();

  return (
    <main className="section page-first-section">
      <div className="page-intro">
        <div className="meta">Human review</div>
        <h1>Moderation queue</h1>
        <p>Only works crossing the report threshold or requesting the top verified tier appear here.</p>
      </div>
      <div className="moderation-list">
        {dashboard.works.length ? dashboard.works.map(item => (
          <article className="moderation-row" key={item.work_id}>
            <Link href={`/moderation/${item.work_id}`} aria-label={`Review ${item.title}`}>
              <Image src={item.image_url} alt="" width={120} height={120} unoptimized />
            </Link>
            <div>
              <div className="meta">{item.triggers.join(' · ')}</div>
              <h2><Link href={`/moderation/${item.work_id}`}>{item.title}</Link></h2>
              <p><Link className="creator-profile-link" href={`/creator/${item.creator_handle}`}>@{item.creator_handle}</Link> · {item.report_count} reports · {item.proof_count} proofs</p>
              <ProvenanceBadge variant={item.badge_variant} label={item.badge_label} />
            </div>
          </article>
        )) : <p className="meta">NO WORKS CURRENTLY REQUIRE HUMAN REVIEW</p>}
      </div>

      <section className="section">
        <div className="section-head">
          <div>
            <div className="meta">Human appeals</div>
            <h2>Strike appeals</h2>
          </div>
        </div>
        <div className="moderation-list">
          {dashboard.appeals.length ? dashboard.appeals.map(appeal => (
            <article className="moderation-row" key={appeal.strike_id}>
              <div className="meta">{appeal.active_count} ACTIVE</div>
              <div>
                <div className="meta">{appeal.source}</div>
                <h2><Link className="creator-profile-link" href={`/creator/${appeal.handle}`}>@{appeal.handle}</Link></h2>
                <p>{appeal.appeal_reason}</p>
                <Link className="text-link" href={`/moderation/appeals/${appeal.strike_id}`}>Review appeal</Link>
              </div>
            </article>
          )) : <p className="meta">NO STRIKE APPEALS CURRENTLY REQUIRE HUMAN REVIEW</p>}
        </div>
      </section>
    </main>
  );
}
