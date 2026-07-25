import 'server-only';

import type { FeedInteractionContext, WorkRecord } from './types';
import { getCollectionSaveContext } from './collections';
import { getFollowContext } from './follows';

export async function getFeedInteractionContext(
  works: WorkRecord[],
): Promise<FeedInteractionContext> {
  const workIds = works.map(work => work.id);
  const creatorIds = works.map(work => work.creator_id);

  const [saveContext, followContext] = await Promise.all([
    getCollectionSaveContext(workIds).catch(() => ({
      isSignedIn: false,
      collections: [],
      savedByWork: {},
    })),
    getFollowContext(creatorIds).catch(() => ({
      isSignedIn: false,
      currentUserId: null,
      followingCreatorIds: [],
    })),
  ]);

  return {
    isSignedIn: saveContext.isSignedIn || followContext.isSignedIn,
    currentUserId: followContext.currentUserId,
    followingCreatorIds: followContext.followingCreatorIds,
    collections: saveContext.collections,
    savedByWork: saveContext.savedByWork,
  };
}
