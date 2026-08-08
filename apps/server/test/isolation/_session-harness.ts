/**
 * M-022 · Shared boot and HTTP plumbing for the three session suites.
 *
 * ┌─ WHY A SHARED MODULE AND NOT THREE COPIES ──────────────────────────────────────────────────┐
 * │ `refresh-reuse-revokes-family`, `refresh-parallel-tabs` and `session-revocation` each need   │
 * │ the same four things: the real `AppModule` over HTTP, a registered account, a cookie jar,    │
 * │ and a cleanup that respects the `ON DELETE RESTRICT` chain.                                  │
 * │                                                                                              │
 * │ Three copies of the cleanup in particular is three chances to get the delete ORDER wrong —   │
 * │ and a cleanup that fails silently leaks rows into whichever suite runs next, where it        │
 * │ surfaces as an unrelated assertion about a seed count. That has already happened once.       │
 * │                                                                                              │
 * │ The leading underscore keeps this out of the `*-spec.ts` glob, matching `_availability.ts`.  │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 *
 * These are NOT unit tests of a controller. `@Public()`, the guards, the Zod pipe, the exception
 * filter and the cookie attributes are all part of what is asserted, and calling a use case
 * directly skips every one of them.
 */

import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';

import { AppModule } from '../../dist/app.module.js';
import { configureApp } from '../../dist/common/bootstrap/configure-app.js';
import { requireRole } from './_availability.ts';

/** The prefix every account these suites create carries, and the one the cleanup matches. */
export const TEST_EMAIL_PREFIX = 'm022';

/** Satisfies the M-020 policy: 10..128 characters, no composition rule. */
export const GOOD_PASSWORD = 'correct horse battery staple';

export interface HttpResult {
  readonly status: number;
  // The bodies under test are error envelopes and token payloads of several shapes; narrowing
  // them here would mean a cast at every call site instead of one here. Test sources sit outside
  // `no-explicit-any`, so this needs no disable directive — an unused one is itself a warning.
  readonly body: any;
  readonly setCookie: string | null;
}

export function psql(sql: string): string {
  return execFileSync(
    'docker',
    ['exec', '-i', 'gymmap-postgres', 'psql', '-U', 'postgres', '-d', 'gymmap', '-tA'],
    { input: sql, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] },
  ).trim();
}

/**
 * Removes every account these suites create, children first.
 *
 * Every identity foreign key is `ON DELETE RESTRICT` — deliberately, so nothing that recorded a
 * fact about a session vanishes because a row upstream did. Which means the order below is not
 * stylistic: get it wrong and the whole statement fails on the FK, cleaning nothing at all.
 */
export function removeTestAccounts(): void {
  const owned = `SELECT id FROM users WHERE email LIKE '${TEST_EMAIL_PREFIX}.%'`;
  psql(`DELETE FROM refresh_tokens WHERE session_id IN (
          SELECT id FROM auth_sessions WHERE user_id IN (${owned}));
        DELETE FROM auth_sessions WHERE user_id IN (${owned});
        DELETE FROM user_roles WHERE user_id IN (${owned});
        DELETE FROM users WHERE email LIKE '${TEST_EMAIL_PREFIX}.%';`);
}

export class SessionHarness {
  private app: INestApplication | null = null;
  private baseUrl = '';
  private seq = 0;

  available = false;

  async boot(): Promise<void> {
    ({ available: this.available } = await requireRole('the API and its dependencies', async () => {
      psql('SELECT 1;');
      // Cleaned on ENTRY as well as on exit: `after` does not run when a suite is killed by a
      // timeout, and the leftovers then fail a LATER suite — a genuinely confusing way to find
      // out that this one was interrupted.
      removeTestAccounts();

      this.app = await NestFactory.create(AppModule, { logger: false, abortOnError: false });
      configureApp(this.app);
      await this.app.listen(0);
      this.baseUrl = (await this.app.getUrl()).replace('[::1]', '127.0.0.1');
    }));
  }

  async shutdown(): Promise<void> {
    if (!this.available) return;
    removeTestAccounts();
    await this.app?.close();
  }

  freshEmail(): string {
    return `${TEST_EMAIL_PREFIX}.${String((this.seq += 1))}.${randomUUID().slice(0, 8)}@seed.test`;
  }

  async request(
    method: 'GET' | 'POST' | 'DELETE',
    path: string,
    options: { body?: unknown; cookie?: string | null; bearer?: string | null } = {},
  ): Promise<HttpResult> {
    const headers: Record<string, string> = {};
    if (options.body !== undefined) headers['content-type'] = 'application/json';
    if (options.cookie) headers['cookie'] = options.cookie;
    if (options.bearer) headers['authorization'] = `Bearer ${options.bearer}`;

    const response = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers,
      ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }),
    });

    // Read ONCE. A second `.json()` on a consumed body throws, and the failure then looks like a
    // network error rather than a test bug.
    const raw = await response.text();
    return {
      status: response.status,
      body: raw === '' ? null : JSON.parse(raw),
      setCookie: response.headers.get('set-cookie'),
    };
  }
}

/**
 * The refresh cookie as a `Cookie` header value.
 *
 * `Secure` is set on the real cookie, and `fetch` against plain HTTP would not send it back — so
 * the tests replay the name=value pair by hand rather than relying on a cookie jar. That is also
 * closer to what a browser sends: only the pair crosses the wire, never the attributes.
 */
export function cookieFrom(setCookie: string | null): string {
  if (setCookie === null) throw new Error('no Set-Cookie header — the session was not opened');
  const pair = setCookie.split(';')[0];
  if (pair === undefined || !pair.includes('__Host-gm_rt=')) {
    throw new Error(`Set-Cookie did not carry the refresh cookie: ${setCookie}`);
  }
  return pair;
}

export interface LoggedIn {
  readonly email: string;
  readonly userId: string;
  readonly accessToken: string;
  readonly cookie: string;
}

/** Registers an account and logs it in, returning both credentials. */
export async function registerAndLogin(harness: SessionHarness): Promise<LoggedIn> {
  const email = harness.freshEmail();
  const registered = await harness.request('POST', '/v1/auth/register', {
    body: { email, password: GOOD_PASSWORD },
  });
  if (registered.status !== 201) {
    throw new Error(`register failed: ${registered.status} ${JSON.stringify(registered.body)}`);
  }

  const login = await harness.request('POST', '/v1/auth/login', {
    body: { identifier: email, password: GOOD_PASSWORD },
  });
  if (login.status !== 200) {
    throw new Error(`login failed: ${login.status} ${JSON.stringify(login.body)}`);
  }

  return {
    email,
    userId: registered.body.user_id,
    accessToken: login.body.access_token,
    cookie: cookieFrom(login.setCookie),
  };
}
