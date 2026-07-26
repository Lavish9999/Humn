import { createServerClient } from '@supabase/ssr';
import { getPublicSupabaseConfig } from '@human/database/config';
import { NextResponse, type NextRequest } from 'next/server';

function styleGuideIsAvailable() {
  if (process.env.NODE_ENV !== 'production') return true;
  return process.env.VERCEL_ENV === 'preview';
}

export async function proxy(request: NextRequest) {
  if (
    !styleGuideIsAvailable()
    && (request.nextUrl.pathname === '/style-guide' || request.nextUrl.pathname.startsWith('/style-guide/'))
  ) {
    return new NextResponse('Not Found', {
      status: 404,
      headers: {
        'content-type': 'text/plain; charset=utf-8',
        'x-robots-tag': 'noindex, nofollow',
      },
    });
  }

  let response = NextResponse.next({ request });
  const { url, publishableKey } = getPublicSupabaseConfig();

  const supabase = createServerClient(url, publishableKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(items) {
        for (const { name, value } of items) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of items) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  await supabase.auth.getUser();
  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
};
