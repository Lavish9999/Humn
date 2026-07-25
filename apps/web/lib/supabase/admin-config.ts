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
  const payloadSegment = segments[1];
  if (segments.length !== 3 || !payloadSegment) return null;

  try {
    const payload = JSON.parse(Buffer.from(payloadSegment, 'base64url').toString('utf8')) as {
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

function normalizeSupabaseProjectUrl(value: string | undefined): string | null {
  const candidate = value?.trim();
  if (!candidate) return null;

  try {
    const url = new URL(candidate);
    if (url.protocol !== 'https:' || !url.hostname.endsWith('.supabase.co')) {
      return null;
    }
    url.pathname = '';
    url.search = '';
    url.hash = '';
    return url.toString().replace(/\/$/, '');
  } catch {
    return null;
  }
}

export function resolveSupabaseAdminConfig() {
  const publicConfig = getPublicSupabaseConfig();
  const environmentUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const url = normalizeSupabaseProjectUrl(environmentUrl)
    ?? normalizeSupabaseProjectUrl(publicConfig.url);

  if (!url) {
    throw new SupabaseAdminConfigurationError(
      'SUPABASE_ADMIN_URL_MISSING',
      'The Supabase project URL is missing or invalid in both the server environment and verified public configuration.',
    );
  }

  if (environmentUrl && !normalizeSupabaseProjectUrl(environmentUrl)) {
    console.warn('[supabase-admin-config] Ignoring invalid NEXT_PUBLIC_SUPABASE_URL and using verified Humn Supabase configuration.', {
      configuredHost: (() => {
        try {
          return new URL(environmentUrl).host;
        } catch {
          return 'invalid-url';
        }
      })(),
    });
  }

  const { key, source } = resolveAdminKey();
  return { url, key, keySource: source };
}
