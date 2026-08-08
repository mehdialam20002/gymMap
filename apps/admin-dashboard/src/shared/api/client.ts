/**
 * The API client — one place that knows how to talk to the server.
 *
 * ┌─ THE ACCESS TOKEN LIVES IN MEMORY, NOT IN `localStorage` ───────────────────────────────────┐
 * │ Storing it in `localStorage` is the common shortcut and it throws away the property the     │
 * │ server worked for: the refresh token is `httpOnly` precisely so that an XSS cannot read a   │
 * │ long-lived credential. Putting the access token somewhere script CAN read hands that        │
 * │ attacker fifteen minutes — and, because this client silently refreshes, fifteen minutes     │
 * │ that renew for as long as they keep the page open.                                           │
 * │                                                                                              │
 * │ In a module-scoped variable it dies with the tab. The cost is that a page reload has no     │
 * │ token — which is exactly what `refresh()` is for, and the refresh cookie survives the        │
 * │ reload precisely because the browser, not this code, is holding it.                          │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 *
 * ┌─ ONE REFRESH IN FLIGHT, EVER — `TR-28` FROM THE CLIENT SIDE ────────────────────────────────┐
 * │ A dashboard fires several queries at once. When the access token expires they all get 401   │
 * │ together, and the obvious implementation has each of them call `/auth/refresh`.             │
 * │                                                                                              │
 * │ That is the parallel-tab race, generated deliberately by our own client. The server's        │
 * │ ten-second grace absorbs it, but relying on a security tolerance to paper over a client bug  │
 * │ is the wrong side of that trade — and outside the window it revokes the family and signs     │
 * │ the operator out of everything. So the promise is shared: the first 401 starts the refresh,  │
 * │ every other caller awaits the same promise.                                                  │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 */

/** The `§C3.2` error envelope every failure arrives in. */
export interface ApiErrorBody {
  readonly error: {
    readonly code: string;
    readonly message: string;
    readonly details?: ReadonlyArray<{ readonly field?: string; readonly message?: string }>;
    readonly correlation_id?: string;
  };
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly correlationId?: string,
    readonly details: ReadonlyArray<{ field?: string; message?: string }> = [],
  ) {
    super(message);
    this.name = 'ApiError';
  }

  /** True when re-authenticating is the caller's only useful response. */
  get isUnauthenticated(): boolean {
    return this.status === 401;
  }
}

// ---------------------------------------------------------------------------
// The token, and the listeners that care when it changes.
// ---------------------------------------------------------------------------

let accessToken: string | null = null;
const subscribers = new Set<(token: string | null) => void>();

export function setAccessToken(token: string | null): void {
  accessToken = token;
  for (const notify of subscribers) notify(token);
}

export function getAccessToken(): string | null {
  return accessToken;
}

/** Notifies when the token is gained or lost, so the session context can re-render. */
export function onAccessTokenChange(listener: (token: string | null) => void): () => void {
  subscribers.add(listener);
  return () => subscribers.delete(listener);
}

// ---------------------------------------------------------------------------
// The request.
// ---------------------------------------------------------------------------

interface RequestOptions {
  readonly method?: 'GET' | 'POST' | 'DELETE' | 'PATCH';
  readonly body?: unknown;
  /**
   * Set for the auth routes themselves. Without it, a failing `/auth/refresh` would try to
   * refresh in order to retry the refresh, which recurses until the stack gives out.
   */
  readonly noRetry?: boolean;
}

async function parse(response: Response): Promise<unknown> {
  const raw = await response.text();
  if (raw === '') return null;
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    // A non-JSON body from a route that promises JSON means a proxy or a crash answered instead
    // of the application. Surfacing the status is more use than a parse error.
    return { error: { code: 'UNEXPECTED_RESPONSE', message: raw.slice(0, 200) } };
  }
}

function toApiError(status: number, body: unknown): ApiError {
  const envelope = body as Partial<ApiErrorBody> | null;
  const error = envelope?.error;
  return new ApiError(
    status,
    error?.code ?? 'UNKNOWN',
    error?.message ?? `The request failed with status ${String(status)}.`,
    error?.correlation_id,
    error?.details?.map((d) => ({ ...d })) ?? [],
  );
}

/** The single in-flight refresh. See the header. */
let refreshInFlight: Promise<boolean> | null = null;

async function performRefresh(): Promise<boolean> {
  // No `Authorization` header: the refresh cookie is the credential, and the access token we
  // hold is the expired one we are here to replace.
  const response = await fetch('/v1/auth/refresh', {
    method: 'POST',
    credentials: 'same-origin',
  });

  if (!response.ok) {
    setAccessToken(null);
    return false;
  }

  const body = (await parse(response)) as { access_token?: string } | null;
  if (typeof body?.access_token !== 'string') {
    setAccessToken(null);
    return false;
  }

  setAccessToken(body.access_token);
  return true;
}

export function refresh(): Promise<boolean> {
  refreshInFlight ??= performRefresh().finally(() => {
    refreshInFlight = null;
  });
  return refreshInFlight;
}

export async function api<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const send = async (): Promise<Response> => {
    const headers: Record<string, string> = {};
    if (options.body !== undefined) headers['content-type'] = 'application/json';
    if (accessToken !== null) headers['authorization'] = `Bearer ${accessToken}`;

    return fetch(path, {
      method: options.method ?? 'GET',
      headers,
      // The refresh cookie rides on every request. `same-origin` rather than `include` because
      // the dev proxy makes this same-origin — and `include` would be the setting that quietly
      // starts working cross-origin the day someone adds a permissive CORS policy.
      credentials: 'same-origin',
      ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }),
    });
  };

  let response = await send();

  // One retry, and only for a 401 on a route that is not itself an auth route.
  if (response.status === 401 && options.noRetry !== true) {
    if (await refresh()) response = await send();
  }

  const body = await parse(response);
  if (!response.ok) throw toApiError(response.status, body);
  return body as T;
}

// ---------------------------------------------------------------------------
// The auth calls, named so a caller does not have to remember the shapes.
// ---------------------------------------------------------------------------

export interface LoginResult {
  readonly user_id: string;
  readonly access_token: string;
  readonly expires_in_seconds: number;
}

export async function login(identifier: string, password: string): Promise<LoginResult> {
  const result = await api<LoginResult>('/v1/auth/login', {
    method: 'POST',
    body: { identifier, password },
    noRetry: true,
  });
  setAccessToken(result.access_token);
  return result;
}

export async function logout(): Promise<void> {
  try {
    await api<null>('/v1/auth/logout', { method: 'POST', noRetry: true });
  } finally {
    // Cleared even if the call failed. A sign-out that leaves the token in memory because the
    // network blipped is a sign-out the operator was told had happened.
    setAccessToken(null);
  }
}

export interface SessionRow {
  readonly id: string;
  readonly device_label: string | null;
  readonly ip: string | null;
  readonly started_at: string;
  readonly current: boolean;
}

export const listSessions = (): Promise<{ sessions: SessionRow[] }> =>
  api<{ sessions: SessionRow[] }>('/v1/auth/sessions');

export const revokeSession = (sessionId: string): Promise<null> =>
  api<null>(`/v1/auth/sessions/${sessionId}`, { method: 'DELETE' });

/**
 * `ApiError` to the shape `@gymmap/ui`'s state adapter expects.
 *
 * The bridge exists because `packages/ui` may not import this client (`R3`) and this client may
 * not import TanStack Query types into the shared layer. Each side owns its own shape and this
 * one function joins them, so the mapping lives in one place rather than at every call site.
 */
export function toProblem(error: unknown): {
  code: string;
  message: string;
  correlationId?: string;
  status?: number;
} {
  if (error instanceof ApiError) {
    return {
      code: error.code,
      message: error.message,
      status: error.status,
      ...(error.correlationId === undefined ? {} : { correlationId: error.correlationId }),
    };
  }
  // A network failure, not a rejection. Saying "check your details" here would send somebody
  // looking for a typo that is not there.
  return {
    code: 'NETWORK',
    message: 'Could not reach the server. Check that the API is running, then try again.',
  };
}
