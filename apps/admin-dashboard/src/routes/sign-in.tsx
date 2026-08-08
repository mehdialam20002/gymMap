/**
 * The sign-in form — `SCR-ADM-000`, `FR-AUTH-04`, `Security.md` §1.6.
 *
 * ┌─ THE FORM SAYS BACK EXACTLY WHAT THE SERVER SAID, AND NOTHING MORE ─────────────────────────┐
 * │ The server goes to real trouble to make "no such account" and "wrong password" identical —  │
 * │ same status, same code, same message, and the same Argon2id cost so even the LATENCY        │
 * │ matches (`Security.md` §1.6). A form that helpfully rendered "we don't recognise that       │
 * │ email" would rebuild the enumeration oracle in the last three feet, on the client, for free. │
 * │                                                                                              │
 * │ So the error text here is whatever the envelope carried. This component never decides what   │
 * │ a failure means.                                                                              │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 *
 * The one exception is a lockout, which IS distinguishable by design (`FR-AUTH-08`): a 403
 * `ACCOUNT_LOCKED` tells a member something actionable about their own account, and the server
 * chose to say it. Passing it through unchanged is passing through a deliberate disclosure, not
 * inventing one.
 */

import { useState, type FormEvent } from 'react';

import { t } from '../shared/i18n/index.ts';
import { useSessionController } from '../shared/auth/session.tsx';

export function SignIn() {
  const { signIn } = useSessionController();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (busy) return;

    setBusy(true);
    setError(null);
    // Not cleared on failure. Re-typing a long passphrase after a network blip is the kind of
    // small hostility that teaches people to pick shorter passwords.
    const failure = await signIn(identifier, password);
    setBusy(false);
    if (failure !== null) setError(failure);
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-container items-center px-inset-md">
      <div className="w-full max-w-ui rounded-card border border-subtle bg-surface p-inset-lg">
        <h1 className="text-2xl font-semibold text-content">{t('adm.gate.signIn.title')}</h1>
        <p className="mt-stack-2xs text-base text-content-secondary">{t('adm.gate.signIn.body')}</p>

        <form onSubmit={onSubmit} className="mt-stack-lg flex flex-col gap-stack-sm" noValidate>
          <Field
            id="identifier"
            label={t('adm.signIn.identifier')}
            hint={t('adm.signIn.identifierHint')}
            type="text"
            value={identifier}
            onChange={setIdentifier}
            autoComplete="username"
            autoFocus
          />
          <Field
            id="password"
            label={t('adm.signIn.password')}
            type="password"
            value={password}
            onChange={setPassword}
            autoComplete="current-password"
          />

          {error !== null && (
            // `role="alert"` so a screen reader announces the failure without the operator
            // having to go looking for it (AX2).
            <p
              role="alert"
              className="rounded-control border border-danger bg-surface-danger-subtle px-inset-sm py-inset-xs text-base text-content-danger"
            >
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={busy || identifier === '' || password === ''}
            className="gm-hit-target mt-stack-2xs rounded-control bg-accent-solid px-inset-lg py-inset-sm text-md font-semibold text-content-on-accent disabled:bg-surface-disabled disabled:text-content-disabled"
            data-on-solid="true"
          >
            {busy ? t('adm.signIn.working') : t('adm.gate.signIn.action')}
          </button>
        </form>

        <p className="mt-stack-md text-sm text-content-muted">{t('adm.signIn.mfaNotice')}</p>
      </div>
    </div>
  );
}

function Field({
  id,
  label,
  hint,
  type,
  value,
  onChange,
  autoComplete,
  autoFocus,
}: {
  id: string;
  label: string;
  hint?: string;
  type: 'text' | 'password';
  value: string;
  onChange: (next: string) => void;
  autoComplete: string;
  autoFocus?: boolean;
}) {
  const hintId = `${id}-hint`;

  return (
    <div className="flex flex-col gap-stack-3xs">
      <label htmlFor={id} className="text-base font-medium text-content">
        {label}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        onChange={(event) => {
          onChange(event.target.value);
        }}
        autoComplete={autoComplete}
        // eslint-disable-next-line jsx-a11y/no-autofocus -- one form, one purpose, nothing above it
        autoFocus={autoFocus}
        {...(hint === undefined ? {} : { 'aria-describedby': hintId })}
        className="gm-hit-target rounded-control border border-subtle bg-surface-sunken px-inset-sm py-inset-xs text-base text-content"
      />
      {hint !== undefined && (
        <span id={hintId} className="text-sm text-content-muted">
          {hint}
        </span>
      )}
    </div>
  );
}
