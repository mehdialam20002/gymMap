/**
 * The MFA boundary — `NFR-SEC-11`. `FolderStructure.md` §6: "MFA-gated at the router boundary".
 *
 * ┌─ ONE GATE ABOVE THE WHOLE TREE, NOT A GUARD PER ROUTE ──────────────────────────────────────┐
 * │ Per-route guards fail by omission. The fifteenth admin screen ships without one, nobody      │
 * │ notices, and the hole is invisible precisely because every other screen is guarded. A gate   │
 * │ above the tree cannot be forgotten by adding a route — which is the only failure mode that   │
 * │ actually happens.                                                                             │
 * │                                                                                              │
 * │ `admin-shell.spec.ts` asserts the structural property: no route element is reachable except  │
 * │ through this component.                                                                       │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 *
 * A CLIENT gate. It protects nobody on its own — an operator who edits the store bypasses it in a
 * console. `PermissionsGuard` and the server-side MFA requirement (M-023, M-024) are the controls;
 * this stops an operator being shown a console they cannot use, and puts the boundary in one
 * reviewable place before the identity module lands.
 */

import type { ReactNode } from 'react';

import { t } from '../shared/i18n/index.ts';
import { useSession } from '../shared/auth/session.tsx';

export function MfaGate({ children }: { children: ReactNode }) {
  const session = useSession();

  if (session.status === 'LOADING') {
    return (
      <GatePanel tone="info" title={t('adm.gate.loading')}>
        <span className="gm-visually-hidden">{t('adm.state.loading')}</span>
      </GatePanel>
    );
  }

  if (session.status === 'UNAUTHENTICATED') {
    return (
      <GatePanel tone="info" title={t('adm.gate.signIn.title')}>
        <p className="text-base text-content-secondary">{t('adm.gate.signIn.body')}</p>
        {/* Disabled and SAID SO. A live-looking button that does nothing is worse than an
            honestly disabled one — it teaches the operator the console is broken. */}
        <button
          type="button"
          disabled
          aria-disabled="true"
          className="gm-hit-target mt-stack-md rounded-control bg-surface-disabled px-inset-lg py-inset-sm text-md font-semibold text-content-disabled"
        >
          {t('adm.gate.signIn.action')}
        </button>
        <p className="mt-stack-sm text-sm text-content-muted">{t('adm.gate.signIn.unavailable')}</p>
      </GatePanel>
    );
  }

  if (session.status === 'MFA_REQUIRED') {
    return (
      <GatePanel tone="warning" title={t('adm.gate.mfa.title')}>
        {/* The reason is given, not just the requirement. An operator who understands why a
            control exists is one who does not look for a way around it. */}
        <p className="max-w-ui text-base text-content-warning">{t('adm.gate.mfa.body')}</p>
        <button
          type="button"
          className="gm-hit-target mt-stack-md rounded-control bg-warning-solid px-inset-lg py-inset-sm text-md font-semibold text-content-on-warning"
          data-on-solid="true"
        >
          {t('adm.gate.mfa.action')}
        </button>
      </GatePanel>
    );
  }

  return <>{children}</>;
}

function GatePanel({
  tone,
  title,
  children,
}: {
  tone: 'info' | 'warning';
  title: string;
  children: ReactNode;
}) {
  const surface =
    tone === 'warning'
      ? 'bg-surface-warning-subtle border-warning'
      : 'bg-surface-info-subtle border-info';
  const heading = tone === 'warning' ? 'text-content-warning' : 'text-content-info';

  return (
    <div className="mx-auto flex min-h-screen max-w-container items-center px-inset-md">
      <div className={`w-full max-w-ui rounded-card border p-inset-lg ${surface}`}>
        <h1 className={`text-2xl font-semibold ${heading}`}>{title}</h1>
        <div className="mt-stack-sm">{children}</div>
      </div>
    </div>
  );
}
