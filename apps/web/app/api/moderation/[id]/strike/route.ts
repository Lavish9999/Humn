import { NextResponse } from 'next/server';
import { getServerSupabase } from '../../../../../lib/supabase/server';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await getServerSupabase();
  const payload = await request.json().catch(() => null) as { reason?: string } | null;
  const reason = payload?.reason?.trim() ?? '';
  if (reason.length < 3) return NextResponse.json({ error: 'A clear violation reason is required.' }, { status: 400 });

  const { data, error } = await supabase.rpc('issue_review_strike', {
    p_work_id: id,
    p_reason: reason,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 403 });
  return NextResponse.json({ ok: true, state: data });
}
