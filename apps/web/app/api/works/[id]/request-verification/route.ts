import { NextResponse } from 'next/server';
import { getServerSupabase } from '../../../../../lib/supabase/server';

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await getServerSupabase();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ redirectTo: '/signin' }, { status: 401 });
  const { error } = await supabase.rpc('request_work_verification', { p_work_id: id });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
