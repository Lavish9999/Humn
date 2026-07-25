'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import {
  RECOVERY_GRANT_COOKIE,
  verifyRecoveryGrant,
} from '../../../lib/auth/recovery';
import { getServerSupabase } from '../../../lib/supabase/server';

export type UpdatePasswordState = {
  error?: string;
};

export async function updateRecoveredPassword(
  _previousState: UpdatePasswordState,
  formData: FormData,
): Promise<UpdatePasswordState> {
  const password = String(formData.get('password') ?? '');

  if (password.length < 10) {
    return { error: 'Password must be at least 10 characters.' };
  }

  const supabase = await getServerSupabase();
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  const cookieStore = await cookies();
  const grant = cookieStore.get(RECOVERY_GRANT_COOKIE)?.value;

  if (userError || !user || !verifyRecoveryGrant(grant, user.id)) {
    return {
      error: 'Your recovery session is invalid or expired. Request a new reset link.',
    };
  }

  const { error } = await supabase.auth.updateUser({ password });

  if (error) {
    return { error: error.message || 'We could not update your password. Try again.' };
  }

  cookieStore.delete(RECOVERY_GRANT_COOKIE);
  await supabase.auth.signOut();
  redirect('/auth?message=Password%20updated.%20Sign%20in%20with%20your%20new%20password.');
}
