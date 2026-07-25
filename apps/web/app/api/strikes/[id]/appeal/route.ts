import { NextResponse } from 'next/server';
import { getServerSupabase } from '../../../../../lib/supabase/server';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await getServerSupabase();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: 'Sign in to appeal a strike.' }, { status: 401 });

  const payload = await request.json().catch(() => null) as { reason?: string } | null;
  const reason = payload?.reason?.trim() ?? '';
  if (reason.length < 10) return NextResponse.json({ error: 'Appeal reason must be at least 10 characters.' }, { status: 400 });

  const { error } = await supabase.rpc('submit_strike_appeal', {
    p_strike_id: id,
    p_reason: reason,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 403 });
  return NextResponse.json({ ok: true });
}
