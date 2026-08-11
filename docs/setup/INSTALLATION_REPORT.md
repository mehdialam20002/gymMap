# Installation Report — Local Development Environment

**Generated** 2026-08-06 · **Machine** Windows 11 Home Single Language, build 26300 (Insider
Preview), AMD64, 15.4 GB RAM · **Operator** automated setup, running **without administrator
rights**.

---

## 1. Summary

The development environment is **provisioned and working**, with two exceptions that need you at an
elevated prompt: **Docker Desktop and WSL 2**. Everything that could be installed per-user was
installed, verified, and committed.

| | Count |
| :--- | :-: |
| Installed and verified | 6 tools · 33 VS Code extensions · 3 browser engines · 8 workspace dev dependencies |
| MCP servers configured | 7 (awaiting one-click approval) · 3 need your credentials |
| Repository | initialised · 109 files · 105,850 lines now under version control |
| **Blocked on administrator rights** | **2 (Docker Desktop, WSL 2)** |
| **Decisions needed from you** | **4 — see §9** |

The single most valuable outcome is not a tool. It is that **`BLK-01` is closed**: ~90,000 lines of
specification that had no version history now do. Before today an accidental overwrite of
`MASTER_PRD.md` was unrecoverable.

> **Read §8 before anything else.** The brief for this session listed a stack that contradicts the
> locked one in `MASTER_PRD.md` §C1.1 in six places — Express, Vitest, Socket.IO and Next.js for the
> dashboards among them. Nothing contradictory was installed. The specification was followed.

---

## 2. Environment detected

| | |
| :--- | :--- |
| OS | Windows 11 Home Single Language, 10.0.26300 (Insider Preview) |
| Architecture | AMD64 |
| RAM | 15.4 GB |
| Free disk (C:) | 38.9 GB |
| Shell | PowerShell 7 · Git Bash |
| Elevation | **Not available** — every machine-wide installer failed on a UAC prompt that could not be shown |
| Virtualisation | Enabled in firmware (`HypervisorPresent = True`) |

**Windows 11 Home matters.** Docker Desktop has no Hyper-V backend on Home, so WSL 2 is mandatory,
not optional.

**Insider Preview build.** This is a pre-release Windows channel. It is not a problem today, but if
Docker or WSL misbehave later, the build is a legitimate first suspect for a system this project will
be maintained on for years.

---

## 3. Installed and verified

### 3.1 Core tooling

| Tool | Version | State | Location |
| :--- | :--- | :--- | :--- |
| Git | 2.45.2 | pre-existing | `C:\Program Files\Git` |
| Node.js | **22.20.0** | pre-existing — see §9.1 | `C:\Program Files\nodejs` |
| npm | 10.9.3 | pre-existing | bundled |
| **pnpm** | **11.20.0** | **installed** | `%LOCALAPPDATA%\pnpm` |
| **GitHub CLI** | **2.97.0** | **installed** | `%LOCALAPPDATA%\Programs\GitHubCLI` |
| VS Code | 1.131.0 | pre-existing | `%LOCALAPPDATA%\Programs\Microsoft VS Code` |
| winget | 1.30.90-preview | pre-existing | — |

**pnpm** — `corepack enable` failed with `EPERM` writing to `C:\Program Files\nodejs`, which needs
admin. Installed instead with pnpm's official standalone script into `%LOCALAPPDATA%\pnpm`, which is
per-user and needs no elevation. Functionally identical.

**GitHub CLI** — the winget package installs machine-wide via MSI and hung on an invisible UAC
prompt. That install was cancelled and `gh` was placed from the official release archive into
`%LOCALAPPDATA%\Programs\GitHubCLI`, added to your user `PATH`. Same binary, same version, no admin.

> Both live in your **user** `PATH`. A terminal opened before this run will not see them — open a new
> one.

### 3.2 Workspace dev dependencies

Exactly the seven packages root law **R1a** permits, and no more. The root has **no `dependencies`
block** by design.

| Package | Version | Register |
| :--- | :--- | :--- |
| turbo | 2.10.8 | A-05 |
| prettier | 3.9.6 | A-22 |
| husky | 9.1.7 | A-24 |
| lint-staged | 17.3.0 | A-24 |
| @commitlint/cli | 21.2.1 | A-24 |
| @commitlint/config-conventional | 21.2.0 | A-24 |
| dependency-cruiser | 18.1.1 | A-23 |
| **typescript** | **6.0.3 — deliberately not 7.x** | §9.2 |

### 3.3 Playwright browsers (A-06)

Chromium 1234 · Chromium headless shell · Firefox 1538 · WebKit 2336 · ffmpeg · winldd —
**1,207 MB** in `%LOCALAPPDATA%\ms-playwright`. E2E and `test:a11y` can run the moment Phase 8 opens,
with no further download.

### 3.4 VS Code extensions — 33 installed, 0 failed

All 21 you named, plus 12 chosen for this specific stack:

| Added | Why it earns its place here |
| :--- | :--- |
| `bierner.markdown-mermaid` | The specification set contains **130+ mermaid diagrams**. Without this they are unreadable in-editor. |
| `yoavbls.pretty-ts-errors` | The §9.1 flag set (`exactOptionalPropertyTypes`, `noUncheckedIndexedAccess`) produces genuinely dense errors. |
| `ms-playwright.playwright` · `Orta.vscode-jest` | The two runners A-06 selects. |
| `DavidAnson.vscode-markdownlint` | The deliverable *is* markdown. Already caught five issues in `CLAUDE.md` during this run. |
| `SonarSource.sonarlint-vscode` | Bug and vulnerability detection alongside ESLint. |
| `EditorConfig.EditorConfig` · `mikestead.dotenv` · `redhat.vscode-yaml` | `.editorconfig`, `.env*`, compose and CI files. |
| `ms-vscode-remote.remote-containers` · `remote-wsl` | Docker runs through WSL 2 on this machine. |
| `graphql.vscode-graphql-syntax` | Syntax only; no GraphQL is proposed. |

Total extensions on the machine: **41**.

---

## 4. Repository — `BLK-01` closed

`git init` on `main`, plus `develop`. Commit `16bff06`, **109 files, 105,850 insertions**.

Verified before committing: no `.env.local`, no `node_modules`, and — checked byte-for-byte against
the pre-run sizes — **the specification corpus was not reformatted**. `.prettierignore` excludes
`docs/`, and `MASTER_PRD.md`, `PROJECT_CONSTITUTION.md`, `DECISION_LOG.md`,
`MASTER_PRD_CHECKLIST.md`, `Schema.md` and `STACK_ADDITIONS.md` are all byte-identical to their state
before this session began.

### 4.1 Created

| File | Purpose |
| :--- | :--- |
| `.gitignore` · `.gitattributes` · `.editorconfig` | LF everywhere — the same files mount into Linux containers, and a CRLF shell script fails there with a confusing error |
| `package.json` · `pnpm-workspace.yaml` · `turbo.json` | R1a-compliant root; two workspace globs; the §3.3 task graph verbatim |
| `tsconfig.base.json` | The §9.1 compiler flag set, **verbatim** — all 20 flags |
| `.npmrc` | `engine-strict`, empty `public-hoist-pattern` (phantom dependencies are how an unapproved library sneaks in), `minimum-release-age=1440` |
| `prettier.config.mjs` · `.prettierignore` | `docs/` excluded from formatting |
| `commitlint.config.mjs` | §20.3 grammar with a **custom rule** requiring a PRD identifier |
| `.lintstagedrc.mjs` | Format staged files |
| `.husky/{pre-commit,commit-msg,pre-push}` | See §4.2 |
| `.gitleaks.toml` · `.trivyignore` | A-25. Razorpay, Postgres and Ed25519 detections; local compose credentials allowlisted |
| `infra/compose/compose.yaml` + `initdb/01-extensions.sql` | A-28 |
| `.env.example` · `.env.local` | Template committed; `.env.local` generated with real keys and git-ignored |
| `CLAUDE.md` | Operating rules — §1 makes the constitution, PRD and `PHASES.md` a mandatory read |
| `README.md` | Onboarding |
| `.vscode/{settings,extensions}.json` | Workspace settings; recommendations for anyone cloning |
| `.github/{PULL_REQUEST_TEMPLATE.md,CODEOWNERS,dependabot.yml}` | Review gates |
| `apps/*`, `packages/*`, `infra/*` placeholder READMEs | Git tracks the normative tree; each states Phase 8 is locked |

### 4.2 Hooks — tested, not assumed

| Hook | Behaviour | Verified |
| :--- | :--- | :--- |
| `pre-commit` | lint-staged → Prettier; Gitleaks if present | ✅ ran on the initial commit |
| `commit-msg` | commitlint, §20.3 grammar | ✅ see below |
| `pre-push` | Blocks direct pushes to `main`/`develop`; validates branch names against `<type>/<PRD-ID>-<summary>`, ≤ 60 chars | ✅ |

The commit-msg rule was tested against three inputs rather than assumed to work:

| Input | Result |
| :--- | :--- |
| `feat(FR-CHK-04): enforce the ten-step check-in validation order` | **accepted** ✅ |
| `feat(checkin): add validation` | **rejected** — no PRD identifier ✅ |
| `fixed stuff` | **rejected** ✅ |

The rule implements both routes §20 allows: a PRD identifier in the **scope**, or in the **footer**
for a commit spanning several. `deps`, `deps-dev`, `release`, `repo` and `setup` are exempt, which is
what lets Dependabot's commits pass without a carve-out.

### 4.3 Git configuration — repository-local

You had **no git identity configured at all**, globally or otherwise — every commit anywhere on this
machine would have failed. Rather than write a guessed name into your global config, identity was set
**repo-local**:

```text
user.name  = Mehdi
user.email = wtftechteam@gmail.com
```

> **Check this.** The email came from your session profile; the name is an assumption. Nothing has
> been pushed, so it is trivially fixable now and permanent later:
>
> ```bash
> git config user.name "Your Name"
> git commit --amend --reset-author --no-edit
> ```

Also set locally: `core.autocrlf=false` (`.gitattributes` governs EOL), `core.longpaths=true` (deep
`node_modules` on Windows), `core.ignorecase=false` (match Linux CI), `pull.rebase=true`,
`merge.conflictstyle=zdiff3`, `rerere.enabled=true`, `fetch.prune=true`, `push.autoSetupRemote=true`.

---

## 5. Local infrastructure (A-28) — built, not yet runnable

`infra/compose/compose.yaml` defines exactly the four services A-28 names. **It cannot start until
Docker is installed (§6).**

| Service | Image | Ports | Credentials |
| :--- | :--- | :--- | :--- |
| PostgreSQL + PostGIS | `postgis/postgis:16-3.4` | 5432 | `postgres` / `postgres` · db `gymmap` |
| Redis 7 | `redis:7-alpine` | 6379 | — |
| MinIO | `minio/minio:RELEASE.2025-04-22…` | 9000 API · 9001 console | `minioadmin` / `minioadmin` |
| Mailpit | `axllent/mailpit:v1.27` | 1025 SMTP · 8025 UI | — |

Every service has a healthcheck, so `pnpm infra:ps` reports honestly rather than "started".

Three decisions worth knowing about, because they will look arbitrary later:

- **Redis runs `--maxmemory-policy noeviction`.** BullMQ stores job state in Redis. Under the default
  `allkeys-lru`, memory pressure silently evicts a job key — the job simply never runs, and nothing
  logs an error. `noeviction` converts that into a visible write failure.
- **Postgres initialises with `--locale=C`.** Index ordering must not depend on the host locale, or a
  developer's `ORDER BY` disagrees with CI's.
- **`initdb/01-extensions.sql` creates extensions only** — `postgis`, `pg_trgm`, `unaccent`,
  `btree_gin`, `btree_gist`, `pgcrypto`, `pg_stat_statements`. No table, column, index or RLS policy.
  Schema is Prisma's job at Phase 8. Prisma cannot create extensions it does not own, so they must
  exist first.

Two buckets are created because they have different lifecycles: `gymmap-media` is public-read behind
a CDN, `gymmap-kyc` is private (`FR-GYM-02`, Epic_03).

`.env.local` was generated with **real** values — a 64-character access secret, a different refresh
secret, and a genuine Ed25519 PKCS8 key for QR signing (A-11). It is git-ignored; confirmed with
`git check-ignore`.

---

## 6. Blocked — needs administrator rights

Neither could be installed. Both are required before `pnpm infra:up` will work.

### Run this

```powershell
# In an ADMINISTRATOR PowerShell
cd C:\Users\Mehdi\Desktop\GYM MAP
powershell -ExecutionPolicy Bypass -File docs\setup\elevated-setup.ps1
```

It installs **WSL 2**, then **Docker Desktop**, then **Gitleaks** and **Trivy** (A-25, used by the
pre-commit hook and CI). It is idempotent — safe to re-run.

**WSL 2 requires a reboot.** The script detects this, tells you, and stops. Run it again afterwards
to finish. Budget ~30 minutes including the restart and Docker's first-run setup.

> **Disk.** 38.9 GB free. Docker Desktop is ~5 GB and the A-28 images another ~1.5 GB; PostGIS alone
> is ~600 MB. Comfortable now, but this is a machine with 15.4 GB RAM running four containers, three
> dev servers and VS Code. Watch it.

---

## 7. MCP servers

### 7.1 Configured — `.mcp.json`, project scope, committed

Project scope means these travel with the repository, so the whole team gets the same set.

| Server | Package | Why |
| :--- | :--- | :--- |
| `filesystem` | `@modelcontextprotocol/server-filesystem` | Scoped to the repo root only |
| `playwright` | `@playwright/mcp` | Drive a real browser — UI/UX verification and E2E authoring |
| `context7` | `@upstash/context7-mcp` | Current library docs. **No API key needed** |
| `sequential-thinking` | `@modelcontextprotocol/server-sequentialthinking` | Structured reasoning |
| `memory` | `@modelcontextprotocol/server-memory` | Cross-session recall |
| `prisma` | `prisma mcp` (built into the CLI ≥ 6.6) | `migrate-status`, `migrate-dev`, Studio |
| `postgres` | `@bytebase/dbhub` | Query the local database directly |

> **One click needed.** All seven show `⏸ Pending approval`. Project-scoped servers require you to
> approve them once, for security — start `claude` in this directory and accept. This is by design,
> not a failure.

### 7.2 Two substitutions, and why

You asked for "PostgreSQL MCP". I did not install it.

**`@modelcontextprotocol/server-postgres` is archived and carries a known SQL-injection
vulnerability.** Datadog Security Labs found that it wrapped queries in a read-only transaction but
accepted semicolon-delimited statements, letting an attacker break out and execute arbitrary SQL. It
was archived in 2025 and receives no security patches. Installing it against a database holding
tenant data — the system's first invariant — is not a defensible trade.

`@bytebase/dbhub` is used instead. It is maintained, and it is the example in Claude Code's own MCP
documentation.

Similarly, the **GitHub** MCP server moved from the archived `@modelcontextprotocol/server-github` to
GitHub's own hosted server (§7.3), and **Puppeteer**'s server is superseded by Playwright's.

### 7.3 Needs your credentials — not installed

Per your instruction to stop and explain rather than guess:

**GitHub MCP** — GitHub's official remote server. Needs a personal access token or OAuth.

```bash
claude mcp add --transport http github https://api.githubcopilot.com/mcp/ \
  --header "Authorization: Bearer YOUR_GITHUB_PAT"
```

Or authenticate the CLI first — `gh` is installed and ready:

```bash
gh auth login          # browser flow; also enables gh pr / gh issue
```

**Figma MCP** — for the design-to-code workflow. The remote server is the one Figma recommends:

```bash
claude mcp add --transport http figma https://mcp.figma.com/mcp
```

It runs an OAuth flow on first use. **Requires a Dev or Full seat on a paid Figma plan** — it will not
work on a free account. The desktop alternative (`http://127.0.0.1:3845/mcp`) additionally needs the
Figma desktop app open with Dev Mode enabled.

**Browser MCP** — drives your real, already-logged-in Chrome session:

```bash
claude mcp add browser -- npx -y @browsermcp/mcp@latest
```

Then install the extension from the Chrome Web Store and click **Connect**. It cannot work without
that manual step.

> **Worth knowing:** you already have 6 claude.ai connectors active. Adding 7 project servers plus
> these 3 puts you at 16. Each is a subprocess. If sessions start feeling slow, `claude mcp remove`
> the ones you are not using — `memory` and `sequential-thinking` are the usual first cuts.
>
> Two existing connectors report **`! Needs authentication`**: **claude.ai n8n** and **claude.ai
> Asana**. Reconnect them in your claude.ai connector settings if you want them.

---

## 8. Conflicts between this session's brief and the locked specification

**This is the most important section.** The stack listed in the brief contradicts `MASTER_PRD.md`
§C1.1 and `STACK_ADDITIONS.md` in six places. You said the stack is settled elsewhere and to focus on
installing, so **the specification was followed and nothing contradictory was installed.** Recording
each one, because the same list will resurface.

`STACK_ADDITIONS.md` Part 3 already records some of these as **decided and rejected** — and
`PHASES.md` shows a previous run was **aborted and three drafts deleted** for exactly this
contamination.

| Requested | Specification says | Action |
| :--- | :--- | :--- |
| **Express** | **NestJS 10.** Part 3: *"Rejected. The PRD names NestJS. Substituting it is a change, not an addition."* | Not installed |
| **Vitest** | **Jest** (A-06). Vitest is listed as a considered-and-rejected alternative | Not installed |
| **Socket.IO** | **Deferred to Phase 2** behind `release.attendance.realtime_transport`. Phase 1 uses TanStack Query polling at 10–15 s, decided 2026-08-06 to keep the app tier stateless per `NFR-SCAL-03` | Not installed |
| **Next.js for all three surfaces** | Next.js for `customer-web` **only**. Both dashboards are **React 18 + Vite** — SEO is irrelevant there and interactivity is high | Structure follows the spec |
| **Sonner** *and* **React Hot Toast** | Neither is in the register. Two toast libraries in one design system is also a contradiction in itself | Not installed — see §9.4 |
| **Framer Motion**, **Scalar API**, **tsup**, **cross-env**, **concurrently**, **nodemon**, **tsx**, **ts-node**, **dotenv-cli** | None appear in Part 1 or Part 2 | Not installed — see §9.4 |

Everything else you listed **is** approved and is either installed or scheduled for its owning
workspace at Phase 8: Prisma (A-01), Zod (A-02), Tailwind (A-03), shadcn/ui (A-04), pnpm+Turborepo
(A-05), Jest/Supertest/Testcontainers/Playwright (A-06), React Hook Form (A-09), Sentry (A-15),
Swagger via `@nestjs/swagger` (A-16), ESLint (A-21), Prettier (A-22), Husky/lint-staged/commitlint
(A-24). TanStack Query, JWT + refresh tokens and OpenTelemetry are in the locked baseline itself.

**PostgreSQL, pgAdmin and Redis were deliberately not installed natively.** A-28 provides both
through Docker. A second Postgres on `localhost:5432` would shadow the container and produce
confusing failures. pgAdmin is unnecessary — DBeaver or the `postgres` MCP server both work, without
a service running permanently.

---

## 9. Decisions needed from you

### 9.1 Node 20 is end-of-life — `.nvmrc` deviates from the spec

`FolderStructure.md` §2 pins **Node 20** in `.nvmrc`, "matching the container base image".

**Node 20 reached end-of-life on 2026-04-30.** It receives no further security patches. For a
platform intended to be maintained for years, holding payment and KYC data under India's DPDP Act,
provisioning an unpatched runtime is not defensible.

`.nvmrc` was therefore written as **22.20.0**, matching the supported LTS already on this machine,
and `package.json` declares `"node": ">=22.0.0"` with `engine-strict=true`.

> **This is a deviation from a normative document, made deliberately and flagged rather than hidden.**

| Option | EOL | Notes |
| :--- | :--- | :--- |
| Node 20 | **2026-04-30 — passed** | As written in the spec. Unsupported today |
| **Node 22** | 2027-04-30 | Currently installed. What `.nvmrc` now says |
| **Node 24 — recommended** | 2028-04-30 | Active LTS. Best fit for a multi-year build |

**Recommended:** amend the PRD to **Node 24 LTS** via §C10 Change Control, and update `.nvmrc` and the
container base image together. Raise as **`BLK-05`**.

### 9.2 TypeScript 7 is held back on purpose

`pnpm add -D typescript` resolves to **7.0.2** — the Go rewrite, 8–12× faster builds. It was installed
and then **deliberately downgraded to 6.0.3**.

**TypeScript 7.0 ships no public compiler API, and `nest build` is an API consumer.** The locked
framework's build would break. The decorator side is fine — the Go port does implement
`experimentalDecorators` and `emitDecoratorMetadata`, so the `design:paramtypes` metadata Nest's
injector reads at boot is still emitted. It is the missing compiler API that bites.

The commonly recommended arrangement is to **type-check with 7.x and build with 6.x**. That is worth
adopting once `apps/server` exists — the build speedup is real. `dependabot.yml` ignores `typescript`
`7.x` so this is not silently undone by a bump.

**Revisit when** NestJS publishes a TypeScript 7 position or a `tsgo` builder.

### 9.3 Directories created outside the normative tree

`FolderStructure.md` §2: *"A directory not listed here does not exist without an amendment under
constitution §24."* Two were created anyway:

| Directory | Why | Ask |
| :--- | :--- | :--- |
| `docs/setup/` | You specified `docs/setup/INSTALLATION_REPORT.md` as the output path | Ratify |
| `docs/prompts/` | You asked for `prompts/` | Ratify — placed under `docs/` rather than the root, because §3.1 warns a root `scripts/` or `tools/` is exactly how the two-glob rule erodes |

Correspondingly **not** created, because the spec places them elsewhere: root `scripts/` and root
`docker/` (→ `infra/docker/`, `infra/compose/`), `docs/architecture/` (→ `docs/engineering/`),
`docs/design/` (→ `docs/ui/`).

Also not created: `PROJECT_CONSTITUTION.md`, `MASTER_PRD.md`, `ARCHITECTURE.md`, `DECISION_LOG.md`,
`ROADMAP.md`, `CHANGELOG.md`, `TECH_DEBT.md`, `KNOWN_LIMITATIONS.md`, `FEATURE_FLAGS.md`,
`MASTER_PRD_CHECKLIST.md`. **All already exist** and are far richer than a fresh template — 30 ADRs,
110 `KL-` entries, 28 `TD-` entries. Overwriting them would have destroyed real work.

### 9.4 ESLint, and the UI/UX libraries you actually asked for

You asked for a setup that makes the **UI/UX as good as possible** and lets you **test properly**.
Two gaps stand between here and that.

**ESLint is not installed, and this is the one thing I would fix first.** A-21 approves it, but root
law **R1a** fixes the root `devDependencies` at exactly seven packages and ESLint is not among them —
it belongs to `packages/config`, consumed per workspace. Installing it at the root would have broken
a normative rule to satisfy a convenience. Two ways forward:

1. **Preferred** — create `packages/config` properly at Phase 8, with `eslint`,
   `@typescript-eslint/*` and the shared rule set. `.lintstagedrc.mjs` carries the exact line to
   uncomment.
2. **Or** amend R1a to allow `eslint` at the root, recorded in `DECISION_LOG.md`.

**The animation and notification layer has no approved choice.** shadcn/ui + Tailwind (A-03, A-04)
cover structure and styling, and Lucide ships with shadcn/ui. But motion and toasts are genuinely
unfilled slots, and both are load-bearing for perceived quality. These qualify as **additions** under
the register's own four tests — the PRD names nothing for them, the slot cannot stay empty, and
nothing conflicts. Proposed rows, for your approval before anything is installed:

| Proposed | Slot | Note |
| :--- | :--- | :--- |
| **A-31** | Animation | **Motion** (the maintained successor to Framer Motion). Must respect `prefers-reduced-motion` for WCAG 2.1 AA (`NFR` a11y targets) |
| **A-32** | Toasts | **Sonner** — *one* library, not Sonner *and* React Hot Toast. It is also what shadcn/ui itself standardised on |
| **A-33** | Component testing | **Testing Library** (`@testing-library/react`, `user-event`). A-06 names Jest but no component-level DOM harness |
| **A-34** | Dev-loop tooling | **tsx** for TypeScript execution; `concurrently` is unnecessary — Turborepo already runs tasks in parallel |

Add them to `STACK_ADDITIONS.md` yourself, or ask and I will draft the rows. Nothing was installed
without approval — that is the standing rule.

---

## 10. Warnings

| # | Warning |
| :--- | :--- |
| 1 | **A second session is writing to `docs/` right now.** `PHASES.md` and `docs/README.md` changed mid-run (15:28), and Phase 5 moved to `IN PROGRESS — 6/10` while this report was being written. The commit captured a mid-flight snapshot. Nothing was lost, but **coordinate before doing bulk work in `docs/`** — with git now in place, `git diff` will show you exactly what the other session changed. `CLAUDE.md` §3 warns future sessions about this. |
| 2 | **`gh` is not authenticated.** `gh auth login` when you want PR and issue commands. |
| 3 | **Gitleaks is not installed locally**, so `pre-commit` prints a note and continues rather than failing. The elevated script installs it. Until then, secret scanning is CI-only — and CI does not exist yet. |
| 4 | **`CODEOWNERS` contains placeholder handles.** GitHub **silently ignores** entries naming an unresolvable team, so the file currently reads as protection while enforcing nothing. Replace `@gymmap/*` with real teams and enable branch protection with "Require review from Code Owners". |
| 5 | **`.env.local` holds real generated keys.** Git-ignored and verified. Never copy a value from it into staging or production. |
| 6 | **No CI workflows exist yet.** `.github/workflows/` is empty. A-26 specifies `ci.yml`, `deploy.yml`, `nightly.yml`, `security.yml`. Every quality gate configured here is currently enforced only on your machine, and `--no-verify` bypasses all of them. |
| 7 | **Windows Insider Preview build.** First suspect if WSL or Docker behave oddly. |
| 8 | `winget` is a `-preview` build and hung on elevation. The elevated script uses it; if it misbehaves, install Docker Desktop from docker.com directly. |

---

## 11. Verification results

| Check | Result |
| :--- | :--- |
| `pnpm --version` | ✅ 11.20.0 |
| `gh --version` | ✅ 2.97.0 |
| `pnpm exec tsc --version` | ✅ 6.0.3 |
| `pnpm exec prettier --check` | ✅ clean |
| commitlint accepts a valid message | ✅ |
| commitlint rejects a missing PRD identifier | ✅ |
| commitlint rejects a junk message | ✅ |
| Husky hooks installed, `core.hooksPath` set | ✅ 3 hooks |
| pre-commit ran on the initial commit | ✅ 95 files formatted |
| Specification corpus unmodified | ✅ byte-identical |
| `.env.local` git-ignored | ✅ |
| `node_modules` excluded | ✅ |
| Playwright browsers | ✅ 3 engines, 1,207 MB |
| VS Code extensions | ✅ 33/33 |
| MCP servers registered | ✅ 7 (pending approval) |
| Branches `main` + `develop` | ✅ |
| `docker --version` | ❌ **not installed** |
| `wsl --status` | ❌ **not installed** |
| Compose stack starts | ⏸ blocked on Docker |

---

## 12. Next steps, in order

1. **Run the elevated script** (§6). Reboot when told, run it again. *~30 min.*
2. **Start Docker Desktop**, then `pnpm infra:up` and `pnpm infra:ps`. Confirm all four services read
   healthy. *~10 min, mostly image pulls.*
3. **Approve the MCP servers** — start `claude` in this directory and accept the seven.
4. **`gh auth login`**, then add the GitHub MCP server (§7.3).
5. **Fix the git identity** if `Mehdi` is not what you want on every commit (§4.3) — do this before
   pushing anywhere.
6. **Rule on the four decisions** in §9. Node 24 (9.1) and the UI/UX additions (9.4) are the two that
   actually change what gets built.
7. **Replace the `CODEOWNERS` placeholders** and enable branch protection when a remote exists.

Nothing in steps 1–7 is blocked by anything else. Phase 8 remains `BLOCKED` regardless; Phases 5, 6
and 7 continue in the other session.

---

## 13. What was deliberately not done

- **No application code.** No React component, no NestJS controller or route, no Prisma schema, no
  migration. Phase 8 is `BLOCKED`.
- **No `package.json` in any `apps/*` or `packages/*`.** Creating one means declaring dependencies,
  and the register's standing rule makes an undeclared dependency a review blocker. Placeholder
  READMEs mark the directories instead.
- **No existing document was overwritten.** Only `CLAUDE.md`, `README.md` and this file were authored
  under governance; every pre-existing specification file is untouched.
- **Nothing was pushed to a remote.** No remote is configured. All 105,850 lines are local.
- **No unapproved dependency was installed anywhere.**

---

*Environment prepared 2026-08-06. Commit `16bff06` on `main`; `develop` branched from it.*
