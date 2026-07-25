'use server';

import { redirect } from 'next/navigation';
import {
  createRecoveryIntent,
  RECOVERY_INTENT_QUERY,
} from '../../../lib/auth/recovery';
import { getServerSupabase } from '../../../lib/supabase/server';
import { getSiteOrigin } from '../../../lib/deployment/site-url';

function recoveryCallbackUrl(): string {
  const callback = new URL('/auth/callback', getSiteOrigin());
  callback.searchParams.set('next', '/auth/update-password');
  callback.searchParams.set(RECOVERY_INTENT_QUERY, createRecoveryIntent());
  return callback.toString();
}

export async function requestReset(formData: FormData) {
  const email = String(formData.get('email') ?? '').trim();
  const supabase = await getServerSupabase();

  try {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: recoveryCallbackUrl(),
    });

    if (error) {
      redirect(`/auth/reset?error=${encodeURIComponent(error.message)}`);
    }
  } catch (error) {
    const message = error instanceof Error
      ? error.message
      : 'We could not start password recovery. Please try again.';
    redirect(`/auth/reset?error=${encodeURIComponent(message)}`);
  }

  redirect('/auth/reset?message=Check%20your%20email%20for%20the%20reset%20link.');
}

