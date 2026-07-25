import { NextResponse } from 'next/server';
import { getFeedInteractionContext } from '../../../lib/data/feed-context';
import { getFollowingFeed } from '../../../lib/data/follows';
import { getWorkFeed } from '../../../lib/data/works';
import { parseFeedCursor, parseFeedFilters } from '../../../lib/discovery/filters';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const raw = Object.fromEntries(url.searchParams.entries());
  const view = raw.view === 'following' || raw.view === 'unverified' ? raw.view : 'default';
  const filters = parseFeedFilters(raw, 'all');
  const cursor = parseFeedCursor(raw);

  try {
    if (view === 'following') {
      const page = await getFollowingFeed({ pageSize: 24, cursor, filters });
      const interaction = await getFeedInteractionContext(page.items);
      return NextResponse.json({
        ok: true,
        view,
        items: page.items,
        nextCursor: page.nextCursor,
        interaction,
        isSignedIn: page.isSignedIn,
        followingCount: page.followingCount,
      });
    }

    const page = await getWorkFeed({
      limit: 24,
      cursor,
      scope: view === 'unverified' ? 'unverified' : 'default',
      filters,
    });
    const interaction = await getFeedInteractionContext(page.items);

    return NextResponse.json({
      ok: true,
      view,
      items: page.items,
      nextCursor: page.nextCursor,
      interaction,
      isSignedIn: interaction.isSignedIn,
      followingCount: null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Discover could not load.';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
