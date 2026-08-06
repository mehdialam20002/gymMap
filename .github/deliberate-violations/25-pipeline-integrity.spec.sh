#!/usr/bin/env bash
# M-007 AC-2, AC-7 · An action pinned by tag fails job 25 and nothing else.
source "$(dirname "${BASH_SOURCE[0]}")/_harness.sh"

REPO_ROOT_ABS="$REPO_ROOT"
echo "25-pipeline-integrity — an action pinned by tag instead of SHA"

setup_scratch

# Repoint one action from its SHA to a mutable tag. This is the exact mistake the rule exists
# for, and it looks completely normal in review.
sed -i 's|actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683 # v4.2.2|actions/checkout@v4|' \
  "$SCRATCH/.github/workflows/security.yml"

echo ""
echo "  violation: actions/checkout pinned to @v4"
expect_gate_fails "25 actions-pinned" bash -c \
  "cd '$SCRATCH' && node '$REPO_ROOT_ABS/packages/config/scripts/actions-pinned.mjs'"
expect_gate_passes "6 module-structure" bash -c \
  "cd '$SCRATCH' && node '$REPO_ROOT_ABS/packages/config/scripts/module-structure.mjs'"

echo ""
echo "  control: unmodified repository"
expect_gate_passes "25 actions-pinned" bash -c \
  "cd '$REPO_ROOT_ABS' && node packages/config/scripts/actions-pinned.mjs"

report
