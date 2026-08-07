/**
 * Time and the business day — `TR-07`, `TR-24`, `AC-FND-13.2`, `AC-FND-13.4`, `FR-INV-02`.
 *
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * MIDNIGHT IN A BENGALURU GYM IS 18:30 UTC ON THE PREVIOUS DAY
 *
 * `TR-24`. A naive hourly UTC cron fires at the wrong local moment for every one of the 24 §C5
 * jobs. A "daily at midnight" expiry sweep running at 00:00 UTC runs at 05:30 local — five and a
 * half hours into the business day, after members have already been turned away at the door by a
 * membership the system still considered active.
 *
 * Three zones are exercised throughout, and each catches a different wrong assumption:
 *
 *   Asia/Kolkata     +05:30, no DST — the launch market
 *   Asia/Colombo     the SAME offset, a different zone — catches code comparing offsets
 *   Asia/Kathmandu   +05:45 — catches anything assuming offsets are whole hours
 *   America/New_York DST — so the design does not DEPEND on India having none
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  INDIA_FY_START_MONTH,
  InvalidFyStartMonthError,
  InvalidTimeZoneError,
  InvalidWindowError,
  SEED_ZONES,
  businessDay,
  businessDayBounds,
  dailyWindow,
  daysBetween,
  extendMonthly,
  financialYear,
  financialYearOf,
  ianaTimeZone,
  indianFinancialYearOf,
  isWithin,
  isoDateIn,
  localDayEndUtc,
  localMidnightUtc,
  monthlyWindow,
  nextLocalTimeUtc,
  offsetMinutes,
  overlaps,
} from '../dist/index.js';

const KOLKATA = ianaTimeZone(SEED_ZONES.kolkata);
const COLOMBO = ianaTimeZone(SEED_ZONES.colombo);
const KATHMANDU = ianaTimeZone(SEED_ZONES.kathmandu);
const NEW_YORK = ianaTimeZone('America/New_York');
const UTC = ianaTimeZone('UTC');

// ═══════════════════════════════════════════════════════════════════════════
// The zone itself.
// ═══════════════════════════════════════════════════════════════════════════

test('an abbreviation is refused, because IST is three different zones', () => {
  // IST means Indian, Irish and Israel Standard Time. A fixed offset is worse still: it cannot
  // express a zone whose rules change, and every zone's rules eventually do.
  assert.throws(() => ianaTimeZone('IST'), InvalidTimeZoneError);
  assert.throws(() => ianaTimeZone('EST'), InvalidTimeZoneError);
  assert.throws(() => ianaTimeZone('+05:30'), InvalidTimeZoneError);
  assert.throws(() => ianaTimeZone('Not/AZone'), InvalidTimeZoneError);
  assert.equal(ianaTimeZone('Asia/Kolkata'), 'Asia/Kolkata');
  assert.equal(ianaTimeZone('UTC'), 'UTC');
});

test('AC-FND-13.4 — the three seed zones have the offsets they were chosen for', () => {
  const instant = new Date('2026-08-07T12:00:00Z');
  assert.equal(offsetMinutes(instant, KOLKATA), 330); // +05:30
  assert.equal(offsetMinutes(instant, COLOMBO), 330); // the SAME offset, a different zone
  assert.equal(offsetMinutes(instant, KATHMANDU), 345); // +05:45 — not a whole hour
  assert.equal(offsetMinutes(instant, UTC), 0);
});

test('a DST zone reports DIFFERENT offsets in summer and winter', () => {
  // The control for the whole design. If offsetMinutes returned a constant, every assertion
  // below would still pass for India — and the code would be wrong everywhere else.
  const summer = offsetMinutes(new Date('2026-07-01T12:00:00Z'), NEW_YORK);
  const winter = offsetMinutes(new Date('2026-01-01T12:00:00Z'), NEW_YORK);
  assert.equal(summer, -240); // EDT
  assert.equal(winter, -300); // EST
  assert.notEqual(summer, winter, 'offsetMinutes is not zone-aware at all');
});

// ═══════════════════════════════════════════════════════════════════════════
// TR-24 — the assertion this whole file exists for.
// ═══════════════════════════════════════════════════════════════════════════

test('TR-24 — local midnight in Kolkata is 18:30 UTC on the PREVIOUS day', () => {
  assert.equal(localMidnightUtc('2026-08-07', KOLKATA).toISOString(), '2026-08-06T18:30:00.000Z');
});

test('TR-24 — Kathmandu is 18:15 UTC, because +05:45 is not a whole hour', () => {
  assert.equal(localMidnightUtc('2026-08-07', KATHMANDU).toISOString(), '2026-08-06T18:15:00.000Z');
});

test('the local day is 24 hours long in India, and ends where the next begins', () => {
  const start = localMidnightUtc('2026-08-07', KOLKATA);
  const end = localDayEndUtc('2026-08-07', KOLKATA);
  assert.equal(end.toISOString(), '2026-08-07T18:30:00.000Z');
  assert.equal(end.getTime() - start.getTime(), 86_400_000);
  // And it tiles exactly with the next day — no gap, no overlap.
  assert.equal(end.getTime(), localMidnightUtc('2026-08-08', KOLKATA).getTime());
});

test('a DST day is 23 or 25 hours, and the bounds are still correct', () => {
  // The reason localDayEndUtc derives the next DATE rather than adding 24 hours. India has no
  // DST, so a one-pass implementation would pass every assertion above and be wrong here.
  const springForward =
    localDayEndUtc('2026-03-08', NEW_YORK).getTime() -
    localMidnightUtc('2026-03-08', NEW_YORK).getTime();
  const fallBack =
    localDayEndUtc('2026-11-01', NEW_YORK).getTime() -
    localMidnightUtc('2026-11-01', NEW_YORK).getTime();

  assert.equal(springForward, 23 * 3_600_000, 'the spring-forward day is not 23 hours');
  assert.equal(fallBack, 25 * 3_600_000, 'the fall-back day is not 25 hours');
});

test('isoDateIn reports the LOCAL date, which straddles the UTC one', () => {
  // 19:00 UTC on the 6th is already the 7th in India. Every "which business day is this" answer
  // depends on this and on nothing else.
  const instant = new Date('2026-08-06T19:00:00Z');
  assert.equal(isoDateIn(instant, KOLKATA), '2026-08-07');
  assert.equal(isoDateIn(instant, UTC), '2026-08-06');
  assert.equal(businessDay(instant, KOLKATA), '2026-08-07');
});

test('localMidnightUtc refuses anything that is not YYYY-MM-DD', () => {
  assert.throws(() => localMidnightUtc('07-08-2026', KOLKATA), TypeError);
  assert.throws(() => localMidnightUtc('2026-8-7', KOLKATA), TypeError);
});

test('businessDayBounds contains its own instant, and excludes the next day', () => {
  const instant = new Date('2026-08-07T03:00:00Z'); // 08:30 local
  const { startsAt, endsAt } = businessDayBounds(instant, KOLKATA);
  assert.ok(instant >= startsAt && instant < endsAt);
  assert.equal(startsAt.toISOString(), '2026-08-06T18:30:00.000Z');
});

test('daysBetween counts CALENDAR days, not 86,400,000-millisecond blocks', () => {
  // The division form is wrong across a DST transition and wrong by a fraction for any zone
  // whose offset is not a whole hour — which includes India.
  const from = new Date('2026-08-06T19:00:00Z'); // 7 Aug local
  const to = new Date('2026-08-08T05:00:00Z'); // 8 Aug local, 10 h later in wall time
  assert.equal(daysBetween(from, to, KOLKATA), 1);
  assert.equal(daysBetween(from, from, KOLKATA), 0);
  assert.equal(daysBetween(to, from, KOLKATA), -1);

  // Across the spring-forward day the naive division gives 0.958 days and rounds to 1 by luck;
  // this counts 1 because the calendar says so.
  assert.equal(
    daysBetween(new Date('2026-03-08T06:00:00Z'), new Date('2026-03-09T06:00:00Z'), NEW_YORK),
    1,
  );
});

// ═══════════════════════════════════════════════════════════════════════════
// TR-24 — scheduling. The failure this prevents is a job at the wrong local hour.
// ═══════════════════════════════════════════════════════════════════════════

test('TR-24 — a job scheduled for local midnight fires at 18:30 UTC', () => {
  const after = new Date('2026-08-06T12:00:00Z'); // 17:30 local on the 6th
  assert.equal(nextLocalTimeUtc(after, '00:00', KOLKATA).toISOString(), '2026-08-06T18:30:00.000Z');
});

test('a time already past today rolls to tomorrow, not to a negative delay', () => {
  const after = new Date('2026-08-06T19:00:00Z'); // 00:30 local on the 7th — midnight has gone
  assert.equal(nextLocalTimeUtc(after, '00:00', KOLKATA).toISOString(), '2026-08-07T18:30:00.000Z');
});

test('a mid-day local time resolves correctly, including across the UTC date line', () => {
  const after = new Date('2026-08-07T00:00:00Z'); // 05:30 local
  assert.equal(nextLocalTimeUtc(after, '06:00', KOLKATA).toISOString(), '2026-08-07T00:30:00.000Z');
  assert.equal(nextLocalTimeUtc(after, '23:30', KOLKATA).toISOString(), '2026-08-07T18:00:00.000Z');
});

test('nextLocalTimeUtc refuses a malformed time', () => {
  const after = new Date('2026-08-07T00:00:00Z');
  assert.throws(() => nextLocalTimeUtc(after, '6:00', KOLKATA), TypeError);
  assert.throws(() => nextLocalTimeUtc(after, '25:00', KOLKATA), RangeError);
  assert.throws(() => nextLocalTimeUtc(after, '06:60', KOLKATA), RangeError);
});

// ═══════════════════════════════════════════════════════════════════════════
// Validity windows — half-open, always.
// ═══════════════════════════════════════════════════════════════════════════

test('BR-MEM-01 — a window is [start, end) and consecutive windows TILE', () => {
  const first = monthlyWindow('2026-04-01', 1, KOLKATA);
  const second = monthlyWindow('2026-05-01', 1, KOLKATA);

  assert.equal(first.endsAt.getTime(), second.startsAt.getTime(), 'a gap or an overlap');
  assert.equal(isWithin(first.endsAt, first), false, 'the end instant is INSIDE the window');
  assert.equal(isWithin(first.endsAt, second), true, 'the boundary instant belongs to neither');
  assert.equal(isWithin(first.startsAt, first), true, 'the start instant is excluded');
  assert.equal(overlaps(first, second), false, 'touching windows report as overlapping');
});

test('BR-MEM-01 — a month is a CALENDAR month, clamped at a short February', () => {
  // 31 Jan + 1 month is 28 Feb, not 2 March. A member charged again on 2 March would be right
  // to complain.
  assert.equal(isoDateIn(monthlyWindow('2026-01-31', 1, KOLKATA).endsAt, KOLKATA), '2026-02-28');
  // And 2028 is a leap year.
  assert.equal(isoDateIn(monthlyWindow('2028-01-31', 1, KOLKATA).endsAt, KOLKATA), '2028-02-29');
  // A year rolls over correctly.
  assert.equal(isoDateIn(monthlyWindow('2026-12-15', 1, KOLKATA).endsAt, KOLKATA), '2027-01-15');
  assert.equal(isoDateIn(monthlyWindow('2026-04-01', 12, KOLKATA).endsAt, KOLKATA), '2027-04-01');
});

test('a renewal continues from the previous END, not from today', () => {
  // Renewing three days early must not cost the member three days.
  const first = monthlyWindow('2026-04-01', 1, KOLKATA);
  const renewed = extendMonthly(first, 1, KOLKATA);
  assert.equal(renewed.startsAt.getTime(), first.startsAt.getTime());
  assert.equal(isoDateIn(renewed.endsAt, KOLKATA), '2026-06-01');
});

test('a daily window is midnight to midnight, and survives a DST day', () => {
  const week = dailyWindow('2026-08-07', 7, KOLKATA);
  assert.equal(isoDateIn(week.endsAt, KOLKATA), '2026-08-14');
  assert.equal(week.endsAt.getTime() - week.startsAt.getTime(), 7 * 86_400_000);

  // Across spring-forward the elapsed time is 23 hours short of 7 days, and the END DATE is
  // still correct — which is the property, not the duration.
  const dstWeek = dailyWindow('2026-03-05', 7, NEW_YORK);
  assert.equal(isoDateIn(dstWeek.endsAt, NEW_YORK), '2026-03-12');
});

test('windows refuse inputs that would silently produce a wrong duration', () => {
  assert.throws(() => monthlyWindow('2026-04-01', 0, KOLKATA), InvalidWindowError);
  assert.throws(() => monthlyWindow('2026-04-01', -1, KOLKATA), InvalidWindowError);
  assert.throws(() => monthlyWindow('2026-04-01', 1.5, KOLKATA), InvalidWindowError);
  assert.throws(() => monthlyWindow('01-04-2026', 1, KOLKATA), InvalidWindowError);
  assert.throws(() => dailyWindow('2026-04-01', 0, KOLKATA), InvalidWindowError);
  assert.throws(() => dailyWindow('2026-04-01', 1.5, KOLKATA), InvalidWindowError);
});

test('overlapping windows are detected in both directions', () => {
  const a = monthlyWindow('2026-04-01', 2, KOLKATA);
  const b = monthlyWindow('2026-05-01', 2, KOLKATA);
  assert.equal(overlaps(a, b), true);
  assert.equal(overlaps(b, a), true);
  assert.equal(overlaps(a, monthlyWindow('2026-06-01', 1, KOLKATA)), false);
});

// ═══════════════════════════════════════════════════════════════════════════
// The financial year — FR-INV-02, and the 18:30 boundary that decides a year.
// ═══════════════════════════════════════════════════════════════════════════

test('FR-INV-02 — India FY 2026-27 runs from 1 April 2026 local midnight', () => {
  const fy = financialYear(2026, INDIA_FY_START_MONTH, KOLKATA);
  assert.equal(fy.label, '2026-27');
  assert.equal(fy.startsAt.toISOString(), '2026-03-31T18:30:00.000Z');
  assert.equal(fy.endsAt.toISOString(), '2027-03-31T18:30:00.000Z');
});

test('FR-INV-02 — 18:45 UTC on 31 March is the NEW financial year', () => {
  // The trap, stated as the assertion. A UTC-based comparison puts this invoice in the old year
  // — off by a year, in a GAPLESS series, on a document a tax authority reads. It cannot be
  // renumbered; the correction is a credit note and a new invoice.
  const justAfterRollover = new Date('2026-03-31T18:45:00Z');
  assert.equal(financialYearOf(justAfterRollover, 4, KOLKATA).startYear, 2026);

  const justBefore = new Date('2026-03-31T18:15:00Z');
  assert.equal(financialYearOf(justBefore, 4, KOLKATA).startYear, 2025);

  // And the UTC control: both instants are 31 March in UTC, so a UTC comparison gets one wrong.
  assert.equal(isoDateIn(justAfterRollover, UTC), '2026-03-31');
  assert.equal(isoDateIn(justBefore, UTC), '2026-03-31');
});

test('the start month is a PARAMETER — a January FY is the calendar year', () => {
  // Hardcoding 4 would work and be wrong at the second market. A January start means the FY IS
  // the calendar year, and labelling that `2026-27` would be wrong on every invoice.
  const calendarFy = financialYear(2026, 1, KOLKATA);
  assert.equal(calendarFy.label, '2026');
  assert.equal(financialYear(2026, 7, KOLKATA).label, '2026-27');
  // The century rolls correctly.
  assert.equal(financialYear(2099, 4, KOLKATA).label, '2099-00');
});

test('an invalid start month is refused, naming where the value comes from', () => {
  assert.throws(() => financialYear(2026, 0, KOLKATA), InvalidFyStartMonthError);
  assert.throws(() => financialYear(2026, 13, KOLKATA), InvalidFyStartMonthError);
  assert.throws(() => financialYearOf(new Date(), 0, KOLKATA), InvalidFyStartMonthError);
  assert.throws(() => financialYear(2026, 4.5, KOLKATA), /tax profile/);
});

test('the India convenience says "India" out loud rather than defaulting', () => {
  const fy = indianFinancialYearOf(new Date('2026-08-07T12:00:00Z'));
  assert.equal(fy.startYear, 2026);
  assert.equal(fy.label, '2026-27');
  assert.equal(INDIA_FY_START_MONTH, 4);
});

test('a FY contains its own instants and excludes the next year', () => {
  const fy = financialYear(2026, 4, KOLKATA);
  assert.equal(isWithin(fy.startsAt, fy), true);
  assert.equal(isWithin(fy.endsAt, fy), false);
  assert.equal(isWithin(new Date('2026-12-31T12:00:00Z'), fy), true);
});
