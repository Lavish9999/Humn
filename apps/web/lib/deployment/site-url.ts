import 'server-only';

function normalizeOrigin(rawValue: string, variableName: string): string {
  const value = rawValue.trim();
  const parsed = new URL(value);

  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    throw new Error(`${variableName} must use http or https.`);
  }

  return parsed.origin;
}

function vercelOrigin(): string | null {
  const hostname = process.env.VERCEL_PROJECT_PRODUCTION_URL ?? process.env.VERCEL_URL;
  if (!hostname) return null;
  return normalizeOrigin(`https://${hostname}`, 'Vercel deployment URL');
}

export function getSiteOrigin(): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL;
  if (configured) return normalizeOrigin(configured, 'NEXT_PUBLIC_SITE_URL');

  const deploymentOrigin = vercelOrigin();
  if (deploymentOrigin) return deploymentOrigin;

  if (process.env.NODE_ENV !== 'production') {
    return 'http://localhost:3000';
  }

  throw new Error(
    'NEXT_PUBLIC_SITE_URL is required in production when no Vercel deployment URL is available.',
  );
}

export function isProductionDeployment(): boolean {
  if (process.env.VERCEL_ENV) return process.env.VERCEL_ENV === 'production';
  return process.env.NODE_ENV === 'production';
}
