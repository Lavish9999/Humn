'use client';

import type { FeedInteractionContext, WorkRecord } from '../lib/data/types';
import { WorkCard } from './work-card';

export function WorkMasonry({
  works,
  interaction,
  preview = false,
}: {
  works: WorkRecord[];
  interaction: FeedInteractionContext;
  preview?: boolean;
}) {
  const visibleWorks = preview ? works.slice(0, 8) : works;
  const followed = new Set(interaction.followingCreatorIds);

  return (
    <div className="shell masonry-shell">
      <div className={preview ? 'masonry masonry-preview' : 'masonry'}>
        {visibleWorks.map((work, index) => (
          <WorkCard
            key={work.id}
            work={work}
            priority={index < 3}
            isSignedIn={interaction.isSignedIn}
            currentUserId={interaction.currentUserId}
            isFollowingCreator={followed.has(work.creator_id)}
            collections={interaction.collections}
            savedCollectionIds={interaction.savedByWork[work.id] ?? []}
          />
        ))}
      </div>
    </div>
  );
}
