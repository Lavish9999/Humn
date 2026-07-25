import { revalidatePath } from 'next/cache';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { adminSupabase } from '../../../lib/supabase';

const reviewerRoles = ['moderator', 'senior_moderator', 'trust_safety_lead', 'admin'];
const actions = ['approve', 'request_evidence', 'restrict_distribution', 'remove', 'escalate'] as const;
type CaseAction = (typeof actions)[number];

async function decideCase(formData: FormData) {
  'use server';
  const caseId = String(formData.get('caseId') ?? '');
  const action = String(formData.get('action') ?? '') as CaseAction;
  const reasonCode = String(formData.get('reasonCode') ?? '');
  const notes = String(formData.get('notes') ?? '');
  if (!caseId || !actions.includes(action) || !reasonCode) throw new Error('Invalid moderation decision.');

  const supabase = await adminSupabase();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error('Authentication required.');
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', auth.user.id).single();
  if (!reviewerRoles.includes(profile?.role ?? '')) throw new Error('Reviewer permission required.');
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;
  if (!token) throw new Error('Reauthentication required.');
  const payload = JSON.parse(Buffer.from(token.split('.')[1] ?? '', 'base64url').toString('utf8')) as { iat?: number; aal?: string };
  if (!payload.iat || Math.floor(Date.now() / 1000) - payload.iat > 900) throw new Error('Reauthentication required before a moderation decision.');
  if (['trust_safety_lead', 'admin'].includes(profile?.role ?? '') && payload.aal !== 'aal2') throw new Error('MFA is required for this role.');

  const { data: currentCase, error: caseError } = await supabase
    .from('moderation_cases')
    .select('*')
    .eq('id', caseId)
    .single();
  if (caseError) throw caseError;

  const nextCase: Record<string, unknown> = { status: 'decided' };
  const nextWork: Record<string, unknown> = {};
  if (action === 'approve') {
    nextWork.status = 'published';
    nextWork.origin_status = 'review_complete';
  } else if (action === 'request_evidence') {
    nextCase.status = 'waiting_evidence';
    nextWork.status = 'needs_evidence';
    nextWork.origin_status = 'under_review';
  } else if (action === 'restrict_distribution') {
    nextCase.status = 'assigned';
    nextWork.status = 'under_review';
    nextWork.origin_status = 'under_review';
  } else if (action === 'remove') {
    nextWork.status = 'rejected';
    nextWork.origin_status = 'under_review';
  } else if (action === 'escalate') {
    nextCase.status = 'assigned';
    nextCase.priority = 95;
  }

  const { error: actionError } = await supabase.from('moderation_actions').insert({
    case_id: caseId,
    actor_id: auth.user.id,
    action,
    reason_code: reasonCode,
    notes: notes || null,
    previous_state: currentCase,
    new_state: { case: nextCase, work: nextWork },
  });
  if (actionError) throw actionError;

  const { error: updateError } = await supabase.from('moderation_cases').update(nextCase).eq('id', caseId);
  if (updateError) throw updateError;
  if (currentCase.work_id && Object.keys(nextWork).length) {
    const { error: workError } = await supabase.from('works').update(nextWork).eq('id', currentCase.work_id);
    if (workError) throw workError;
  }

  revalidatePath(`/cases/${caseId}`);
  revalidatePath('/');
}

export default async function CasePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await adminSupabase();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return <main className="shell"><div className="empty">Sign in through the main web app first.</div></main>;
  const { data: profile } = await supabase.from('profiles').select('role,display_name').eq('id', auth.user.id).single();
  const { data: moderationCase } = await supabase.from('moderation_cases').select('*').eq('id', id).maybeSingle();
  if (!moderationCase) notFound();

  const [workResult, reportResult, actionResult] = await Promise.all([
    moderationCase.work_id
      ? supabase.from('works').select('*,profiles!works_creator_id_fkey(display_name,username),work_media(*)').eq('id', moderationCase.work_id).maybeSingle()
      : Promise.resolve({ data: null }),
    moderationCase.work_id
      ? supabase.from('reports').select('*').eq('work_id', moderationCase.work_id).order('created_at', { ascending: false })
      : Promise.resolve({ data: [] }),
    supabase.from('moderation_actions').select('*,profiles!moderation_actions_actor_id_fkey(display_name,username)').eq('case_id', id).order('created_at', { ascending: false }),
  ]);
  const work = workResult.data as any;
  const canDecide = reviewerRoles.includes(profile?.role ?? '');

  return <main className="shell">
    <div className="header"><div><Link href="/">← Queue</Link><h1>{moderationCase.queue_type.replaceAll('_', ' ')}</h1></div><span>{profile?.display_name} · {profile?.role}</span></div>
    <div className="grid">
      <div className="card"><strong>Status</strong><h2>{moderationCase.status}</h2></div>
      <div className="card"><strong>Priority</strong><h2>{moderationCase.priority}</h2></div>
      <div className="card"><strong>Reports</strong><h2>{reportResult.data?.length ?? 0}</h2></div>
      <div className="card"><strong>Policy</strong><h2>{moderationCase.policy_version}</h2></div>
    </div>

    <div style={{ display: 'grid', gridTemplateColumns: '1.2fr .8fr', gap: 18, marginTop: 20 }}>
      <section className="card">
        <h2>Work and evidence summary</h2>
        {!work ? <p>No Work is attached.</p> : <>
          {work.work_media?.[0]?.public_url && <img src={work.work_media[0].public_url} alt={work.work_media[0].alt_text ?? work.title} style={{ width: '100%', borderRadius: 12, maxHeight: 620, objectFit: 'contain', background: '#0d0e0c' }} />}
          <h2>{work.title}</h2>
          <p>{work.description}</p>
          <p>Creator: <strong>@{work.profiles?.username}</strong></p>
          <p>Origin: <span className="pill">{work.origin_status}</span> · Risk score: {work.origin_risk_score ?? 'not calculated'}</p>
        </>}
        <h3>Reports</h3>
        {reportResult.data?.length ? reportResult.data.map((report: any) => <div className="card" key={report.id} style={{ marginTop: 10 }}><strong>{report.reason}</strong><p>{report.details}</p><small>{new Date(report.created_at).toLocaleString()}</small></div>) : <p>No reports attached.</p>}
      </section>

      <aside style={{ display: 'grid', gap: 18, alignContent: 'start' }}>
        <section className="card">
          <h2>Decision</h2>
          {!canDecide ? <p>This role has read-only access.</p> : <form action={decideCase} style={{ display: 'grid', gap: 12 }}>
            <input type="hidden" name="caseId" value={id} />
            <label>Action<select name="action" required defaultValue="request_evidence"><option value="approve">Approve</option><option value="request_evidence">Request evidence</option><option value="restrict_distribution">Restrict distribution</option><option value="remove">Remove</option><option value="escalate">Escalate</option></select></label>
            <label>Reason code<select name="reasonCode" required defaultValue="insufficient_origin_evidence"><option value="verified_evidence_consistent">Verified evidence consistent</option><option value="insufficient_origin_evidence">Insufficient origin evidence</option><option value="contradictory_metadata">Contradictory metadata</option><option value="confirmed_policy_violation">Confirmed policy violation</option><option value="requires_senior_review">Requires senior review</option></select></label>
            <label>Reviewer notes<textarea name="notes" rows={7} placeholder="Explain the evidence and decision." /></label>
            <button type="submit">Record decision</button>
          </form>}
        </section>
        <section className="card"><h2>Audit history</h2>{actionResult.data?.length ? actionResult.data.map((action: any) => <div key={action.id} style={{ borderTop: '1px solid #34382F', padding: '12px 0' }}><strong>{action.action}</strong><p>{action.reason_code}</p><small>{action.profiles?.display_name} · {new Date(action.created_at).toLocaleString()}</small></div>) : <p>No decisions recorded.</p>}</section>
      </aside>
    </div>
  </main>;
}
