#!/usr/bin/env bash
# M-007 AC-2 · Job 5 `architecture` bites on a raw PrismaClient import outside tenancy/.
#
# This is the most consequential of the ten. ADR-0005 / BR-TEN-01: a raw Prisma client bypasses
# the tenant-context extension, so the query runs with no `app.tenant_id` set. RLS then returns
# nothing — the query is syntactically valid, nothing throws, and the failure presents as
# "data missing" rather than "isolation broken". Someone eventually "fixes" it by widening the
# policy, and that is the breach.
#
# ┌─ WHY THIS FIXTURE RUNS AGAINST THE REAL REPOSITORY ────────────────────────────────────────┐
# │ Every other fixture works on a scratch copy, which is the safer pattern. This one cannot.  │
# │ dependency-cruiser can only see an edge to a module it can RESOLVE, and the scratch copy   │
# │ deliberately excludes node_modules — so `@prisma/client` resolves to nothing there and the │
# │ rule has no edge to fire on. The fixture then passes while proving the opposite of what it │
# │ claims: it reported "the gate is inert" when the gate was fine and the harness was blind.  │
# │                                                                                             │
# │ So: the probe file is written into the real tree, and removed by an EXIT trap that fires   │
# │ on success, failure and interrupt alike. It is also named so a leftover is unmistakable.   │
# └─────────────────────────────────────────────────────────────────────────────────────────────┘

set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
PROBE="$REPO_ROOT/apps/server/src/ordering/__deliberate-violation-probe.ts"

PASS=0
FAIL=0
cleanup() { rm -f "$PROBE"; }
trap cleanup EXIT INT TERM

echo "05-architecture — a raw PrismaClient import outside tenancy/"

depcruise() {
  ( cd "$REPO_ROOT" && pnpm exec depcruise --config .dependency-cruiser.cjs \
      apps packages --output-type err ) 2>&1
}

if [ ! -d "$REPO_ROOT/apps/server/node_modules/@prisma/client" ]; then
  # pnpm keeps a package's dependencies in ITS OWN node_modules; checking only the root reported
  # "Prisma is not installed" for a Prisma that was installed, and the fixture skipped while
  # sounding confident about why.
  echo "  SKIP  @prisma/client is not installed. Run: pnpm install"
  exit 0
fi

# --- control first: the tree must be green BEFORE the probe ------------------
if depcruise | grep -q "no-raw-prisma-outside-tenancy"; then
  echo "  FAIL  the repository already violates no-raw-prisma-outside-tenancy."
  echo "        Fix that before trusting this fixture."
  exit 1
fi
echo "  ok    control: clean tree has no raw-Prisma violation"
PASS=$((PASS + 1))

# --- the violation -----------------------------------------------------------
cat > "$PROBE" <<'TS'
// Deliberate violation fixture. Removed by an EXIT trap; if you are reading this in a diff,
// 05-architecture.spec.sh was killed uncleanly — delete it.
import { PrismaClient } from '@prisma/client';
export const prisma = new PrismaClient();
TS

echo ""
echo "  violation: ordering/ imports @prisma/client directly"

OUTPUT="$(depcruise)"
if printf '%s' "$OUTPUT" | grep -q "error no-raw-prisma-outside-tenancy"; then
  echo "  ok    gate '5 architecture' correctly failed"
  PASS=$((PASS + 1))
else
  echo "  FAIL  gate '5 architecture' did NOT fire on a raw PrismaClient import."
  echo "        ADR-0005 is unenforced. This is the rule that keeps BR-TEN-01 structural."
  printf '%s\n' "$OUTPUT" | tail -3
  FAIL=$((FAIL + 1))
fi

# --- and only that gate ------------------------------------------------------
# NOT asserted here: module-structure. Adding a .ts file to `ordering/` legitimately gives that
# module source, which correctly makes §8.1's mandated file set apply — so module-structure
# failing is the right answer, not collateral damage. Asserting it "unaffected" would be
# asserting a bug. 25-pipeline-integrity covers the and-only-that-gate property instead.
if node "$REPO_ROOT/packages/config/scripts/actions-pinned.mjs" >/dev/null 2>&1; then
  echo "  ok    gate '25 actions-pinned' correctly unaffected"
  PASS=$((PASS + 1))
else
  echo "  FAIL  gate '25 actions-pinned' reddened on an unrelated change"
  FAIL=$((FAIL + 1))
fi

cleanup

# --- the tree is clean again -------------------------------------------------
if depcruise | grep -q "no-raw-prisma-outside-tenancy"; then
  echo "  FAIL  the probe was not removed — the working tree is left dirty."
  FAIL=$((FAIL + 1))
else
  echo "  ok    probe removed; tree green again"
  PASS=$((PASS + 1))
fi

echo ""
if [ "$FAIL" -eq 0 ]; then
  echo "  $PASS assertion(s) passed."
  exit 0
fi
echo "  $FAIL of $((PASS + FAIL)) assertion(s) FAILED."
exit 1
