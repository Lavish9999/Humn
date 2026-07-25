'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import type {
  DiscoverFilterCapabilities,
  FeedCursor,
  FeedFilters,
  FeedInteractionContext,
  ProvenanceTierMode,
  WorkRecord,
} from '../../lib/data/types';
import {
  appendCursor,
  categoryOptions,
  feedFiltersToSearchParams,
} from '../../lib/discovery/filters';
import { WorkMasonry } from '../../components/work-masonry';

const tierOptions: Array<{ value: ProvenanceTierMode; label: string; help: string }> = [
  { value: 'verified', label: 'Verified only', help: 'Human-reviewed Works with at least one proof.' },
  { value: 'reviewed', label: 'Include awaiting', help: 'Verified and proof-backed Works awaiting review.' },
  { value: 'provenance', label: 'Verified + strong provenance', help: 'Verified Works plus strong capture credentials.' },
  { value: 'all', label: 'All eligible', help: 'Everything allowed by the default provenance rules.' },
];

function mergeInteraction(
  current: FeedInteractionContext,
  incoming: FeedInteractionContext,
): FeedInteractionContext {
  return {
    isSignedIn: current.isSignedIn || incoming.isSignedIn,
    currentUserId: incoming.currentUserId ?? current.currentUserId,
    followingCreatorIds: [...new Set([
      ...current.followingCreatorIds,
      ...incoming.followingCreatorIds,
    ])],
    collections: incoming.collections.length ? incoming.collections : current.collections,
    savedByWork: { ...current.savedByWork, ...incoming.savedByWork },
  };
}

function sameFilters(left: FeedFilters, right: FeedFilters) {
  return left.tier === right.tier
    && left.categories.join(',') === right.categories.join(',')
    && left.origins.join(',') === right.origins.join(',');
}

export function DiscoverClient({
  view,
  filters,
  accountDefaultTier,
  capabilities,
  initialWorks,
  initialCursor,
  initialInteraction,
  followingSignedIn,
  followingCount,
  loadError,
}: {
  view: 'default' | 'following' | 'unverified';
  filters: FeedFilters;
  accountDefaultTier: ProvenanceTierMode;
  capabilities: DiscoverFilterCapabilities;
  initialWorks: WorkRecord[];
  initialCursor: FeedCursor | null;
  initialInteraction: FeedInteractionContext;
  followingSignedIn: boolean;
  followingCount: number;
  loadError: boolean;
}) {
  const router = useRouter();
  const [works, setWorks] = useState(initialWorks);
  const [nextCursor, setNextCursor] = useState(initialCursor);
  const [interaction, setInteraction] = useState(initialInteraction);
  const [draft, setDraft] = useState(filters);
  const [filterOpen, setFilterOpen] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadMoreError, setLoadMoreError] = useState('');
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setWorks(initialWorks);
    setNextCursor(initialCursor);
    setInteraction(initialInteraction);
    setDraft(filters);
    setLoadingMore(false);
    setLoadMoreError('');
  }, [filters, initialCursor, initialInteraction, initialWorks, view]);

  const filterCount = filters.categories.length
    + filters.origins.length
    + (filters.tier === accountDefaultTier ? 0 : 1);

  const buildHref = useCallback((targetView: typeof view, targetFilters = filters) => {
    const params = feedFiltersToSearchParams(targetFilters);
    if (targetView !== 'default') params.set('view', targetView);
    const search = params.toString();
    return search ? `/discover?${search}` : '/discover';
  }, [filters]);

  function toggleCategory(category: FeedFilters['categories'][number]) {
    setDraft(current => ({
      ...current,
      categories: current.categories.includes(category)
        ? current.categories.filter(value => value !== category)
        : [...current.categories, category],
    }));
  }

  function toggleOrigin(origin: FeedFilters['origins'][number]) {
    setDraft(current => ({
      ...current,
      origins: current.origins.includes(origin)
        ? current.origins.filter(value => value !== origin)
        : [...current.origins, origin],
    }));
  }

  function applyFilters() {
    setFilterOpen(false);
    router.push(buildHref(view, draft), { scroll: false });
  }

  function clearFilters() {
    const cleared: FeedFilters = { categories: [], origins: [], tier: accountDefaultTier };
    setDraft(cleared);
    setFilterOpen(false);
    router.push(buildHref(view, cleared), { scroll: false });
  }

  const loadMore = useCallback(async () => {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    setLoadMoreError('');

    const params = feedFiltersToSearchParams(filters);
    params.set('view', view);
    appendCursor(params, nextCursor);

    try {
      const response = await fetch(`/api/discover?${params.toString()}`);
      const payload = await response.json() as {
        ok?: boolean;
        items?: WorkRecord[];
        nextCursor?: FeedCursor | null;
        interaction?: FeedInteractionContext;
        error?: string;
      };
      if (!response.ok || !payload.ok) {
        throw new Error(payload.error ?? 'More work could not load.');
      }

      setWorks(current => {
        const known = new Set(current.map(work => work.id));
        return [...current, ...(payload.items ?? []).filter(work => !known.has(work.id))];
      });
      setNextCursor(payload.nextCursor ?? null);
      if (payload.interaction) {
        setInteraction(current => mergeInteraction(current, payload.interaction!));
      }
    } catch (error) {
      setLoadMoreError(error instanceof Error ? error.message : 'More work could not load.');
    } finally {
      setLoadingMore(false);
    }
  }, [filters, loadingMore, nextCursor, view]);

  useEffect(() => {
    const node = sentinelRef.current;
    if (!node || !nextCursor) return;
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) void loadMore();
    }, { rootMargin: '600px 0px' });
    observer.observe(node);
    return () => observer.disconnect();
  }, [loadMore, nextCursor]);

  const headline = view === 'following'
    ? 'From creators you follow.'
    : view === 'unverified'
      ? 'New work, not yet verified.'
      : 'Made by people.';

  const emptyMessage = useMemo(() => {
    if (view === 'following') return 'The creators you follow have no public work matching these filters.';
    if (view === 'unverified') return 'No unverified work matches these filters.';
    return 'No public work matches these filters.';
  }, [view]);

  return (
    <main className="section discover-page">
      <div className="shell section-head page-first-section">
        <div>
          <div className="eyebrow">Discover</div>
          <h1>{headline}</h1>
          <p className="section-intro">
            Provenance ranking is mechanical: verified first, awaiting next, and newest as the tie-breaker. Missing metadata remains neutral.
          </p>
        </div>
        <div className="discover-head-actions">
          <button className="button" type="button" onClick={() => setFilterOpen(current => !current)} aria-expanded={filterOpen}>
            Refine feed{filterCount ? ` · ${filterCount}` : ''}
          </button>
          <Link className="button" href="/search">Search</Link>
        </div>
      </div>

      <nav className="shell discover-tabs" aria-label="Discover views">
        <Link className={view === 'default' ? 'discover-tab active' : 'discover-tab'} href={buildHref('default')}>Discover</Link>
        <Link className={view === 'following' ? 'discover-tab active' : 'discover-tab'} href={buildHref('following')}>Following</Link>
        <Link className={view === 'unverified' ? 'discover-tab active' : 'discover-tab'} href={buildHref('unverified')}>Unverified / new</Link>
      </nav>

      {filterOpen ? (
        <section className="shell feed-filter-panel" aria-label="Refine feed">
          <div className="feed-filter-group">
            <h2>Category</h2>
            <div className="filter-choice-grid">
              {categoryOptions().map(([slug, label]) => (
                <label className="filter-choice" key={slug}>
                  <input type="checkbox" checked={draft.categories.includes(slug)} onChange={() => toggleCategory(slug)} />
                  <span>{label}</span>
                </label>
              ))}
            </div>
          </div>

          {view !== 'unverified' ? (
            <div className="feed-filter-group">
              <h2>Provenance tier</h2>
              <div className="filter-radio-list">
                {tierOptions.map(option => (
                  <label className="filter-choice filter-choice-tier" key={option.value}>
                    <input
                      type="radio"
                      name="tier"
                      checked={draft.tier === option.value}
                      onChange={() => setDraft(current => ({ ...current, tier: option.value }))}
                    />
                    <span><strong>{option.label}</strong><small>{option.help}</small></span>
                  </label>
                ))}
              </div>
            </div>
          ) : null}

          <div className="feed-filter-group">
            <h2>Origin</h2>
            <div className="filter-radio-list">
              <label className="filter-choice">
                <input type="checkbox" checked={draft.origins.includes('uploaded')} onChange={() => toggleOrigin('uploaded')} />
                <span>Uploaded</span>
              </label>
              {capabilities.hasCapturedInApp ? (
                <label className="filter-choice">
                  <input type="checkbox" checked={draft.origins.includes('captured_in_app')} onChange={() => toggleOrigin('captured_in_app')} />
                  <span>Captured in Humn</span>
                </label>
              ) : null}
            </div>
          </div>

          <div className="feed-filter-actions">
            <button className="button primary" type="button" onClick={applyFilters} disabled={sameFilters(draft, filters)}>Apply filters</button>
            <button className="button" type="button" onClick={clearFilters}>Use account defaults</button>
          </div>
        </section>
      ) : null}

      {loadError ? (
        <div className="shell ruled-panel"><div className="panel-row" role="alert"><p>Discover could not load. Check Supabase configuration, then retry.</p></div></div>
      ) : view === 'following' && !followingSignedIn ? (
        <div className="shell editorial-empty following-empty">
          <p>Sign in to see recent public work from creators you follow.</p>
          <Link className="button" href="/signin?next=%2Fdiscover%3Fview%3Dfollowing">Sign in</Link>
        </div>
      ) : view === 'following' && followingCount === 0 ? (
        <div className="shell editorial-empty following-empty">
          <p>Your Following feed is ready when you are. Browse Discover and follow creators whose work you want to keep up with.</p>
          <Link className="button" href="/discover">Find creators</Link>
        </div>
      ) : works.length ? (
        <WorkMasonry works={works} interaction={interaction} />
      ) : (
        <div className="shell editorial-empty"><p>{emptyMessage}</p></div>
      )}

      {nextCursor ? (
        <div className="shell infinite-feed-footer" ref={sentinelRef}>
          <button className="button" type="button" onClick={() => void loadMore()} disabled={loadingMore}>
            {loadingMore ? 'Loading…' : 'Load more'}
          </button>
        </div>
      ) : works.length ? <p className="shell feed-end-label">End of this index.</p> : null}
      {loadMoreError ? <p className="shell notice" role="alert">{loadMoreError}</p> : null}
    </main>
  );
}
