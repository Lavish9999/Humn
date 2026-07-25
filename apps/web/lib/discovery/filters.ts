import { categoryLabels, type CategorySlug } from '@human/config';
import type { FeedCursor, FeedFilters, OriginInput, ProvenanceTierMode } from '../data/types';

const categorySet = new Set(Object.keys(categoryLabels));
const originSet = new Set<OriginInput>(['captured_in_app', 'uploaded']);
const tierSet = new Set<ProvenanceTierMode>(['verified', 'reviewed', 'provenance', 'all']);

function first(value: string | string[] | undefined): string {
  return Array.isArray(value) ? (value[0] ?? '') : (value ?? '');
}

function csv(value: string | string[] | undefined): string[] {
  return first(value)
    .split(',')
    .map(item => item.trim())
    .filter(Boolean);
}

export function parseFeedFilters(
  params: Record<string, string | string[] | undefined>,
  defaultTier: ProvenanceTierMode,
): FeedFilters {
  const categories = csv(params.categories)
    .filter(value => categorySet.has(value)) as CategorySlug[];
  const origins = csv(params.origins)
    .filter((value): value is OriginInput => originSet.has(value as OriginInput));
  const candidateTier = first(params.tier) as ProvenanceTierMode;

  return {
    categories: [...new Set(categories)],
    origins: [...new Set(origins)],
    tier: tierSet.has(candidateTier) ? candidateTier : defaultTier,
  };
}

export function parseFeedCursor(
  params: Record<string, string | string[] | undefined>,
): FeedCursor | null {
  const rank = Number(first(params.cursorRank));
  const publishedAt = first(params.cursorAt);
  const id = first(params.cursorId);
  if (!Number.isFinite(rank) || !publishedAt || !id) return null;
  return { rankScore: rank, publishedAt, id };
}

export function feedFiltersToSearchParams(filters: FeedFilters): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.categories.length) params.set('categories', filters.categories.join(','));
  if (filters.tier !== 'all') params.set('tier', filters.tier);
  if (filters.origins.length) params.set('origins', filters.origins.join(','));
  return params;
}

export function appendCursor(params: URLSearchParams, cursor: FeedCursor | null) {
  if (!cursor) return;
  params.set('cursorRank', String(cursor.rankScore));
  params.set('cursorAt', cursor.publishedAt);
  params.set('cursorId', cursor.id);
}

export function categoryOptions() {
  return Object.entries(categoryLabels) as Array<[CategorySlug, string]>;
}
