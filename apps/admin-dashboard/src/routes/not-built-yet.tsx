/**
 * A declared route whose screen has not been built.
 *
 * ┌─ WHY THIS EXISTS RATHER THAN A 404 ─────────────────────────────────────────────────────────┐
 * │ An omitted route 404s, and a 404 reads as a bug — somebody files a ticket, somebody else     │
 * │ investigates, and the answer is "that is next quarter". This says so on the screen, names    │
 * │ the milestone, and keeps the navigation honest.                                               │
 * │                                                                                              │
 * │ It also makes the remaining work countable: `admin-shell.spec.ts` asserts that every         │
 * │ `SCR-ADM-*` screen id appears exactly once across the route table, so a screen cannot be     │
 * │ silently dropped from the plan by being forgotten in a router file.                           │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 *
 * The screen id and milestone are NOT run through the i18n catalogue: they are identifiers, not
 * prose. Translating `SCR-ADM-007` would be wrong, and putting fourteen near-identical sentences
 * in the catalogue to interpolate them would be worse.
 */

export function NotBuiltYet({ screen, milestone }: { screen: string; milestone: string }) {
  return (
    <section className="rounded-card border border-subtle bg-surface-subtle p-inset-lg">
      <h1 className="text-2xl font-semibold text-content">{screen}</h1>
      <p className="mt-stack-sm max-w-ui text-base text-content-secondary">
        <span className="font-mono text-sm">{milestone}</span>
      </p>
    </section>
  );
}
