import { after, NextResponse } from 'next/server';
import { getServerSupabase } from '../../../../../lib/supabase/server';
import { runVerificationForWork } from '../../../../../lib/verification/pipeline';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await getServerSupabase();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ redirectTo: '/signin' }, { status: 401 });

  const { data: runId, error } = await supabase.rpc('request_work_verification', { p_work_id: id });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  // The browser can request review but never receives provider credentials and
  // never controls scores or status transitions. Next.js keeps this server work
  // alive after the response; the durable DB queue supports secure recovery.
  after(async () => {
    try {
      await runVerificationForWork(id);
    } catch (pipelineError) {
      console.error('[automated-verification] Immediate trigger failed.', {
        workId: id,
        runId,
        errorClass: pipelineError instanceof Error ? pipelineError.name : 'UnknownError',
        error: pipelineError instanceof Error ? pipelineError.message : String(pipelineError),
      });
    }
  });

  return NextResponse.json({ ok: true, runId, status: 'awaiting' });
}
