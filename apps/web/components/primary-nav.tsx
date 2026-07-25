'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { createBrowserSupabaseClient } from '@human/database/browser';
import { authMetadataNeedsHandleChoice, type NavAuthState } from '../lib/auth/nav-state';

const links = [
  ['/discover', 'Discover'],
  ['/search', 'Search'],
  ['/collections', 'Collections'],
] as const;

type PrimaryNavProps = {
  initialAuth: NavAuthState;
};

export function PrimaryNav({ initialAuth }: PrimaryNavProps) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = useMemo(() => createBrowserSupabaseClient(), []);
  const [open, setOpen] = useState(false);
  const [auth, setAuth] = useState<NavAuthState>(initialAuth);
  const [signingOut, setSigningOut] = useState(false);

  const loadProfile = useCallback(async (userId: string, metadata: unknown) => {
    const { data: profile } = await supabase
      .from('users')
      .select('handle, avatar_url, is_admin, reviewer_level')
      .eq('id', userId)
      .maybeSingle();

    if (!profile) {
      setAuth({ status: 'profile-missing', userId });
      return;
    }

    const next = {
      userId,
      handle: String(profile.handle),
      avatarUrl: typeof profile.avatar_url === 'string' ? profile.avatar_url : null,
      canReview: Boolean(profile.is_admin || (profile.reviewer_level ?? 0) > 0),
    };

    if (authMetadataNeedsHandleChoice(metadata)) {
      setAuth({ status: 'handle-choice-required', ...next });
      return;
    }

    setAuth({ status: 'signed-in', ...next });
  }, [supabase]);

  useEffect(() => setAuth(initialAuth), [initialAuth]);
  useEffect(() => setOpen(false), [pathname]);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session?.user) {
        setAuth({ status: 'signed-out' });
        return;
      }

      window.setTimeout(() => {
        void loadProfile(session.user.id, session.user.user_metadata);
      }, 0);
    });

    return () => subscription.unsubscribe();
  }, [loadProfile, supabase]);

  useEffect(() => {
    const needsProfileFlow = auth.status === 'profile-missing' || auth.status === 'handle-choice-required';
    if (needsProfileFlow && pathname !== '/complete-profile') {
      router.replace('/complete-profile');
    }
  }, [auth.status, pathname, router]);

  async function signOut() {
    if (signingOut) return;
    setSigningOut(true);
    await supabase.auth.signOut();
    setAuth({ status: 'signed-out' });
    setOpen(false);
    router.replace('/');
    router.refresh();
    setSigningOut(false);
  }

  return <>
    <button className="menu-toggle" type="button" aria-label={open ? 'Close menu' : 'Open menu'} aria-expanded={open} aria-controls="primary-navigation" onClick={() => setOpen(current => !current)}>
      <span /><span /><span />
    </button>
    <nav id="primary-navigation" className={open ? 'nav nav-open' : 'nav'} aria-label="Primary">
      {links.map(([href, label]) => (
        <Link key={href} className="nav-link" href={href} aria-current={pathname.startsWith(href) ? 'page' : undefined}>
          {label}
        </Link>
      ))}

      {auth.status === 'signed-out' && (
        <Link className="nav-link nav-auth" href="/signin" aria-current={pathname.startsWith('/auth') || pathname.startsWith('/signin') ? 'page' : undefined}>
          Sign in
        </Link>
      )}

      {auth.status === 'profile-missing' && (
        <>
          <Link className="nav-link nav-profile" href="/complete-profile" aria-current={pathname.startsWith('/complete-profile') ? 'page' : undefined}>
            Complete profile
          </Link>
          <button className="nav-link nav-auth nav-button" type="button" onClick={signOut} disabled={signingOut}>
            {signingOut ? 'Signing out…' : 'Sign out'}
          </button>
        </>
      )}

      {auth.status === 'handle-choice-required' && (
        <>
          <Link className="nav-link nav-profile" href="/complete-profile" aria-current={pathname.startsWith('/complete-profile') ? 'page' : undefined}>
            {auth.avatarUrl ? <img className="nav-avatar" src={auth.avatarUrl} alt="" /> : null}
            <span>@{auth.handle} · Choose handle</span>
          </Link>
          <button className="nav-link nav-auth nav-button" type="button" onClick={signOut} disabled={signingOut}>
            {signingOut ? 'Signing out…' : 'Sign out'}
          </button>
        </>
      )}

      {auth.status === 'signed-in' && (
        <>
          <Link className="nav-link" href="/share" aria-current={pathname.startsWith('/share') ? 'page' : undefined}>
            Share your work
          </Link>
          {auth.canReview ? (
            <Link className="nav-link nav-review" href="/moderation" aria-current={pathname.startsWith('/moderation') ? 'page' : undefined}>
              Moderation
            </Link>
          ) : null}
          <Link
            className="nav-link nav-profile"
            href={`/creator/${auth.handle}`}
            aria-current={pathname.startsWith(`/creator/${auth.handle}`) ? 'page' : undefined}
            aria-label={`View public profile for @${auth.handle}`}
          >
            {auth.avatarUrl ? <img className="nav-avatar" src={auth.avatarUrl} alt="" /> : null}
            <span>@{auth.handle}</span>
          </Link>
          <Link className="nav-link nav-account" href="/account" aria-current={pathname.startsWith('/account') ? 'page' : undefined}>
            Account
          </Link>
          <button className="nav-link nav-auth nav-button" type="button" onClick={signOut} disabled={signingOut}>
            {signingOut ? 'Signing out…' : 'Sign out'}
          </button>
        </>
      )}
    </nav>
  </>;
}
