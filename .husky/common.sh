#!/usr/bin/env sh
# A-24 · shared hook helpers. Sourced by the hooks; never run as one itself
# (husky 9 only executes files named after a git hook, so this is inert).

# ---------------------------------------------------------------------------
# resolve_pnpm — sets $PNPM to a working invocation, or exits 1.
#
# `packageManager` in package.json pins pnpm@11, and corepack is the mechanism
# that field exists for. But `corepack enable` writes a shim into the Node
# install directory, which needs administrator rights on Windows — so a
# developer can have a correct, pinned toolchain and still have no `pnpm` on
# PATH. Failing their commit over a shim they cannot install is not a quality
# gate, it is an obstacle, and it is exactly what gets hooks disabled wholesale.
# ---------------------------------------------------------------------------
resolve_pnpm() {
  if command -v pnpm >/dev/null 2>&1; then
    PNPM="pnpm"
  elif command -v corepack >/dev/null 2>&1; then
    PNPM="corepack pnpm"
  else
    echo ""
    echo "  Neither pnpm nor corepack is available."
    echo "  Node 22 ships corepack. Install Node >= 22 (see .nvmrc), or:"
    echo "      npm i -g pnpm@11"
    echo ""
    return 1
  fi
  export PNPM
  return 0
}
