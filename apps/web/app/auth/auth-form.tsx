'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { signInSchema, signUpSchema } from '@human/validation';
import {
  signInAction,
  signUpAction,
  type AuthActionResult,
  type AuthField,
} from './actions';

type FormValues = {
  displayName: string;
  username: string;
  email: string;
  password: string;
};

type AuthFormProps = {
  signup: boolean;
  initialError?: string | undefined;
  initialMessage?: string | undefined;
  redirectTo?: string | undefined;
};

const AUTH_REQUEST_TIMEOUT_MS = 15_000;
const AUTH_TIMEOUT_CODE = 'AUTH_REQUEST_TIMEOUT';

function fieldErrorsFromIssues(
  issues: Array<{ path: PropertyKey[]; message: string }>,
): Partial<Record<AuthField, string>> {
  const errors: Partial<Record<AuthField, string>> = {};

  for (const issue of issues) {
    const field = issue.path[0];
    if (
      (field === 'displayName' || field === 'username' || field === 'email' || field === 'password')
      && !errors[field]
    ) {
      errors[field] = issue.message;
    }
  }

  return errors;
}

function withRequestTimeout<T>(request: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timeoutId = window.setTimeout(() => {
      reject(new Error(AUTH_TIMEOUT_CODE));
    }, timeoutMs);

    request.then(
      (value) => {
        window.clearTimeout(timeoutId);
        resolve(value);
      },
      (error: unknown) => {
        window.clearTimeout(timeoutId);
        reject(error);
      },
    );
  });
}

function isTimeoutError(error: unknown): boolean {
  return error instanceof Error && error.message === AUTH_TIMEOUT_CODE;
}

export function AuthForm({
  signup,
  initialError,
  initialMessage,
  redirectTo = '/discover',
}: AuthFormProps) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [values, setValues] = useState<FormValues>({
    displayName: '',
    username: '',
    email: '',
    password: '',
  });
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<AuthField, string>>>({});
  const [formError, setFormError] = useState(initialError ?? '');
  const [message, setMessage] = useState(initialMessage ?? '');

  function setValue(field: keyof FormValues, value: string) {
    const nextValue = field === 'username' ? value.toLowerCase() : value;
    setValues((current) => ({ ...current, [field]: nextValue }));
    setFieldErrors((current) => {
      const next = { ...current };
      delete next[field];
      return next;
    });
    setFormError('');
    setMessage('');
  }

  function applyResult(result: AuthActionResult) {
    setFieldErrors(result.fieldErrors ?? {});
    setFormError(result.formError ?? '');
    setMessage(result.message ?? '');

    if (result.ok) {
      setValues((current) => ({ ...current, password: '' }));
    }

    if (result.redirectTo) {
      router.replace(result.redirectTo);
      router.refresh();
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;

    setFieldErrors({});
    setFormError('');
    setMessage('');

    const input = signup
      ? {
          displayName: values.displayName,
          username: values.username,
          email: values.email,
          password: values.password,
        }
      : {
          email: values.email,
          password: values.password,
        };
    const validation = signup ? signUpSchema.safeParse(input) : signInSchema.safeParse(input);

    if (!validation.success) {
      const nextErrors = fieldErrorsFromIssues(validation.error.issues);
      setFieldErrors(nextErrors);
      console.info(`[auth:${signup ? 'signup' : 'signin'}]`, {
        stage: 'validation',
        fields: Object.keys(nextErrors),
        requestSent: false,
      });
      return;
    }

    const formData = new FormData(event.currentTarget);
    setSubmitting(true);

    try {
      const request = signup ? signUpAction(formData) : signInAction(formData);
      const result = await withRequestTimeout(request, AUTH_REQUEST_TIMEOUT_MS);

      console.info(`[auth:${signup ? 'signup' : 'signin'}]`, {
        stage: result.stage,
        requestSent: result.stage !== 'validation',
      });
      applyResult(result);
    } catch (error) {
      console.error(`[auth:${signup ? 'signup' : 'signin'}]`, {
        stage: 'client-error',
        error,
      });

      setFormError(
        isTimeoutError(error)
          ? 'The sign-in request took too long. Check your connection and try again.'
          : 'We could not reach the sign-in service. Check your connection and try again.',
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      {formError && <p className="notice" role="alert">{formError}</p>}
      {message && <p role="status">{message}</p>}
      <form className="form" onSubmit={submit} noValidate aria-busy={submitting}>
        <input type="hidden" name="next" value={redirectTo} />
        {signup && (
          <>
            <label className="field">
              <span className="field-label">Display name</span>
              <input
                name="displayName"
                autoComplete="name"
                value={values.displayName}
                onChange={(event) => setValue('displayName', event.target.value)}
                aria-invalid={Boolean(fieldErrors.displayName)}
                aria-describedby={fieldErrors.displayName ? 'displayName-error' : undefined}
                required
              />
              {fieldErrors.displayName && (
                <span className="field-error" id="displayName-error">{fieldErrors.displayName}</span>
              )}
            </label>
            <label className="field">
              <span className="field-label">Username</span>
              <input
                name="username"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                value={values.username}
                onChange={(event) => setValue('username', event.target.value)}
                aria-invalid={Boolean(fieldErrors.username)}
                aria-describedby={fieldErrors.username ? 'username-help username-error' : 'username-help'}
                minLength={3}
                maxLength={30}
                pattern="[a-z0-9_]+"
                required
              />
              <span className="field-help" id="username-help">
                Lowercase letters, numbers, underscores, 3–30 characters. Capitals are converted automatically.
              </span>
              {fieldErrors.username && (
                <span className="field-error" id="username-error">{fieldErrors.username}</span>
              )}
            </label>
          </>
        )}
        <label className="field">
          <span className="field-label">Email</span>
          <input
            type="email"
            name="email"
            autoComplete="email"
            value={values.email}
            onChange={(event) => setValue('email', event.target.value)}
            aria-invalid={Boolean(fieldErrors.email)}
            aria-describedby={fieldErrors.email ? 'email-error' : undefined}
            required
          />
          {fieldErrors.email && (
            <span className="field-error" id="email-error">{fieldErrors.email}</span>
          )}
        </label>
        <label className="field">
          <span className="field-label">Password</span>
          <input
            type="password"
            name="password"
            autoComplete={signup ? 'new-password' : 'current-password'}
            value={values.password}
            onChange={(event) => setValue('password', event.target.value)}
            aria-invalid={Boolean(fieldErrors.password)}
            aria-describedby={fieldErrors.password ? 'password-error' : signup ? 'password-help' : undefined}
            minLength={signup ? 10 : 1}
            required
          />
          {signup && <span className="field-help" id="password-help">At least 10 characters.</span>}
          {fieldErrors.password && (
            <span className="field-error" id="password-error">{fieldErrors.password}</span>
          )}
        </label>
        <button className="button primary" type="submit" disabled={submitting}>
          {submitting ? 'Working…' : signup ? 'Create account' : 'Sign in'}
        </button>
      </form>
    </>
  );
}
