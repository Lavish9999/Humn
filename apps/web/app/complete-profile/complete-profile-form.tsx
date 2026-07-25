'use client';

import { useState, useTransition, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { completeProfileAction, type CompleteProfileResult } from './actions';

type CompleteProfileFormProps = {
  initialDisplayName: string;
  initialHandle: string;
  notice?: string | undefined;
};

export function CompleteProfileForm({ initialDisplayName, initialHandle, notice }: CompleteProfileFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [displayName, setDisplayName] = useState(initialDisplayName);
  const [handle, setHandle] = useState(initialHandle.toLowerCase());
  const [result, setResult] = useState<CompleteProfileResult>({ ok: false });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    startTransition(async () => {
      const next = await completeProfileAction(formData);
      setResult(next);
      if (next.ok) {
        router.replace('/discover');
        router.refresh();
      }
    });
  }

  return (
    <form className="form" onSubmit={submit} noValidate>
      {notice ? <p role="status">{notice}</p> : null}
      {result.formError ? <p className="notice" role="alert">{result.formError}</p> : null}
      <label className="field">
        <span className="field-label">Display name</span>
        <input
          name="displayName"
          autoComplete="name"
          value={displayName}
          onChange={(event) => setDisplayName(event.target.value)}
          aria-invalid={Boolean(result.fieldErrors?.displayName)}
          aria-describedby={result.fieldErrors?.displayName ? 'complete-display-error' : undefined}
          required
        />
        {result.fieldErrors?.displayName ? <span className="field-error" id="complete-display-error">{result.fieldErrors.displayName}</span> : null}
      </label>
      <label className="field">
        <span className="field-label">Username</span>
        <input
          name="handle"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          minLength={3}
          maxLength={30}
          pattern="[a-z0-9_]+"
          value={handle}
          onChange={(event) => setHandle(event.target.value.toLowerCase())}
          aria-invalid={Boolean(result.fieldErrors?.handle)}
          aria-describedby={result.fieldErrors?.handle ? 'complete-handle-help complete-handle-error' : 'complete-handle-help'}
          required
        />
        <span className="field-help" id="complete-handle-help">Lowercase letters, numbers, underscores, 3–30 characters.</span>
        {result.fieldErrors?.handle ? <span className="field-error" id="complete-handle-error">{result.fieldErrors.handle}</span> : null}
      </label>
      <button className="button primary" type="submit" disabled={isPending}>
        {isPending ? 'Saving…' : 'Complete profile'}
      </button>
    </form>
  );
}
