import { NextResponse } from 'next/server';
import { getServerSupabase } from '../../../lib/supabase/server';

export async function POST(request: Request) {
  const supabase = await getServerSupabase();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ redirectTo: '/signin' }, { status: 401 });
  const payload = await request.json().catch(() => null) as { workId?: string; reason?: string } | null;
  const workId = payload?.workId?.trim() ?? '';
  const reason = payload?.reason?.trim() ?? '';
  if (!workId) return NextResponse.json({ error: 'Work is required.' }, { status: 400 });
  if (reason.length < 10 || reason.length > 1000) return NextResponse.json({ error: 'Explain the concern in 10–1,000 characters.' }, { status: 400 });
  const { error } = await supabase.from('reports').insert({ work_id: workId, reporter_id: auth.user.id, reason });
  if (error) {
    const message = error.code === '23505' ? 'You already reported this work.' : error.message;
    return NextResponse.json({ error: message }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
