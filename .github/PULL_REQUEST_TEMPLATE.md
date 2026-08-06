<!--
  FolderStructure.md §2: every PR declares its PRD id, the permission it needs,
  its isolation test and its rollback plan. A PR that leaves these blank is not
  ready for review.
-->

## What and why

<!-- The diff shows what changed. Explain WHY, in terms of the requirement. -->

## PRD identifiers

<!-- Every PR serves at least one. e.g. FR-CHK-04, BR-PAY-03, NFR-SEC-09 -->

-

## Checklist

- [ ] Cites at least one `FR-` / `BR-` / `NFR-` / `AC-` identifier, and the branch and commits match
- [ ] Read the governing specification for the area touched — not a summary of it
- [ ] Conflicts with the constitution or the PRD: **none**, or raised and recorded in `DECISION_LOG.md`
- [ ] No new dependency, **or** it has an approved `A-NN` row in `STACK_ADDITIONS.md`
- [ ] `PHASES.md` boxes ticked in this same change, if a deliverable completed

### Every endpoint touched

- [ ] Declares a required permission (constitution rule — no endpoint is implicitly public)
- [ ] Money-affecting or state-changing endpoints declare idempotency behaviour
- [ ] Error codes come from the shared error taxonomy

### Tenant isolation — `BR-TEN-01`

- [ ] All tenant-scoped access goes through the Prisma tenant-context client extension. No repository
      calls the raw client. _(The condition on which `A-01` was approved.)_
- [ ] An isolation test proves tenant B cannot read or write tenant A's rows
- [ ] N/A — this change touches no tenant-owned table

### Money — `BR-PAY-01`, `BR-FIN-01`

- [ ] Integer minor units (paise) with an adjacent currency column. No `numeric`, no `float`.
- [ ] Ledger writes are append-only; corrections are compensating entries, never edits or deletes
- [ ] N/A — this change touches no money path

### Tests

- [ ] Unit / integration / contract / e2e as appropriate for the layer
- [ ] Every `M`-priority rule touched has a test proving the **negative** case too (`BAC-06`)

### Rollback plan

<!-- How is this undone in production? Migrations must be backward-compatible
     per §C7 expand/migrate/contract. "Revert the PR" is only a plan if it is true. -->

## Debt and limitations

- [ ] Any knowing shortcut is recorded in `TECH_DEBT.md` with an interest rate and a payoff trigger
- [ ] Any deliberate gap is recorded in `KNOWN_LIMITATIONS.md` with a revisit trigger
- [ ] Neither applies
