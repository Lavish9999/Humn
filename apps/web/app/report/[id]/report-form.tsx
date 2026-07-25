'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function ReportForm({ workId }: { workId: string }) {
  const router = useRouter();
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage('');
    const response = await fetch('/api/reports', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ workId, reason }),
    });
    const result = await response.json() as { ok?: boolean; error?: string; redirectTo?: string };
    setBusy(false);
    if (result.redirectTo) { router.push(result.redirectTo); return; }
    if (!response.ok || !result.ok) { setMessage(result.error ?? 'Report could not be submitted.'); return; }
    setMessage('REPORT RECORDED');
  }

  return (
    <form className="form" onSubmit={submit}>
      <label className="field">
        <span className="field-label">Reason</span>
        <textarea value={reason} onChange={event => setReason(event.target.value)} rows={6} maxLength={1000} required />
        <span className="field-help">Describe the specific concern. Reports are reviewed as provenance concerns, not detector verdicts.</span>
      </label>
      <button className="button danger" type="submit" disabled={busy}>{busy ? 'SUBMITTING…' : 'SUBMIT REPORT'}</button>
      {message ? <p className="notice" role="status">{message}</p> : null}
    </form>
  );
}
