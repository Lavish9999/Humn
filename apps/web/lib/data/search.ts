import 'server-only';

import { getServerSupabase } from '../supabase/server';
import type {
  CreatorSearchCursor,
  CreatorSearchPage,
  CreatorSearchRecord,
} from './types';

export async function searchCreators({
  query,
  limit = 8,
  cursor = null,
}: {
  query: string;
  limit?: number;
  cursor?: CreatorSearchCursor | null;
}): Promise<CreatorSearchPage> {
  const normalized = query.trim();
  if (!normalized) return { items: [], nextCursor: null };

  const safeLimit = Math.min(40, Math.max(1, Math.floor(limit)));
  const supabase = await getServerSupabase();
  const { data, error } = await supabase.rpc('search_creators', {
    p_query: normalized,
    p_cursor_verified_count: cursor?.verifiedWorkCount ?? null,
    p_cursor_handle: cursor?.handle ?? null,
    p_cursor_id: cursor?.id ?? null,
    p_limit: safeLimit,
  });
  if (error) throw new Error(`Creator search failed: ${error.message}`);

  const rows = (data ?? []) as Array<{
    id: string;
    handle: string;
    display_name: string;
    avatar_url: string | null;
    joined_at: string;
    verified_work_count: number | string;
    follower_count: number | string;
    is_followed_by_viewer: boolean;
  }>;

  const items: CreatorSearchRecord[] = rows.map(row => ({
    id: String(row.id),
    handle: String(row.handle),
    displayName: String(row.display_name),
    avatarUrl: typeof row.avatar_url === 'string' ? row.avatar_url : null,
    joinedAt: String(row.joined_at),
    verifiedWorkCount: Number(row.verified_work_count ?? 0),
    followerCount: Number(row.follower_count ?? 0),
    isFollowedByViewer: Boolean(row.is_followed_by_viewer),
  }));
  const last = items.at(-1);

  return {
    items,
    nextCursor: items.length === safeLimit && last
      ? {
          verifiedWorkCount: last.verifiedWorkCount,
          handle: last.handle,
          id: last.id,
        }
      : null,
  };
}
