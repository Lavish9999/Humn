import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

export type StrikeState = {
  active_count: number;
  strike_level: number;
  posting_cooldown_until: string | null;
  suspended_at: string | null;
  can_post: boolean;
  status_label?: string;
};

export function firstRow<T>(value: T | T[] | null): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

export function formatPostingRestriction(state: StrikeState): string | null {
  if (state.suspended_at) {
    return 'Posting is suspended after three active strikes. You can continue browsing and may appeal from your account page.';
  }

  if (state.posting_cooldown_until) {
    const until = new Date(state.posting_cooldown_until);
    const label = Number.isNaN(until.getTime())
      ? state.posting_cooldown_until
      : until.toLocaleString('en-US');
    if (Number.isNaN(until.getTime()) || until.getTime() > Date.now()) {
      return `Posting is paused until ${label}. Browsing remains available, and every strike can be appealed from your account page.`;
    }
  }

  if (!state.can_post) {
    return state.status_label ?? 'Posting is not available for this account right now.';
  }

  return null;
}

export async function getPostingRestriction(
  admin: SupabaseClient,
  userId: string,
): Promise<{ restriction: string | null; error: string | null }> {
  const { data, error } = await admin.rpc('get_user_strike_state', {
    p_user_id: userId,
  });

  if (error) return { restriction: null, error: error.message };
  const state = firstRow(data as StrikeState | StrikeState[] | null);
  return { restriction: state ? formatPostingRestriction(state) : null, error: null };
}
