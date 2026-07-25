export type NavAuthState =
  | { status: 'signed-out' }
  | { status: 'profile-missing'; userId: string }
  | {
      status: 'handle-choice-required';
      userId: string;
      handle: string;
      avatarUrl: string | null;
      canReview: boolean;
    }
  | {
      status: 'signed-in';
      userId: string;
      handle: string;
      avatarUrl: string | null;
      canReview: boolean;
    };

function metadataBoolean(metadata: Record<string, unknown>, key: string): boolean {
  const value = metadata[key];
  return value === true || value === 'true';
}

export function authMetadataNeedsHandleChoice(metadata: unknown): boolean {
  if (!metadata || typeof metadata !== 'object') return false;
  const record = metadata as Record<string, unknown>;
  return metadataBoolean(record, 'requires_handle_choice') || metadataBoolean(record, 'handle_adjusted');
}
