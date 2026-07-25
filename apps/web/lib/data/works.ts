import 'server-only';
import { getServerSupabase } from '../supabase/server';
import type {
  DiscoverFilterCapabilities,
  FeedCursor,
  FeedFilters,
  FeedPage,
  FileEvidenceRecord,
  ProofEntryRecord,
  ProvenanceSignalRecord,
  ProvenanceVariant,
  TechnicalSignalRecord,
  WorkDetailRecord,
  WorkRecord,
  WorkStatus,
} from './types';

export type FeedRow = {
  id: string;
  creator_id: string;
  title: string;
  description: string | null;
  category: string;
  aspect_ratio: string;
  image_url: string;
  thumb_url: string | null;
  origin_input: 'captured_in_app' | 'uploaded';
  status: WorkStatus;
  proof_count: number;
  ai_declared: boolean;
  report_count: number;
  feed_rank: number;
  created_at: string;
  published_at: string | null;
  creator_handle: string;
  creator_display_name: string;
  creator_avatar_url: string | null;
  creator_reputation: number;
  badge_variant: ProvenanceVariant;
  badge_label: string;
};

type DetailPayload = FeedRow & {
  creator: {
    id: string;
    handle: string;
    display_name: string;
    avatar_url: string | null;
    reputation: number;
  };
  badge: { badge_variant: ProvenanceVariant; badge_label: string };
  proof_entries: Array<{
    id: string;
    seq: number;
    captured_at: string;
    title: string;
    body: string;
    thumb_url: string | null;
  }>;
  file_evidence: null | {
    capture_device: string | null;
    lens: string | null;
    iso: number | null;
    shutter: string | null;
    dimensions: string | null;
    file_format: string | null;
    original_hash: string | null;
    captured_at: string | null;
    uploaded_at: string | null;
  };
  provenance_signals: Array<{
    id: string;
    signal_name: string;
    value: Record<string, unknown>;
    weight: number;
    created_at: string;
  }>;
  review_note: string | null;
  technical_signals: Array<{
    id: string;
    name: string;
    sentence: string;
    hedge: string;
    confidence: number;
  }>;
};

const RATIO_DIMENSIONS: Record<string, [number, number]> = {
  '2:3': [800, 1200],
  '1:1': [1000, 1000],
  '4:5': [960, 1200],
  '3:2': [1200, 800],
  '9:16': [720, 1280],
};

function dimensionsFor(ratio: string): [number, number] {
  const known = RATIO_DIMENSIONS[ratio];
  if (known) return known;
  const match = ratio.match(/^(\d+):(\d+)$/);
  if (!match) return [1000, 1000];
  const left = Number(match[1]);
  const right = Number(match[2]);
  if (!Number.isFinite(left) || !Number.isFinite(right) || left <= 0 || right <= 0) return [1000, 1000];
  const longest = 1200;
  if (left >= right) return [longest, Math.max(1, Math.round(longest * right / left))];
  return [Math.max(1, Math.round(longest * left / right)), longest];
}

export function mapFeedRow(row: FeedRow): WorkRecord {
  const [width, height] = dimensionsFor(row.aspect_ratio);
  return {
    id: row.id,
    creator_id: row.creator_id,
    title: row.title,
    description: row.description,
    category_slug: row.category as WorkRecord['category_slug'],
    aspect_ratio: row.aspect_ratio,
    media_url: row.image_url,
    thumb_url: row.thumb_url,
    width,
    height,
    alt_text: row.title,
    origin_input: row.origin_input,
    origin_status: row.status,
    status: row.status,
    proof_count: row.proof_count,
    review_complete: row.status === 'verified' && row.proof_count >= 1,
    created_at: row.created_at,
    published_at: row.published_at,
    creator_name: row.creator_display_name,
    creator_username: row.creator_handle,
    creator_avatar_url: row.creator_avatar_url,
    creator_reputation: row.creator_reputation,
    badge_variant: row.badge_variant,
    badge_label: row.badge_label,
    ai_declared: row.ai_declared ?? false,
    report_count: row.report_count ?? 0,
    feed_rank: row.feed_rank ?? 0,
    review_note: null,
  };
}

export type FeedScope = 'default' | 'unverified';

export type MyUnverifiedWork = {
  id: string;
  title: string;
  proof_count: number;
  created_at: string;
};

export async function getWorkFeed({
  limit = 40,
  cursor = null,
  scope = 'default',
  filters = { categories: [], tier: 'all', origins: [] },
}: {
  limit?: number;
  cursor?: FeedCursor | null;
  scope?: FeedScope;
  filters?: FeedFilters;
} = {}): Promise<FeedPage> {
  const supabase = await getServerSupabase();
  const functionName = scope === 'unverified'
    ? 'get_filtered_unverified_work_feed'
    : 'get_filtered_work_feed';
  const params = scope === 'unverified'
    ? {
        p_categories: filters.categories.length ? filters.categories : null,
        p_origins: filters.origins.length ? filters.origins : null,
        p_cursor_rank: cursor?.rankScore ?? null,
        p_cursor_published_at: cursor?.publishedAt ?? null,
        p_cursor_id: cursor?.id ?? null,
        p_limit: limit,
      }
    : {
        p_categories: filters.categories.length ? filters.categories : null,
        p_tier_mode: filters.tier,
        p_origins: filters.origins.length ? filters.origins : null,
        p_cursor_rank: cursor?.rankScore ?? null,
        p_cursor_published_at: cursor?.publishedAt ?? null,
        p_cursor_id: cursor?.id ?? null,
        p_limit: limit,
      };

  const { data, error } = await supabase.rpc(functionName, params);
  if (error) throw new Error(`Feed query failed: ${error.message}`);
  const items = ((data ?? []) as unknown as FeedRow[]).map(mapFeedRow);
  const last = items.at(-1);
  return {
    items,
    nextCursor: items.length === limit && last
      ? {
          rankScore: last.feed_rank,
          publishedAt: last.published_at ?? last.created_at,
          id: last.id,
        }
      : null,
  };
}

export async function searchWorkFeed({
  query,
  limit = 20,
  cursor = null,
}: {
  query: string;
  limit?: number;
  cursor?: FeedCursor | null;
}): Promise<FeedPage> {
  const normalized = query.trim();
  if (!normalized) return getWorkFeed({ limit, cursor });

  const supabase = await getServerSupabase();
  const { data, error } = await supabase.rpc('search_work_feed', {
    p_query: normalized,
    p_cursor_rank: cursor?.rankScore ?? null,
    p_cursor_published_at: cursor?.publishedAt ?? null,
    p_cursor_id: cursor?.id ?? null,
    p_limit: limit,
  });
  if (error) throw new Error(`Search query failed: ${error.message}`);

  const items = ((data ?? []) as unknown as FeedRow[]).map(mapFeedRow);
  const last = items.at(-1);
  return {
    items,
    nextCursor: items.length === limit && last
      ? {
          rankScore: last.feed_rank,
          publishedAt: last.published_at ?? last.created_at,
          id: last.id,
        }
      : null,
  };
}

export async function getDiscoverFilterCapabilities(): Promise<DiscoverFilterCapabilities> {
  const supabase = await getServerSupabase();
  const { data, error } = await supabase.rpc('get_discover_filter_capabilities');
  if (error) throw new Error(`Discover filter capability query failed: ${error.message}`);
  const row = Array.isArray(data) ? data[0] : data;
  return { hasCapturedInApp: Boolean(row?.has_captured_in_app) };
}

export async function getMyUnverifiedWorks(limit = 12): Promise<MyUnverifiedWork[]> {
  const supabase = await getServerSupabase();
  const { data, error } = await supabase.rpc('get_my_unverified_works', {
    p_limit: limit,
  });
  if (error) throw new Error(`Unverified Works query failed: ${error.message}`);
  return (data ?? []) as unknown as MyUnverifiedWork[];
}

export async function getWorkById(id: string): Promise<WorkDetailRecord | null> {
  const supabase = await getServerSupabase();
  const { data, error } = await supabase.rpc('get_work_detail', { p_work_id: id });
  if (error) throw new Error(`Work query failed: ${error.message}`);
  if (!data) return null;
  const payload = data as unknown as DetailPayload;
  const base = mapFeedRow({
    ...payload,
    creator_handle: payload.creator.handle,
    creator_display_name: payload.creator.display_name,
    creator_avatar_url: payload.creator.avatar_url,
    creator_reputation: payload.creator.reputation,
    badge_variant: payload.badge.badge_variant,
    badge_label: payload.badge.badge_label,
  });
  const proofStory: ProofEntryRecord[] = (payload.proof_entries ?? []).map(entry => ({
    id: entry.id,
    seq: entry.seq,
    timestamp: entry.captured_at,
    label: entry.title,
    note: entry.body,
    thumbnail_url: entry.thumb_url,
  }));
  const evidence: FileEvidenceRecord | null = payload.file_evidence ? {
    captureDevice: payload.file_evidence.capture_device,
    lens: payload.file_evidence.lens,
    iso: payload.file_evidence.iso,
    shutter: payload.file_evidence.shutter,
    dimensions: payload.file_evidence.dimensions,
    format: payload.file_evidence.file_format,
    originalHash: payload.file_evidence.original_hash,
    capturedAt: payload.file_evidence.captured_at,
    uploadTimestamp: payload.file_evidence.uploaded_at,
    originInput: payload.origin_input,
  } : null;
  const provenanceSignals: ProvenanceSignalRecord[] = (payload.provenance_signals ?? []).map(signal => ({
    name: signal.signal_name,
    value: signal.value ?? {},
    weight: signal.weight,
    createdAt: signal.created_at,
  }));
  const signals: TechnicalSignalRecord[] = (payload.technical_signals ?? []).map(signal => ({
    label: signal.name,
    strength: signal.confidence,
    description: signal.sentence,
    qualifier: signal.hedge,
  }));
  return { ...base, review_note: payload.review_note ?? null, proof_story: proofStory, file_evidence: evidence, technical_signals: signals, provenance_signals: provenanceSignals };
}
