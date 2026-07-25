'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

type ModerationAction = 'approve' | 'reject' | 'remove';

type ModerationResponse = {
  ok?: boolean;
  status?: string;
  error?: string;
};

export function ModerationActionForm({ workId }: { workId: string }) {
  const router = useRouter();
  const [reason, setReason] = useState('');
  const [strikeReason, setStrikeReason] = useState('');
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [message, setMessage] = useState('');

  async function submitAction(action: ModerationAction) {
    const trimmedReason = reason.trim();
    if (trimmedReason.length < 3) {
      setMessage('Enter a review reason of at least 3 characters.');
      return;
    }

    setBusyAction(action);
    setMessage('');

    try {
      const response = await fetch(`/api/moderation/${workId}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action, reason: trimmedReason }),
      });

      const result = (await response.json().catch(() => ({}))) as ModerationResponse;
      if (!response.ok || !result.ok) {
        setMessage(result.error ?? 'The moderation action could not be completed.');
        return;
      }

      setMessage(`WORK ${action.toUpperCase()}D`);
      setReason('');
      router.refresh();
    } catch {
      setMessage('The moderation action could not be completed.');
    } finally {
      setBusyAction(null);
    }
  }

  async function issueStrike() {
    const trimmed = strikeReason.trim();
    if (trimmed.length < 3) {
      setMessage('Describe the clear ownership or proof violation.');
      return;
    }

    setBusyAction('strike');
    setMessage('');
    try {
      const response = await fetch(`/api/moderation/${workId}/strike`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ reason: trimmed }),
      });
      const result = (await response.json().catch(() => ({}))) as ModerationResponse;
      if (!response.ok || !result.ok) {
        setMessage(result.error ?? 'The strike could not be issued.');
        return;
      }
      setStrikeReason('');
      setMessage('STRIKE ISSUED AFTER HUMAN REVIEW');
      router.refresh();
    } catch {
      setMessage('The strike could not be issued.');
    } finally {
      setBusyAction(null);
    }
  }

  const busy = busyAction !== null;

  return (
    <>
      <section className="provenance-block">
        <div className="meta">Work review action</div>
        <div className="form">
          <label className="field">
            <span className="field-label">Reason</span>
            <textarea
              value={reason}
              onChange={event => setReason(event.target.value)}
              rows={5}
              maxLength={1000}
              required
            />
            <span className="field-help">A reason is recorded in the moderation audit log for every Work action.</span>
          </label>

          <div className="creator-proof-actions">
            <button className="button primary" type="button" disabled={busy} onClick={() => submitAction('approve')}>
              {busyAction === 'approve' ? 'APPROVING…' : 'APPROVE'}
            </button>
            <button className="button" type="button" disabled={busy} onClick={() => submitAction('reject')}>
              {busyAction === 'reject' ? 'REJECTING…' : 'REJECT'}
            </button>
            <button className="button danger" type="button" disabled={busy} onClick={() => submitAction('remove')}>
              {busyAction === 'remove' ? 'REMOVING…' : 'REMOVE'}
            </button>
          </div>
        </div>
      </section>

      <section className="provenance-block danger-zone">
        <div className="meta">Accountability action</div>
        <div className="form">
          <p>
            Reports alone never issue a strike. Use this only after human review confirms a faked proof story, plagiarism, or posting another person’s work as one’s own.
          </p>
          <label className="field">
            <span className="field-label">Upheld violation reason</span>
            <textarea
              value={strikeReason}
              onChange={event => setStrikeReason(event.target.value)}
              rows={5}
              maxLength={2000}
              required
            />
          </label>
          <button className="button danger" type="button" disabled={busy} onClick={issueStrike}>
            {busyAction === 'strike' ? 'ISSUING…' : 'ISSUE STRIKE'}
          </button>
        </div>
      </section>

      {message ? <p className="notice" role="status">{message}</p> : null}
    </>
  );
}
