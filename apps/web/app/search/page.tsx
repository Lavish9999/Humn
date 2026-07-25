import { SearchClient } from './search-client';
import { getFeedInteractionContext } from '../../lib/data/feed-context';
import { searchCreators } from '../../lib/data/search';
import { getWorkFeed, searchWorkFeed } from '../../lib/data/works';
import type {
  CreatorSearchCursor,
  CreatorSearchRecord,
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

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string | string[] }>;
}) {
  const params = await searchParams;
  const query = (Array.isArray(params.q) ? (params.q[0] ?? '') : (params.q ?? '')).trim();
  let works: WorkRecord[] = [];
  let workCursor: FeedCursor | null = null;
  let creators: CreatorSearchRecord[] = [];
  let creatorCursor: CreatorSearchCursor | null = null;
  let interaction: FeedInteractionContext = emptyInteraction;
  let loadError = false;

  try {
    const [workPage, creatorPage] = await Promise.all([
      query ? searchWorkFeed({ query, limit: 20 }) : getWorkFeed({ limit: 24 }),
      query
        ? searchCreators({ query, limit: 8 })
        : Promise.resolve({ items: [] as CreatorSearchRecord[], nextCursor: null as CreatorSearchCursor | null }),
    ]);
    works = workPage.items;
    workCursor = workPage.nextCursor;
    creators = creatorPage.items;
    creatorCursor = creatorPage.nextCursor;
    interaction = await getFeedInteractionContext(works);
  } catch {
    loadError = true;
  }

  return (
    <SearchClient
      query={query}
      initialWorks={works}
      initialWorkCursor={workCursor}
      initialCreators={creators}
      initialCreatorCursor={creatorCursor}
      initialInteraction={interaction}
      loadError={loadError}
    />
  );
}

