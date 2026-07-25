import 'server-only';

import { getPublicSupabaseConfig } from '@human/database/config';

export type SupabaseAdminConfigurationCode =
  | 'SUPABASE_ADMIN_KEY_MISSING'
  | 'SUPABASE_ADMIN_KEY_PUBLIC'
  | 'SUPABASE_ADMIN_KEY_WRONG_ROLE'
  | 'SUPABASE_ADMIN_URL_MISSING';

export class SupabaseAdminConfigurationError extends Error {
  readonly code: SupabaseAdminConfigurationCode;
  readonly keySource: string | null;

  constructor(
    code: SupabaseAdminConfigurationCode,
    message: string,
    keySource: string | null = null,
  ) {
    super(message);
    this.name = 'SupabaseAdminConfigurationError';
    this.code = code;
    this.keySource = keySource;
  }
}

function decodeJwtRole(token: string): string | null {
  const segments = token.split('.');
  if (segments.length !== 3) return null;

  try {
    const payload = JSON.parse(Buffer.from(segments[1], 'base64url').toString('utf8')) as {
      role?: unknown;
    };
    return typeof payload.role === 'string' ? payload.role : null;
  } catch {
    return null;
  }
}

function resolveAdminKey(): { key: string; source: string } {
  const candidates = [
    ['SUPABASE_SECRET_KEY', process.env.SUPABASE_SECRET_KEY],
    ['SUPABASE_SERVICE_ROLE_KEY', process.env.SUPABASE_SERVICE_ROLE_KEY],
  ] as const;

  const match = candidates.find(([, value]) => Boolean(value?.trim()));
  if (!match) {
    throw new SupabaseAdminConfigurationError(
      'SUPABASE_ADMIN_KEY_MISSING',
      'No server-side Supabase secret key is configured. Set SUPABASE_SECRET_KEY (preferred for rotated sb_secret_ keys) or SUPABASE_SERVICE_ROLE_KEY in Vercel Production.',
    );
  }

  const [source, rawValue] = match;
  const key = rawValue!.trim();

  if (
    key.startsWith('sb_publishable_')
    || key.startsWith('sb_anon_')
    || decodeJwtRole(key) === 'anon'
  ) {
    throw new SupabaseAdminConfigurationError(
      'SUPABASE_ADMIN_KEY_PUBLIC',
      `${source} contains a public/anonymous Supabase key and cannot perform privileged Storage operations.`,
      source,
    );
  }

  const jwtRole = decodeJwtRole(key);
  if (!key.startsWith('sb_secret_') && jwtRole && jwtRole !== 'service_role') {
    throw new SupabaseAdminConfigurationError(
      'SUPABASE_ADMIN_KEY_WRONG_ROLE',
      `${source} does not contain a Supabase secret or service-role key.`,
      source,
    );
  }

  return { key, source };
}

export function resolveSupabaseAdminConfig() {
  const publicConfig = getPublicSupabaseConfig();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || publicConfig.url?.trim();
  if (!url) {
    throw new SupabaseAdminConfigurationError(
      'SUPABASE_ADMIN_URL_MISSING',
      'The Supabase project URL is missing from the server environment and public configuration.',
    );
  }

  const { key, source } = resolveAdminKey();
  return { url, key, keySource: source };
}
