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
 * │ shape is right — so wiring the rest up later is a change to this file rather than to every   │
 * │ route.                                                                                        │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 *
 * ┌─ WHAT IS REAL AS OF M-022, AND WHAT IS STILL A SEAM ────────────────────────────────────────┐
 * │ REAL: the credential check, the access token, the httpOnly refresh cookie, silent renewal,  │
 * │       the device list, and revocation. All of it against the running API.                   │
 * │ SEAM: `permissions` is empty until M-023 encodes the B3.2 matrix, and `MFA_REQUIRED` is     │
 * │       never entered because the server has no second factor until M-024. Both are stated    │
 * │       here rather than faked — a stub that reported "MFA satisfied" would be demonstrating  │
 * │       a control that does not exist, which is worse than showing none.                       │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import {
  ApiError,
  login as apiLogin,
  logout as apiLogout,
  getAccessToken,
  onAccessTokenChange,
  refresh,
} from '../api/client.ts';
import { DEMO_OPERATOR, isDemoMode } from '../demo/demo-mode.ts';

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
      /**
       * The operator's platform role, from the token's `roles` claim — `SUPER_ADMIN` → "Super admin".
       *
       * `null` when the claim carries no platform-scoped role, which the shell renders as nothing
       * rather than guessing. The dashboard greeting said "Welcome back, Super Admin" as a hardcoded
       * string, which was a fiction for the five other platform roles that use the same console.
       */
      readonly roleLabel: string | null;
      /** `B3.2` permission keys. Empty until M-023 wires the matrix. */
      readonly permissions: readonly string[];
      /**
       * `FR-AUTH-12`, `BR-DAT-02`. Present when this operator is acting AS someone else, and the
       * banner is rendered from the root layout so a page cannot exist without it.
       */
      readonly impersonating?: { readonly subjectId: string; readonly subjectLabel: string };
    };

export interface SessionController {
  readonly session: AdminSession;
  /** Resolves to `null` on success, or a human-readable reason to show under the form. */
  readonly signIn: (identifier: string, password: string) => Promise<string | null>;
  readonly signOut: () => Promise<void>;
}

const SessionContext = createContext<SessionController>({
  session: { status: 'LOADING' },
  signIn: () => Promise.resolve('No session provider is mounted.'),
  signOut: () => Promise.resolve(),
});

export function SessionProvider({
  children,
  value,
}: {
  children: ReactNode;
  /** Overrides the live session. For tests and stories only. */
  value?: AdminSession;
}) {
  /*
   * ┌─ DEMO MODE STARTS AUTHENTICATED, AND SKIPS THE REFRESH ENTIRELY ─────────────────────────┐
   * │ There is no API, so `refresh()` cannot succeed and the console would sit on the sign-in   │
   * │ form. Starting AUTHENTICATED is the whole point of the mode.                              │
   * │                                                                                          │
   * │ It is NOT a bypass of authentication: `isDemoMode` is a build-time constant, so a bundle  │
   * │ built without `VITE_DEMO_MODE=true` has this branch eliminated and cannot reach it at     │
   * │ runtime by any means — no cookie, no query parameter, no toggle. A deployment either IS a │
   * │ demo or has no demo code in it at all.                                                    │
   * │                                                                                          │
   * │ `MFA_REQUIRED` is skipped for the same reason and with the same caveat: the second factor │
   * │ is real (`NFR-SEC-11`) and the demo cannot present one, so the walkthrough would stop at  │
   * │ a gate that has nothing to show. `DemoNotice` says the session is not real, which is what │
   * │ keeps this honest rather than misleading.                                                  │
   * └──────────────────────────────────────────────────────────────────────────────────────────┘
   */
  const [session, setSession] = useState<AdminSession>(() => {
    if (value !== undefined) return value;
    if (isDemoMode) {
      return {
        status: 'AUTHENTICATED',
        userId: DEMO_OPERATOR.userId,
        displayName: DEMO_OPERATOR.displayName,
        roleLabel: DEMO_OPERATOR.roleLabel,
        // Empty, exactly as a live session's is until `M-023` wires the matrix into the token.
        // Inventing a permission list here would make the console show controls the real one hides.
        permissions: [],
      };
    }
    return { status: 'LOADING' };
  });

  const authenticatedAs = useCallback(
    (userId: string, identifier?: string): AdminSession => ({
      status: 'AUTHENTICATED',
      userId,
      // The identifier the operator TYPED, when we have it — that is what they recognise. After a
      // reload we do not: the email was never persisted (it is PII, and this console keeps the
      // access token out of storage for the same reason), so the uuid from `sub` is all that
      // survives. The shell shortens it rather than printing 36 characters of it.
      displayName: identifier ?? userId,
      roleLabel: roleLabelOf(getAccessToken()),
      permissions: [],
    }),
    [],
  );

  // ── On mount: is there a session already? ──────────────────────────────────────────────────
  //
  // A reload leaves no access token — it lived in memory, deliberately. But the refresh cookie
  // survives, so exactly one refresh attempt decides between "signed in" and "not". Without this,
  // every reload would look like a sign-out and the console would be unusable.
  useEffect(() => {
    if (value !== undefined) return;
    // No API to refresh against, and the session above is already resolved.
    if (isDemoMode) return;

    let cancelled = false;
    void (async () => {
      const restored = await refresh();
      if (cancelled) return;

      if (!restored) {
        setSession({ status: 'UNAUTHENTICATED' });
        return;
      }
      setSession(authenticatedAs(subjectOf(getAccessToken())));
    })();

    return () => {
      cancelled = true;
    };
  }, [value, authenticatedAs]);

  // ── The token can be lost without this component asking ────────────────────────────────────
  //
  // A background query hits a revoked session, the client's retry-refresh fails, and the token is
  // cleared. Without this subscription the console would keep rendering a signed-in shell whose
  // every request 401s — which reads to an operator as "the app is broken", not "you were signed
  // out". `AC-10` makes that a real path: revocation reaches a token mid-session, by design.
  useEffect(() => {
    if (value !== undefined) return;
    return onAccessTokenChange((token) => {
      if (token === null) setSession({ status: 'UNAUTHENTICATED' });
    });
  }, [value]);

  const signIn = useCallback(
    async (identifier: string, password: string): Promise<string | null> => {
      try {
        const result = await apiLogin(identifier, password);
        setSession(authenticatedAs(result.user_id, identifier));
        return null;
      } catch (error) {
        setSession({ status: 'UNAUTHENTICATED' });
        return messageFor(error);
      }
    },
    [authenticatedAs],
  );

  const signOut = useCallback(async () => {
    await apiLogout();
    setSession({ status: 'UNAUTHENTICATED' });
  }, []);

  const controller = useMemo<SessionController>(
    () => ({ session: value ?? session, signIn, signOut }),
    [value, session, signIn, signOut],
  );

  return <SessionContext.Provider value={controller}>{children}</SessionContext.Provider>;
}

export function useSession(): AdminSession {
  return useContext(SessionContext).session;
}

export function useSessionController(): SessionController {
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

// ---------------------------------------------------------------------------
// Helpers.
// ---------------------------------------------------------------------------

/**
 * Reads `sub` out of the access token's payload — WITHOUT verifying it.
 *
 * That is not a lapse, it is the only correct posture for a browser. The client cannot hold the
 * signing key, so it cannot verify anything; a client-side "verification" would only ever confirm
 * what an attacker who forged the token already chose. The server verifies every request, and
 * this value is used for one thing: deciding which name to put in the corner.
 */
/**
 * The platform roles this console serves, most privileged first, with the wording an operator reads.
 *
 * Ordered because a person can hold several — the label names the widest one, since that is what
 * determines what the screen will let them do. Kept in sync with `PLATFORM_ROLES` in the server's
 * `platform-role.guard.ts`; `shell.spec.ts` asserts the two lists match rather than trusting that
 * a role added there is remembered here.
 */
const PLATFORM_ROLE_LABELS: ReadonlyArray<readonly [string, string]> = [
  ['SUPER_ADMIN', 'Super admin'],
  ['FINANCE', 'Finance'],
  ['VERIFICATION_OFFICER', 'Verification officer'],
  ['MODERATOR', 'Moderator'],
  ['SUPPORT_AGENT', 'Support agent'],
];

/**
 * The widest platform role in the token, as a label — or `null`.
 *
 * Same unverified read as `subjectOf`, and the same reason it is safe: a forged claim could only
 * change the WORD in the corner. Every request is authorised server-side, and the sidebar shows
 * every screen regardless of role today (`M-023` wires the `B3.2` matrix), so nothing here gates
 * anything.
 */
function roleLabelOf(token: string | null): string | null {
  const claims = claimsOf(token);
  const roles = Array.isArray(claims?.roles) ? claims.roles : [];
  const held = new Set(
    roles
      .filter((role): role is string => typeof role === 'string')
      .map((scoped) => {
        // `SUPER_ADMIN@platform`. The scope matters: a tenant-scoped role of the same name is a gym
        // owner's staff member, not platform staff.
        const [key, scope] = scoped.split('@');
        return scope === 'platform' ? key : undefined;
      }),
  );

  return PLATFORM_ROLE_LABELS.find(([key]) => held.has(key))?.[1] ?? null;
}

/** The payload, decoded and not verified. One parse, two readers. */
function claimsOf(token: string | null): { sub?: unknown; roles?: unknown } | null {
  if (token === null) return null;
  const payload = token.split('.')[1];
  if (payload === undefined) return null;

  try {
    const json = atob(payload.replace(/-/g, '+').replace(/_/g, '/')) as string;
    return JSON.parse(json) as { sub?: unknown; roles?: unknown };
  } catch {
    return null;
  }
}

function subjectOf(token: string | null): string {
  const claims = claimsOf(token);
  return typeof claims?.sub === 'string' ? claims.sub : 'unknown';
}

/**
 * Turns a failure into something an operator can act on.
 *
 * `UNAUTHENTICATED` is passed through as the server's own wording deliberately: `Security.md` §1.6
 * requires that "no such account" and "wrong password" be indistinguishable, and a client that
 * helpfully rewrote one of them into "that email is not registered" would rebuild the enumeration
 * oracle the server spent an Argon2id decoy hash preventing.
 */
function messageFor(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  // A network failure, not a rejection. Saying "check your details" here would be wrong and would
  // send the operator looking for a typo that is not there.
  return 'Could not reach the server. Check that the API is running, then try again.';
}
