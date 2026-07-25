import { NextResponse } from 'next/server';
import { getPublicSupabaseConfig } from '@human/database/config';

const candidates = [
  { label: 'human-cli', ref: 'bondfumehickzmmbfwoe' },
  { label: 'humn-production', ref: 'tysaxhgyvpvcbpoaynog' },
] as const;

export async function GET() {
  const { publishableKey } = getPublicSupabaseConfig();

  const results = await Promise.all(candidates.map(async ({ label, ref }) => {
    const url = `https://${ref}.supabase.co/auth/v1/settings`;

    try {
      const response = await fetch(url, {
        headers: {
          apikey: publishableKey,
          Authorization: `Bearer ${publishableKey}`,
        },
        cache: 'no-store',
      });

      return {
        label,
        ref,
        status: response.status,
        contentType: response.headers.get('content-type'),
        matched: response.ok,
      };
    } catch (error) {
      return {
        label,
        ref,
        status: null,
        contentType: null,
        matched: false,
        error: error instanceof Error ? error.message : 'Unknown fetch failure',
      };
    }
  }));

  return NextResponse.json({ results });
}
