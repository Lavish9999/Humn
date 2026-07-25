'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function StrikeAppealForm({ strikeId }: { strikeId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = reason.trim();
    if (trimmed.length < 10) {
      setMessage('Explain the appeal in at least 10 characters.');
      return;
    }

    setBusy(true);
    setMessage('');
    try {
      const response = await fetch(`/api/strikes/${strikeId}/appeal`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ reason: trimmed }),
      });
      const result = await response.json().catch(() => ({})) as { ok?: boolean; error?: string };
      if (!response.ok || !result.ok) {
        setMessage(result.error ?? 'The appeal could not be submitted.');
        return;
      }
      setMessage('APPEAL SUBMITTED FOR HUMAN REVIEW');
      setReason('');
      setOpen(false);
      router.refresh();
    } catch {
      setMessage('The appeal could not be submitted.');
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <div className="form">
        <button className="button" type="button" onClick={() => setOpen(true)}>APPEAL THIS STRIKE</button>
        {message ? <p className="notice" role="status">{message}</p> : null}
      </div>
    );
  }

  return (
    <form className="form" onSubmit={submit}>
      <label className="field">
        <span className="field-label">Appeal reason</span>
        <textarea
          value={reason}
          onChange={event => setReason(event.target.value)}
          rows={5}
          maxLength={2000}
          required
        />
        <span className="field-help">A human reviewer will read this. Explain why the strike should be overturned.</span>
      </label>
      <div className="creator-proof-actions">
        <button className="button primary" type="submit" disabled={busy}>{busy ? 'SUBMITTING…' : 'SUBMIT APPEAL'}</button>
        <button className="button" type="button" onClick={() => setOpen(false)} disabled={busy}>CANCEL</button>
      </div>
      {message ? <p className="notice" role="status">{message}</p> : null}
    </form>
  );
}
