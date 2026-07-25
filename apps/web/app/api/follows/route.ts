import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { getServerSupabase } from '../../../lib/supabase/server';

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

async function readRequest(request: Request) {
  const body = await request.json().catch(() => ({})) as { creatorId?: unknown; handle?: unknown };
  return {
    creatorId: typeof body.creatorId === 'string' ? body.creatorId : '',
    handle: typeof body.handle === 'string' ? body.handle.trim().toLowerCase() : '',
  };
}

async function followerCount(creatorId: string) {
  const supabase = await getServerSupabase();
  const { count, error } = await supabase
    .from('follows')
    .select('follower_id', { count: 'exact', head: true })
    .eq('creator_id', creatorId);
  if (error) throw new Error(error.message);
  return count ?? 0;
}

function revalidateCreator(handle: string) {
  revalidatePath('/discover');
  revalidatePath('/creator');
  if (handle) {
    revalidatePath(`/creator/${handle}`);
    revalidatePath(`/creator/${handle}/followers`);
    revalidatePath(`/creator/${handle}/following`);
  }
}

export async function POST(request: Request) {
  const supabase = await getServerSupabase();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: 'Sign in to follow creators.' }, { status: 401 });

  const { creatorId, handle } = await readRequest(request);
  if (!isUuid(creatorId)) return NextResponse.json({ error: 'Invalid creator identifier.' }, { status: 400 });
  if (creatorId === auth.user.id) return NextResponse.json({ error: 'You cannot follow your own profile.' }, { status: 400 });

  const { error } = await supabase.from('follows').upsert(
    { follower_id: auth.user.id, creator_id: creatorId },
    { onConflict: 'follower_id,creator_id', ignoreDuplicates: true },
  );
  if (error) return NextResponse.json({ error: error.message }, { status: error.code === '42501' ? 403 : 400 });

  revalidateCreator(handle);
  return NextResponse.json({ following: true, followerCount: await followerCount(creatorId) });
}

export async function DELETE(request: Request) {
  const supabase = await getServerSupabase();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: 'Sign in to manage follows.' }, { status: 401 });

  const { creatorId, handle } = await readRequest(request);
  if (!isUuid(creatorId)) return NextResponse.json({ error: 'Invalid creator identifier.' }, { status: 400 });

  const { error } = await supabase
    .from('follows')
    .delete()
    .eq('follower_id', auth.user.id)
    .eq('creator_id', creatorId);
  if (error) return NextResponse.json({ error: error.message }, { status: error.code === '42501' ? 403 : 400 });

  revalidateCreator(handle);
  return NextResponse.json({ following: false, followerCount: await followerCount(creatorId) });
}
