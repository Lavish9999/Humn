import { NextResponse } from 'next/server';
import {
  createRecoveryGrant,
  RECOVERY_GRANT_COOKIE,
  RECOVERY_GRANT_TTL_SECONDS,
  RECOVERY_INTENT_QUERY,
  verifyRecoveryIntent,
} from '../../../lib/auth/recovery';
import { safeInternalRedirect } from '../../../lib/auth/redirects';
import { getServerSupabase } from '../../../lib/supabase/server';

const RECOVERY_DESTINATION = '/auth/update-password';

function authErrorRedirect(requestUrl: URL, message: string): NextResponse {
  const target = new URL('/auth', requestUrl.origin);
  target.searchParams.set('error', message);
  return NextResponse.redirect(target);
}

function resetErrorRedirect(requestUrl: URL, message: string): NextResponse {
  const target = new URL('/auth/reset', requestUrl.origin);
  target.searchParams.set('error', message);
  return NextResponse.redirect(target);
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const nextPath = safeInternalRedirect(requestUrl.searchParams.get('next'));

  if (!code) {
    return authErrorRedirect(
      requestUrl,
      'The sign-in link is missing or invalid. Please try again.',
    );
  }

  const supabase = await getServerSupabase();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error || !data.session) {
    return authErrorRedirect(
      requestUrl,
      'We could not complete authentication. The link may be expired; please try again.',
    );
  }

  const userId = data.session.user?.id;

  if (!userId) {
    return authErrorRedirect(
      requestUrl,
      'We could not verify the authenticated account. Please try again.',
    );
  }

  if (nextPath === RECOVERY_DESTINATION) {
    const recoveryIntent = requestUrl.searchParams.get(RECOVERY_INTENT_QUERY);

    if (!verifyRecoveryIntent(recoveryIntent)) {
      return resetErrorRedirect(
        requestUrl,
        'That recovery link is invalid or expired. Request a new password reset email.',
      );
    }

    const response = NextResponse.redirect(new URL(nextPath, requestUrl.origin));
    response.cookies.set(RECOVERY_GRANT_COOKIE, createRecoveryGrant(userId), {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: RECOVERY_DESTINATION,
      maxAge: RECOVERY_GRANT_TTL_SECONDS,
    });
    return response;
  }

  return NextResponse.redirect(new URL(nextPath, requestUrl.origin));
}
