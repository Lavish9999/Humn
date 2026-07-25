import Link from 'next/link';
import { notFound } from 'next/navigation';
import { FollowButton, LiveFollowerCount } from '../../../components/follow-button';
import { MasonryFeed } from '../../../components/masonry-feed';
import { getCreatorPublicProfile } from '../../../lib/data/creator-profile';
import { pluralize } from '../../../lib/pluralize';
import { getServerSupabase } from '../../../lib/supabase/server';

function joinDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(date);
}

export default async function CreatorProfilePage({
  params,
}: {
  params: Promise<{ handle: string }>;
}) {
  const { handle } = await params;
  const profile = await getCreatorPublicProfile(handle);
  if (!profile) notFound();

  const supabase = await getServerSupabase();
  const { data: auth } = await supabase.auth.getUser();
  const isOwner = auth.user?.id === profile.id;
  let initialFollowing = false;

  if (auth.user && !isOwner) {
    const { data: follow } = await supabase
      .from('follows')
      .select('creator_id')
      .eq('follower_id', auth.user.id)
      .eq('creator_id', profile.id)
      .maybeSingle();
    initialFollowing = Boolean(follow);
  }

  const reputationLabel = profile.verifiedWorkCount > 0
    ? 'Verified creator'
    : 'Creator';

  return (
    <main className="section creator-profile-page">
      <header className="shell creator-profile-header page-first-section">
        <div className="creator-profile-identity">
          {profile.avatarUrl ? (
            <img className="creator-profile-avatar" src={profile.avatarUrl} alt={`${profile.displayName}'s avatar`} />
          ) : (
            <span className="creator-profile-avatar creator-profile-avatar-fallback" aria-hidden="true">
              {profile.displayName.slice(0, 1).toUpperCase()}
            </span>
          )}
          <div>
            <h1>@{profile.handle}</h1>
            <p className="creator-display-name">{profile.displayName}</p>
            <p className="creator-positive-tier">{reputationLabel}</p>
          </div>
        </div>

        <div className="creator-profile-side">
          <p className="creator-join-date">Joined {joinDate(profile.joinedAt)}</p>
          <div className="creator-profile-actions">
            {isOwner ? (
              <>
                <Link className="button" href="/account#profile">Edit profile</Link>
                <Link className="button" href="/account">Private account</Link>
              </>
            ) : (
              <FollowButton
                creatorId={profile.id}
                handle={profile.handle}
                isSignedIn={Boolean(auth.user)}
                isOwner={false}
                initialFollowing={initialFollowing}
                initialFollowerCount={profile.followerCount}
                nextPath={`/creator/${profile.handle}`}
              />
            )}
          </div>
        </div>

        <div className="creator-stats" aria-label="Creator statistics">
          <span>{pluralize(profile.verifiedWorkCount, 'VERIFIED WORK', 'VERIFIED WORKS')}</span>
          <LiveFollowerCount
            creatorId={profile.id}
            initialCount={profile.followerCount}
            href={`/creator/${profile.handle}/followers`}
          />
          <Link className="creator-stat-link" href={`/creator/${profile.handle}/following`}>
            {pluralize(profile.followingCount, 'FOLLOWING', 'FOLLOWING')}
          </Link>
        </div>

        {isOwner ? (
          <p className="method-hedge creator-profile-owner-note">
            This is the public page other people see. Private account controls remain in Account.
          </p>
        ) : null}
      </header>

      <section className="creator-showcase">
        <div className="shell compact-section-head">
          <div>
            <h2 className="section-title">Public work</h2>
            <p className="section-intro">
              Verified work appears first, followed by review-pending work. Unverified self-declared uploads are not mixed into this showcase.
            </p>
          </div>
        </div>

        {profile.works.length ? (
          <MasonryFeed works={profile.works} />
        ) : (
          <div className="shell creator-profile-empty">
            <p>No verified or review-pending work is public yet.</p>
          </div>
        )}
      </section>
    </main>
  );
}
