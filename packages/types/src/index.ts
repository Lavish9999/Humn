export type OriginStatus =
  | 'captured_live'
  | 'process_verified'
  | 'original_file_verified'
  | 'creator_verified'
  | 'review_complete'
  | 'not_yet_verified'
  | 'ai_assistance_disclosed'
  | 'under_review';

export type WorkStatus = 'draft' | 'processing' | 'needs_evidence' | 'under_review' | 'published' | 'rejected' | 'archived';
export type CollectionPrivacy = 'private' | 'invite_only' | 'public';
export type UserRole = 'user' | 'support' | 'moderator' | 'senior_moderator' | 'trust_safety_lead' | 'admin' | 'auditor';

export interface WorkCard {
  id: string;
  title: string;
  description: string | null;
  origin_status: OriginStatus;
  creator_id: string;
  creator_name: string;
  creator_username: string;
  creator_avatar_url: string | null;
  media_url: string;
  width: number;
  height: number;
  blurhash: string | null;
  is_saved: boolean;
}

export interface ModerationQueueItem {
  id: string;
  queue_type: string;
  status: string;
  priority: number;
  work_id: string | null;
  creator_id: string | null;
  created_at: string;
}
