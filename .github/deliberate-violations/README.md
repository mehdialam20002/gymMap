# Deliberate violations — `E0.11`, `AC-FND-14.2`

**M-007 AC-2.** Each script here breaks exactly one rule and asserts that **that gate fails, and
only that gate**.

## Why this exists

A CI gate that has never failed is a gate nobody has proved works. Every one of the ten has a
plausible way of being silently inert:

- a `grep` whose pattern never matches, so it always passes
- a linter run against a path that no longer holds source
- a script that swallows its own non-zero exit
- a job whose `if:` condition is never true
- a rule that was correct until a refactor moved the files it watched

None of those show up as a red build. They show up as a **green** one, which is worse, because a
green check is read as a claim that something was verified.

The second half — _and only that gate_ — matters just as much. A gate that fails on everything is
noise, and the response to noise is to stop reading it. If breaking formatting also turns
`architecture` red, then `architecture`'s signal has been destroyed and nobody will notice until
it matters.

## Running them

```bash
# One violation
bash .github/deliberate-violations/03-lint.spec.sh

# All of them
for f in .github/deliberate-violations/*.spec.sh; do bash "$f" || echo "FAILED: $f"; done
```

Each script:

1. Copies the repository into a scratch directory — **nothing mutates the working tree**
2. Introduces one violation
3. Runs the gate that should catch it, and asserts it **fails**
4. Runs the other gates, and asserts they **pass**
5. Cleans up

## Coverage

| Script                  | Violation                                                     | Must fail | Must stay green |
| :---------------------- | :------------------------------------------------------------ | :-------- | :-------------- |
| `02-commit-grammar`     | A commit message with no PRD identifier                       | 2         | all others      |
| `03-lint`               | An unformatted file                                           | 3         | all others      |
| `04-typecheck`          | A type error                                                  | 4         | all others      |
| `05-architecture`       | `PrismaClient` imported outside `tenancy/`                    | 5         | all others      |
| `06-module-structure`   | A missing `README.md`; a 24th module; a forbidden `services/` | 6         | all others      |
| `16-scan-secrets`       | A committed AWS key                                           | 16        | all others      |
| `25-pipeline-integrity` | An action pinned by tag instead of SHA                        | 25        | all others      |

## Not yet covered

`01-setup` and `26-gate-summary` are not violated here. `setup` fails only if the toolchain
itself is broken, which every other job would report anyway; `gate-summary` is proved by any of
the scripts above — its whole job is to go red when an upstream job does, and each script
demonstrates that transitively.

`15-scan-deps` runs its unapproved-dependency check in advisory mode until M-008 (see the header
of `dependency-approval.mjs`), so a violation would correctly **not** fail the build yet. The
fixture is added when the check becomes enforcing.
