#!/usr/bin/env bash
# M-007 · Shared harness for the deliberate-violation fixtures.
#
# Every fixture works on a COPY. A script that mutates the working tree and then restores it
# leaves the repository broken the first time it is interrupted, and someone spends an hour
# working out why their branch has an AWS key in it.

set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SCRATCH=""

setup_scratch() {
  SCRATCH="$(mktemp -d)"
  # Tracked AND untracked-but-not-ignored. `ls-files` alone lists only what is COMMITTED, so a
  # fixture run before committing copies a repository that is missing the very files under test
  # — and then reports the gate as inert when it is simply looking at nothing. That produced two
  # false failures the first time this ran, which is a good demonstration of why the "and only
  # that gate" assertion is worth having.
  #
  # node_modules is excluded by .gitignore and is not needed: the gates under test are scripts
  # run with the original root's node.
  git -C "$REPO_ROOT" ls-files -z --cached --others --exclude-standard | while IFS= read -r -d '' f; do
    mkdir -p "$SCRATCH/$(dirname "$f")"
    cp "$REPO_ROOT/$f" "$SCRATCH/$f" 2>/dev/null || true
  done
  trap 'rm -rf "$SCRATCH"' EXIT
}

PASS=0
FAIL=0

# Asserts the named gate FAILS (non-zero) with the violation in place.
expect_gate_fails() {
  local name="$1"; shift
  if "$@" >/dev/null 2>&1; then
    echo "  FAIL  gate '$name' PASSED with a deliberate violation in place."
    echo "        This gate is inert — it is not checking what it claims to check."
    FAIL=$((FAIL + 1))
  else
    echo "  ok    gate '$name' correctly failed"
    PASS=$((PASS + 1))
  fi
}

# Asserts a gate that should be UNAFFECTED still passes — the "and only that gate" half.
expect_gate_passes() {
  local name="$1"; shift
  if "$@" >/dev/null 2>&1; then
    echo "  ok    gate '$name' correctly unaffected"
    PASS=$((PASS + 1))
  else
    echo "  FAIL  gate '$name' also failed. A gate that reddens on unrelated changes is noise,"
    echo "        and the response to noise is to stop reading it."
    FAIL=$((FAIL + 1))
  fi
}

report() {
  echo ""
  if [ "$FAIL" -eq 0 ]; then
    echo "  $PASS assertion(s) passed."
    exit 0
  fi
  echo "  $FAIL of $((PASS + FAIL)) assertion(s) FAILED."
  exit 1
}
