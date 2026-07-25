import { redirect } from 'next/navigation';
import { authMetadataNeedsHandleChoice } from '../../lib/auth/nav-state';
import { getServerSupabase } from '../../lib/supabase/server';
import { CompleteProfileForm } from './complete-profile-form';

export default async function CompleteProfilePage() {
  const supabase = await getServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect('/signin');

  const { data: profile } = await supabase
    .from('users')
    .select('id, handle, display_name')
    .eq('id', user.id)
    .maybeSingle();

  const metadata = user.user_metadata ?? {};
  const needsHandleChoice = authMetadataNeedsHandleChoice(metadata);

  if (profile && !needsHandleChoice) redirect('/discover');

  const initialDisplayName = profile?.display_name
    ? String(profile.display_name)
    : typeof metadata.display_name === 'string'
      ? metadata.display_name
      : user.email?.split('@')[0] ?? '';

  const currentHandle = profile?.handle ? String(profile.handle) : '';
  const requestedHandle = typeof metadata.requested_handle === 'string' ? metadata.requested_handle : '';
  const generatedHandle = currentHandle.startsWith('member_');
  const initialHandle = generatedHandle ? '' : currentHandle || requestedHandle;

  const reason = metadata.handle_choice_reason;
  const notice = reason === 'collision'
    ? `Your requested username was unavailable. We reserved @${currentHandle}; keep it or choose another.`
    : reason === 'generated'
      ? 'Your account is active. Choose the public username Humn should display.'
      : profile
        ? 'Choose the public username Humn should display.'
        : undefined;

  return (
    <main className="shell section page-first-section">
      <div className="section-head">
        <div>
          <p className="eyebrow">Account setup</p>
          <h1>Complete your profile.</h1>
          <p className="section-intro">Your session is active. Choose the public username Humn should display.</p>
        </div>
      </div>
      <div className="auth-form-wrap">
        <CompleteProfileForm
          initialDisplayName={initialDisplayName}
          initialHandle={initialHandle}
          notice={notice}
        />
      </div>
    </main>
  );
}
