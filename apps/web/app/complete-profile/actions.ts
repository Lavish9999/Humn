'use server';

import { usernameSchema } from '@human/validation';
import { getServerSupabase } from '../../lib/supabase/server';

export type CompleteProfileResult = {
  ok: boolean;
  fieldErrors?: { handle?: string; displayName?: string };
  formError?: string;
};

export async function completeProfileAction(formData: FormData): Promise<CompleteProfileResult> {
  const supabase = await getServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return { ok: false, formError: 'Your session expired. Sign in again.' };

  const displayName = String(formData.get('displayName') ?? '').trim();
  const parsedHandle = usernameSchema.safeParse(formData.get('handle'));
  const fieldErrors: CompleteProfileResult['fieldErrors'] = {};

  if (displayName.length < 2) fieldErrors.displayName = 'Display name must be at least 2 characters.';
  if (displayName.length > 80) fieldErrors.displayName = 'Display name must be 80 characters or fewer.';
  if (!parsedHandle.success) fieldErrors.handle = parsedHandle.error.issues[0]?.message ?? 'Choose a valid username.';
  if (fieldErrors.displayName || fieldErrors.handle) return { ok: false, fieldErrors };

  const { error } = await supabase.rpc('complete_humn_profile', {
    p_handle: parsedHandle.data,
    p_display_name: displayName,
  });

  if (error) {
    const message = error.message.toLowerCase();
    if (message.includes('handle_taken') || message.includes('duplicate')) {
      return { ok: false, fieldErrors: { handle: 'That username is already taken.' } };
    }
    if (message.includes('handle_change_not_allowed')) {
      return { ok: false, formError: 'This account no longer requires a username choice.' };
    }
    return { ok: false, formError: `We could not complete your profile: ${error.message}` };
  }

  return { ok: true };
}
