import type { CategorySlug } from '@human/config';
export type WorkStatus = 'declared' | 'awaiting' | 'verified' | 'rejected';
export type ProvenanceVariant = 'verified' | 'awaiting' | 'unverified';

export type BadgeRecord = { variant: ProvenanceVariant; label: string };

export type WorkRecord = {
  id: string;
  creator_id: string;
  title: string;
  description: string | null;
  category_slug: CategorySlug;
  aspect_ratio: string;
  media_url: string;
  thumb_url: string | null;
  width: number;
  height: number;
  alt_text: string;
  origin_input: 'captured_in_app' | 'uploaded';
  origin_status: WorkStatus;
  status: WorkStatus;
  proof_count: number;
  review_complete: boolean;
  created_at: string;
  published_at: string | null;
  creator_name: string;
  creator_username: string;
  creator_avatar_url: string | null;
  creator_reputation: number;
  badge_variant: ProvenanceVariant;
  badge_label: string;
  ai_declared: boolean;
  report_count: number;
  feed_rank: number;
  review_note: string | null;
};

export type ProofEntryRecord = {
  id: string;
  seq: number;
  timestamp: string;
  label: string;
  note: string;
  thumbnail_url: string | null;
};

export type FileEvidenceRecord = {
  captureDevice: string | null;
  lens: string | null;
  iso: number | null;
  shutter: string | null;
  focalLengthMm?: number | null;
  orientation?: number | null;
  gpsMetadataPresent?: boolean;
  dimensions: string | null;
  format: string | null;
  originalHash: string | null;
  capturedAt: string | null;
  uploadTimestamp: string | null;
  originInput: string | null;
};

export type ProvenanceSignalRecord = {
  name: string;
  value: Record<string, unknown>;
  weight: number;
  createdAt: string;
};

export type TechnicalSignalRecord = {
  label: string;
  strength: number;
  description: string;
  qualifier: string;
};

export type WorkDetailRecord = WorkRecord & {
  proof_story: ProofEntryRecord[];
  file_evidence: FileEvidenceRecord | null;
  technical_signals: TechnicalSignalRecord[];
  provenance_signals: ProvenanceSignalRecord[];
};

export type FeedCursor = { rankScore: number; publishedAt: string; id: string };
export type FeedPage = { items: WorkRecord[]; nextCursor: FeedCursor | null };

export type CollectionPickerCollection = {
  id: string;
  name: string;
  privacy: 'private' | 'public';
  updated_at: string;
};

export type CollectionSaveContext = {
  isSignedIn: boolean;
  collections: CollectionPickerCollection[];
  savedByWork: Record<string, string[]>;
};

export type CollectionSummary = {
  id: string;
  owner_id: string;
  name: string;
  privacy: 'private' | 'public';
  created_at: string;
  updated_at: string;
  work_count: number;
  preview_works: WorkRecord[];
};

export type CollectionDetail = {
  id: string;
  owner_id: string;
  name: string;
  privacy: 'private' | 'public';
  created_at: string;
  updated_at: string;
  work_count: number;
  owner: {
    id: string;
    handle: string;
    display_name: string;
    avatar_url: string | null;
  };
  works: WorkRecord[];
  is_owner: boolean;
};

export type OriginInput = 'captured_in_app' | 'uploaded';
export type ProvenanceTierMode = 'verified' | 'reviewed' | 'provenance' | 'all';

export type FeedFilters = {
  categories: CategorySlug[];
  tier: ProvenanceTierMode;
  origins: OriginInput[];
};

export type FeedInteractionContext = {
  isSignedIn: boolean;
  currentUserId: string | null;
  followingCreatorIds: string[];
  collections: CollectionPickerCollection[];
  savedByWork: Record<string, string[]>;
};

export type DiscoverFilterCapabilities = {
  hasCapturedInApp: boolean;
};

export type CreatorSearchRecord = {
  id: string;
  handle: string;
  displayName: string;
  avatarUrl: string | null;
  joinedAt: string;
  verifiedWorkCount: number;
  followerCount: number;
  isFollowedByViewer: boolean;
};

export type CreatorSearchCursor = {
  verifiedWorkCount: number;
  handle: string;
  id: string;
};

export type CreatorSearchPage = {
  items: CreatorSearchRecord[];
  nextCursor: CreatorSearchCursor | null;
};
