'use client';

import { useState, useTransition, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { updateProfileDisplayName, type UpdateProfileResult } from './profile-actions';

export function ProfileForm({
  handle,
  initialDisplayName,
}: {
  handle: string;
  initialDisplayName: string;
}) {
  const router = useRouter();
  const [displayName, setDisplayName] = useState(initialDisplayName);
  const [result, setResult] = useState<UpdateProfileResult>({ ok: false });
  const [pending, startTransition] = useTransition();

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    startTransition(async () => {
      const next = await updateProfileDisplayName(displayName);
      setResult(next);
      if (next.ok) router.refresh();
    });
  }

  return (
    <form className="settings-panel profile-edit-panel" onSubmit={submit} noValidate>
      <div className="meta">Public profile details</div>
      <h3>Edit what others see.</h3>
      <label className="field">
        <span className="field-label">Display name</span>
        <input
          value={displayName}
          onChange={event => setDisplayName(event.target.value)}
          minLength={2}
          maxLength={80}
          aria-invalid={Boolean(result.fieldError)}
          required
        />
        {result.fieldError ? <span className="field-error">{result.fieldError}</span> : null}
      </label>
      <label className="field">
        <span className="field-label">Username</span>
        <input value={handle} readOnly aria-readonly="true" />
        <span className="field-help">Usernames are protected after account creation.</span>
      </label>
      {result.formError ? <p className="field-error" role="alert">{result.formError}</p> : null}
      {result.ok ? <p className="meta" role="status">PROFILE UPDATED</p> : null}
      <button className="button primary" type="submit" disabled={pending}>
        {pending ? 'Saving…' : 'Save profile'}
      </button>
    </form>
  );
}
