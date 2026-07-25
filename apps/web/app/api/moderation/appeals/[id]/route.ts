import { NextResponse } from 'next/server';
import { getServerSupabase } from '../../../../../lib/supabase/server';

const ACTIONS = new Set(['uphold', 'deny', 'overturn']);

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await getServerSupabase();
  const payload = await request.json().catch(() => null) as { action?: string; reason?: string } | null;
  const action = payload?.action ?? '';
  const reason = payload?.reason?.trim() ?? '';

  if (!ACTIONS.has(action)) return NextResponse.json({ error: 'Choose a valid strike action.' }, { status: 400 });
  if (reason.length < 3) return NextResponse.json({ error: 'A resolution reason is required.' }, { status: 400 });

  const { data, error } = await supabase.rpc('resolve_strike_appeal', {
    p_strike_id: id,
    p_resolution: action,
    p_reason: reason,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 403 });
  return NextResponse.json({ ok: true, state: data });
}
