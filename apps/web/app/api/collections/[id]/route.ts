import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { getServerSupabase } from '../../../../lib/supabase/server';

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isUuid(id)) return NextResponse.json({ error: 'Invalid collection identifier.' }, { status: 400 });

  const supabase = await getServerSupabase();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: 'Sign in to update a collection.' }, { status: 401 });

  const body = await request.json().catch(() => ({})) as Record<string, unknown>;
  const updates: { name?: string; privacy?: 'private' | 'public' } = {};

  if (typeof body.name === 'string') {
    const name = body.name.trim();
    if (!name || name.length > 100) {
      return NextResponse.json({ field: 'name', error: 'Collection name must be 1–100 characters.' }, { status: 400 });
    }
    updates.name = name;
  }
  if (body.privacy === 'private' || body.privacy === 'public') updates.privacy = body.privacy;
  if (!Object.keys(updates).length) return NextResponse.json({ error: 'No valid changes supplied.' }, { status: 400 });

  const { data, error } = await supabase
    .from('collections')
    .update(updates)
    .eq('id', id)
    .select('id,name,privacy,updated_at')
    .single();

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ field: 'name', error: 'You already have a collection with that name.' }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: error.code === '42501' ? 403 : 400 });
  }

  revalidatePath('/collections');
  revalidatePath(`/collections/${id}`);
  return NextResponse.json({ collection: data });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isUuid(id)) return NextResponse.json({ error: 'Invalid collection identifier.' }, { status: 400 });

  const supabase = await getServerSupabase();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: 'Sign in to delete a collection.' }, { status: 401 });

  const { data, error } = await supabase
    .from('collections')
    .delete()
    .eq('id', id)
    .select('id')
    .single();
  if (error || !data) {
    return NextResponse.json(
      { error: error?.message ?? 'Collection not found or not owned by this account.' },
      { status: error?.code === '42501' ? 403 : 404 },
    );
  }

  revalidatePath('/collections');
  return NextResponse.json({ deleted: true });
}
