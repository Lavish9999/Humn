import { redirect } from 'next/navigation';
import { categoryLabels, productConfig } from '@human/config';
import { getServerSupabase } from '../../lib/supabase/server';
import { ShareWorkForm } from './share-work-form';
import { getMyStrikeOverview } from '../../lib/data/strikes';

export default async function ShareWorkPage() {
  const supabase = await getServerSupabase();
  const { data: authData } = await supabase.auth.getUser();
  if (!authData.user) redirect('/signin?next=%2Fshare');

  const { data: profile } = await supabase
    .from('users')
    .select('id')
    .eq('id', authData.user.id)
    .maybeSingle();
  if (!profile) redirect('/complete-profile');

  const overview = await getMyStrikeOverview();
  const categories = productConfig.launchCategories.map(value => ({
    value,
    label: categoryLabels[value],
  }));

  return (
    <main className="shell report-page">
      <section className="form-card page-first-section share-work-card">
        <header className="form-header">
          <div className="eyebrow">Creator upload</div>
          <h3>Share your work</h3>
          <p className="muted">
            Bare uploads begin as UNVERIFIED · SELF-DECLARED and stay outside default Discover until process evidence or review is added. File metadata and hashes are recorded evidence, not proof of human origin.
          </p>
        </header>
        <div className="form-body">
          {overview.state?.suspended_at ? (
            <div className="form">
              <p className="notice">{overview.state.status_label}</p>
              <p>Posting is suspended. Browsing remains available, and every strike can be appealed from your account page.</p>
              <a className="button" href="/account">VIEW ACCOUNT STANDING</a>
            </div>
          ) : (
            <>
              {overview.state && !overview.state.can_post ? (
                <div className="form">
                  <p className="notice">{overview.state.status_label}</p>
                  <p>New Works cannot be published during the cooldown. Browsing and appeals remain available.</p>
                </div>
              ) : null}
              <ShareWorkForm categories={categories} />
            </>
          )}
        </div>
      </section>
    </main>
  );
}
