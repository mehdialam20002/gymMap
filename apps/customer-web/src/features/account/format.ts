/**
 * Dates and times for the account area — `LAUNCH_MARKET_INDIA.md`, `TR-24`.
 *
 * ┌─ THE TIMEZONE IS NAMED, ALWAYS ─────────────────────────────────────────────────────────────┐
 * │ `Asia/Kolkata` is passed explicitly to every formatter here. A date rendered in whatever     │
 * │ timezone the process happens to run in is the classic off-by-one: a check-in at 05:12 IST is │
 * │ 23:42 the PREVIOUS day in UTC, so a server in the wrong zone reports every early-morning     │
 * │ visit on the wrong date — and gyms in this market open at 05:00.                              │
 * │                                                                                              │
 * │ It is also why these are Server Component helpers rather than client ones. The BROWSER's     │
 * │ zone is the member's, which sounds right and is not: a member travelling abroad would see    │
 * │ their gym's attendance history shift by a day.                                                │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 */

/** The market's zone. One constant, so a second market is a parameter rather than a rewrite. */
export const MARKET_TIME_ZONE = 'Asia/Kolkata';

const DATE = new Intl.DateTimeFormat('en-IN', {
  dateStyle: 'medium',
  timeZone: MARKET_TIME_ZONE,
});

const DATE_TIME = new Intl.DateTimeFormat('en-IN', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: MARKET_TIME_ZONE,
});

export function formatDate(iso: string): string {
  return DATE.format(new Date(iso));
}

export function formatDateTime(iso: string): string {
  return DATE_TIME.format(new Date(iso));
}

/**
 * The `datetime` attribute for a `<time>` element.
 *
 * The machine-readable value stays the full instant — an assistive technology or a crawler
 * reading `datetime` gets the unambiguous UTC moment, while the text beside it is the local one
 * a member recognises. Rendering the local string into `datetime` would lose the offset and make
 * the value ambiguous, which is the opposite of what the attribute is for.
 */
export function machineDate(iso: string): string {
  return new Date(iso).toISOString();
}
