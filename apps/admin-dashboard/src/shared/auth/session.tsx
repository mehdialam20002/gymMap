/**
 * The session and the MFA gate — `NFR-SEC-11`, `FolderStructure.md` §6.
 *
 * ┌─ THE MFA GUARD WRAPS THE ENTIRE TREE, NOT INDIVIDUAL ROUTES ────────────────────────────────┐
 * │ §6: "MFA-gated at the router boundary". Per-route guards are the tempting version and they   │
 * │ fail by omission — the fifteenth admin screen ships without one, nobody notices, and the     │
 * │ hole is invisible because every OTHER screen is guarded. A gate above the whole tree cannot  │
 * │ be forgotten by adding a route.                                                              │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 *
 * ┌─ THIS IS A SEAM, NOT AN AUTHORISATION CONTROL ──────────────────────────────────────────────┐
 * │ Every check here is a CLIENT check, and a client check protects nobody: an operator who      │
 * │ edits the store, or who calls the API directly, bypasses all of it in a browser console.     │
 * │ The real controls are `PermissionsGuard` and the MFA requirement on the server (M-023,       │
 * │ M-024), and they must exist independently of this.                                            │
 * │                                                                                              │
 * │ What this buys is that the operator is not shown a screen they cannot use, and that the      │
 * │ shape is right before the real identity module lands — so wiring it up later is a change to  │
 * │ this file rather than to every route.                                                         │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 *
 * The real session arrives with M-019…M-025. Until then `useSession()` reports UNAUTHENTICATED
 * and the gate renders its sign-in prompt — which is honest: there is no auth endpoint yet, and a
 * shell that faked a logged-in state would be demonstrating something that does not exist.
 */

import { createContext, useContext, useMemo, type ReactNode } from 'react';

/**
 * The states an admin session can be in, as a discriminated union rather than three booleans.
 *
 * `isAuthenticated && !mfaSatisfied` and `!isAuthenticated && mfaSatisfied` are both meaningless,
 * and a union makes them unrepresentable instead of merely unlikely.
 */
export type AdminSession =
  | { readonly status: 'LOADING' }
  | { readonly status: 'UNAUTHENTICATED' }
  /** Password accepted, second factor not yet presented. `NFR-SEC-11` stops here. */
  | { readonly status: 'MFA_REQUIRED'; readonly userId: string }
  | {
      readonly status: 'AUTHENTICATED';
      readonly userId: string;
      readonly displayName: string;
      /** `B3.2` permission keys. Empty until M-023 wires the matrix. */
      readonly permissions: readonly string[];
      /**
       * `FR-AUTH-12`, `BR-DAT-02`. Present when this operator is acting AS someone else, and the
       * banner is rendered from the root layout so a page cannot exist without it.
       */
      readonly impersonating?: { readonly subjectId: string; readonly subjectLabel: string };
    };

const SessionContext = createContext<AdminSession>({ status: 'LOADING' });

export function SessionProvider({
  children,
  value,
}: {
  children: ReactNode;
  value?: AdminSession;
}) {
  // Until M-022 there is no token endpoint to call. Reported honestly rather than stubbed to
  // AUTHENTICATED: a shell that fakes a signed-in operator demonstrates a capability that does
  // not exist, and the first real integration then has to un-fake it.
  const session = useMemo<AdminSession>(() => value ?? { status: 'UNAUTHENTICATED' }, [value]);
  return <SessionContext.Provider value={session}>{children}</SessionContext.Provider>;
}

export function useSession(): AdminSession {
  return useContext(SessionContext);
}

/**
 * Client-side permission check. Convenience, never a control.
 *
 * Named `mayAttempt` and not `can` on purpose: the honest reading is "should this button be
 * shown", not "is this allowed". The server decides, every time.
 */
export function mayAttempt(session: AdminSession, permission: string): boolean {
  return session.status === 'AUTHENTICATED' && session.permissions.includes(permission);
}
