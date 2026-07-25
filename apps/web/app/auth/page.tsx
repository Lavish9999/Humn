import Link from 'next/link';
import Image from 'next/image';
import { redirect } from 'next/navigation';
import { oauthAction } from './actions';
import { AuthForm } from './auth-form';
import { getWorkFeed } from '../../lib/data/works';
import { getServerSupabase } from '../../lib/supabase/server';
import { safeInternalRedirect } from '../../lib/auth/redirects';

type AuthSearchParams = Record<string, string | string[] | undefined>;

function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}


export default async function AuthPage({
  searchParams,
}: {
  searchParams: Promise<AuthSearchParams>;
}) {
  const params = await searchParams;
  const signup = firstParam(params.mode) === 'signup';
  const nextPath = safeInternalRedirect(firstParam(params.next));
  const supabase = await getServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();

  if (user) {
    redirect(nextPath);
  }

  const { items: works } = await getWorkFeed({ limit: 4 });

  return (
    <main className="auth-split">
      <section className="auth-form-column">
        <div className="auth-form-wrap">
          <header className="form-header">
            <div className="eyebrow">Account access</div>
            <h2>{signup ? 'Create your account' : 'Welcome back'}</h2>
            <p className="muted">
              {signup
                ? 'Start collecting and publishing human-created work.'
                : 'Continue where you left off.'}
            </p>
          </header>
          <div className="form-body">
            <AuthForm
              signup={signup}
              initialError={firstParam(params.error)}
              initialMessage={firstParam(params.message)}
              redirectTo={nextPath}
            />
            <div className="oauth-grid">
              <form action={oauthAction.bind(null, 'apple', nextPath)}>
                <button className="button">Continue with Apple</button>
              </form>
              <form action={oauthAction.bind(null, 'google', nextPath)}>
                <button className="button">Continue with Google</button>
              </form>
            </div>
            <div className="form-links">
              {!signup && <a href="/auth/reset">Forgot your password?</a>}
              <a href={signup ? `/auth?next=${encodeURIComponent(nextPath)}` : `/auth?mode=signup&next=${encodeURIComponent(nextPath)}`}>
                {signup ? 'Already have an account? Sign in' : 'New here? Create an account'}
              </a>
            </div>
          </div>
        </div>
      </section>
      <aside className="auth-editorial">
        <div className="auth-editorial-head">
          <div className="meta">Recent verified work</div>
          <p>
            Every image remains attached to a creator, an origin declaration, and the evidence
            available at review time.
          </p>
        </div>
        <div className="auth-work-grid">
          {works.map((work) => (
            <figure key={work.id}>
              <div className="auth-work-media">
                <Image
                  src={work.media_url}
                  alt={work.alt_text}
                  width={work.width}
                  height={work.height}
                  unoptimized
                />
              </div>
              <figcaption className="meta"><Link href={`/creator/${work.creator_username}`}>@{work.creator_username}</Link></figcaption>
            </figure>
          ))}
        </div>
      </aside>
    </main>
  );
}

