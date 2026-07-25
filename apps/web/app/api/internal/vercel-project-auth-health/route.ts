import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const oidcToken = process.env.VERCEL_OIDC_TOKEN?.trim();
  const projectId = process.env.VERCEL_PROJECT_ID?.trim();
  const teamId = process.env.VERCEL_ORG_ID?.trim();
  const authRecoverySecret = process.env.AUTH_RECOVERY_SECRET?.trim();

  if (!oidcToken || !projectId || !teamId) {
    return NextResponse.json({
      ok: false,
      oidcConfigured: Boolean(oidcToken),
      projectIdConfigured: Boolean(projectId),
      teamIdConfigured: Boolean(teamId),
      authRecoveryConfigured: Boolean(authRecoverySecret),
    }, { status: 503 });
  }

  try {
    const response = await fetch(
      `https://api.vercel.com/v9/projects/${encodeURIComponent(projectId)}?teamId=${encodeURIComponent(teamId)}`,
      {
        headers: { Authorization: `Bearer ${oidcToken}` },
        cache: 'no-store',
      },
    );
    const body = await response.text();

    return NextResponse.json({
      ok: response.ok,
      oidcConfigured: true,
      projectIdConfigured: true,
      teamIdConfigured: true,
      authRecoveryConfigured: Boolean(authRecoverySecret),
      vercelApiStatus: response.status,
      responseClass: response.headers.get('content-type'),
      bodyClass: body.includes('unauthorized') || body.includes('Unauthorized')
        ? 'unauthorized'
        : body.includes('forbidden') || body.includes('Forbidden')
          ? 'forbidden'
          : response.ok
            ? 'authorized'
            : 'other-error',
    }, { status: response.ok ? 200 : 503 });
  } catch (error) {
    return NextResponse.json({
      ok: false,
      oidcConfigured: true,
      projectIdConfigured: true,
      teamIdConfigured: true,
      authRecoveryConfigured: Boolean(authRecoverySecret),
      errorClass: error instanceof Error ? error.name : 'UnknownError',
      message: error instanceof Error ? error.message : String(error),
    }, { status: 500 });
  }
}
