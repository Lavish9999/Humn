import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { getServerSupabase } from '../../../../../lib/supabase/server';

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: collectionId } = await params;
  const supabase = await getServerSupabase();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: 'Sign in to save work.' }, { status: 401 });

  const body = await request.json().catch(() => ({})) as { workId?: unknown; action?: unknown };
  const workId = typeof body.workId === 'string' ? body.workId : '';
  const action = body.action === 'remove' ? 'remove' : 'save';

  if (!isUuid(collectionId) || !isUuid(workId)) {
    return NextResponse.json({ error: 'Invalid collection or work identifier.' }, { status: 400 });
  }

  const mutation = action === 'remove'
    ? supabase.from('collection_items').delete().eq('collection_id', collectionId).eq('work_id', workId)
    : supabase.from('collection_items').upsert(
        { collection_id: collectionId, work_id: workId },
        { onConflict: 'collection_id,work_id', ignoreDuplicates: true },
      );

  const { error } = await mutation;
  if (error) {
    const status = error.code === '42501' ? 403 : 400;
    return NextResponse.json({ error: error.message }, { status });
  }

  const { count, error: countError } = await supabase
    .from('collection_items')
    .select('work_id', { count: 'exact', head: true })
    .eq('collection_id', collectionId);

  if (countError) return NextResponse.json({ error: countError.message }, { status: 500 });

  revalidatePath('/collections');
  revalidatePath(`/collections/${collectionId}`);
  revalidatePath(`/work/${workId}`);

  return NextResponse.json({ saved: action === 'save', workCount: count ?? 0 });
}
