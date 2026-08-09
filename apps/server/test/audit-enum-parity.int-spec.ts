/**
 * Every `entityType` and `action` the source writes is a REAL enum value — `BR-DAT-01`.
 *
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * THIS FILE EXISTS BECAUSE SIX USE CASES SHIPPED WRITING VALUES POSTGRES REJECTS
 *
 * `change-user-role`, all three MFA use cases and both impersonation use cases wrote
 * `'user_role'`, `'user_mfa'` and `'user_session'`. The enum holds `USER_ROLE`, `USER` and
 * `AUTH_SESSION` — uppercase, and two of the three names simply do not exist.
 *
 * Every one of those writes would have thrown `invalid input value for enum`. And the audit
 * repository SWALLOWS write failures by design, so the effect was not an error: it was no row. Six
 * code paths silently writing nothing to the audit log, with green unit tests, because a doubled
 * port accepts any string.
 *
 * Only the database knows the enum, so only an integration test can check this.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const CONTAINER = 'gymmap-postgres';

function enumValues(typeName: string): string[] {
  const out = execFileSync(
    'docker',
    [
      'exec',
      CONTAINER,
      'psql',
      '-U',
      'postgres',
      '-d',
      'gymmap',
      '-tAc',
      `SELECT enumlabel FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid WHERE t.typname = '${typeName}'`,
    ],
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
  );
  return out
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

/** Every `.ts` under `src/`, so a new module cannot opt out by being new. */
function sourceFiles(dir = 'src'): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return sourceFiles(full);
    return full.endsWith('.ts') ? [full] : [];
  });
}

let available = false;

before(() => {
  try {
    enumValues('audit_entity_type_enum');
    available = true;
  } catch {
    available = false;
    console.error(
      '\n  SKIPPING the audit enum parity check — no database reachable. ' +
        'It is the ONLY assertion that an audit write will not be silently discarded.\n',
    );
  }
});

const it = (name: string, fn: () => void) =>
  test(name, (t) => {
    if (!available) return t.skip('no database');
    fn();
  });

/** Literal values assigned to a field, across the whole source tree. */
function literalsFor(field: string): { file: string; value: string }[] {
  /*
   * `String.raw`, and that is not style.
   *
   * The first version was a plain template literal containing `\s`. JavaScript collapses an
   * unrecognised escape in a template to the bare character, so the pattern became
   * `entityType:s*'…'` — it required a literal `s` after the colon and matched nothing. Every
   * assertion below passed while checking NOTHING, which is precisely the failure this file was
   * written to catch in other people's code. Proved by breaking a real value and watching the
   * gate stay green.
   */
  const pattern = new RegExp(String.raw`${field}:\s*'([^']+)'`, 'g');
  return sourceFiles().flatMap((file) =>
    [...readFileSync(file, 'utf8').matchAll(pattern)].map((match) => ({
      file,
      value: match[1] as string,
    })),
  );
}

it('every entityType written in src/ is a value audit_entity_type_enum accepts', () => {
  const valid = new Set(enumValues('audit_entity_type_enum'));
  assert.ok(valid.size > 0, 'the enum came back empty — the query is wrong, not the code');

  const offenders = literalsFor('entityType')
    .filter((hit) => !valid.has(hit.value))
    .map((hit) => `${hit.file}: '${hit.value}'`);

  assert.deepEqual(
    offenders,
    [],
    'these entityType values are not in audit_entity_type_enum. The INSERT throws, the audit ' +
      'repository swallows it, and the row is silently never written:\n  ' +
      offenders.join('\n  ') +
      `\n\nValid values: ${[...valid].sort().join(', ')}`,
  );
});

it('every audit action written in src/ is a value audit_action_enum accepts', () => {
  const valid = new Set(enumValues('audit_action_enum'));
  assert.ok(valid.size > 0);

  // Scoped to `action:` inside an audit entry — other modules use the word for their own things,
  // so a false positive here would be a test nobody can satisfy.
  const offenders = literalsFor('action')
    .filter((hit) => hit.file.includes('use-case') || hit.file.includes('interceptor'))
    .filter((hit) => !valid.has(hit.value))
    .map((hit) => `${hit.file}: '${hit.value}'`);

  assert.deepEqual(offenders, [], `not in audit_action_enum:\n  ${offenders.join('\n  ')}`);
});

it('every actorType written in src/ is a value actor_type_enum accepts', () => {
  const valid = new Set(enumValues('actor_type_enum'));
  assert.ok(valid.size > 0);

  const offenders = literalsFor('actorType')
    .filter((hit) => !valid.has(hit.value))
    .map((hit) => `${hit.file}: '${hit.value}'`);

  assert.deepEqual(offenders, [], `not in actor_type_enum:\n  ${offenders.join('\n  ')}`);
});
