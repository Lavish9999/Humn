import { DiscoverClient } from './discover-client';
import { getDiscoverDefaultTier } from '../../lib/data/discover-preferences';
import { getFeedInteractionContext } from '../../lib/data/feed-context';
import { getFollowingFeed } from '../../lib/data/follows';
import { getDiscoverFilterCapabilities, getWorkFeed } from '../../lib/data/works';
import { parseFeedFilters } from '../../lib/discovery/filters';
import type {
  DiscoverFilterCapabilities,
  FeedCursor,
  FeedInteractionContext,
  WorkRecord,
} from '../../lib/data/types';

const emptyInteraction: FeedInteractionContext = {
  isSignedIn: false,
  currentUserId: null,
  followingCreatorIds: [],
  collections: [],
  savedByWork: {},
};

export default async function DiscoverPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  const view = query.view === 'following' || query.view === 'unverified'
    ? query.view
    : 'default';
  const accountDefaultTier = await getDiscoverDefaultTier().catch(() => 'all' as const);
  const filters = parseFeedFilters(query, accountDefaultTier);

  let works: WorkRecord[] = [];
  let nextCursor: FeedCursor | null = null;
  let interaction: FeedInteractionContext = emptyInteraction;
  let capabilities: DiscoverFilterCapabilities = { hasCapturedInApp: false };
  let followingSignedIn = true;
  let followingCount = 0;
  let loadError = false;

  try {
    capabilities = await getDiscoverFilterCapabilities();
    if (view === 'following') {
      const feedResult = await getFollowingFeed({ pageSize: 24, filters });
      works = feedResult.items;
      nextCursor = feedResult.nextCursor;
      followingSignedIn = feedResult.isSignedIn;
      followingCount = feedResult.followingCount;
    } else {
      const feedResult = await getWorkFeed({
        limit: 24,
        scope: view === 'unverified' ? 'unverified' : 'default',
        filters,
      });
      works = feedResult.items;
      nextCursor = feedResult.nextCursor;
    }
    interaction = await getFeedInteractionContext(works);
  } catch {
    loadError = true;
  }

  return (
    <DiscoverClient
      view={view}
      filters={filters}
      accountDefaultTier={accountDefaultTier}
      capabilities={capabilities}
      initialWorks={works}
      initialCursor={nextCursor}
      initialInteraction={interaction}
      followingSignedIn={followingSignedIn}
      followingCount={followingCount}
      loadError={loadError}
    />
  );
}
