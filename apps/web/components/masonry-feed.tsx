import type { WorkRecord } from '../lib/data/types';
import { getFeedInteractionContext } from '../lib/data/feed-context';
import { WorkMasonry } from './work-masonry';

export async function MasonryFeed({
  works,
  preview = false,
}: {
  works: WorkRecord[];
  preview?: boolean;
}) {
  const visibleWorks = preview ? works.slice(0, 8) : works;
  const interaction = await getFeedInteractionContext(visibleWorks);

  return (
    <WorkMasonry
      works={visibleWorks}
      interaction={interaction}
      preview={preview}
    />
  );
}
