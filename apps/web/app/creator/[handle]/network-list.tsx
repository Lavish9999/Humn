import Link from 'next/link';
import { notFound } from 'next/navigation';
import { FollowButton } from '../../../components/follow-button';
import { getCreatorPublicProfile } from '../../../lib/data/creator-profile';
import { getCreatorNetwork, type CreatorNetworkDirection } from '../../../lib/data/follows';
import { pluralize } from '../../../lib/pluralize';
import { getServerSupabase } from '../../../lib/supabase/server';

export async function CreatorNetworkList({
  handle,
  direction,
  page,
}: {
  handle: string;
  direction: CreatorNetworkDirection;
  page: number;
}) {
  const profile = await getCreatorPublicProfile(handle);
  if (!profile) notFound();

  const [network, supabase] = await Promise.all([
    getCreatorNetwork(profile.handle, direction, page, 24),
    getServerSupabase(),
  ]);
  const { data: auth } = await supabase.auth.getUser();
  const title = direction === 'followers' ? 'Followers' : 'Following';

  return (
    <main className="section creator-network-page">
      <header className="shell section-head page-first-section creator-network-head">
        <div>
          <Link className="text-link" href={`/creator/${profile.handle}`}>← @{profile.handle}</Link>
          <h1>{title}</h1>
          <p className="section-intro">
            {direction === 'followers'
              ? `People following @${profile.handle}.`
              : `Creators @${profile.handle} follows.`}
          </p>
        </div>
        <span className="meta">{pluralize(network.totalCount, direction === 'followers' ? 'FOLLOWER' : 'CREATOR')}</span>
      </header>

      <section className="shell creator-network-list" aria-label={`${title} list`}>
        {network.members.length ? network.members.map(member => {
          const isOwner = auth.user?.id === member.id;
          return (
            <article className="creator-network-row" key={member.id}>
              <Link className="creator-network-identity" href={`/creator/${member.handle}`}>
                {member.avatarUrl ? (
                  <img className="creator-network-avatar" src={member.avatarUrl} alt="" />
                ) : (
                  <span className="creator-network-avatar creator-profile-avatar-fallback" aria-hidden="true">
                    {member.displayName.slice(0, 1).toUpperCase()}
                  </span>
                )}
                <span>
                  <strong>@{member.handle}</strong>
                  <small>{member.displayName}</small>
                </span>
              </Link>
              <div className="creator-network-meta">
                <span className="meta">{pluralize(member.verifiedWorkCount, 'VERIFIED WORK', 'VERIFIED WORKS')}</span>
                <span className="meta">{pluralize(member.followerCount, 'FOLLOWER', 'FOLLOWERS')}</span>
              </div>
              <FollowButton
                creatorId={member.id}
                handle={member.handle}
                isSignedIn={Boolean(auth.user)}
                isOwner={isOwner}
                initialFollowing={member.isFollowedByViewer}
                initialFollowerCount={member.followerCount}
                compact
                nextPath={`/creator/${profile.handle}/${direction}?page=${network.page}`}
              />
            </article>
          );
        }) : (
          <div className="creator-network-empty">
            <p>{direction === 'followers' ? 'No followers yet.' : 'No creators followed yet.'}</p>
          </div>
        )}
      </section>

      {(network.hasPrevious || network.hasNext) ? (
        <nav className="shell pagination" aria-label={`${title} pagination`}>
          {network.hasPrevious ? <Link className="button" href={`?page=${network.page - 1}`}>Previous</Link> : <span />}
          <span className="meta">PAGE {network.page}</span>
          {network.hasNext ? <Link className="button" href={`?page=${network.page + 1}`}>Next</Link> : <span />}
        </nav>
      ) : null}
    </main>
  );
}
