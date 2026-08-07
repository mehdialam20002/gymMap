/**
 * M-020 · `common/index.ts` exports the tokens `CommonModule` actually registers.
 *
 * ┌─ WHY THIS NEEDS A TEST AT ALL ──────────────────────────────────────────────────────────────┐
 * │ Until M-020 the barrel exported `CLOCK` and `ID_GENERATOR` from                             │
 * │ `common/application/ports/`, while `CommonModule` registered providers against the          │
 * │ different `Symbol()` values in `common/clock/clock.port.ts`.                                 │
 * │                                                                                              │
 * │ Every check in the pipeline passed. `tsc` passes — both are `symbol`, and the two `Clock`   │
 * │ interfaces are structurally compatible for `now()`. ESLint passes. `depcruise` passes. The  │
 * │ two files look correct side by side. The only symptom was a runtime                          │
 * │ "Nest can't resolve dependencies" in whichever module first imported from the public         │
 * │ surface — and nothing had, so it sat there from M-016 to M-020.                              │
 * │                                                                                              │
 * │ Two `Symbol()` calls with the same DESCRIPTION are different values. `Symbol('Clock')` and   │
 * │ `Symbol('Clock')` are not equal, and `String(sym)` is identical for both — so an assertion   │
 * │ on the description would pass against the bug. Identity is the only comparison that works.  │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { CLOCK, ID_GENERATOR } from '../dist/common/index.js';
import {
  CLOCK as CLOCK_FROM_PORT,
  ID_GENERATOR as ID_GENERATOR_FROM_PORT,
} from '../dist/common/clock/clock.port.js';
import { CommonModule } from '../dist/common/common.module.js';

/** The `provide` value of every provider `CommonModule` declares. */
function registeredTokens(): unknown[] {
  const providers = (Reflect.getMetadata('providers', CommonModule) ?? []) as unknown[];
  return providers.map((provider) =>
    typeof provider === 'object' && provider !== null && 'provide' in provider
      ? (provider as { provide: unknown }).provide
      : provider,
  );
}

test('the barrel exports the SAME symbol object the port declares', () => {
  // `assert.equal` on symbols is identity, which is exactly the comparison needed. A duplicate
  // `Symbol('Clock')` fails here and passes every other check in the repository.
  assert.equal(CLOCK, CLOCK_FROM_PORT, 'common/index.ts re-exports a different CLOCK symbol');
  assert.equal(ID_GENERATOR, ID_GENERATOR_FROM_PORT);
});

test('CommonModule registers a provider for exactly those symbols', () => {
  // The half that matters. An exported token no provider answers is a runtime failure in the
  // first module that injects it, and a compile-time success everywhere.
  const tokens = registeredTokens();

  assert.ok(
    tokens.includes(CLOCK),
    'CommonModule registers no provider for the CLOCK exported by common/index.ts. Any module ' +
      'injecting it fails at runtime with "Nest can\'t resolve dependencies" — and nothing in ' +
      'typecheck, lint or depcruise can see it.',
  );
  assert.ok(tokens.includes(ID_GENERATOR), 'CommonModule registers no provider for ID_GENERATOR');
});

test('CommonModule EXPORTS them, or no other module can inject them', () => {
  // Registering without exporting makes the provider private to CommonModule. Same runtime
  // failure, different cause, and equally invisible to every static check.
  const exported = (Reflect.getMetadata('exports', CommonModule) ?? []) as unknown[];
  assert.ok(exported.includes(CLOCK), 'CLOCK is registered but not exported');
  assert.ok(exported.includes(ID_GENERATOR), 'ID_GENERATOR is registered but not exported');
});

test('there is exactly ONE clock port module in the tree', async () => {
  // The structural cause: a second file declaring the same token names. Asserting on the
  // symbols alone would not catch a THIRD copy that nothing imports yet — which is precisely
  // the state the deleted `common/application/ports/clock.port.ts` was in for four milestones.
  const { readdirSync, existsSync } = await import('node:fs');
  const { resolve, dirname } = await import('node:path');

  let dir = process.cwd();
  for (let depth = 0; depth < 8; depth += 1) {
    if (existsSync(resolve(dir, 'pnpm-workspace.yaml'))) break;
    const parent = dirname(dir);
    if (parent === dir) throw new Error('could not locate the repository root');
    dir = parent;
  }

  const found: string[] = [];
  const walk = (path: string): void => {
    for (const entry of readdirSync(path, { withFileTypes: true })) {
      if (entry.name === 'node_modules' || entry.name === 'dist') continue;
      const child = resolve(path, entry.name);
      if (entry.isDirectory()) walk(child);
      else if (/^(clock|id-generator)\.port\.ts$/.test(entry.name)) found.push(child);
    }
  };
  walk(resolve(dir, 'apps/server/src'));

  assert.equal(
    found.length,
    1,
    `${found.length} clock/id-generator port files exist:\n  ${found.join('\n  ')}\n\n` +
      'A second file declaring CLOCK or ID_GENERATOR is a second Symbol(), and a consumer that ' +
      'imports the wrong one fails at runtime while passing typecheck, lint and depcruise.',
  );
  assert.match(found[0]!, /common[\\/]clock[\\/]clock\.port\.ts$/);
});

test('the Clock interface is the one-method shape the adapters implement', async () => {
  // The deleted duplicate declared `{ now, nowMs }`. Nothing implemented `nowMs`, so a consumer
  // typed against that interface would compile against the token and fail on the call.
  const { SystemClock } = await import('../dist/common/clock/system-clock.adapter.js');
  const { FixedClock } = await import('../dist/common/clock/fixed-clock.adapter.js');

  const system = new SystemClock();
  const fixed = new FixedClock('2026-08-07T12:00:00Z');

  assert.ok(system.now() instanceof Date);
  assert.equal(fixed.now().toISOString(), '2026-08-07T12:00:00.000Z');
  assert.equal(
    'nowMs' in system,
    false,
    'SystemClock grew a nowMs(). If the Clock interface is widening, widen it in one place — ' +
      'the deleted duplicate port declared nowMs() that no adapter ever implemented.',
  );
});
