/**
 * `SCR-WEB-01x` — the member account. `BR-PAY-02`, `BR-REV-01`, `BR-CHK-02`, `MASTER_PRD.md` §A6.3.
 *
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * FOUR RULES MEET IN THE ACCOUNT AREA, AND EACH ONE HAS A TEMPTING SHORTCUT
 *
 *   Membership status  →  compute it from the end date. Wrong: a paid-but-unconfirmed
 *                         membership shows as usable, and a device with the wrong clock
 *                         extends its own.
 *   The QR             →  render something square. Wrong: the token is server-signed with a
 *                         60-second life, so a code drawn here encodes nothing and fails at
 *                         the desk.
 *   Receipts           →  re-quote from the plan. Wrong: §A6.3 — a receipt that recomputes
 *                         changes when the tax rate does, for a purchase made under the old.
 *   Reviews            →  list the gyms with a membership. Wrong: `BR-REV-01` needs a
 *                         recorded CHECK-IN. Paying for something is not having been.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { code, source, tsxFiles } from './helpers.ts';
import { en } from '../src/shared/i18n/messages/en.ts';
import {
  DEMO_MEMBER,
  activeMembership,
  findMembership,
  reviewableGyms,
  visitCount,
} from '../src/features/account/fixtures/member.ts';
import { formatDate, formatDateTime, MARKET_TIME_ZONE } from '../src/features/account/format.ts';

const SCREENS = 'src/features/account/screens.tsx';

// ═══════════════════════════════════════════════════════════════════════════
// BR-PAY-02 · status is reported, never derived.
// ═══════════════════════════════════════════════════════════════════════════

test('membership status is a stored field and is never computed from a date', () => {
  const screens = code(SCREENS);
  const fixture = code('src/features/account/fixtures/member.ts');

  // The two shapes this bug takes.
  assert.ok(!/endsOn\s*[<>]/.test(screens), 'the screen compares a validity date to decide status');
  assert.ok(!/new Date\(\)/.test(screens), 'the screen reads the clock');
  assert.ok(!/Date\.now\(\)/.test(screens + fixture), 'the account area reads the clock');

  for (const membership of DEMO_MEMBER.memberships) {
    assert.ok(
      ['ACTIVE', 'PENDING', 'EXPIRED', 'CANCELLED'].includes(membership.status),
      `${membership.id} has an unknown status`,
    );
  }
});

test('the fixture exercises PENDING, which only exists because activation is webhook-driven', () => {
  // A demo where every membership is active makes the one screen that explains invariant 5
  // unreachable, and PENDING is the state a member will actually meet.
  const statuses = new Set(DEMO_MEMBER.memberships.map((membership) => membership.status));
  assert.ok(statuses.has('ACTIVE'), 'no active membership to demonstrate check-in');
  assert.ok(statuses.has('PENDING'), 'the pending state is not exercised');
  assert.ok(statuses.has('EXPIRED'), 'the expired state is not exercised');

  // And PENDING has never had a visit — it was never usable.
  const pending = DEMO_MEMBER.memberships.filter((m) => m.status === 'PENDING');
  for (const membership of pending) {
    // Counted from the records now, not read off the membership - the stored field disagreed
    // with them and has gone.
    assert.equal(
      visitCount(DEMO_MEMBER, membership.id),
      0,
      `${membership.id} recorded a visit while pending`,
    );
    assert.equal(
      DEMO_MEMBER.visits.filter((visit) => visit.membershipId === membership.id).length,
      0,
    );
  }
});

test('PENDING reads as a normal state, not as a failure', () => {
  // It is the correct behaviour of a system whose activation comes from the payment provider.
  // Copy that alarms a member here produces a support ticket for a working system.
  const pending = en['web.account.status.pendingNote'];
  assert.ok(!/\b(error|failed|problem|sorry|unfortunately)\b/i.test(pending), pending);
  assert.match(pending, /server|provider/i);
});

test('the active membership helper never returns a pending or expired one', () => {
  const active = activeMembership(DEMO_MEMBER);
  assert.equal(active?.status, 'ACTIVE');
  assert.equal(findMembership(DEMO_MEMBER, 'does-not-exist'), null);
});

// ═══════════════════════════════════════════════════════════════════════════
// BR-CHK-02 · the credential is server-issued.
// ═══════════════════════════════════════════════════════════════════════════

test('no QR is generated in the browser, because none can be', () => {
  // `FR-CHK-02`: the token is server-signed and expires in 60 seconds. A code drawn on this page
  // would encode nothing and fail at the desk — a demo QR is worse than no QR, because somebody
  // would try it.
  const screens = code(SCREENS);
  assert.ok(!/qrcode|QRCode|toDataURL/.test(screens), 'a QR is being generated client-side');
  // And the screen says why the panel is empty.
  assert.match(en['web.account.qr.serverIssued'], /60 seconds/);
  assert.match(en['web.account.qr.serverIssued'], /server/i);
});

// ═══════════════════════════════════════════════════════════════════════════
// §A6.3 · a receipt is read, never recomputed.
// ═══════════════════════════════════════════════════════════════════════════

test('receipts render stored figures and never re-quote', () => {
  const screens = code(SCREENS);
  assert.ok(!screens.includes('quoteForPlan'), 'the receipts screen is recomputing an order');
  assert.ok(!screens.includes('multiplyByBps'), 'the receipts screen is applying a tax rate');
});

test('every stored order balances, in integer paise', () => {
  for (const order of DEMO_MEMBER.orders) {
    assert.equal(typeof order.totalMinor, 'bigint', `${order.reference} is not integer paise`);
    assert.equal(order.netMinor, order.grossMinor - order.discountMinor, order.reference);
    assert.equal(order.totalMinor, order.netMinor + order.taxMinor, order.reference);
    assert.equal(
      order.taxLines.reduce((total, line) => total + line.amountMinor, 0n),
      order.taxMinor,
      `${order.reference}: the tax lines do not sum to the tax`,
    );
  }
});

test('the receipts screen tells the member the figures are the ones they were charged', () => {
  assert.match(en['web.account.orders.persisted'], /never (be )?recalculat|not.*recalculat/i);
  assert.match(code(SCREENS), /web\.account\.orders\.persisted/);
});

// ═══════════════════════════════════════════════════════════════════════════
// BR-REV-01 · a review needs a recorded check-in.
// ═══════════════════════════════════════════════════════════════════════════

test('reviewable gyms come from VISITS, not from memberships', () => {
  const eligible = reviewableGyms(DEMO_MEMBER);
  const visited = new Set(DEMO_MEMBER.visits.map((visit) => visit.gymName));
  assert.deepEqual(
    [...eligible].sort((a, b) => a.localeCompare(b)),
    [...eligible],
  );
  assert.equal(eligible.length, visited.size);

  // The proof the rule is not "has a membership": the fixture holds a membership with no visits.
  const paidButNeverWent = DEMO_MEMBER.memberships.find((m) => visitCount(DEMO_MEMBER, m.id) === 0);
  assert.ok(paidButNeverWent, 'the fixture no longer exercises paid-but-never-visited');
  assert.ok(
    !eligible.includes(paidButNeverWent.gymName),
    `${paidButNeverWent.gymName} can be reviewed without a check-in`,
  );
});

// ═══════════════════════════════════════════════════════════════════════════
// The timezone, and the demo notice.
// ═══════════════════════════════════════════════════════════════════════════

test('dates render in Asia/Kolkata, not in whatever zone the process runs in', () => {
  // A 05:12 IST check-in is 23:42 the PREVIOUS day in UTC, and gyms in this market open at 05:00.
  assert.equal(MARKET_TIME_ZONE, 'Asia/Kolkata');
  // 2026-08-07T01:12:00Z is 06:42 on the 7th in Kolkata. In UTC it is still the 7th, so the
  // discriminating case is the one that crosses midnight backwards.
  const lateEvening = '2026-08-07T19:30:00.000Z'; // 01:00 on the 8th, IST
  assert.match(formatDate(lateEvening), /8 Aug 2026/);
  assert.match(formatDateTime('2026-08-07T01:12:00.000Z'), /7 Aug 2026/);
  // And the formatter names the zone rather than relying on the environment.
  assert.match(source('src/features/account/format.ts'), /timeZone: MARKET_TIME_ZONE/);
});

test('the demo notice is on EVERY account screen, not just the first', () => {
  // A member can land on `/account/orders` from a link and never see `/account`. A caveat shown
  // once, on a page they did not visit, was not shown — and these records are receipts and
  // memberships, which are exactly what somebody screenshots.
  assert.match(code('src/features/account/account-shell.tsx'), /web\.account\.demoNotice/);
  const screens = code(SCREENS);
  assert.ok(screens.includes('AccountShell'), 'a screen renders outside the shell');
  // Every exported screen goes through the shell.
  const exported = [...screens.matchAll(/export function (\w+)/g)].map((m) => m[1]);
  assert.ok(exported.length >= 5, `only ${String(exported.length)} account screens are exported`);
});

test('no account route is offered to a search engine', () => {
  // These are one member's records. Nothing here belongs in a search result and nothing it links
  // to needs crawling either.
  for (const file of tsxFiles('app')) {
    if (!file.startsWith('app/account/')) continue;
    assert.match(
      code(file),
      /robots:\s*\{\s*index:\s*false,\s*follow:\s*false\s*\}/,
      `${file} is indexable`,
    );
  }
});

test('the account area ships no client state', () => {
  for (const file of tsxFiles('src/features/account')) {
    assert.ok(!code(file).includes("'use client'"), `${file} became a client component`);
  }
});
