'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

type Action = 'uphold' | 'deny' | 'overturn';

export function AppealReviewForm({ strikeId, hasPendingAppeal }: { strikeId: string; hasPendingAppeal: boolean }) {
  const router = useRouter();
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState<Action | null>(null);
  const [message, setMessage] = useState('');

  async function act(action: Action) {
    const trimmed = reason.trim();
    if (trimmed.length < 3) {
      setMessage('Enter a resolution reason.');
      return;
    }

    setBusy(action);
    setMessage('');
    try {
      const response = await fetch(`/api/moderation/appeals/${strikeId}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action, reason: trimmed }),
      });
      const result = await response.json().catch(() => ({})) as { ok?: boolean; error?: string };
      if (!response.ok || !result.ok) {
        setMessage(result.error ?? 'The strike action could not be completed.');
        return;
      }
      setReason('');
      setMessage(action === 'deny' ? 'APPEAL DENIED' : 'STRIKE OVERTURNED');
      router.refresh();
    } catch {
      setMessage('The strike action could not be completed.');
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="provenance-block">
      <div className="meta">Human resolution</div>
      <div className="form">
        <label className="field">
          <span className="field-label">Resolution reason</span>
          <textarea value={reason} onChange={event => setReason(event.target.value)} rows={5} maxLength={2000} required />
        </label>
        <div className="creator-proof-actions">
          {hasPendingAppeal ? (
            <>
              <button className="button primary" type="button" disabled={busy !== null} onClick={() => act('uphold')}>
                {busy === 'uphold' ? 'OVERTURNING…' : 'UPHOLD APPEAL'}
              </button>
              <button className="button" type="button" disabled={busy !== null} onClick={() => act('deny')}>
                {busy === 'deny' ? 'DENYING…' : 'DENY APPEAL'}
              </button>
            </>
          ) : (
            <button className="button danger" type="button" disabled={busy !== null} onClick={() => act('overturn')}>
              {busy === 'overturn' ? 'OVERTURNING…' : 'MANUALLY OVERTURN STRIKE'}
            </button>
          )}
        </div>
        {message ? <p className="notice" role="status">{message}</p> : null}
      </div>
    </section>
  );
}
