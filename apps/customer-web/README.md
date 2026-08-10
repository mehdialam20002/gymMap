# customer-web

Next.js 14 App Router - React 18 - TypeScript - SSR for SEO. Surface `web`. 18 SCR-WEB screens.

---

**This directory is a placeholder.** Phase 8 (implementation) is `BLOCKED` - see
[docs/PHASES.md](../../docs/PHASES.md). No application code, `package.json` or dependency belongs
here until Phases 0-7 are complete and the project owner records approval in the Phase 8 Unlock
Record.

The structure is normative: see
[docs/engineering/FolderStructure.md](../../docs/engineering/FolderStructure.md). A directory not
listed there does not exist without an amendment under constitution SS.24.

---

## `vercel.json` — why previews are switched off

`ignoreCommand` runs before install, and its exit code is inverted from the obvious reading:
**`exit 1` builds, `exit 0` skips.** The one line there builds production and nothing else.

It is not a cost measure. Dependabot's `open-pull-requests-limit` is 10, every open PR is a branch,
and Vercel builds a preview per branch regardless of the Production Branch setting — so ten bumps
produced ten builds of code nobody asked to see, several of which failed on the bump itself and
looked, in the dashboard, exactly like a broken `main`. A red deployment list that is red for
reasons unrelated to the deployment is worse than no list.

Turning previews back on is one line, and worth doing once a PR here is a human's PR rather than a
bot's. `VERCEL_ENV` is used instead of a branch name deliberately: a branch name in a committed file
stops being true the moment the branch merges.
