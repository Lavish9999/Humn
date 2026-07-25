'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

type Errors = Partial<Record<'title' | 'body' | 'captured_at' | 'file', string>>;

export function ProofForm({ workId }: { workId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const [message, setMessage] = useState('');

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
    const requestVerification = submitter?.value === 'request';
    const form = new FormData(event.currentTarget);
    form.set('request_verification', String(requestVerification));
    setBusy(true);
    setErrors({});
    setMessage('');
    try {
      const response = await fetch(`/api/works/${workId}/proofs`, { method: 'POST', body: form });
      const result = await response.json() as { ok?: boolean; fieldErrors?: Errors; error?: string; redirectTo?: string; proofAdded?: boolean };
      if (result.redirectTo) { router.push(result.redirectTo); return; }
      if (!response.ok || !result.ok) {
        setErrors(result.fieldErrors ?? {});
        setMessage(result.error ?? (result.proofAdded ? 'Proof added, but verification could not be requested.' : 'Proof entry could not be added.'));
        return;
      }
      router.push(`/work/${workId}`);
      router.refresh();
    } catch {
      setMessage('The proof entry could not be submitted.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="form" onSubmit={submit} noValidate>
      <label className="field">
        <span className="field-label">Stage title</span>
        <input name="title" maxLength={120} required aria-invalid={Boolean(errors.title)} />
        {errors.title ? <span className="field-error">{errors.title}</span> : null}
      </label>
      <label className="field">
        <span className="field-label">What changed at this stage?</span>
        <textarea name="body" rows={5} maxLength={1000} required aria-invalid={Boolean(errors.body)} />
        {errors.body ? <span className="field-error">{errors.body}</span> : null}
      </label>
      <label className="field">
        <span className="field-label">Captured at</span>
        <input name="captured_at" type="datetime-local" aria-invalid={Boolean(errors.captured_at)} />
        <span className="field-help">Leave blank to record the current time.</span>
        {errors.captured_at ? <span className="field-error">{errors.captured_at}</span> : null}
      </label>
      <label className="field">
        <span className="field-label">Optional stage image</span>
        <input name="file" type="file" accept="image/jpeg,image/png,image/webp" aria-invalid={Boolean(errors.file)} />
        <span className="field-help">Use a real image of this stage. Humn never reuses the finished hero crop.</span>
        {errors.file ? <span className="field-error">{errors.file}</span> : null}
      </label>
      <div className="work-actions">
        <button className="button secondary" type="submit" value="add" disabled={busy}>ADD PROOF ENTRY</button>
        <button className="button primary" type="submit" value="request" disabled={busy}>ADD & REQUEST VERIFICATION</button>
      </div>
      {message ? <p className="notice" role="alert">{message}</p> : null}
    </form>
  );
}
