import 'server-only';
import { getServerSupabase } from '../supabase/server';
import { mapFeedRow, type FeedRow } from './works';
import type { CollectionDetail, CollectionPickerCollection, CollectionSaveContext, CollectionSummary, ProvenanceVariant, WorkRecord, WorkStatus } from './types';

type CollectionRow = {
  id: string;
  owner_id: string;
  name: string;
  privacy: 'private' | 'public';
  created_at: string;
  updated_at: string;
  work_count: number;
  preview_works: Array<{
    id: string;
    title: string;
    aspect_ratio: string;
    image_url: string;
    thumb_url: string | null;
    creator_handle: string;
    proof_count: number;
    status: WorkStatus;
    ai_declared: boolean;
    report_count: number;
    feed_rank: number;
    badge: { badge_variant: ProvenanceVariant; badge_label: string };
  }>;
};

type CollectionDetailPayload = {
  id: string;
  owner_id: string;
  name: string;
  privacy: 'private' | 'public';
  created_at: string;
  updated_at: string;
  work_count: number;
  owner: {
    id: string;
    handle: string;
    display_name: string;
    avatar_url: string | null;
  };
  works: FeedRow[];
};

const sizes: Record<string, [number, number]> = {
  '2:3': [800, 1200],
  '1:1': [1000, 1000],
  '4:5': [960, 1200],
  '3:2': [1200, 800],
  '9:16': [720, 1280],
};

function mapPreview(work: CollectionRow['preview_works'][number]): WorkRecord {
  const [width, height] = sizes[work.aspect_ratio] ?? [1000, 1000];
  return {
    id: work.id,
    creator_id: '',
    title: work.title,
    description: null,
    category_slug: 'photography',
    aspect_ratio: work.aspect_ratio,
    media_url: work.thumb_url ?? work.image_url,
    thumb_url: work.thumb_url,
    width,
    height,
    alt_text: work.title,
    origin_input: 'uploaded',
    origin_status: work.status,
    status: work.status,
    proof_count: work.proof_count,
    review_complete: work.status === 'verified' && work.proof_count >= 1,
    created_at: '',
    published_at: null,
    creator_name: work.creator_handle,
    creator_username: work.creator_handle,
    creator_avatar_url: null,
    creator_reputation: 0,
    badge_variant: work.badge.badge_variant,
    badge_label: work.badge.badge_label,
    ai_declared: work.ai_declared ?? false,
    report_count: work.report_count ?? 0,
    feed_rank: work.feed_rank ?? 0,
    review_note: null,
  };
}

export async function getCollectionsForOwner(ownerId: string): Promise<CollectionSummary[]> {
  const supabase = await getServerSupabase();
  const { data, error } = await supabase.rpc('get_collection_summaries', { p_owner_id: ownerId });
  if (error) throw new Error(`Collections query failed: ${error.message}`);
  return ((data ?? []) as unknown as CollectionRow[]).map(row => ({
    id: row.id,
    owner_id: row.owner_id,
    name: row.name,
    privacy: row.privacy,
    created_at: row.created_at,
    updated_at: row.updated_at,
    work_count: Number(row.work_count ?? 0),
    preview_works: (row.preview_works ?? []).map(mapPreview),
  }));
}

export async function getCollectionSaveContext(workIds: string[]): Promise<CollectionSaveContext> {
  const supabase = await getServerSupabase();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) {
    return { isSignedIn: false, collections: [], savedByWork: {} };
  }

  const { data: collectionRows, error: collectionError } = await supabase
    .from('collections')
    .select('id,name,privacy,updated_at')
    .eq('owner_id', auth.user.id)
    .order('updated_at', { ascending: false });

  if (collectionError) throw new Error(`Collection picker query failed: ${collectionError.message}`);

  const collections = (collectionRows ?? []) as CollectionPickerCollection[];
  const collectionIds = collections.map(collection => collection.id);
  const savedByWork: Record<string, string[]> = Object.fromEntries(workIds.map(id => [id, []]));

  if (!workIds.length || !collectionIds.length) {
    return { isSignedIn: true, collections, savedByWork };
  }

  const { data: itemRows, error: itemError } = await supabase
    .from('collection_items')
    .select('collection_id,work_id')
    .in('work_id', workIds)
    .in('collection_id', collectionIds);

  if (itemError) throw new Error(`Saved-state query failed: ${itemError.message}`);

  for (const row of itemRows ?? []) {
    const typed = row as { collection_id: string; work_id: string };
    (savedByWork[typed.work_id] ??= []).push(typed.collection_id);
  }

  return { isSignedIn: true, collections, savedByWork };
}

export async function getCollectionDetail(id: string): Promise<CollectionDetail | null> {
  const supabase = await getServerSupabase();
  const [{ data, error }, { data: auth }] = await Promise.all([
    supabase.rpc('get_collection_detail', { p_collection_id: id }),
    supabase.auth.getUser(),
  ]);

  if (error) throw new Error(`Collection detail query failed: ${error.message}`);
  if (!data) return null;

  const payload = data as unknown as CollectionDetailPayload;
  return {
    id: payload.id,
    owner_id: payload.owner_id,
    name: payload.name,
    privacy: payload.privacy,
    created_at: payload.created_at,
    updated_at: payload.updated_at,
    work_count: Number(payload.work_count ?? 0),
    owner: payload.owner,
    works: (payload.works ?? []).map(mapFeedRow),
    is_owner: auth.user?.id === payload.owner_id,
  };
}
