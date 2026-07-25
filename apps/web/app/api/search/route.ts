import { NextResponse } from 'next/server';
import { getFeedInteractionContext } from '../../../lib/data/feed-context';
import { searchCreators } from '../../../lib/data/search';
import { searchWorkFeed } from '../../../lib/data/works';
import type { CreatorSearchCursor, FeedCursor } from '../../../lib/data/types';

function parseFeedCursor(params: URLSearchParams): FeedCursor | null {
  const rankScore = Number(params.get('wRank'));
  const publishedAt = params.get('wAt') ?? '';
  const id = params.get('wId') ?? '';
  return Number.isFinite(rankScore) && publishedAt && id
    ? { rankScore, publishedAt, id }
    : null;
}

function parseCreatorCursor(params: URLSearchParams): CreatorSearchCursor | null {
  const verifiedWorkCount = Number(params.get('cCount'));
  const handle = params.get('cHandle') ?? '';
  const id = params.get('cId') ?? '';
  return Number.isFinite(verifiedWorkCount) && handle && id
    ? { verifiedWorkCount, handle, id }
    : null;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const query = (url.searchParams.get('q') ?? '').trim();
  if (!query) {
    return NextResponse.json({ ok: false, error: 'Enter a search term.' }, { status: 400 });
  }

  const loadWorks = url.searchParams.get('works') !== '0';
  const loadCreators = url.searchParams.get('creators') !== '0';

  try {
    const [workPage, creatorPage] = await Promise.all([
      loadWorks
        ? searchWorkFeed({ query, limit: 20, cursor: parseFeedCursor(url.searchParams) })
        : Promise.resolve({ items: [], nextCursor: null }),
      loadCreators
        ? searchCreators({ query, limit: 8, cursor: parseCreatorCursor(url.searchParams) })
        : Promise.resolve({ items: [], nextCursor: null }),
    ]);
    const interaction = await getFeedInteractionContext(workPage.items);

    return NextResponse.json({
      ok: true,
      works: workPage.items,
      workCursor: workPage.nextCursor,
      creators: creatorPage.items,
      creatorCursor: creatorPage.nextCursor,
      interaction,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Search could not load.';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
