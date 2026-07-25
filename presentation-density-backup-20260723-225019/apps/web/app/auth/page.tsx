import { oauthAction, signInAction, signUpAction } from './actions';

export default async function AuthPage({ searchParams }: { searchParams: Promise<Record<string,string|undefined>> }) {
  const params = await searchParams; const signup = params.mode === 'signup';
  return <main className="shell"><section className="form-card">
    <header className="form-header"><div className="eyebrow">Account access</div><h3>{signup ? 'Create your account' : 'Welcome back'}</h3><p className="muted">{signup ? 'Start collecting and publishing human-created work.' : 'Continue where you left off.'}</p>{params.error && <p className="notice" role="alert">{params.error}</p>}{params.message && <p>{params.message}</p>}</header>
    <div className="form-body"><form className="form" action={signup ? signUpAction : signInAction}>
      {signup && <><label className="field"><span className="field-label">Display name</span><input name="displayName" autoComplete="name" required /></label><label className="field"><span className="field-label">Username</span><input name="username" autoCapitalize="none" required /></label></>}
      <label className="field"><span className="field-label">Email</span><input type="email" name="email" autoComplete="email" required /></label>
      <label className="field"><span className="field-label">Password</span><input type="password" name="password" autoComplete={signup?'new-password':'current-password'} required minLength={signup?10:1}/></label>
      <button className="button primary" type="submit">{signup?'Create account':'Sign in'}</button>
    </form>
    <div className="actions"><form action={oauthAction.bind(null,'apple')}><button className="button">Continue with Apple</button></form><form action={oauthAction.bind(null,'google')}><button className="button">Continue with Google</button></form></div>
    <div className="form-links">{!signup && <a href="/auth/reset">Forgot your password?</a>}<a href={signup?'/auth':'/auth?mode=signup'}>{signup?'Already have an account? Sign in':'New here? Create an account'}</a></div></div>
  </section></main>;
}
