import { oauthAction, signInAction, signUpAction } from './actions';

export default async function AuthPage({ searchParams }: { searchParams: Promise<Record<string,string|undefined>> }) {
  const params = await searchParams; const signup = params.mode === 'signup';
  return <main className="shell"><section className="form-card">
    <h2>{signup ? 'Create your account' : 'Welcome back'}</h2>
    <p style={{color:'var(--muted)'}}>{signup ? 'Start collecting and publishing human-created work.' : 'Continue where you left off.'}</p>
    {params.error && <p className="notice" role="alert">{params.error}</p>}{params.message && <p>{params.message}</p>}
    <form className="form" action={signup ? signUpAction : signInAction}>
      {signup && <><label className="field">Display name<input name="displayName" autoComplete="name" required /></label><label className="field">Username<input name="username" autoCapitalize="none" required /></label></>}
      <label className="field">Email<input type="email" name="email" autoComplete="email" required /></label>
      <label className="field">Password<input type="password" name="password" autoComplete={signup?'new-password':'current-password'} required minLength={signup?10:1}/></label>
      <button className="button" type="submit">{signup?'Create account':'Sign in'}</button>
    </form>
    <div className="actions"><form action={oauthAction.bind(null,'apple')}><button className="button secondary">Continue with Apple</button></form><form action={oauthAction.bind(null,'google')}><button className="button secondary">Continue with Google</button></form></div>
    {!signup && <p><a href="/auth/reset">Forgot your password?</a></p>}<p><a href={signup?'/auth':'/auth?mode=signup'}>{signup?'Already have an account? Sign in':'New here? Create an account'}</a></p>
  </section></main>;
}
