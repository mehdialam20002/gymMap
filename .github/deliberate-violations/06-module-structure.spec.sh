#!/usr/bin/env bash
# M-007 AC-2 · Job 6 `module-structure` bites, and nothing else does.
source "$(dirname "${BASH_SOURCE[0]}")/_harness.sh"

REPO_ROOT_ABS="$REPO_ROOT"
echo "06-module-structure — three violations, each must fail job 6 alone"

check() { node "$REPO_ROOT_ABS/packages/config/scripts/module-structure.mjs"; }
run_in() { ( cd "$1" && node "$REPO_ROOT_ABS/packages/config/scripts/module-structure.mjs" ); }

# --- 1. a 24th module -------------------------------------------------------
setup_scratch
mkdir -p "$SCRATCH/apps/server/src/marketing"
echo ""
echo "  violation: a 24th module directory"
expect_gate_fails "6 module-structure" run_in "$SCRATCH"
expect_gate_passes "25 actions-pinned" bash -c "cd '$SCRATCH' && node '$REPO_ROOT_ABS/packages/config/scripts/actions-pinned.mjs'"
rm -rf "$SCRATCH"; trap - EXIT

# --- 2. a missing README ----------------------------------------------------
setup_scratch
rm -f "$SCRATCH/apps/server/src/plans/README.md"
echo ""
echo "  violation: plans/README.md removed"
expect_gate_fails "6 module-structure" run_in "$SCRATCH"
rm -rf "$SCRATCH"; trap - EXIT

# --- 3. a forbidden services/ directory ------------------------------------
setup_scratch
mkdir -p "$SCRATCH/apps/server/src/ordering/services"
touch "$SCRATCH/apps/server/src/ordering/services/.keep"
echo ""
echo "  violation: ordering/services/ (forbidden by §7.3.2)"
expect_gate_fails "6 module-structure" run_in "$SCRATCH"
rm -rf "$SCRATCH"; trap - EXIT

# --- control: the unmodified repository must be GREEN -----------------------
echo ""
echo "  control: unmodified repository"
expect_gate_passes "6 module-structure" check

report
