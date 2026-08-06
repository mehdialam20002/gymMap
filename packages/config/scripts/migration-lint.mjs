/**
 * M-006 · `migration-lint` — MigrationStrategy.md §2.4, PM-8, PM-9, PM-10, MF3.
 *
 * A migration is the one artefact in this system with no undo. `git revert` restores a file; it
 * does not un-drop a column. Everything below is a rule that someone would otherwise have to
 * remember at the exact moment they are least likely to — writing a migration under time
 * pressure to fix something in production.
 *
 * Each failure names its rule id, because "invalid migration" sends a person to a 900-line
 * specification to work out which of thirty rules they broke.
 */

import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs';
import { join, resolve, basename } from 'node:path';

/** §2.4 — the closed verb list. A name outside it means the change was not classified. */
export const VERBS = [
  'create',
  'add',
  'drop',
  'rename',
  'alter',
  'backfill',
  'enable',
  'grant',
  'revoke',
  'partition',
  'index',
  'seed',
];

/** MG3 — the expand/migrate/contract phase, which decides whether a rollback is free. */
export const PHASES = ['expand', 'migrate', 'contract'];

/** §2.4 — every header key, in order. */
export const HEADER_KEYS = [
  'phase',
  'requirement',
  'tables',
  'rls',
  'grants',
  'append_only',
  'partitioned',
  'max_lock',
  'rewrite',
  'est_duration',
  'backfill_job',
  'rollback',
  'concurrent_steps',
  'reviewers',
  'docs',
];

/** §4.4 ceilings. CI must fail EARLIER than production, never later. */
export const LOCK_TIMEOUT_CEILING_MS = 5_000;
export const STATEMENT_TIMEOUT_CEILING_MS = 300_000;

const DURATION = /^'?(\d+)(ms|s|min)'?$/;

function toMs(raw) {
  const m = DURATION.exec(raw.trim());
  if (!m) return null;
  const n = Number(m[1]);
  return m[2] === 'ms' ? n : m[2] === 's' ? n * 1000 : n * 60_000;
}

/** Strips `--` comments so a rule never fires on prose that merely discusses it. */
function executableOnly(sql) {
  return sql
    .split('\n')
    .map((line) => line.replace(/--.*$/, ''))
    .join('\n');
}

export function lintMigration(name, sql) {
  const problems = [];
  const fail = (rule, message) => problems.push({ migration: name, rule, message });
  const code = executableOnly(sql);

  // --- naming: <UTC timestamp>_<phase>_<verb>_<subject>, or the one exception ------------
  if (name !== '0_init') {
    const parts = /^(\d{14})_([a-z]+)_([a-z]+)_(.+)$/.exec(name);
    if (!parts) {
      fail(
        'MF3',
        `"${name}" is not <14-digit UTC timestamp>_<phase>_<verb>_<subject>. The timestamp is ` +
          `what orders migrations across branches — two developers who both name a file ` +
          `"add_column" get a merge whose apply order depends on nothing.`,
      );
    } else {
      const [, , phase, verb] = parts;
      if (!PHASES.includes(phase)) {
        fail('MF3', `"${name}" has phase "${phase}"; expected one of ${PHASES.join(' | ')}.`);
      }
      if (!VERBS.includes(verb)) {
        fail(
          'PM-verb',
          `"${name}" uses the verb "${verb}", which is outside the closed list ` +
            `(${VERBS.join(' · ')}). A verb outside the list means the change was never ` +
            `classified, and the phase/rollback analysis was therefore never done.`,
        );
      }
    }
  }

  // --- §2.4 header block ------------------------------------------------------------------
  const header = {};
  for (const line of sql.split('\n')) {
    const m = /^--\s{1,20}([a-z_]+):\s+(.+?)\s*(?:--.*)?$/.exec(line);
    if (m && HEADER_KEYS.includes(m[1])) header[m[1]] ??= m[2].trim();
  }
  for (const key of HEADER_KEYS) {
    if (!(key in header)) {
      fail(
        '§2.4',
        `header key "${key}" is missing. The header is what a reviewer reads first and what ` +
          `this linter parses; an absent key is an unanswered question, not a default.`,
      );
    }
  }
  if (header.phase && !PHASES.includes(header.phase.split(/\s/)[0])) {
    fail('MG3', `header phase "${header.phase}" is not ${PHASES.join(' | ')}.`);
  }
  if (header.requirement && !/[A-Z]{2,}-[A-Z0-9]+|§|ADR-\d{4}|R-M\d/.test(header.requirement)) {
    fail(
      '§2.4',
      `header "requirement" cites no identifier. A schema change nobody can trace to a ` +
        `requirement is a schema change nobody can safely reverse.`,
    );
  }

  // --- PM-8: the first two executable statements ------------------------------------------
  const statements = code
    .split(';')
    .map((s) => s.trim())
    .filter(Boolean);

  const first = statements[0] ?? '';
  const second = statements[1] ?? '';

  if (!/^SET\s+LOCAL\s+lock_timeout\s*=/i.test(first)) {
    fail(
      'PM-8',
      `the first statement must be "SET LOCAL lock_timeout". Prisma wraps each migration in one ` +
        `transaction, so SET LOCAL is scoped exactly to it. Without a lock_timeout the ` +
        `migration waits indefinitely behind a long transaction while a queue of blocked ` +
        `queries builds behind IT — a brief schema change becomes an outage.`,
    );
  }
  if (!/^SET\s+LOCAL\s+statement_timeout\s*=/i.test(second)) {
    fail('PM-8', `the second statement must be "SET LOCAL statement_timeout".`);
  }

  const lock = /SET\s+LOCAL\s+lock_timeout\s*=\s*([^;\s]+)/i.exec(code);
  if (lock) {
    const ms = toMs(lock[1]);
    if (ms === null) fail('PM-8', `lock_timeout "${lock[1]}" is not a recognised duration.`);
    else if (ms > LOCK_TIMEOUT_CEILING_MS) {
      fail('§4.4', `lock_timeout ${lock[1]} exceeds the ${LOCK_TIMEOUT_CEILING_MS} ms ceiling.`);
    }
  }
  const stmt = /SET\s+LOCAL\s+statement_timeout\s*=\s*([^;\s]+)/i.exec(code);
  if (stmt) {
    const ms = toMs(stmt[1]);
    if (ms !== null && ms > STATEMENT_TIMEOUT_CEILING_MS) {
      fail(
        '§4.4',
        `statement_timeout ${stmt[1]} exceeds the ${STATEMENT_TIMEOUT_CEILING_MS} ms ceiling. ` +
          `A migration that needs longer belongs in a concurrent step, not a longer timeout.`,
      );
    }
  }

  // --- PM-9: idempotence ------------------------------------------------------------------
  const nonIdempotent = [
    [/CREATE\s+TABLE\s+(?!IF\s+NOT\s+EXISTS)/i, 'CREATE TABLE', 'IF NOT EXISTS'],
    [
      /CREATE\s+INDEX\s+(?!CONCURRENTLY\s+)?(?!IF\s+NOT\s+EXISTS)/i,
      'CREATE INDEX',
      'IF NOT EXISTS',
    ],
    [/ADD\s+COLUMN\s+(?!IF\s+NOT\s+EXISTS)/i, 'ADD COLUMN', 'IF NOT EXISTS'],
    [/DROP\s+TABLE\s+(?!IF\s+EXISTS)/i, 'DROP TABLE', 'IF EXISTS'],
    [/DROP\s+COLUMN\s+(?!IF\s+EXISTS)/i, 'DROP COLUMN', 'IF EXISTS'],
  ];
  for (const [pattern, what, guard] of nonIdempotent) {
    if (pattern.test(code)) {
      fail(
        'PM-9',
        `${what} without ${guard}. A migration that is re-applied after a partial failure must ` +
          `be a no-op, or recovering from the first failure requires hand-editing production.`,
      );
    }
  }

  // --- PM-10: a @@map rename needs the three-release plan ---------------------------------
  if (/ALTER\s+TABLE\s+\S+\s+RENAME\s+TO/i.test(code) && !/three[- ]release|PM-10/i.test(sql)) {
    fail(
      'PM-10',
      `a table rename without a stated three-release plan. A rename is not one migration: the ` +
        `old name must keep working while the previous release is still running, or the ` +
        `deploy is a hard cutover with a window of 500s.`,
    );
  }

  // --- P9 / MG10: a new table must bring its policy and grants ----------------------------
  const createsTable = /CREATE\s+TABLE/i.test(code);
  if (createsTable) {
    if (!/ENABLE\s+ROW\s+LEVEL\s+SECURITY/i.test(code)) {
      fail(
        'MG10',
        `creates a table but never enables row-level security. BR-TEN-01 is enforced in the ` +
          `database. A table without a policy, even for one commit, is queryable across tenants.`,
      );
    } else if (!/FORCE\s+ROW\s+LEVEL\s+SECURITY/i.test(code)) {
      fail(
        'MG10',
        `ENABLE without FORCE ROW LEVEL SECURITY. ENABLE alone exempts the table OWNER — and ` +
          `migrations run as an owner, so the policy is advisory for exactly the connection ` +
          `most able to do damage.`,
      );
    }
    if (!/GRANT\s+/i.test(code)) {
      fail(
        'P10',
        `creates a table but grants nothing. 0_init revoked default privileges, so this table ` +
          `is unreachable by the application (see prisma/grants/_grant-classes.sql).`,
      );
    }
  }

  // --- the fail-closed rule, §8.3 ---------------------------------------------------------
  if (/current_setting\s*\(\s*'app\.tenant_id'\s*,/i.test(code)) {
    fail(
      '§8.3',
      `current_setting('app.tenant_id', …) is called with a missing_ok argument. Constraints.md ` +
        `§8.3 calls this "the single most consequential omission available": with missing_ok, an ` +
        `unset variable yields NULL, the predicate is NULL, and the query returns ZERO ROWS ` +
        `silently. The bug then looks like missing data, someone widens the policy to "fix" it, ` +
        `and that is the breach. Drop the second argument so it raises 42704 instead.`,
    );
  }

  // --- BR-PAY-01 in DDL --------------------------------------------------------------------
  const floatMoney =
    /\b\w*(amount|price|fee|total|balance)\w*_minor\s+(numeric|decimal|real|double|money)\b/i;
  if (floatMoney.test(code)) {
    fail(
      'DB2',
      `a *_minor column declared as numeric/decimal/float/money. BR-PAY-01: money is an integer ` +
        `count of minor units. Use bigint, or the money_minor domain.`,
    );
  }
  if (/\btimestamp\s+without\s+time\s+zone\b/i.test(code)) {
    fail(
      'CI-05',
      `"timestamp without time zone". India is UTC+05:30 with no DST, so a naive timestamp is ` +
        `ambiguous the moment it crosses a process boundary. Use timestamptz.`,
    );
  }

  return problems;
}

export function lintAll(repoRoot = process.cwd()) {
  const dir = resolve(repoRoot, 'apps/server/prisma/migrations');
  if (!existsSync(dir)) return [];
  const problems = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const file = join(dir, entry.name, 'migration.sql');
    if (!existsSync(file) || !statSync(file).isFile()) {
      problems.push({
        migration: entry.name,
        rule: 'PM-4',
        message: `${entry.name}/ has no migration.sql`,
      });
      continue;
    }
    problems.push(...lintMigration(basename(entry.name), readFileSync(file, 'utf8')));
  }
  return problems;
}

const isMain = process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/'));
if (isMain) {
  const problems = lintAll(process.cwd());
  if (problems.length === 0) {
    console.log('migration-lint: OK');
    process.exit(0);
  }
  console.error(`migration-lint: ${problems.length} problem(s)\n`);
  for (const p of problems) {
    console.error(`  [${p.rule}] ${p.migration}`);
    console.error(`      ${p.message}\n`);
  }
  process.exit(1);
}
