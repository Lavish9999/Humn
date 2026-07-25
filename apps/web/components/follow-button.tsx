'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

type FollowChangeDetail = {
  creatorId: string;
  following: boolean;
  followerCount: number | null;
};

const FOLLOW_EVENT = 'humn:follow-change';

export function FollowButton({
  creatorId,
  handle,
  isSignedIn,
  isOwner,
  initialFollowing,
  initialFollowerCount = null,
  compact = false,
  nextPath,
}: {
  creatorId: string;
  handle: string;
  isSignedIn: boolean;
  isOwner: boolean;
  initialFollowing: boolean;
  initialFollowerCount?: number | null;
  compact?: boolean;
  nextPath?: string;
}) {
  const router = useRouter();
  const [following, setFollowing] = useState(initialFollowing);
  const [followerCount, setFollowerCount] = useState<number | null>(initialFollowerCount);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    function onFollowChange(event: Event) {
      const detail = (event as CustomEvent<FollowChangeDetail>).detail;
      if (!detail || detail.creatorId !== creatorId) return;
      setFollowing(detail.following);
      if (detail.followerCount !== null) setFollowerCount(detail.followerCount);
    }
    window.addEventListener(FOLLOW_EVENT, onFollowChange);
    return () => window.removeEventListener(FOLLOW_EVENT, onFollowChange);
  }, [creatorId]);

  if (isOwner) return null;

  async function toggleFollow() {
    if (!isSignedIn) {
      const destination = nextPath ?? `/creator/${handle}`;
      router.push(`/signin?next=${encodeURIComponent(destination)}`);
      return;
    }
    if (busy) return;

    const previousFollowing = following;
    const previousCount = followerCount;
    const optimisticFollowing = !previousFollowing;
    const optimisticCount = previousCount === null
      ? null
      : Math.max(0, previousCount + (optimisticFollowing ? 1 : -1));

    setFollowing(optimisticFollowing);
    setFollowerCount(optimisticCount);
    setBusy(true);
    setMessage('');
    window.dispatchEvent(new CustomEvent<FollowChangeDetail>(FOLLOW_EVENT, {
      detail: { creatorId, following: optimisticFollowing, followerCount: optimisticCount },
    }));

    const response = await fetch('/api/follows', {
      method: optimisticFollowing ? 'POST' : 'DELETE',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ creatorId, handle }),
    });
    const payload = await response.json().catch(() => ({})) as {
      following?: boolean;
      followerCount?: number;
      error?: string;
    };
    setBusy(false);

    if (!response.ok) {
      setFollowing(previousFollowing);
      setFollowerCount(previousCount);
      window.dispatchEvent(new CustomEvent<FollowChangeDetail>(FOLLOW_EVENT, {
        detail: { creatorId, following: previousFollowing, followerCount: previousCount },
      }));
      if (response.status === 401) {
        const destination = nextPath ?? `/creator/${handle}`;
        router.push(`/signin?next=${encodeURIComponent(destination)}`);
        return;
      }
      setMessage(payload.error ?? 'Follow could not be updated.');
      return;
    }

    const confirmedFollowing = Boolean(payload.following);
    const confirmedCount = typeof payload.followerCount === 'number' && Number.isFinite(payload.followerCount)
      ? payload.followerCount
      : optimisticCount;
    setFollowing(confirmedFollowing);
    setFollowerCount(confirmedCount);
    window.dispatchEvent(new CustomEvent<FollowChangeDetail>(FOLLOW_EVENT, {
      detail: { creatorId, following: confirmedFollowing, followerCount: confirmedCount },
    }));
    setMessage(confirmedFollowing ? `Following @${handle}.` : `No longer following @${handle}.`);
  }

  return (
    <span className={compact ? 'follow-control follow-control-compact' : 'follow-control'}>
      <button
        className={compact ? 'button follow-button follow-button-compact' : 'button follow-button'}
        type="button"
        aria-pressed={following}
        onClick={toggleFollow}
        disabled={busy}
      >
        {busy ? 'Updating…' : following ? 'Following' : 'Follow'}
      </button>
      {message && !compact ? <span className="follow-message" role="status">{message}</span> : null}
    </span>
  );
}

export function LiveFollowerCount({
  creatorId,
  initialCount,
  href,
}: {
  creatorId: string;
  initialCount: number;
  href: string;
}) {
  const [count, setCount] = useState(initialCount);

  useEffect(() => {
    function onFollowChange(event: Event) {
      const detail = (event as CustomEvent<FollowChangeDetail>).detail;
      if (!detail || detail.creatorId !== creatorId || detail.followerCount === null) return;
      setCount(detail.followerCount);
    }
    window.addEventListener(FOLLOW_EVENT, onFollowChange);
    return () => window.removeEventListener(FOLLOW_EVENT, onFollowChange);
  }, [creatorId]);

  return <a className="creator-stat-link" href={href}>{count} {count === 1 ? 'FOLLOWER' : 'FOLLOWERS'}</a>;
}
