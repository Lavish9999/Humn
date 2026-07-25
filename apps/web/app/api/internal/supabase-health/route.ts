import { NextResponse } from 'next/server';
import { getPublicSupabaseConfig } from '@human/database/config';

const projectRef = 'bondfumehickzmmbfwoe';

async function inspect(path: string, init?: RequestInit) {
  const { publishableKey } = getPublicSupabaseConfig();
  const response = await fetch(`https://${projectRef}.supabase.co${path}`, {
    ...init,
    headers: {
      apikey: publishableKey,
      Authorization: `Bearer ${publishableKey}`,
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
    cache: 'no-store',
  });
  const body = await response.text();

  return {
    path,
    status: response.status,
    contentType: response.headers.get('content-type'),
    bodyPreview: body.replace(/\s+/g, ' ').slice(0, 240),
  };
}

export async function GET() {
  const checks = await Promise.all([
    inspect('/auth/v1/settings'),
    inspect('/rest/v1/'),
    inspect('/rest/v1/rpc/get_discover_filter_capabilities', {
      method: 'POST',
      body: '{}',
    }),
    inspect('/rest/v1/rpc/get_filtered_work_feed', {
      method: 'POST',
      body: JSON.stringify({
        p_categories: null,
        p_tier_mode: 'all',
        p_origins: null,
        p_cursor_rank: null,
        p_cursor_published_at: null,
        p_cursor_id: null,
        p_limit: 1,
      }),
    }),
  ]);

  return NextResponse.json({ projectRef, checks });
}
