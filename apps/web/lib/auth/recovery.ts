import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';

export const RECOVERY_INTENT_QUERY = 'recovery_intent';
export const RECOVERY_GRANT_COOKIE = 'humn_recovery_grant';

const RECOVERY_INTENT_PURPOSE = 'password-recovery-intent';
const RECOVERY_GRANT_PURPOSE = 'password-recovery-grant';
const RECOVERY_INTENT_TTL_SECONDS = 30 * 60;
export const RECOVERY_GRANT_TTL_SECONDS = 15 * 60;

type SignedPayload = {
  purpose: string;
  exp: number;
  nonce: string;
  sub?: string;
};

function signingSecret(): string {
  const secret = process.env.AUTH_RECOVERY_SECRET ?? process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!secret) {
    throw new Error(
      'Password recovery requires AUTH_RECOVERY_SECRET or SUPABASE_SERVICE_ROLE_KEY.',
    );
  }

  return secret;
}

function encodePayload(payload: SignedPayload): string {
  return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
}

function sign(encodedPayload: string): string {
  return createHmac('sha256', signingSecret()).update(encodedPayload).digest('base64url');
}

function createSignedToken(payload: SignedPayload): string {
  const encodedPayload = encodePayload(payload);
  return `${encodedPayload}.${sign(encodedPayload)}`;
}

function readSignedToken(token: string | null | undefined): SignedPayload | null {
  const value = String(token ?? '').trim();
  const separator = value.lastIndexOf('.');

  if (separator <= 0 || separator === value.length - 1) {
    return null;
  }

  const encodedPayload = value.slice(0, separator);
  const receivedSignature = value.slice(separator + 1);
  const expectedSignature = sign(encodedPayload);
  const received = Buffer.from(receivedSignature, 'utf8');
  const expected = Buffer.from(expectedSignature, 'utf8');

  if (received.length !== expected.length || !timingSafeEqual(received, expected)) {
    return null;
  }

  try {
    const parsed = JSON.parse(
      Buffer.from(encodedPayload, 'base64url').toString('utf8'),
    ) as Partial<SignedPayload>;

    if (
      typeof parsed.purpose !== 'string'
      || typeof parsed.exp !== 'number'
      || typeof parsed.nonce !== 'string'
      || parsed.exp <= Math.floor(Date.now() / 1000)
    ) {
      return null;
    }

    return parsed as SignedPayload;
  } catch {
    return null;
  }
}

export function createRecoveryIntent(): string {
  return createSignedToken({
    purpose: RECOVERY_INTENT_PURPOSE,
    exp: Math.floor(Date.now() / 1000) + RECOVERY_INTENT_TTL_SECONDS,
    nonce: randomUUID(),
  });
}

export function verifyRecoveryIntent(token: string | null | undefined): boolean {
  return readSignedToken(token)?.purpose === RECOVERY_INTENT_PURPOSE;
}

export function createRecoveryGrant(userId: string): string {
  return createSignedToken({
    purpose: RECOVERY_GRANT_PURPOSE,
    sub: userId,
    exp: Math.floor(Date.now() / 1000) + RECOVERY_GRANT_TTL_SECONDS,
    nonce: randomUUID(),
  });
}

export function verifyRecoveryGrant(
  token: string | null | undefined,
  userId: string,
): boolean {
  const payload = readSignedToken(token);
  return payload?.purpose === RECOVERY_GRANT_PURPOSE && payload.sub === userId;
}
