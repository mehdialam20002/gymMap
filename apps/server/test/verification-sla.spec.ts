/**
 * The verification SLA — `Admin.md` §5.1.1, `AdminDashboard.md` §6.2 and `UI-ADM-4`, `FR-ADMN-11`.
 *
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * THIS EXISTS BECAUSE THE FIRST IMPLEMENTATION GOT IT WRONG TWICE
 *
 * The console originally decided the SLA itself, with `waitingDays > 7`. Two defects in one
 * expression: the target is 72 HOURS, not seven days, and `UI-ADM-4` forbids the console holding
 * the number at all — *"the console reads it from the API and must never hard-code it"*.
 *
 * Then the server-side version missed the pause. `INFO_REQUESTED` stops the platform's clock,
 * because the applicant owes the next move — and §6.2 requires the wall-clock age to stay visible
 * anyway *"so a paused queue cannot hide a stalled application"*.
 *
 * So the assertions below are the three §5.1.1 boundaries, the pause, and the two properties an
 * SLA implementation is most tempted to break: clamping a breach at zero, and letting the target
 * become a constant.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { PlatformOverviewUseCase } from '../dist/admin/application/platform-overview.use-case.js';
import { appConfigSchema } from '../dist/common/config/app-config.schema.js';

const HOUR = 3_600_000;

/** A fixed instant. `AC-FND-13.3` — the ambient clock is not readable in a test either. */
const NOW = new Date('2026-08-08T12:00:00.000Z');

/**
 * The use case with a stub read port and a fixed clock.
 *
 * Hand-built rather than through the Nest container: the SLA is arithmetic over a status and two
 * instants, and standing up a module to assert "-1 is a breach" is a test nobody would write twice.
 */
function useCaseWith(rows: ReadonlyArray<{ status: string; createdAt: Date }>, targetHours = 72) {
  const port = {
    countGymsByStatus: () => Promise.resolve({}),
    listGyms: () =>
      Promise.resolve(
        rows.map((row, index) => ({
          id: `gym-${String(index)}`,
          legalName: 'Test Gym Private Limited',
          tradingName: 'Test Gym',
          entityType: 'PRIVATE_LIMITED',
          status: row.status,
          subscriptionStatus: 'ACTIVE',
          city: 'Pune',
          state: 'Maharashtra',
          gstin: null,
          commissionRateBps: 1200,
          createdAt: row.createdAt,
        })),
      ),
    countPeopleByRole: () => Promise.resolve({}),
    countPeople: () => Promise.resolve(0),
    countActiveSessions: () => Promise.resolve(0),
  };

  const clock = { now: () => NOW };
  const config = { VERIFICATION_SLA_TARGET_HOURS: targetHours };

  return new PlatformOverviewUseCase(port, clock, config);
}

const context = { userId: 'u-1', permission: 'onboarding.application.list_all', why: 'x'.repeat(24) };

/** One row, submitted `hoursAgo` before `NOW`. */
async function slaFor(status: string, hoursAgo: number, targetHours = 72) {
  const createdAt = new Date(NOW.getTime() - hoursAgo * HOUR);
  const [row] = await useCaseWith([{ status, createdAt }], targetHours).gyms(context, null);
  return row;
}

// ═══════════════════════════════════════════════════════════════════════════
// §5.1.1's three states, at their boundaries.
// ═══════════════════════════════════════════════════════════════════════════

test('WITHIN above 24 hours remaining', async () => {
  // 6 hours in on a 72-hour target: 66 remaining. §5.1.1: `WITHIN` is `hours_remaining > 24`.
  const row = await slaFor('SUBMITTED', 6);
  assert.equal(row?.sla?.state, 'WITHIN');
  assert.equal(row?.sla?.hours_remaining, 66);
});

test('APPROACHING at exactly 24 hours remaining, not 23', async () => {
  // The boundary, and the direction matters: §5.1.1 defines APPROACHING as
  // `0 < hours_remaining <= 24`, so 24 is already approaching. An off-by-one here costs an officer
  // a full day of warning on the one application that needed it.
  const row = await slaFor('SUBMITTED', 48);
  assert.equal(row?.sla?.hours_remaining, 24);
  assert.equal(row?.sla?.state, 'APPROACHING');
});

test('still APPROACHING at one hour remaining', async () => {
  const row = await slaFor('SUBMITTED', 71);
  assert.equal(row?.sla?.hours_remaining, 1);
  assert.equal(row?.sla?.state, 'APPROACHING');
});

test('BREACHED at exactly the target, because zero remaining is not "within"', async () => {
  const row = await slaFor('SUBMITTED', 72);
  assert.equal(row?.sla?.hours_remaining, 0);
  assert.equal(row?.sla?.state, 'BREACHED');
});

// ═══════════════════════════════════════════════════════════════════════════
// The breach stays visible, and stays measurable.
// ═══════════════════════════════════════════════════════════════════════════

test('hours_remaining goes NEGATIVE and is never clamped', async () => {
  // §6.2: "A breach shows negative `hours_remaining` and stays in the queue — a breach that
  // disappears is a breach nobody fixes." Clamping at zero would make a 2-hour breach and a
  // 4-week breach identical, which is the one distinction a breached queue is triaged on.
  const fresh = await slaFor('SUBMITTED', 74);
  const stale = await slaFor('SUBMITTED', 72 + 24 * 28);

  assert.equal(fresh?.sla?.hours_remaining, -2);
  assert.equal(stale?.sla?.hours_remaining, -672);
  assert.equal(stale?.sla?.state, 'BREACHED');
  assert.ok(
    (stale?.sla?.hours_remaining ?? 0) < (fresh?.sla?.hours_remaining ?? 0),
    'the older breach must sort as more urgent',
  );
});

test('a breached row is still returned by the query, not filtered out', async () => {
  const rows = await useCaseWith([
    { status: 'SUBMITTED', createdAt: new Date(NOW.getTime() - 200 * HOUR) },
  ]).gyms(context, null);

  assert.equal(rows.length, 1);
  assert.equal(rows[0]?.sla?.state, 'BREACHED');
});

// ═══════════════════════════════════════════════════════════════════════════
// The pause — the part the first implementation missed.
// ═══════════════════════════════════════════════════════════════════════════

test('INFO_REQUESTED pauses the clock', async () => {
  // The applicant owes the next move, so the wait is not the platform being slow. Without this an
  // application waiting on a gym for a week reads as the platform having breached its own SLA.
  const row = await slaFor('INFO_REQUESTED', 500);

  assert.equal(row?.sla?.state, 'PAUSED');
  assert.equal(row?.sla?.hours_remaining, null);
  assert.equal(row?.sla?.breaches_at, null);
});

test('a paused row still reports its WALL-CLOCK age, so the pause cannot hide it', async () => {
  // §6.2's anti-hiding measure, verbatim: the tooltip carries `age_hours_wall_clock` "so a paused
  // queue cannot hide a stalled application". 500 hours is three weeks; the pause must not make
  // that look like nothing.
  const row = await slaFor('INFO_REQUESTED', 500);
  assert.equal(row?.sla?.age_hours_wall_clock, 500);
  assert.equal(row?.age_hours, 500);
});

test('wall-clock age is present on every state, not only the paused one', async () => {
  for (const status of ['SUBMITTED', 'UNDER_REVIEW', 'INFO_REQUESTED']) {
    const row = await slaFor(status, 30);
    assert.equal(
      row?.sla?.age_hours_wall_clock,
      30,
      `${status} lost its wall-clock age — it is the only figure a pause cannot flatter`,
    );
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// No SLA where nobody owes a decision.
// ═══════════════════════════════════════════════════════════════════════════

test('a decided gym has no SLA at all', async () => {
  // A `WITHIN` state on an APPROVED gym would read as "still fine" about something nobody is
  // waiting for. `null` says there is nothing to be late for.
  for (const status of ['APPROVED', 'REJECTED', 'SUSPENDED', 'CLOSED', 'DRAFT']) {
    const row = await slaFor(status, 900);
    assert.equal(row?.sla, null, `${status} should carry no SLA`);
  }
});

test('all three open statuses carry one', async () => {
  for (const status of ['SUBMITTED', 'UNDER_REVIEW', 'INFO_REQUESTED']) {
    const row = await slaFor(status, 10);
    assert.notEqual(row?.sla, null, `${status} is an open state and must carry an SLA`);
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// UI-ADM-4 — the target is configuration, and it is on the wire.
// ═══════════════════════════════════════════════════════════════════════════

test('the target comes from configuration and reaches the client', async () => {
  // `UI-ADM-4`: the SLA target "is configuration, not a constant. The console reads it from the API
  // and must never hard-code it." So it has to be BOTH configurable and present in the response —
  // a configurable value the client cannot see is one the client will assume instead.
  const row = await slaFor('SUBMITTED', 10, 48);
  assert.equal(row?.sla?.target_hours, 48);
  assert.equal(row?.sla?.hours_remaining, 38);
});

test('changing the target moves the state, not just the number', async () => {
  // 30 hours in. Within a 72-hour target; breached against a 24-hour one. If this only changed
  // `target_hours` and not `state`, the threshold would still be hard-coded somewhere.
  assert.equal((await slaFor('SUBMITTED', 30, 72))?.sla?.state, 'WITHIN');
  assert.equal((await slaFor('SUBMITTED', 30, 24))?.sla?.state, 'BREACHED');
});

test('VERIFICATION_SLA_TARGET_HOURS defaults to 72 and refuses zero', async () => {
  // 72 is `Admin.md` §5.1.1's launch value. A target of 0 would put every application into BREACHED
  // the instant it arrived, and a target measured in years is a typo — both are refused by the
  // schema rather than discovered in production.
  const parsed = appConfigSchema._def.schema.shape.VERIFICATION_SLA_TARGET_HOURS;
  assert.equal(parsed.parse(undefined), 72);
  assert.throws(() => parsed.parse('0'));
  assert.throws(() => parsed.parse('9000'));
  assert.equal(parsed.parse('48'), 48);
});

// ═══════════════════════════════════════════════════════════════════════════
// The console holds no threshold. This is the assertion UI-ADM-4 actually needs.
// ═══════════════════════════════════════════════════════════════════════════

test('UI-ADM-4 — the admin console names no SLA threshold anywhere', () => {
  // The defect this replaces was a literal `> 7` in the console. Rather than trusting that it does
  // not come back, this reads the two files that would carry it.
  const root = resolve('../..');
  const sources = [
    'apps/admin-dashboard/src/routes/sla-chip.tsx',
    'apps/admin-dashboard/src/routes/approval-queue.route.tsx',
    'apps/admin-dashboard/src/routes/platform-dashboard.route.tsx',
  ];

  for (const rel of sources) {
    const text = readFileSync(resolve(root, rel), 'utf8')
      // Comments stripped, because the reason 24 and 72 must not appear in code is explained in
      // prose that necessarily mentions 24 and 72.
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\/\/[^\n]*/g, '');

    assert.ok(
      !/hours_remaining\s*[<>]/.test(text),
      `${rel} compares hours_remaining against a threshold — §5.1.1 makes the state server-computed`,
    );
    assert.ok(
      !/\b(?:72|24)\s*(?:\*|hours?)/i.test(text),
      `${rel} appears to hard-code an SLA duration, which UI-ADM-4 forbids`,
    );
  }
});
