'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { FollowButton } from '../../components/follow-button';
import { WorkMasonry } from '../../components/work-masonry';
import type {
  CreatorSearchCursor,
  CreatorSearchRecord,
  FeedCursor,
  FeedInteractionContext,
  WorkRecord,
} from '../../lib/data/types';
import { pluralize } from '../../lib/pluralize';

const examples = [
  'botanical tattoo',
  'walnut table',
  'braided hair',
  'small kitchen',
  'ceramic mug',
  'linen outfit',
  'film portrait',
  'garden path',
];
const adjacent = [
  'traditional art',
  'home interiors',
  'woodworking',
  'photography',
  'food recipes',
  'digital art',
];

function mergeInteraction(
  current: FeedInteractionContext,
  incoming: FeedInteractionContext,
): FeedInteractionContext {
  return {
    isSignedIn: current.isSignedIn || incoming.isSignedIn,
    currentUserId: incoming.currentUserId ?? current.currentUserId,
    followingCreatorIds: [...new Set([...current.followingCreatorIds, ...incoming.followingCreatorIds])],
    collections: incoming.collections.length ? incoming.collections : current.collections,
    savedByWork: { ...current.savedByWork, ...incoming.savedByWork },
  };
}

function appendWorkCursor(params: URLSearchParams, cursor: FeedCursor) {
  params.set('wRank', String(cursor.rankScore));
  params.set('wAt', cursor.publishedAt);
  params.set('wId', cursor.id);
}

function appendCreatorCursor(params: URLSearchParams, cursor: CreatorSearchCursor) {
  params.set('cCount', String(cursor.verifiedWorkCount));
  params.set('cHandle', cursor.handle);
  params.set('cId', cursor.id);
}

export function SearchClient({
  query,
  initialWorks,
  initialWorkCursor,
  initialCreators,
  initialCreatorCursor,
  initialInteraction,
  loadError,
}: {
  query: string;
  initialWorks: WorkRecord[];
  initialWorkCursor: FeedCursor | null;
  initialCreators: CreatorSearchRecord[];
  initialCreatorCursor: CreatorSearchCursor | null;
  initialInteraction: FeedInteractionContext;
  loadError: boolean;
}) {
  const router = useRouter();
  const [input, setInput] = useState(query);
  const [works, setWorks] = useState(initialWorks);
  const [workCursor, setWorkCursor] = useState(initialWorkCursor);
  const [creators, setCreators] = useState(initialCreators);
  const [creatorCursor, setCreatorCursor] = useState(initialCreatorCursor);
  const [interaction, setInteraction] = useState(initialInteraction);
  const [loadingMore, setLoadingMore] = useState(false);
  const [message, setMessage] = useState('');
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setInput(query);
    setWorks(initialWorks);
    setWorkCursor(initialWorkCursor);
    setCreators(initialCreators);
    setCreatorCursor(initialCreatorCursor);
    setInteraction(initialInteraction);
    setLoadingMore(false);
    setMessage('');
  }, [initialCreatorCursor, initialCreators, initialInteraction, initialWorkCursor, initialWorks, query]);

  useEffect(() => {
    const normalized = input.trim();
    if (normalized === query) return;
    const timer = window.setTimeout(() => {
      router.replace(normalized ? `/search?q=${encodeURIComponent(normalized)}` : '/search', { scroll: false });
    }, 350);
    return () => window.clearTimeout(timer);
  }, [input, query, router]);

  const runQuery = useCallback((value: string) => {
    setInput(value);
    router.push(`/search?q=${encodeURIComponent(value)}`, { scroll: false });
  }, [router]);

  const loadMore = useCallback(async () => {
    if (!query || loadingMore || (!workCursor && !creatorCursor)) return;
    setLoadingMore(true);
    setMessage('');
    const params = new URLSearchParams({ q: query });
    if (workCursor) appendWorkCursor(params, workCursor);
    else params.set('works', '0');
    if (creatorCursor) appendCreatorCursor(params, creatorCursor);
    else params.set('creators', '0');

    try {
      const response = await fetch(`/api/search?${params.toString()}`);
      const payload = await response.json() as {
        ok?: boolean;
        works?: WorkRecord[];
        workCursor?: FeedCursor | null;
        creators?: CreatorSearchRecord[];
        creatorCursor?: CreatorSearchCursor | null;
        interaction?: FeedInteractionContext;
        error?: string;
      };
      if (!response.ok || !payload.ok) throw new Error(payload.error ?? 'More results could not load.');

      setWorks(current => {
        const ids = new Set(current.map(item => item.id));
        return [...current, ...(payload.works ?? []).filter(item => !ids.has(item.id))];
      });
      setCreators(current => {
        const ids = new Set(current.map(item => item.id));
        return [...current, ...(payload.creators ?? []).filter(item => !ids.has(item.id))];
      });
      setWorkCursor(payload.workCursor ?? null);
      setCreatorCursor(payload.creatorCursor ?? null);
      if (payload.interaction) setInteraction(current => mergeInteraction(current, payload.interaction as FeedInteractionContext));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'More results could not load.');
    } finally {
      setLoadingMore(false);
    }
  }, [creatorCursor, loadingMore, query, workCursor]);

  useEffect(() => {
    const node = sentinelRef.current;
    if (!node || (!workCursor && !creatorCursor)) return;
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) void loadMore();
    }, { rootMargin: '500px 0px' });
    observer.observe(node);
    return () => observer.disconnect();
  }, [creatorCursor, loadMore, workCursor]);

  const hasResults = works.length > 0 || creators.length > 0;

  return (
    <main className="section search-page">
      <div className="shell section-head page-first-section">
        <div>
          <div className="eyebrow">Index search</div>
          <h1>Search human-made work.</h1>
          <p className="section-intro">Search Works, creators, and the canonical category index. Public results use the same provenance rank as Discover.</p>
        </div>
      </div>

      <div className="shell">
        <form
          className="search-form"
          onSubmit={event => {
            event.preventDefault();
            const normalized = input.trim();
            router.push(normalized ? `/search?q=${encodeURIComponent(normalized)}` : '/search');
          }}
        >
          <input
            className="search-input"
            value={input}
            onChange={event => setInput(event.target.value)}
            placeholder="Tattoo style, walnut table, braided hair…"
            aria-label="Search Works and creators"
          />
          <button className="search-submit" type="submit">Search</button>
        </form>

        <div className="search-suggestions" aria-label="Example searches">
          <span className="meta">Try:</span>
          {examples.map(example => (
            <button className="search-example-link" type="button" key={example} onClick={() => runQuery(example)}>{example}</button>
          ))}
        </div>
      </div>

      {loadError ? (
        <div className="shell editorial-empty"><p role="alert">Search could not load. Check the database connection and try again.</p></div>
      ) : query && !hasResults ? (
        <div className="shell search-suggestions search-empty">
          <span className="meta">No results:</span>
          <span>Try a nearby part of the index:</span>
          {adjacent.map(example => (
            <button className="search-example-link" type="button" key={example} onClick={() => runQuery(example)}>{example}</button>
          ))}
        </div>
      ) : null}

      {query && creators.length ? (
        <section className="shell search-creator-section">
          <div className="compact-section-head">
            <h2>Creators</h2>
            <span className="meta">{pluralize(creators.length, 'MATCH', 'MATCHES')}</span>
          </div>
          <div className="creator-search-list">
            {creators.map(creator => (
              <article className="creator-search-row" key={creator.id}>
                <Link className="creator-search-identity" href={`/creator/${creator.handle}`}>
                  {creator.avatarUrl
                    ? <img className="creator-search-avatar" src={creator.avatarUrl} alt="" />
                    : <span className="creator-search-avatar creator-search-avatar-fallback" aria-hidden="true">{creator.displayName.slice(0, 1).toUpperCase()}</span>}
                  <span>
                    <strong>{creator.displayName}</strong>
                    <span>@{creator.handle}</span>
                  </span>
                </Link>
                <span className="creator-search-count meta">
                  {creator.verifiedWorkCount} {creator.verifiedWorkCount === 1 ? 'VERIFIED WORK' : 'VERIFIED WORKS'}
                </span>
                <FollowButton
                  creatorId={creator.id}
                  handle={creator.handle}
                  isSignedIn={interaction.isSignedIn}
                  isOwner={interaction.currentUserId === creator.id}
                  initialFollowing={creator.isFollowedByViewer}
                  initialFollowerCount={creator.followerCount}
                  compact
                  nextPath={`/search?q=${encodeURIComponent(query)}`}
                />
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {works.length ? (
        <section className="search-results-feed">
          <div className="shell compact-section-head">
            <h2>{query ? 'Works' : 'Recent work'}</h2>
            <span className="meta">{pluralize(works.length, 'RESULT', 'RESULTS')}</span>
          </div>
          <WorkMasonry works={works} interaction={interaction} />
        </section>
      ) : !query && !loadError ? (
        <div className="shell editorial-empty"><p>Recent public Work will appear here.</p></div>
      ) : null}

      {(workCursor || creatorCursor) ? (
        <div className="shell infinite-feed-footer" ref={sentinelRef}>
          <button className="button" type="button" onClick={() => void loadMore()} disabled={loadingMore}>
            {loadingMore ? 'Loading…' : 'Load more results'}
          </button>
        </div>
      ) : hasResults ? <p className="shell feed-end-label">End of these results.</p> : null}
      {message ? <p className="shell notice" role="alert">{message}</p> : null}
    </main>
  );
}
