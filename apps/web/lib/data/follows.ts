import 'server-only';

import { getServerSupabase } from '../supabase/server';
import { mapFeedRow, type FeedRow } from './works';
import type { FeedCursor, FeedFilters, WorkRecord } from './types';

export type FollowContext = {
  isSignedIn: boolean;
  currentUserId: string | null;
  followingCreatorIds: string[];
};

export type CreatorNetworkDirection = 'followers' | 'following';

export type CreatorNetworkMember = {
  id: string;
  handle: string;
  displayName: string;
  avatarUrl: string | null;
  joinedAt: string;
  verifiedWorkCount: number;
  followerCount: number;
  followingCount: number;
  isFollowedByViewer: boolean;
};

export type CreatorNetworkPage = {
  members: CreatorNetworkMember[];
  page: number;
  pageSize: number;
  totalCount: number;
  hasPrevious: boolean;
  hasNext: boolean;
};

export type FollowingFeedPage = {
  isSignedIn: boolean;
  items: WorkRecord[];
  nextCursor: FeedCursor | null;
  followingCount: number;
};

export async function getFollowContext(creatorIds: string[]): Promise<FollowContext> {
  const ids = [...new Set(creatorIds.filter(Boolean))];
  const supabase = await getServerSupabase();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) {
    return { isSignedIn: false, currentUserId: null, followingCreatorIds: [] };
  }
  if (!ids.length) {
    return { isSignedIn: true, currentUserId: auth.user.id, followingCreatorIds: [] };
  }

  const { data, error } = await supabase
    .from('follows')
    .select('creator_id')
    .eq('follower_id', auth.user.id)
    .in('creator_id', ids);

  if (error) throw new Error(`Follow-state query failed: ${error.message}`);

  return {
    isSignedIn: true,
    currentUserId: auth.user.id,
    followingCreatorIds: ((data ?? []) as Array<{ creator_id: string }>).map(row => String(row.creator_id)),
  };
}

export async function getCreatorNetwork(
  handle: string,
  direction: CreatorNetworkDirection,
  page = 1,
  pageSize = 24,
): Promise<CreatorNetworkPage> {
  const safePage = Math.max(1, Math.floor(page));
  const safeSize = Math.min(60, Math.max(1, Math.floor(pageSize)));
  const supabase = await getServerSupabase();
  const { data, error } = await supabase.rpc('get_creator_network', {
    p_handle: handle,
    p_direction: direction,
    p_limit: safeSize,
    p_offset: (safePage - 1) * safeSize,
  });
  if (error) throw new Error(`Creator network query failed: ${error.message}`);

  const rows = (data ?? []) as Array<{
    id: string;
    handle: string;
    display_name: string;
    avatar_url: string | null;
    joined_at: string;
    verified_work_count: number | string;
    follower_count: number | string;
    following_count: number | string;
    is_followed_by_viewer: boolean;
    total_count: number | string;
  }>;
  const totalCount = Number(rows[0]?.total_count ?? 0);

  return {
    members: rows.map(row => ({
      id: String(row.id),
      handle: String(row.handle),
      displayName: String(row.display_name),
      avatarUrl: typeof row.avatar_url === 'string' ? row.avatar_url : null,
      joinedAt: String(row.joined_at),
      verifiedWorkCount: Number(row.verified_work_count ?? 0),
      followerCount: Number(row.follower_count ?? 0),
      followingCount: Number(row.following_count ?? 0),
      isFollowedByViewer: Boolean(row.is_followed_by_viewer),
    })),
    page: safePage,
    pageSize: safeSize,
    totalCount,
    hasPrevious: safePage > 1,
    hasNext: safePage * safeSize < totalCount,
  };
}

export async function getFollowingFeed({
  pageSize = 24,
  cursor = null,
  filters = { categories: [], tier: 'all', origins: [] },
}: {
  pageSize?: number;
  cursor?: FeedCursor | null;
  filters?: FeedFilters;
} = {}): Promise<FollowingFeedPage> {
  const safeSize = Math.min(60, Math.max(1, Math.floor(pageSize)));
  const supabase = await getServerSupabase();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) {
    return {
      isSignedIn: false,
      items: [],
      nextCursor: null,
      followingCount: 0,
    };
  }

  const [feedResult, countResult] = await Promise.all([
    supabase.rpc('get_following_work_feed', {
      p_categories: filters.categories.length ? filters.categories : null,
      p_tier_mode: filters.tier,
      p_origins: filters.origins.length ? filters.origins : null,
      p_cursor_rank: cursor?.rankScore ?? null,
      p_cursor_published_at: cursor?.publishedAt ?? null,
      p_cursor_id: cursor?.id ?? null,
      p_limit: safeSize,
    }),
    supabase
      .from('follows')
      .select('creator_id', { count: 'exact', head: true })
      .eq('follower_id', auth.user.id),
  ]);

  if (feedResult.error) throw new Error(`Following feed query failed: ${feedResult.error.message}`);
  if (countResult.error) throw new Error(`Following count query failed: ${countResult.error.message}`);

  const items = ((feedResult.data ?? []) as unknown as FeedRow[]).map(mapFeedRow);
  const last = items.at(-1);

  return {
    isSignedIn: true,
    items,
    nextCursor: items.length === safeSize && last
      ? {
          rankScore: last.feed_rank,
          publishedAt: last.published_at ?? last.created_at,
          id: last.id,
        }
      : null,
    followingCount: countResult.count ?? 0,
  };
}

