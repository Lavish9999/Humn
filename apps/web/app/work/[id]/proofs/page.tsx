import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { getServerSupabase } from '../../../../lib/supabase/server';
import { getWorkById } from '../../../../lib/data/works';
import { ProofForm } from './proof-form';

export default async function ProofAuthoringPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await getServerSupabase();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect(`/signin?next=${encodeURIComponent(`/work/${id}/proofs`)}`);
  const work = await getWorkById(id);
  if (!work || work.creator_id !== auth.user.id) notFound();

  return (
    <main className="shell report-page">
      <section className="form-card page-first-section share-work-card">
        <header className="form-header">
          <div className="eyebrow">Proof story</div>
          <h3>Add process evidence</h3>
          <p className="muted">Attach a real timestamped stage from making “{work.title}.” Proof entries request human review; they do not self-verify a work.</p>
        </header>
        <div className="form-body"><ProofForm workId={work.id} /></div>
      </section>
      <Link className="text-link" href={`/work/${work.id}`}>RETURN TO ORIGIN RECORD</Link>
    </main>
  );
}
