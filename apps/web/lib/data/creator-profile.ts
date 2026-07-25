import 'server-only';

import { getServerSupabase } from '../supabase/server';
import type { WorkRecord } from './types';
import { mapFeedRow, type FeedRow } from './works';

export type CreatorPublicProfile = {
  id: string;
  handle: string;
  displayName: string;
  avatarUrl: string | null;
  joinedAt: string;
  verifiedWorkCount: number;
  followerCount: number;
  followingCount: number;
  works: WorkRecord[];
};

export async function getCreatorPublicProfile(
  handle: string,
): Promise<CreatorPublicProfile | null> {
  const normalizedHandle = handle.trim().toLowerCase();
  if (!normalizedHandle) return null;

  const supabase = await getServerSupabase();
  const { data: profile, error: profileError } = await supabase
    .from('users')
    .select('id,handle,display_name,avatar_url,created_at')
    .eq('handle', normalizedHandle)
    .maybeSingle();

  if (profileError) {
    throw new Error(`Creator profile query failed: ${profileError.message}`);
  }
  if (!profile) return null;

  const [worksResult, verifiedCountResult, followerCountResult, followingCountResult] = await Promise.all([
    supabase.rpc('get_creator_public_works', {
      p_handle: normalizedHandle,
      p_limit: 100,
    }),
    supabase
      .from('works')
      .select('id', { count: 'exact', head: true })
      .eq('creator_id', profile.id)
      .eq('status', 'verified')
      .gte('proof_count', 1)
      .eq('ai_declared', false)
      .is('removed_at', null),
    supabase
      .from('follows')
      .select('follower_id', { count: 'exact', head: true })
      .eq('creator_id', profile.id),
    supabase
      .from('follows')
      .select('creator_id', { count: 'exact', head: true })
      .eq('follower_id', profile.id),
  ]);

  if (worksResult.error) {
    throw new Error(`Creator work query failed: ${worksResult.error.message}`);
  }
  if (verifiedCountResult.error) {
    throw new Error(`Verified Work count failed: ${verifiedCountResult.error.message}`);
  }
  if (followerCountResult.error) {
    throw new Error(`Follower count failed: ${followerCountResult.error.message}`);
  }
  if (followingCountResult.error) {
    throw new Error(`Following count failed: ${followingCountResult.error.message}`);
  }

  return {
    id: String(profile.id),
    handle: String(profile.handle),
    displayName: String(profile.display_name),
    avatarUrl: typeof profile.avatar_url === 'string' ? profile.avatar_url : null,
    joinedAt: String(profile.created_at),
    verifiedWorkCount: verifiedCountResult.count ?? 0,
    followerCount: followerCountResult.count ?? 0,
    followingCount: followingCountResult.count ?? 0,
    works: ((worksResult.data ?? []) as unknown as FeedRow[]).map(mapFeedRow),
  };
}
