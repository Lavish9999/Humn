'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

export function CreatorProfileActions({
  creatorId,
  handle,
  isSignedIn,
  isOwner,
  initialFollowing,
}: {
  creatorId: string;
  handle: string;
  isSignedIn: boolean;
  isOwner: boolean;
  initialFollowing: boolean;
}) {
  const router = useRouter();
  const [following, setFollowing] = useState(initialFollowing);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  if (isOwner) {
    return (
      <div className="actions creator-profile-actions">
        <Link className="button" href="/account#profile">Edit profile</Link>
        <Link className="button" href="/account">Private account</Link>
      </div>
    );
  }

  async function toggleFollow() {
    if (!isSignedIn) {
      router.push(`/signin?next=${encodeURIComponent(`/creator/${handle}`)}`);
      return;
    }
    if (busy) return;

    setBusy(true);
    setMessage('');
    const response = await fetch('/api/follows', {
      method: following ? 'DELETE' : 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ creatorId }),
    });
    const payload = await response.json().catch(() => ({})) as {
      following?: boolean;
      error?: string;
    };
    setBusy(false);

    if (!response.ok) {
      if (response.status === 401) {
        router.push(`/signin?next=${encodeURIComponent(`/creator/${handle}`)}`);
        return;
      }
      setMessage(payload.error ?? 'Follow could not be updated.');
      return;
    }

    setFollowing(Boolean(payload.following));
    setMessage(payload.following ? `Following @${handle}.` : `No longer following @${handle}.`);
  }

  return (
    <div className="creator-profile-actions">
      <button
        className="button"
        type="button"
        aria-pressed={following}
        onClick={toggleFollow}
        disabled={busy}
      >
        {busy ? 'Updating…' : following ? 'Following' : 'Follow'}
      </button>
      {message ? <span className="meta" role="status">{message}</span> : null}
    </div>
  );
}
