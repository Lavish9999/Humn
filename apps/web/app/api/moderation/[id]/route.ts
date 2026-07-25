import { after, NextResponse } from 'next/server';
import { getServerSupabase } from '../../../../lib/supabase/server';
import { runVerificationForWork } from '../../../../lib/verification/pipeline';

const POLICY_ACTIONS = new Set(['reject', 'remove']);
const ESCALATION_ACTIONS = new Set(['resubmit', 'retry']);

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await getServerSupabase();
  const payload = await request.json().catch(() => null) as { action?: string; reason?: string } | null;
  const action = payload?.action ?? '';
  const reason = payload?.reason?.trim() ?? '';
  if (!POLICY_ACTIONS.has(action) && !ESCALATION_ACTIONS.has(action)) {
    return NextResponse.json({ error: 'Choose a valid review action.' }, { status: 400 });
  }
  if (reason.length < 3) return NextResponse.json({ error: 'A review reason is required.' }, { status: 400 });

  if (ESCALATION_ACTIONS.has(action)) {
    const { data, error } = await supabase.rpc('resolve_escalated_verification', {
      p_work_id: id,
      p_action: action,
      p_reason: reason,
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 403 });
    if (action === 'retry') {
      after(async () => {
        try {
          await runVerificationForWork(id);
        } catch (pipelineError) {
          console.error('[automated-verification] Escalation retry trigger failed.', {
            workId: id,
            errorClass: pipelineError instanceof Error ? pipelineError.name : 'UnknownError',
            error: pipelineError instanceof Error ? pipelineError.message : String(pipelineError),
          });
        }
      });
    }
    return NextResponse.json({ ok: true, status: data });
  }

  const { data, error } = await supabase.rpc('moderate_work', {
    p_work_id: id,
    p_action: action,
    p_reason: reason,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 403 });
  return NextResponse.json({ ok: true, status: data });
}
