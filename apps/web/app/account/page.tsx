import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getMyStrikeOverview, type StrikeRecord } from '../../lib/data/strikes';
import { getMyUnverifiedWorks } from '../../lib/data/works';
import { pluralize } from '../../lib/pluralize';
import { getServerSupabase } from '../../lib/supabase/server';
import { SettingsClient } from '../settings/settings-client';
import { ProfileForm } from './profile-form';
import { StrikeAppealForm } from './strike-appeal-form';

function formatDate(value: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

function sourceLabel(source: StrikeRecord['source']) {
  return source === 'c2pa_ai'
    ? 'FILE CREDENTIAL · AI ORIGIN'
    : 'HUMAN REVIEW · UPHELD VIOLATION';
}

function calmStatusLabel(value: string | null | undefined) {
  const normalized = (value ?? 'No active restriction').toLocaleLowerCase();
  return normalized.charAt(0).toLocaleUpperCase() + normalized.slice(1);
}

export default async function AccountPage() {
  const supabase = await getServerSupabase();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect('/signin?next=/account');

  const [profileResult, settingsResult, overview, unverifiedWorks] = await Promise.all([
    supabase
      .from('users')
      .select('handle,display_name,avatar_url,reputation')
      .eq('id', auth.user.id)
      .maybeSingle(),
    supabase
      .from('user_settings')
      .select('*')
      .eq('user_id', auth.user.id)
      .maybeSingle(),
    getMyStrikeOverview(),
    getMyUnverifiedWorks(24),
  ]);

  const profile = profileResult.data;
  if (!profile) redirect('/complete-profile');

  const initialSettings = settingsResult.data ?? {
    strict_human_only: false,
    include_awaiting_verification: true,
    hide_commercial: false,
    show_local: false,
  };
  const state = overview.state;

  return (
    <main className="shell section account-page">
      <header className="page-intro page-first-section account-intro">
        <div className="page-label">Private account</div>
        <h1>Account and standing.</h1>
        <p>
          This page is visible only to you. Your public creator page never exposes strikes, appeals, cooldowns, suspension, or private settings.
        </p>
        <div className="actions account-destination-links">
          <Link className="button" href={`/creator/${profile.handle}`}>View my public profile</Link>
          <Link className="button" href="/collections">Manage collections</Link>
          <Link className="button" href="/share">Share your work</Link>
        </div>
      </header>

      <section className="section account-standing-section">
        <div className="section-head compact-section-head">
          <div>
            <div className="section-label">Private accountability</div>
            <h2 className="section-title">Standing and appeals</h2>
          </div>
        </div>

        <div className="settings-grid">
          <section className="settings-panel settings-primary">
            <div className="panel-label">Current standing</div>
            <h3 className="status-title">{calmStatusLabel(state?.status_label)}</h3>
            <dl className="meta-list">
              <dt>Active strikes</dt><dd>{state?.active_count ?? 0}</dd>
              <dt>Posting</dt><dd>{state?.can_post ? 'AVAILABLE' : 'RESTRICTED'}</dd>
              <dt>Cooldown until</dt><dd>{formatDate(state?.posting_cooldown_until ?? null)}</dd>
              <dt>Suspended at</dt><dd>{formatDate(state?.suspended_at ?? null)}</dd>
              <dt>Reputation</dt><dd>{profile.reputation ?? 0}</dd>
            </dl>
            <p className="method-hedge">
              Missing provenance never creates a strike. Only explicit AI-origin Content Credentials or a human-upheld ownership or proof violation can do so.
            </p>
          </section>

          <section className="settings-panel">
            <div className="panel-label">Graduated response</div>
            <div className="panel-row"><strong>1</strong><span>Educational warning. The upload is blocked; posting remains available.</span></div>
            <div className="panel-row"><strong>2</strong><span>Formal warning and a seven-day posting cooldown. Browsing remains available.</span></div>
            <div className="panel-row"><strong>3</strong><span>Posting suspension pending appeal. Every strike remains reviewable by a human.</span></div>
          </section>

          <section className="settings-panel">
            <div className="panel-label">Public identity</div>
            <h3 className="panel-title"><Link href={`/creator/${profile.handle}`}>@{profile.handle}</Link></h3>
            <p className="muted">{profile.display_name}</p>
            <Link className="button" href={`/creator/${profile.handle}`}>See what others see</Link>
          </section>

          {unverifiedWorks.length ? (
            <section className="settings-panel unverified-account-panel">
              <div className="panel-label">Works outside default Discover</div>
              <h3 className="status-title">
                {unverifiedWorks.length} {unverifiedWorks.length === 1 ? 'Work needs' : 'Works need'} provenance
              </h3>
              <p>
                These Works are self-declared and have no strong provenance or completed review. This is neutral—not an accusation. Add real process evidence, then request review to move a Work into AWAITING REVIEW.
              </p>
              <div className="unverified-work-list">
                {unverifiedWorks.map(work => (
                  <article className="panel-row" key={work.id}>
                    <div>
                      <strong>{work.title}</strong>
                      <span className="meta">{pluralize(work.proof_count, 'PROOF', 'PROOFS')} ATTACHED</span>
                    </div>
                    <Link className="text-link" href={`/work/${work.id}/proofs`}>Add proof story</Link>
                  </article>
                ))}
              </div>
            </section>
          ) : (
            <section className="settings-panel unverified-account-panel">
              <div className="panel-label">Works outside default Discover</div>
              <h3 className="status-title">No unverified Works need attention</h3>
              <p className="muted">Any self-declared Work that needs process evidence will appear here privately.</p>
            </section>
          )}
        </div>
      </section>

      <section className="section account-history-section">
        <div className="section-head compact-section-head">
          <div>
            <div className="section-label">Private history</div>
            <h2 className="section-title">Strikes and appeals</h2>
          </div>
        </div>

        <div className="moderation-list">
          {overview.strikes.length ? overview.strikes.map(strike => {
            const active = new Date(strike.expires_at).getTime() > Date.now()
              && strike.appeal_status !== 'upheld';
            return (
              <article className="moderation-row" key={strike.id}>
                <div className="meta">{active ? 'ACTIVE' : 'INACTIVE'}</div>
                <div>
                  <div className="meta">{sourceLabel(strike.source)}</div>
                  <h3 className="record-title">{strike.reason}</h3>
                  <p>Issued {formatDate(strike.created_at)} · Expires {formatDate(strike.expires_at)}</p>
                  <p className="meta">APPEAL: {strike.appeal_status.toUpperCase()}</p>
                  {strike.appeal_resolution_reason ? <p>{strike.appeal_resolution_reason}</p> : null}
                  {strike.appeal_status === 'none' && active
                    ? <StrikeAppealForm strikeId={strike.id} />
                    : null}
                </div>
              </article>
            );
          }) : <p className="meta account-empty-history">NO STRIKES ON THIS ACCOUNT</p>}
        </div>
      </section>

      <section className="section account-settings-section" id="profile">
        <div className="section-head compact-section-head">
          <div>
            <div className="section-label">Profile and settings</div>
            <h2 className="section-title">Manage your account</h2>
            <p className="section-intro">Edit your public display name, manage feed preferences, export data, or delete the account.</p>
          </div>
        </div>
        <div className="account-profile-settings">
          <ProfileForm handle={String(profile.handle)} initialDisplayName={String(profile.display_name)} />
          <div id="settings">
            <SettingsClient userId={auth.user.id} initialSettings={initialSettings} />
          </div>
        </div>
      </section>
    </main>
  );
}
