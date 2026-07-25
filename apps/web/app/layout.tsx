import type { Metadata } from 'next';
import Link from 'next/link';
import { Fraunces, Inter_Tight, JetBrains_Mono } from 'next/font/google';
import { productConfig } from '@human/config';
import { PrimaryNav } from '../components/primary-nav';
import { SiteFooter } from '../components/site-footer';
import { authMetadataNeedsHandleChoice, type NavAuthState } from '../lib/auth/nav-state';
import { getServerSupabase } from '../lib/supabase/server';
import { getSiteOrigin } from '../lib/deployment/site-url';
import './globals.css';

const display = Fraunces({ subsets: ['latin'], weight: ['600'], variable: '--font-display', display: 'swap' });
const body = Inter_Tight({ subsets: ['latin'], weight: ['400', '500'], variable: '--font-body', display: 'swap' });
const mono = JetBrains_Mono({ subsets: ['latin'], weight: ['400', '500'], variable: '--font-mono', display: 'swap' });

export const metadata: Metadata = {
  metadataBase: new URL(getSiteOrigin()),
  title: productConfig.name,
  description: productConfig.description,
};

function hasPublicSupabaseConfig() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL
      && (process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
  );
}

async function getInitialNavAuthState(): Promise<NavAuthState> {
  if (!hasPublicSupabaseConfig()) return { status: 'signed-out' };

  try {
    const supabase = await getServerSupabase();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return { status: 'signed-out' };

    const { data: profile } = await supabase
      .from('users')
      .select('handle, avatar_url, is_admin, reviewer_level')
      .eq('id', user.id)
      .maybeSingle();

    if (!profile) return { status: 'profile-missing', userId: user.id };

    const identity = {
      userId: user.id,
      handle: String(profile.handle),
      avatarUrl: typeof profile.avatar_url === 'string' ? profile.avatar_url : null,
      canReview: Boolean(profile.is_admin || (profile.reviewer_level ?? 0) > 0),
    };

    if (authMetadataNeedsHandleChoice(user.user_metadata)) {
      return { status: 'handle-choice-required', ...identity };
    }

    return { status: 'signed-in', ...identity };
  } catch (error) {
    console.error('Initial navigation auth lookup failed.', error);
    return { status: 'signed-out' };
  }
}

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const initialAuth = await getInitialNavAuthState();

  return (
    <html lang="en">
      <body className={`${display.variable} ${body.variable} ${mono.variable}`}>
        <div className="app-shell">
          <header className="topbar">
            <div className="shell topbar-inner">
              <Link className="brand" href="/">{productConfig.name}</Link>
              <PrimaryNav initialAuth={initialAuth} />
            </div>
          </header>
          <div className="app-main">{children}</div>
          <SiteFooter />
        </div>
      </body>
    </html>
  );
}
