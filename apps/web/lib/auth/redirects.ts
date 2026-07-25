const DEFAULT_INTERNAL_REDIRECT = '/discover';
const INTERNAL_REDIRECT_BASE = 'https://humn.invalid';

export function safeInternalRedirect(
  value: string | null | undefined,
  fallback = DEFAULT_INTERNAL_REDIRECT,
): string {
  const candidate = String(value ?? '').trim();

  if (
    candidate.length === 0
    || !candidate.startsWith('/')
    || candidate.startsWith('//')
    || candidate.includes('\\')
    || /[\u0000-\u001F\u007F]/.test(candidate)
  ) {
    return fallback;
  }

  try {
    const parsed = new URL(candidate, INTERNAL_REDIRECT_BASE);

    if (parsed.origin !== INTERNAL_REDIRECT_BASE) {
      return fallback;
    }

    const normalized = `${parsed.pathname}${parsed.search}${parsed.hash}`;

    if (
      normalized === '/auth'
      || normalized === '/signin'
      || normalized.startsWith('/auth?')
      || normalized.startsWith('/signin?')
    ) {
      return fallback;
    }

    return normalized;
  } catch {
    return fallback;
  }
}
