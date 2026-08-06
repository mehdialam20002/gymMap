#!/usr/bin/env bash
# M-007 AC-2 · Job 16 `scan-secrets` bites on a committed AWS key.
source "$(dirname "${BASH_SOURCE[0]}")/_harness.sh"

REPO_ROOT_ABS="$REPO_ROOT"
echo "16-scan-secrets — a committed AWS access key"

if ! command -v gitleaks >/dev/null 2>&1; then
  echo "  SKIP  gitleaks is not installed locally."
  echo "        CI runs it via gitleaks/gitleaks-action; install locally with:"
  echo "            winget install gitleaks"
  echo "        Reported rather than passed: a fixture that silently succeeds because its tool"
  echo "        is absent is precisely the inert gate this directory exists to catch."
  exit 0
fi

setup_scratch

# A syntactically valid AWS key. Not a real credential — the prefix and shape are what the
# detector matches, and that is the whole point of the fixture.
cat > "$SCRATCH/apps/server/src/leaked-config.ts" <<'TS'
export const config = {
  accessKeyId: 'AKIAIOSFODNN7EXAMPLE',
  secretAccessKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
};
TS

( cd "$SCRATCH" && git init -q . && git add -A && \
  git -c user.email=t@t -c user.name=t commit -qm "chore(EP-01): fixture" ) >/dev/null 2>&1

echo ""
echo "  violation: an AWS key committed in source"
expect_gate_fails "16 scan-secrets" bash -c "cd '$SCRATCH' && gitleaks detect --no-banner --redact"
expect_gate_passes "6 module-structure" bash -c \
  "cd '$SCRATCH' && node '$REPO_ROOT_ABS/packages/config/scripts/module-structure.mjs'"

echo ""
echo "  control: the real repository is clean"
expect_gate_passes "16 scan-secrets" bash -c \
  "cd '$REPO_ROOT_ABS' && gitleaks detect --no-banner --redact"

report
