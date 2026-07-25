'use server';

import { redirect } from 'next/navigation';
import { signInSchema, signUpSchema } from '@human/validation';
import { getServerSupabase } from '../../lib/supabase/server';
import { getSiteOrigin } from '../../lib/deployment/site-url';

export type AuthField = 'displayName' | 'username' | 'email' | 'password';

export type AuthActionResult = {
  ok: boolean;
  stage: 'validation' | 'supabase' | 'success';
  fieldErrors?: Partial<Record<AuthField, string>>;
  formError?: string;
  message?: string;
  redirectTo?: string;
  requiresEmailConfirmation?: boolean;
};

const AUTH_SERVICE_TIMEOUT_MS = 12_000;
const AUTH_SERVICE_TIMEOUT_CODE = 'AUTH_SERVICE_TIMEOUT';

function firstIssueByField(
  issues: Array<{ path: PropertyKey[]; message: string }>,
): Partial<Record<AuthField, string>> {
  const errors: Partial<Record<AuthField, string>> = {};

  for (const issue of issues) {
    const field = issue.path[0];
    if (
      (field === 'displayName' || field === 'username' || field === 'email' || field === 'password')
      && !errors[field]
    ) {
      errors[field] = issue.message;
    }
  }

  return errors;
}

function safeInternalRedirect(value: FormDataEntryValue | string | null | undefined): string {
  const candidate = String(value ?? '').trim();
  if (!candidate.startsWith('/') || candidate.startsWith('//')) return '/discover';
  if (candidate === '/auth' || candidate === '/signin' || candidate.startsWith('/auth?')) {
    return '/discover';
  }
  return candidate;
}

function withServiceTimeout<T>(request: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timeoutId = setTimeout(() => reject(new Error(AUTH_SERVICE_TIMEOUT_CODE)), timeoutMs);

    request.then(
      (value) => {
        clearTimeout(timeoutId);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timeoutId);
        reject(error);
      },
    );
  });
}

function authErrorCode(error: unknown): string {
  if (typeof error === 'object' && error !== null && 'code' in error) {
    const code = (error as { code?: unknown }).code;
    return typeof code === 'string' ? code : '';
  }

  return '';
}

function authErrorStatus(error: unknown): number | null {
  if (typeof error === 'object' && error !== null && 'status' in error) {
    const status = (error as { status?: unknown }).status;
    return typeof status === 'number' ? status : null;
  }

  return null;
}

function authErrorMessage(error: unknown): string {
  if (typeof error === 'object' && error !== null && 'message' in error) {
    const message = (error as { message?: unknown }).message;
    return typeof message === 'string' ? message : '';
  }

  return '';
}

function mapSupabaseAuthError(error: unknown): Pick<AuthActionResult, 'fieldErrors' | 'formError'> {
  const code = authErrorCode(error).toLowerCase();
  const status = authErrorStatus(error);
  const rawMessage = authErrorMessage(error);
  const message = rawMessage.toLowerCase();

  if (rawMessage === AUTH_SERVICE_TIMEOUT_CODE) {
    return { formError: 'The sign-in service took too long to respond. Try again.' };
  }

  if (status === 429 || code === 'over_email_send_rate_limit' || code === 'over_request_rate_limit' || message.includes('rate limit') || message.includes('too many requests')) {
    return { formError: 'Too many sign-in attempts. Wait a moment, then try again.' };
  }

  if (code === 'user_already_exists' || message.includes('already registered') || message.includes('already exists')) {
    return { fieldErrors: { email: 'That email is already registered.' } };
  }

  if (code === 'weak_password' || message.includes('weak password') || message.includes('password should be')) {
    return { fieldErrors: { password: 'Password does not meet the required strength rules.' } };
  }

  if (code === 'email_not_confirmed' || message.includes('email not confirmed')) {
    return { fieldErrors: { email: 'Confirm your email before signing in.' } };
  }

  if (code === 'invalid_credentials' || message.includes('invalid login credentials')) {
    return { fieldErrors: { email: 'Email or password is incorrect.' } };
  }

  if (code === 'email_address_invalid' || message.includes('invalid email')) {
    return { fieldErrors: { email: 'Enter a valid email address.' } };
  }

  if (
    message.includes('failed to fetch')
    || message.includes('fetch failed')
    || message.includes('network')
    || message.includes('connection')
  ) {
    return { formError: 'We could not reach the sign-in service. Check your connection and try again.' };
  }

  if (code === 'signup_disabled' || message.includes('signups not allowed')) {
    return { formError: 'Account creation is temporarily unavailable.' };
  }

  if (message.includes('database error saving new user')) {
    return { formError: 'We could not finish creating the account. Try a different username or try again.' };
  }

  return {
    formError: rawMessage
      ? `Supabase could not complete the request: ${rawMessage}`
      : 'Supabase could not complete the request. Try again.',
  };
}

export async function signInAction(formData: FormData): Promise<AuthActionResult> {
  const redirectTo = safeInternalRedirect(formData.get('next'));
  const result = signInSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  });

  if (!result.success) {
    const fieldErrors = firstIssueByField(result.error.issues);
    console.info('[auth:signin]', { stage: 'validation', fields: Object.keys(fieldErrors) });
    return { ok: false, stage: 'validation', fieldErrors };
  }

  const supabase = await getServerSupabase();

  try {
    const currentUserResponse = await withServiceTimeout(
      Promise.resolve(supabase.auth.getUser()),
      AUTH_SERVICE_TIMEOUT_MS,
    );

    if (currentUserResponse.data.user) {
      console.info('[auth:signin]', { stage: 'success', reason: 'already_authenticated' });
      return { ok: true, stage: 'success', redirectTo };
    }
  } catch (error) {
    if (authErrorMessage(error) === AUTH_SERVICE_TIMEOUT_CODE) {
      return {
        ok: false,
        stage: 'supabase',
        formError: 'The sign-in service took too long to respond. Try again.',
      };
    }
    // Continue to the actual sign-in request when session inspection fails.
  }

  try {
    const { error } = await withServiceTimeout(
      Promise.resolve(supabase.auth.signInWithPassword(result.data)),
      AUTH_SERVICE_TIMEOUT_MS,
    );

    if (error) {
      const mapped = mapSupabaseAuthError(error);
      console.info('[auth:signin]', {
        stage: 'supabase',
        code: authErrorCode(error) || 'unknown',
        status: authErrorStatus(error),
      });
      return { ok: false, stage: 'supabase', ...mapped };
    }
  } catch (error) {
    const mapped = mapSupabaseAuthError(error);
    console.info('[auth:signin]', {
      stage: 'supabase',
      code: authErrorCode(error) || 'request_failed',
      status: authErrorStatus(error),
    });
    return { ok: false, stage: 'supabase', ...mapped };
  }

  console.info('[auth:signin]', { stage: 'success' });
  return { ok: true, stage: 'success', redirectTo };
}

export async function signUpAction(formData: FormData): Promise<AuthActionResult> {
  const normalizedUsername = String(formData.get('username') ?? '').trim().toLowerCase();
  const result = signUpSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
    displayName: formData.get('displayName'),
    username: normalizedUsername,
  });

  if (!result.success) {
    const fieldErrors = firstIssueByField(result.error.issues);
    console.info('[auth:signup]', { stage: 'validation', fields: Object.keys(fieldErrors) });
    return { ok: false, stage: 'validation', fieldErrors };
  }

  const supabase = await getServerSupabase();

  const { data: existingHandle, error: handleLookupError } = await supabase
    .from('users')
    .select('id')
    .eq('handle', result.data.username)
    .maybeSingle();

  if (handleLookupError) {
    console.info('[auth:signup]', { stage: 'supabase', code: 'handle_lookup_failed' });
    return {
      ok: false,
      stage: 'supabase',
      formError: 'We could not verify username availability. Try again.',
    };
  }

  if (existingHandle) {
    console.info('[auth:signup]', { stage: 'validation', fields: ['username'], reason: 'taken' });
    return {
      ok: false,
      stage: 'validation',
      fieldErrors: { username: 'That username is already taken.' },
    };
  }

  const { data, error } = await supabase.auth.signUp({
    email: result.data.email,
    password: result.data.password,
    options: {
      data: {
        // Keep both keys during the transition. The profile trigger reads `handle`
        // first, while older clients and recovery flows may still read `username`.
        handle: result.data.username,
        username: result.data.username,
        display_name: result.data.displayName,
        signup_source: 'form',
        requires_handle_choice: false,
        handle_adjusted: false,
      },
    },
  });

  if (error) {
    const mapped = mapSupabaseAuthError(error);
    console.info('[auth:signup]', { stage: 'supabase', code: authErrorCode(error) || 'unknown' });
    return { ok: false, stage: 'supabase', ...mapped };
  }

  let resolvedHandle: string | null = null;
  if (data.user?.id) {
    const { data: profile } = await supabase
      .from('users')
      .select('handle')
      .eq('id', data.user.id)
      .maybeSingle();
    resolvedHandle = profile?.handle ? String(profile.handle) : null;
  }

  const handleAdjusted = Boolean(resolvedHandle && resolvedHandle !== result.data.username);
  const requiresEmailConfirmation = data.session === null;

  console.info('[auth:signup]', {
    stage: 'success',
    requiresEmailConfirmation,
    handleAdjusted,
  });

  if (requiresEmailConfirmation) {
    return {
      ok: true,
      stage: 'success',
      requiresEmailConfirmation: true,
      message: handleAdjusted
        ? `Account created. Your requested username was unavailable, so @${resolvedHandle} was reserved. Confirm your email, then choose a username.`
        : 'Account created. Check your email to confirm your address before signing in.',
    };
  }

  if (handleAdjusted) {
    return {
      ok: true,
      stage: 'success',
      requiresEmailConfirmation: false,
      redirectTo: '/complete-profile',
    };
  }

  return {
    ok: true,
    stage: 'success',
    requiresEmailConfirmation: false,
    redirectTo: safeInternalRedirect(formData.get('next')),
  };
}

export async function oauthAction(provider: 'google' | 'apple', nextPath = '/discover') {
  const supabase = await getServerSupabase();
  const safeNext = safeInternalRedirect(nextPath);
  const callbackUrl = `${getSiteOrigin()}/auth/callback?next=${encodeURIComponent(safeNext)}`;
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: { redirectTo: callbackUrl },
  });

  if (error || !data.url) {
    redirect(`/auth?error=${encodeURIComponent(error?.message ?? 'Could not start sign in.')}`);
  }

  redirect(data.url);
}

