'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import {
  updateRecoveredPassword,
  type UpdatePasswordState,
} from './actions';

const INITIAL_STATE: UpdatePasswordState = {};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button className="button primary" type="submit" disabled={pending}>
      {pending ? 'Updating…' : 'Update password'}
    </button>
  );
}

export function UpdatePasswordForm() {
  const [state, formAction] = useActionState(updateRecoveredPassword, INITIAL_STATE);

  return (
    <main className="shell">
      <section className="form-card">
        <header className="form-header">
          <div className="eyebrow">Account recovery</div>
          <h3>Choose a new password</h3>
        </header>
        <div className="form-body">
          <form className="form" action={formAction}>
            <label className="field">
              <span className="field-label">New password</span>
              <input name="password" type="password" minLength={10} required />
            </label>
            {state.error && (
              <p className="notice danger" role="alert">
                {state.error}
              </p>
            )}
            <SubmitButton />
          </form>
        </div>
      </section>
    </main>
  );
}
