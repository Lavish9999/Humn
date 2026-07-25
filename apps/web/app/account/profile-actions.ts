'use server';

import { getServerSupabase } from '../../lib/supabase/server';

export type UpdateProfileResult = {
  ok: boolean;
  fieldError?: string;
  formError?: string;
};

export async function updateProfileDisplayName(
  displayNameInput: string,
): Promise<UpdateProfileResult> {
  const displayName = displayNameInput.trim();
  if (displayName.length < 2) {
    return { ok: false, fieldError: 'Display name must be at least 2 characters.' };
  }
  if (displayName.length > 80) {
    return { ok: false, fieldError: 'Display name must be 80 characters or fewer.' };
  }

  const supabase = await getServerSupabase();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { ok: false, formError: 'Your session expired. Sign in again.' };

  const { error } = await supabase
    .from('users')
    .update({ display_name: displayName })
    .eq('id', auth.user.id);

  if (error) return { ok: false, formError: error.message };
  return { ok: true };
}
