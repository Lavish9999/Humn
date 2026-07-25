import { NextResponse } from 'next/server';
import { getServerSupabase } from '../../../lib/supabase/server';

function text(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export async function GET(request: Request) {
  const supabase = await getServerSupabase();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: 'Sign in to save work.' }, { status: 401 });

  const workId = new URL(request.url).searchParams.get('workId') ?? '';
  if (workId && !isUuid(workId)) {
    return NextResponse.json({ error: 'Invalid work identifier.' }, { status: 400 });
  }

  const { data: collections, error: collectionError } = await supabase
    .from('collections')
    .select('id,name,privacy,updated_at')
    .eq('owner_id', auth.user.id)
    .order('updated_at', { ascending: false });

  if (collectionError) {
    return NextResponse.json({ error: collectionError.message }, { status: 500 });
  }

  const collectionIds = (collections ?? []).map((collection: { id: string }) => collection.id);
  let savedCollectionIds: string[] = [];

  if (workId && collectionIds.length) {
    const { data: items, error: itemError } = await supabase
      .from('collection_items')
      .select('collection_id')
      .eq('work_id', workId)
      .in('collection_id', collectionIds);

    if (itemError) return NextResponse.json({ error: itemError.message }, { status: 500 });
    savedCollectionIds = (items ?? []).map((item: { collection_id: string }) => item.collection_id);
  }

  return NextResponse.json({ collections: collections ?? [], savedCollectionIds });
}

export async function POST(request: Request) {
  const supabase = await getServerSupabase();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: 'Sign in to create a collection.' }, { status: 401 });

  const body = await request.json().catch(() => ({})) as Record<string, unknown>;
  const name = text(body.name);
  const privacy = body.privacy === 'public' ? 'public' : 'private';
  const workId = text(body.workId);

  if (!name || name.length > 100) {
    return NextResponse.json({ field: 'name', error: 'Collection name must be 1–100 characters.' }, { status: 400 });
  }
  if (workId && !isUuid(workId)) {
    return NextResponse.json({ error: 'Invalid work identifier.' }, { status: 400 });
  }

  const { data, error } = await supabase.rpc('create_collection_with_optional_work', {
    p_name: name,
    p_privacy: privacy,
    p_work_id: workId || null,
  });

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ field: 'name', error: 'You already have a collection with that name.' }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  const row = data as unknown as {
    id: string;
    owner_id: string;
    name: string;
    privacy: 'private' | 'public';
    created_at: string;
    updated_at: string;
  };

  return NextResponse.json({
    collection: { ...row, work_count: workId ? 1 : 0, preview_works: [] },
    saved: Boolean(workId),
  }, { status: 201 });
}
