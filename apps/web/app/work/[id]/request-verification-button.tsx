'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function RequestVerificationButton({ workId }: { workId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  async function requestReview() {
    setBusy(true);
    setMessage('');
    const response = await fetch(`/api/works/${workId}/request-verification`, { method: 'POST' });
    const result = await response.json() as { ok?: boolean; error?: string; redirectTo?: string };
    setBusy(false);
    if (result.redirectTo) { router.push(result.redirectTo); return; }
    if (!response.ok || !result.ok) { setMessage(result.error ?? 'Review could not be requested.'); return; }
    setMessage('VERIFICATION REQUESTED');
    router.refresh();
  }

  return (
    <div className="inline-action-status">
      <button className="button secondary" type="button" onClick={requestReview} disabled={busy}>
        {busy ? 'REQUESTING…' : 'REQUEST VERIFICATION'}
      </button>
      {message ? <span className="meta">{message}</span> : null}
    </div>
  );
}
