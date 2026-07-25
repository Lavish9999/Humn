import { notFound, redirect } from 'next/navigation';
import { getServerSupabase } from '../../../lib/supabase/server';
import { getWorkById } from '../../../lib/data/works';
import { ReportForm } from './report-form';

export default async function ReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await getServerSupabase();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect(`/signin?next=${encodeURIComponent(`/report/${id}`)}`);
  const work = await getWorkById(id);
  if (!work) notFound();
  return (
    <main className="shell report-page">
      <section className="form-card page-first-section share-work-card">
        <header className="form-header"><div className="eyebrow">Report</div><h3>Report this work</h3><p className="muted">Report “{work.title}” only for a specific provenance or policy concern.</p></header>
        <div className="form-body"><ReportForm workId={work.id} /></div>
      </section>
    </main>
  );
}
