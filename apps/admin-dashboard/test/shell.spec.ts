/**
 * The admin shell's contract — `NFR-SEC-11`, `FR-ADMN-02`, `BR-DAT-02`, `NFR-USE-08`.
 *
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * THE THREE PROPERTIES THAT MUST NOT ERODE
 *
 *   1  Every route is behind the MFA gate. A per-route guard fails by omission — the fifteenth
 *      screen ships without one and the hole is invisible because every OTHER screen is guarded.
 *   2  The impersonation banner is rendered by the layout, never by a feature. One forgotten
 *      import and an operator views a member's data believing it is their own (BR-DAT-02).
 *   3  A reason cannot be defaulted away. `approve(id, '')` must not compile.
 *
 * All three are structural, all three are one line away from being broken, and none of them is
 * visible in a screenshot.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { en } from '../src/shared/i18n/messages/en.ts';
import { t, DEFAULT_LOCALE } from '../src/shared/i18n/index.ts';
import {
  REASON_FLOOR,
  REASON_MIN_LENGTH,
  ReasonTooShortError,
  reason,
  reasonProblem,
} from '../src/shared/reason/reason.ts';

const APP_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const source = (rel: string) => readFileSync(join(APP_ROOT, rel), 'utf8');

/**
 * The file with comments blanked, newlines preserved.
 *
 * ┌─ USE THIS FOR EVERY STRUCTURAL ASSERTION ───────────────────────────────────────────────────┐
 * │ Three separate tests in this repository have now failed on their own documentation: a scan  │
 * │ for `runElevated(` matched a doc comment, a scan for `'unsafe-inline'` matched the comment  │
 * │ explaining why it is forbidden, and a scan for `<MfaGate>` matched the header describing    │
 * │ where the gate goes.                                                                         │
 * │                                                                                              │
 * │ The pattern is the same each time and so is the fix: a test that asserts something about    │
 * │ CODE must not read PROSE. Well-commented code is not a hazard to work around; a scanner     │
 * │ that cannot tell the difference is a bad scanner.                                            │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 */
function code(rel: string): string {
  const text = source(rel);
  let out = '';
  let i = 0;
  const blank = (s: string) => s.replace(/[^\n]/g, ' ');

  while (i < text.length) {
    const two = text.slice(i, i + 2);
    if (two === '//') {
      const end = text.indexOf('\n', i);
      const stop = end === -1 ? text.length : end;
      out += blank(text.slice(i, stop));
      i = stop;
    } else if (two === '/*') {
      const end = text.indexOf('*/', i + 2);
      const stop = end === -1 ? text.length : end + 2;
      out += blank(text.slice(i, stop));
      i = stop;
    } else if (two === '{/') {
      // A JSX comment: `{/* … */}`. Not caught by the block-comment branch, because the brace
      // comes first and the scanner would otherwise re-enter at the `*/` leaving a stray `}`.
      const end = text.indexOf('*/}', i);
      const stop = end === -1 ? text.length : end + 3;
      out += blank(text.slice(i, stop));
      i = stop;
    } else {
      out += text[i];
      i += 1;
    }
  }
  return out;
}

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(join(APP_ROOT, dir))) {
    const rel = `${dir}/${name}`;
    if (statSync(join(APP_ROOT, rel)).isDirectory()) out.push(...sourceFiles(rel));
    else if (/\.tsx?$/.test(name)) out.push(rel);
  }
  return out;
}

// ═══════════════════════════════════════════════════════════════════════════
// NFR-SEC-11 · the gate is at the router boundary, not per route.
// ═══════════════════════════════════════════════════════════════════════════

test('NFR-SEC-11 — there is exactly ONE top-level route, and it is the gated layout', () => {
  const router = code('src/routes/router.tsx');
  // A second top-level entry is how a route escapes the gate: it looks like an ordinary addition
  // and it is outside AdminLayout, so MfaGate never wraps it.
  const topLevel = [...router.matchAll(/^\s{2}\{\s*$/gm)];
  assert.equal(
    topLevel.length,
    1,
    'createBrowserRouter has more than one top-level route. Every route must be a CHILD of the ' +
      'gated layout — a sibling bypasses MfaGate entirely, and nothing about it looks wrong.',
  );
  assert.match(router, /element: <AdminLayout \/>/);
});

test('NFR-SEC-11 — the layout wraps its Outlet in MfaGate', () => {
  const router = code('src/routes/router.tsx');
  const gateAt = router.indexOf('<MfaGate>');
  const outletAt = router.indexOf('<Outlet />');
  const closeAt = router.indexOf('</MfaGate>');
  assert.ok(gateAt > 0, 'AdminLayout does not render MfaGate');
  assert.ok(
    gateAt < outletAt && outletAt < closeAt,
    'the Outlet is not INSIDE MfaGate — routes render regardless of session state',
  );
});

test('NFR-SEC-11 — the gate renders children ONLY when fully authenticated', () => {
  const gate = code('src/routes/mfa-gate.tsx');
  // Every non-AUTHENTICATED state must return before the children. If `MFA_REQUIRED` fell
  // through, a password alone would open a console that reads across every gym on the platform.
  for (const state of ['LOADING', 'UNAUTHENTICATED', 'MFA_REQUIRED']) {
    assert.ok(
      gate.includes(`session.status === '${state}'`),
      `the gate does not handle the ${state} state, so it falls through to the children`,
    );
    assert.ok(
      gate.indexOf(`session.status === '${state}'`) < gate.indexOf('return <>{children}</>'),
      `the ${state} branch is after the children are rendered`,
    );
  }
});

test('the session states are a union, so an impossible combination cannot be represented', () => {
  const session = code('src/shared/auth/session.tsx');
  // `isAuthenticated && !mfaSatisfied` and its inverse are both meaningless. Three booleans make
  // them merely unlikely; a discriminated union makes them unrepresentable.
  assert.match(session, /status: 'LOADING'/);
  assert.match(session, /status: 'MFA_REQUIRED'/);
  assert.ok(!/isAuthenticated\s*:/.test(session), 'a boolean flag has reappeared');
  assert.ok(!/mfaSatisfied\s*:/.test(session), 'a boolean flag has reappeared');
});

test('the client permission helper is named so it cannot be mistaken for a control', () => {
  const session = code('src/shared/auth/session.tsx');
  // `can(...)` reads as an authorisation decision. `mayAttempt(...)` reads as "should this button
  // be shown", which is the only thing a client check can honestly mean.
  assert.match(session, /export function mayAttempt/);
  assert.ok(!/export function can\b/.test(session));
});

// ═══════════════════════════════════════════════════════════════════════════
// BR-DAT-02 / FR-AUTH-12 · the impersonation banner.
// ═══════════════════════════════════════════════════════════════════════════

test('BR-DAT-02 — the banner is rendered by the layout, and by nothing else', () => {
  const router = code('src/routes/router.tsx');
  assert.match(router, /<ImpersonationBanner session=\{session\} \/>/);

  // Any OTHER importer means a page could render without it — which is the failure this rule
  // exists to prevent, and it is silent: nothing looks wrong to the operator.
  const importers = sourceFiles('src').filter(
    (f) => f !== 'src/routes/router.tsx' && code(f).includes('impersonation/banner'),
  );
  assert.deepEqual(
    importers,
    [],
    'a file other than the root layout imports the impersonation banner. §6: it must be ' +
      'impossible to render a page WITHOUT it.',
  );
});

test('BR-DAT-02 — the banner sits ABOVE the gate, so it shows in every state', () => {
  const router = code('src/routes/router.tsx');
  assert.ok(
    router.indexOf('<ImpersonationBanner') < router.indexOf('<MfaGate>'),
    'the banner is inside the gate, so it disappears on the sign-in and MFA screens — exactly ' +
      'the moments an operator is most likely to be confused about who they are',
  );
});

test('the banner announces itself politely, and warns rather than alarms', () => {
  const banner = code('src/shared/impersonation/banner.tsx');
  // role="alert" interrupts a screen reader mid-sentence. This is a persistent CONDITION, not an
  // event, so it is a status with a polite live region.
  assert.match(banner, /role="status"/);
  assert.match(banner, /aria-live="polite"/);
  // Warning, not danger. Impersonation is a legitimate audited capability; painting it red makes
  // the everyday support flow look like a failure and teaches operators to ignore red.
  assert.match(banner, /bg-warning-solid/);
  assert.ok(!banner.includes('bg-danger'), 'the banner uses danger colours for a normal flow');
});

// ═══════════════════════════════════════════════════════════════════════════
// FR-ADMN-02 · every administrative write states a reason.
// ═══════════════════════════════════════════════════════════════════════════

test('FR-ADMN-02 — a placeholder is not a reason', () => {
  // ┌─ TEN, AND IT IS THE SERVER'S NUMBER ────────────────────────────────────────────────────┐
  // │ `Admin.md` RS3: "Minimum length 10 characters after trimming." `AdminDashboard.md` RD2   │
  // │ mirrors it client-side so "the counter and the server agree". This asserted 20, which    │
  // │ was stricter than anything documented — no hole, but it refused a legitimate             │
  // │ twelve-character reason the API accepts, and a counter that disagrees with the server is │
  // │ a counter an operator learns to ignore.                                                  │
  // └─────────────────────────────────────────────────────────────────────────────────────────┘
  assert.equal(REASON_MIN_LENGTH, 10);

  // `checking a thing` is sixteen characters and now PASSES the floor. That is the documented
  // behaviour and it is why the floor is not the only control: `RS4` requires a structured code
  // alongside the free text wherever the domain has a taxonomy, and `RS5` puts the reason on the
  // audit row where a human judges it.
  for (const bad of ['', '   ', 'admin', 'fix', 'test', 'ok', '.']) {
    assert.throws(() => reason(bad), ReasonTooShortError, `"${bad}" was accepted as a reason`);
  }

  // RS3 names these three explicitly as refusals.
  for (const named of ['ok', '.', '   ']) {
    assert.throws(() => reason(named), ReasonTooShortError);
  }

  const good = 'Suspending tenant 4471 after a confirmed chargeback pattern';
  assert.equal(reason(good), good);
});

test('RD4 — the higher floors are per-action and none of them is the general one', () => {
  // `RD4` states them as a closed list: 20 for a pre-check override, 20 for impersonation, 50 for
  // a reconciliation variance. Held as named entries so a literal `20` never appears in a
  // component, where the next reader cannot trace it to a rule.
  assert.equal(REASON_FLOOR.general, REASON_MIN_LENGTH);
  assert.equal(REASON_FLOOR.precheckOverride, 20);
  assert.equal(REASON_FLOOR.impersonation, 20);
  assert.equal(REASON_FLOOR.reconciliationVariance, 50);

  for (const [name, floor] of Object.entries(REASON_FLOOR)) {
    if (name === 'general') continue;
    assert.ok(floor > REASON_MIN_LENGTH, `${name} is not actually higher than the general floor`);
  }
});

test('FR-ADMN-02 — the reason is trimmed, so whitespace cannot pad it to length', () => {
  // Twenty spaces followed by "ok" is twenty-two characters and is not a reason.
  assert.throws(() => reason(`${' '.repeat(20)}ok`), ReasonTooShortError);
  assert.equal(reason(`  ${'a'.repeat(25)}  `), 'a'.repeat(25));
});

test('reasonProblem distinguishes empty from too-short, for the form', () => {
  // Different messages: "a reason is required" and "too short" send the operator to different
  // actions, and one message for both is the kind of thing that makes people type "aaaaaaaaaa".
  assert.equal(reasonProblem(''), 'EMPTY');
  assert.equal(reasonProblem('   '), 'EMPTY');
  assert.equal(reasonProblem('short'), 'TOO_SHORT');
  assert.equal(reasonProblem('a'.repeat(REASON_MIN_LENGTH)), null);
});

test('the error explains WHY, not just that it failed', () => {
  const error = new ReasonTooShortError(3);
  // An operator who is told "minimum 20 characters" types twenty characters of noise. One who is
  // told somebody will read this in six months writes a sentence.
  assert.match(error.message, /six months/);
  assert.match(error.message, /FR-ADMN-02/);
});

// ═══════════════════════════════════════════════════════════════════════════
// The route table is the plan, so it must be complete.
// ═══════════════════════════════════════════════════════════════════════════

test('all fifteen SCR-ADM screens appear exactly once in the route table', () => {
  // The table moved from `router.tsx` to `nav.ts` when the console grew grouped navigation, and
  // the screens stopped being uniformly unbuilt: four are live now. What must NOT change is the
  // property this asserts — the table IS the plan, and a screen dropped from it is one nobody
  // notices is missing until launch. So it counts screen ids wherever they are declared, built
  // or pending, rather than counting pending ones.
  const nav = code('src/routes/nav.ts');
  const declared = [...nav.matchAll(/screen: '(SCR-ADM-\d+)'/g)].map((m) => m[1]!);
  // SCR-ADM-001 is the index route and carries no id; 002-015 are declared in the nav.
  const expected = Array.from(
    { length: 14 },
    (_, i) => `SCR-ADM-${String(i + 2).padStart(3, '0')}`,
  );

  assert.deepEqual(
    [...declared].sort(),
    expected,
    'a screen is missing from or duplicated in the route table. The table IS the plan — a screen ' +
      'dropped here is a screen nobody notices is missing until launch.',
  );
  assert.match(code('src/routes/router.tsx'), /PlatformDashboardRoute/, 'SCR-ADM-001 has no route');
});

test('every pending route names the milestone that delivers it', () => {
  const nav = code('src/routes/nav.ts');

  // Every IN_DEVELOPMENT entry, with whatever follows it up to the closing brace. Matching the
  // block rather than a fixed key order means reordering the fields inside an entry does not
  // silently empty this assertion.
  const pending = [...nav.matchAll(/state: 'IN_DEVELOPMENT',([^}]*)}/g)].map((m) => m[1]!);
  assert.ok(pending.length > 0, 'no pending routes found — the scan is wrong, not the nav');

  for (const block of pending) {
    const screen = /screen: '(SCR-ADM-\d+)'/.exec(block)?.[1];
    const milestone = /milestone: '(M-\d+)'/.exec(block)?.[1];

    // ┌─ THE MILESTONE IS MANDATORY. THE SCREEN ID IS NOT, AND DELIBERATELY SO ─────────────────┐
    // │ `§B3` numbers FIFTEEN admin screens. The configuration and system pages the redesign      │
    // │ added are real destinations but they are not among those fifteen, and inventing           │
    // │ `SCR-ADM-016`… for them would corrupt the very numbering the exactly-once assertion above │
    // │ depends on — that test compares the route table against `§B3`'s list, so a fabricated id  │
    // │ would either fail it or, worse, be added to the expected list and become fact by          │
    // │ repetition.                                                                               │
    // │                                                                                          │
    // │ What must never be missing is the MILESTONE. "In development" without a milestone is an   │
    // │ excuse; with one it is a commitment a reader can look up.                                 │
    // └──────────────────────────────────────────────────────────────────────────────────────────┘
    assert.match(
      milestone ?? '',
      /^M-\d{3}$/,
      `${screen ?? '(a screen with no §B3 id)'} cites "${milestone ?? 'nothing'}", which is not a milestone id`,
    );
  }
});

test('a BUILT route has a component, and never a milestone', () => {
  // The other direction, and the one that rots. Marking a screen BUILT is how it leaves the
  // "in development" list in the sidebar AND on the dashboard — so a route marked built before
  // its component exists would quietly claim work that has not happened.
  const nav = code('src/routes/nav.ts');
  const built = [...nav.matchAll(/state: 'BUILT',([^}]*)}/g)].map((m) => m[1]!);

  for (const block of built) {
    assert.ok(
      !block.includes('milestone:'),
      `a BUILT route still names a milestone: ${block.trim()}`,
    );
  }

  const router = code('src/routes/router.tsx');
  for (const component of [
    'ApprovalQueueRoute',
    'GymRegisterRoute',
    'PeopleRoute',
    'SessionsRoute',
  ]) {
    assert.match(router, new RegExp(component), `${component} is marked BUILT but is not routed`);
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// Security.md §11.5 · the admin surface is stricter than the customer one.
// ═══════════════════════════════════════════════════════════════════════════

test('§11.5 — no inline script, so script-src can stay self with no nonce', () => {
  const html = code('index.html');
  // The asymmetry is deliberate: the surface with MORE authority gets the TIGHTER policy. A Vite
  // production build emits only external hashed files, so an inline script here would have
  // forced either a nonce (which a static build cannot generate per response) or unsafe-inline.
  const scripts = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>/g)];
  assert.deepEqual(
    scripts.map((s) => s[0]),
    [],
    "index.html contains an inline <script>. It would be blocked by §11.5's script-src, and " +
      'the fix people reach for is unsafe-inline — which hands every XSS a script tag.',
  );
  // The theme bootstrap is external and CLASSIC: a module script is deferred, so the flash it
  // exists to prevent would happen anyway.
  assert.match(html, /<script src="\/theme\.js"><\/script>/);
});

test('the admin console is never indexed', () => {
  // It can read across every gym on the platform. A crawled admin URL in a search result is a
  // reconnaissance gift.
  assert.match(source('index.html'), /name="robots" content="noindex, nofollow"/);
});

test('the theme bootstrap honours an explicit choice in BOTH directions', () => {
  const script = source('public/theme.js');
  // The half usually missed: a user who chose LIGHT on a dark-mode OS.
  assert.match(script, /t === 'dark' \|\| t === 'light'/);
  assert.match(script, /try \{/);
  assert.match(script, /catch \(e\)/);
});

// ═══════════════════════════════════════════════════════════════════════════
// Query defaults, i18n, and the skip link.
// ═══════════════════════════════════════════════════════════════════════════

test('a mutation is NEVER retried automatically', () => {
  const main = code('src/main.tsx');
  // An automatically retried admin mutation is a duplicate approval, a duplicate refund or a
  // duplicate suspension. A deliberate retry is made safe by idempotency keys (M-017), not by
  // the query client guessing.
  assert.match(main, /mutations:\s*\{\s*retry:\s*0\s*\}/);
  assert.match(main, /refetchOnWindowFocus:\s*false/);
});

test('the state layer is TanStack Query, not a rejected alternative', () => {
  assert.match(code('src/main.tsx'), /@tanstack\/react-query/);

  // Asserted on the DEPENDENCY LIST, not on file text. Scanning source for the word "redux"
  // matched the comment in main.tsx that names Redux as rejected — the third time in this
  // repository that a test failed on its own documentation. A package cannot be present by
  // being mentioned.
  const manifest = JSON.parse(source('package.json')) as {
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
  };
  const installed = Object.keys({ ...manifest.dependencies, ...manifest.devDependencies });
  assert.ok(installed.includes('@tanstack/react-query'));
  for (const rejected of ['redux', '@reduxjs/toolkit', 'zustand', 'mobx', 'recoil', 'jotai']) {
    assert.ok(
      !installed.includes(rejected),
      `${rejected} is installed. STACK_ADDITIONS.md rejects it for server state explicitly and ` +
        'says so by name — "do not propose again".',
    );
  }
});

test('AX2 — the skip link is the first focusable element and main is focusable', () => {
  const router = code('src/routes/router.tsx');
  assert.ok(
    router.indexOf('gm-skip-link') < router.indexOf('<ImpersonationBanner'),
    'the skip link is not first, so a keyboard user tabs through the banner to reach content',
  );
  // Whitespace-tolerant: prettier splits a multi-attribute JSX tag across lines, and a
  // single-line regex here failed on a reformat that changed no behaviour at all.
  assert.match(router, /<main[^>]*id="main"[^>]*tabIndex=\{-1\}/);
});

/** Prose is two or more words with a space. A className or a token id never is. */
const PROSE_IN_JSX = />\s*([A-Z][a-z]+(?: [a-z]+){1,})\s*</g;

test('I18N1 — every user-facing string comes from the catalogue', () => {
  const offenders: string[] = [];
  for (const file of sourceFiles('src')) {
    for (const match of code(file).matchAll(PROSE_IN_JSX)) {
      offenders.push(`${file}: "${match[1]}"`);
    }
  }
  assert.deepEqual(offenders, [], `hard-coded user-facing text:\n  ${offenders.join('\n  ')}`);
});

test('CONTROL — the literal scan detects a literal and is looking at real files', () => {
  // Without this the test above passes on an empty file list, a broken regex and a wrong path.
  assert.equal([...'<h1>Approve this gym</h1>'.matchAll(PROSE_IN_JSX)].length, 1);
  const files = sourceFiles('src');
  assert.ok(files.length >= 6, `only ${files.length} source files found`);
  assert.ok(files.includes('src/routes/router.tsx'));
});

test('every catalogue key resolves', () => {
  for (const key of Object.keys(en) as (keyof typeof en)[]) {
    assert.ok(t(key).length > 0, `${key} resolves to an empty string`);
  }
  assert.equal(DEFAULT_LOCALE, 'en');
});

test('the MFA copy gives the reason, not just the requirement', () => {
  // An operator who understands why a control exists is one who does not look for a way around
  // it. "Two-factor is required" invites workarounds; "this console reads across every gym"
  // does not.
  assert.match(en['adm.gate.mfa.body'], /read across every gym/i);
  assert.match(en['adm.impersonation.restriction'], /disabled/i);
  assert.match(en['adm.reason.help'], /audit log/i);
});

/**
 * ┌─ THE ROLE LIST EXISTS TWICE, SO SOMETHING HAS TO HOLD THE TWO TOGETHER ─────────────────────┐
 * │ The server's `platform-role.guard.ts` decides who may reach `/v1/admin/*`; this console's     │
 * │ `PLATFORM_ROLE_LABELS` decides what the topbar calls them. A role added to the guard and      │
 * │ forgotten here would sign in successfully and be labelled "Platform staff" — which looks like │
 * │ a permissions bug and is really a copy of a list that drifted.                                │
 * │                                                                                              │
 * │ The test reads the guard's source across the workspace boundary. That is deliberate and it is │
 * │ not an `R2` violation: `R2` forbids IMPORTING `apps/server`'s source, and this reads it as    │
 * │ text in a test. The alternative is a third copy in `packages/types`, which is one more place  │
 * │ to forget.                                                                                   │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 */
test('the console labels exactly the platform roles the server admits', () => {
  // Relative to APP_ROOT, which is what `code()` joins against. `R2` forbids IMPORTING
  // `apps/server`'s source; reading it as text in a test is not an import and the alternative is a
  // third copy of the list in `packages/types` — one more place to forget.
  const guard = code('../server/src/common/guards/platform-role.guard.ts');

  // The `new Set([...])` block only. Scanning the whole file for capitalised strings would also
  // catch the error codes and the scope names, and a test that over-matches passes for the wrong
  // reason forever.
  const setBlock = /PLATFORM_ROLES = new Set\(\[([^\]]*)\]/.exec(guard)?.[1];
  assert.ok(setBlock, 'PLATFORM_ROLES is no longer a `new Set([...])` — this scan needs updating');

  const admitted = [...setBlock.matchAll(/'([A-Z_]+)'/g)].map((match) => match[1]!);
  assert.equal(
    admitted.length,
    5,
    `the guard admits ${String(admitted.length)} roles; §B3.2 names five platform roles. If that ` +
      'changed, this number and the label list both need to move together.',
  );

  const labelled = [
    ...code('src/shared/auth/session.tsx').matchAll(/\['([A-Z_]+)', '[^']+'\]/g),
  ].map((match) => match[1]!);

  for (const role of admitted) {
    assert.ok(
      labelled.includes(role),
      `the server admits ${role} but the console has no label for it — that operator would sign ` +
        'in successfully and be shown "Platform staff", which reads as a permissions bug',
    );
  }

  for (const role of labelled) {
    assert.ok(
      admitted.includes(role),
      `the console labels ${role} but the server's guard does not admit it — either the guard is ` +
        'missing a role or the label is for one that no longer exists',
    );
  }
});
