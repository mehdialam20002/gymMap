# billing

> **Charter (`MASTER_PRD.md` §C1.3).** `billing/` — _invoices, credit notes, tax profiles,
> subscription billing._
>
> **Milestone ids in this file are cited from `docs/roadmap/Milestones_030-059.md` and
> `Milestones_090-119.md`.** `docs/roadmap/README.md` §5 assigns different ids to the same titles.
> That disagreement is **`BLK-05`, recorded OPEN in `PHASES.md`**, and it is not resolved here.
> Where an id is cited the milestone **title** is given with it, because the title is the stable
> reference until `BLK-05` closes.

---

## 1. Bounded context

`billing/` owns the **document** — the numbered, immutable, statutorily-retained artefact that says
what was sold, to whom, and with which tax on it. Two decisions live here and nowhere else. First,
**which number a document gets**: `billing/` owns `document_number_counters` and the
`financialYearOf(instant, timezone, fyStartMonth)` function, which together are the only mechanism
by which `FR-INV-02`'s gapless per-tenant-per-financial-year sequence exists. Second, **which tax
treatment is frozen onto it**: `TaxProfile.apply()` returns a `TaxAssessment` that is snapshotted, so
a later GST change can never rewrite a filed invoice (`BR-PAY-11`). What `billing/` explicitly does
**not** own is any decision about money: it never prices a sale (`ordering/` does), never decides a
refund — ADR-0029 is blunt about this: _"`billing/` never decides a refund"_ — and never derives a
balance (`ledger/` does). It is asked for a document and it produces one.

## 2. PRD identifiers

| Family                      | Identifiers                                                                                                                                                                                                                                                     |
| :-------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Functional                  | `FR-INV-01` … `FR-INV-11` (`B5.11`)                                                                                                                                                                                                                             |
| Business rules **owned**    | `BR-PAY-10` (gapless, immutable, credit-note corrections) · `BR-PAY-11` (tax treatment frozen at the moment of sale) · `BR-TEN-06` (the subscription dunning ladder)                                                                                            |
| Business rules **co-owned** | `BR-PAY-09` (with `ordering/` — the consolidated invoice for a `BALANCE_DUE` order)                                                                                                                                                                             |
| Non-functional              | `NFR-PERF-07` (invoice PDF ≤ 3 s) · `NFR-DQ-02` · `NFR-MNT-01` (≥ 95% coverage on `billing/**`) · `NFR-MNT-09` (§9)                                                                                                                                             |
| State machine               | **No `§C4` machine.** `invoice_status_enum` is `ISSUED` / `PARTIALLY_CREDITED` / `FULLY_CREDITED` and **has no `VOID` label** — a document is never cancelled, only credited. The `§C4.5` refund machine that drives credit-note issuance belongs to `refunds/` |
| Background jobs             | **`§C5`** `subscription.charge` · plus one non-`§C5` assurance job (§8)                                                                                                                                                                                         |
| API                         | Member rows in `API_Catalog.md` §3.5 (`GET /me/invoices`, `GET /me/invoices/:id/pdf`) and tenant rows in §3.9 (`GET /tenant/invoices`, `GET /tenant/invoices/:id/pdf`). Both are `NO-STORE!` — `private, no-store` + `Pragma: no-cache` + `Vary: Authorization` |
| Screens                     | `SCR-DASH-013` Invoices · `SCR-WEB-011` Orders & Invoices                                                                                                                                                                                                       |
| Acceptance                  | `AC-INV-01.1` (concurrency → contiguity) · `AC-INV-01.2` (**a silently skipped number is a defect**) · `AC-INV-01.3` (FY rollover) · `BAC-04`                                                                                                                   |
| India                       | `LAUNCH_MARKET_INDIA.md` §4 (GST 18% = CGST 9% + SGST 9% intra-state, IGST 18% inter-state, place of supply = the **branch**) · §5 (FY 1 April – 31 March) · ADR-0028 (country/tax as configuration)                                                            |
| Open items                  | **`O-1`** GST on the platform's own commission (`commission_tax_minor`, blocked on `REG-02`) · **`O-3`** the SAC code (9997xx)                                                                                                                                  |

## 3. Owned tables

_Planned. No code in this module yet - populated by the milestones listed below._

| Table                      | `Schema.md` | Grants / retention                                                                                      | Why the shape matters                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| :------------------------- | :---------- | :------------------------------------------------------------------------------------------------------ | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `invoices`                 | §7.5        | RLS · P-STD · **R-FIN** · **G-APPEND** plus `GRANT UPDATE (status, pdf_url)` · **no soft delete, ever** | `uq_invoices__tenant_fy_number (tenant_id, financial_year, invoice_number)` **is `FR-INV-02` expressed as an index** — the allocator is the mechanism, this is the proof. Five snapshot columns (`tenant_snapshot`, `customer_snapshot`, `line_items`, `tax_breakdown`, `totals`) make the byte-identical re-render of `FR-INV-07` possible, because the renderer reads snapshots and never joins to `tax_profiles`. The two writable columns are facts _about_ the document, not part of it |
| `credit_notes`             | §7.5        | as above, with its **own** gapless sequence                                                             | `original_invoice_id` is mandatory; `refund_id` is nullable because a credit note may precede a gateway refund. Numbering is a distinct `document_kind`, so the invoice series is never interrupted (`FR-INV-09`)                                                                                                                                                                                                                                                                            |
| `subscription_invoices`    | §4.5        | RLS · P-STD · R-FIN · **G-APPEND** plus `GRANT UPDATE (status, paid_at, payment_id, pdf_url)`           | The tenant's own SaaS bill for its `subscription_tier`, distinct from the member invoices its customers receive. **Nothing about subscription state sits on the check-in read path** — that is `BR-TEN-06`'s _"check-in for existing members is never blocked by subscription arrears"_ enforced by schema placement                                                                                                                                                                         |
| `document_number_counters` | §13.6       | RLS · P-STD · R-FIN · G-CRUD (no delete)                                                                | The row-locked counter keyed `(tenant_id, document_kind, financial_year)`. **One table with a discriminator, not three** — _"three tables would be three code paths and three chances for one to use a sequence"_                                                                                                                                                                                                                                                                            |

**A PostgreSQL `SEQUENCE` may not be used.** Sequences are non-transactional: a rollback consumes the
number and leaves a gap, and gapless means gapless (`Schema.md` §2.12,
`PROJECT_CONSTITUTION.md` §15.8 rule 3). Nor an advisory lock, which serialises correctly but leaves
nothing durable, so a crash between allocation and commit is unresolvable.

**`tax_profiles` is not owned here.** It is `GLOBAL` platform-reference data (`Schema.md` §12.3),
written by `admin/` on the audited, reason-required path and **read** by `billing/` through
`common/persistence/reference-data.repository.ts` — never by importing `admin/`
(`ModuleDependency.md` §0 C-3). `fy_start_month = 4` is a value in that table, never a constant.

**Two artefacts named in the specification with no table behind them yet.** Recorded rather than
invented: the **void record** of `AC-INV-01.2` (`M-060` names `billing/domain/void-record.ts`, but no
`Schema.md` entry defines where a void record is stored), and the `invoice_sequence_gaps` relation
that `Monitoring.md` `ALRT-16`'s first diagnostic query selects from
(`SELECT tenant_id, financial_year, missing_number FROM invoice_sequence_gaps WHERE resolved_at IS NULL;`),
which likewise has no `Schema.md` specification. Both need one before `M-060` merges.

**Delivering milestones.** `M-060` _"The gapless per-tenant-per-FY invoice number and the India GST
breakdown"_ creates `invoices` and `document_number_counters` in one migration · `credit_notes`
arrives with `M-101` _"The credit note in its own sequence, and proportional commission reversal at
the original rounding"_, which reuses `M-060`'s allocator unchanged — _the point of the
`document_kind` discriminator_. `subscription_invoices` is Sprint 15 (`Milestones_030-059.md` §2
records subscription charging as moved out of the Sprint-6 band).

## 4. Public surface

_Planned. No code in this module yet - populated by the milestones listed below._

`billing/` has `controllers/` — member-facing and tenant-facing invoice reads — and therefore a
mandatory `permissions.ts`. It is a **read-only HTTP surface**: no endpoint issues, edits or voids a
document, because issuance is event-driven (§7) and correction is a credit note.

| Exported symbol                                                                 | Kind                   | Consumers                                                                                                                                                                                                | Authority                            |
| :------------------------------------------------------------------------------ | :--------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :----------------------------------- |
| `CREDIT_NOTE_PORT` + `CreditNotePort`                                           | Port token + interface | `refunds/` (edge 36). The split is exact: **`refunds/` decides, `billing/` issues the numbered document**                                                                                                | `ModuleDependency.md` §3.2, ADR-0029 |
| `INVOICE_QUERY_PORT` + `InvoiceQueryPort`                                       | Port token + interface | `settlements/` (edge 41 — statement lines cite invoice numbers, `FR-SETL-04`) · `support/` (edge 45 — `FR-SUP-02` stores references and renders them live) · `reporting/` (edge 46) · `admin/` (edge 47) | `ModuleDependency.md` §3.2           |
| `InvoiceIssuedPayload`, `CreditNoteIssuedPayload`, `SubscriptionPastDuePayload` | **Types only**         | The consumers in §6 (`E7`)                                                                                                                                                                               | `ModuleDependency.md` §8.1           |
| `BILLING_PERMISSIONS`                                                           | Constant               | `billing.invoice.list` · `billing.invoice.download`. The same two permissions gate both the member and the tenant surface; RLS decides _which rows_, the permission decides _whether at all_             | `API_Catalog.md` §3.5, §3.9          |

**Never exported:** the `Invoice` and `CreditNote` aggregates (an `Invoice` has **no mutators** — a
second module able to construct one is a second place a number can be allocated); the
`DocumentNumberAllocator`; `FinancialYear` and the GST split policy; the repositories; every DTO;
every Prisma model.

**Delivering milestone.** `M-060` creates `index.ts`, `billing.module.ts`, `permissions.ts`, this
README, `types/` and the domain set. The two PDF endpoints stream a byte-identical regeneration once
the deterministic Chromium renderer lands in the following band.

## 5. Consumed ports

_Planned. No code in this module yet - populated by the milestones listed below._

`billing/` has the **widest read fan-in of any non-`reporting/` module** — nine ports by
`ModuleDependency.md` §12.2's count — because composing one document means restating facts that four
other modules own. That fan-in is also why its extraction-readiness score is **2**.

| From        | Port                                                                                              | Why the answer must be synchronous                                                                                                                                                                                                                                                                  |
| :---------- | :------------------------------------------------------------------------------------------------ | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ordering/` | `ORDER_SNAPSHOT_PORT`                                                                             | The invoice **restates the order exactly**, including the CGST/SGST split lines. The figures are copied at issuance and never recomputed, so they must be read in the issuing transaction — after which the copy, not the source, is authoritative (edge 30; `FR-INV-01`, `FR-INV-04`, `BR-FIN-02`) |
| `payments/` | `PAYMENT_QUERY_PORT`                                                                              | An invoice is issued on capture and **names the payment** — `FR-INV-04` requires the payment reference and method to be printed lines (edge 31; `BR-PAY-10`)                                                                                                                                        |
| `plans/`    | `PLAN_SUMMARY_PORT`                                                                               | Line descriptions on the document. Note that `order_items.description` is already a snapshotted literal (`S5`), so this port supplies presentation detail, never the priced figure (edge 32)                                                                                                        |
| `crm/`      | `MEMBER_QUERY_PORT`                                                                               | The bill-to party for `customer_snapshot` — read once at issuance, then frozen (edge 33)                                                                                                                                                                                                            |
| `common/`   | `ReferenceDataRepository` → `tax_profiles`; `Money`; the error taxonomy; the outbox port; `Clock` | The rate table, inclusivity, rounding method, place-of-supply rule and `fy_start_month` must all be read at the instant of issuance, because that instant is what the snapshot preserves (`§0 C-3`, ADR-0028)                                                                                       |
| `tenancy/`  | `TenantContext`, the tenant-scoped Prisma client                                                  | Universal edge. The counter row is locked **inside** the tenant-scoped issuing transaction                                                                                                                                                                                                          |
| `audit/`    | `AUDIT_WRITE_PORT`                                                                                | Issue and credit-note issue are audited. There is no update to audit, by construction                                                                                                                                                                                                               |

**Two matrix cells with no port behind them, and one genuine gap.**

- `ModuleDependency.md` §4 marks `billing → catalog` and `billing → iam` as **●**, but §3.2 declares
  no port for either. Under §3.2's closure rule they are **not edges**. This matters for
  `invoices.place_of_supply_state_code`, which is _"the branch's state"_ — the specification does not
  say whether that value reaches `billing/` inside the order snapshot or through a `catalog/` port.
  Resolve before `M-060`.
- **`subscription.charge` has no charging port.** §3.2 gives `billing/` only `PAYMENT_QUERY_PORT` on
  `payments/`, which reads. `subscription_invoices.payment_id` is a real FK to `payments`, so
  something must create that charge, and no declared port can. Flagged rather than invented; it needs
  a §3.2 row before the Sprint-15 milestone.

**Delivering milestone.** `M-060` wires `ORDER_SNAPSHOT_PORT` and the tax-profile read; the
`payment.captured` handler that triggers issuance lands in the same milestone.

## 6. Emitted events

_Planned. No code in this module yet - populated by the milestones listed below._

| Event                   | Payload beyond `tenant_id` and `occurred_at`                   | Known consumers                                                                                                                       | Notes                                                                                                                                                                                                          |
| :---------------------- | :------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------ | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `invoice.issued`        | `invoice_id`, `invoice_number`, `order_id`, `tax_components[]` | `notifications/` (`FR-INV-08` — invoices are emailed on issue) · `settlements/` (`FR-SETL-04` — statement lines cite invoice numbers) | `tax_components[]` is an **array**, never a scalar and never a single object, so an inter-state IGST invoice and an intra-state CGST+SGST invoice have the same payload shape and the consumer does not branch |
| `credit-note.issued`    | `credit_note_id`, `invoice_id`, `amount_minor`                 | `refunds/`, `notifications/`                                                                                                          | The document `refunds/` asked for, announced back to it                                                                                                                                                        |
| `subscription.past-due` | `tenant_id`, `days_overdue`                                    | `admin/`, `notifications/`                                                                                                            | Idempotency key `tenant_id` + `billing_period`. `BR-TEN-06`: `PAST_DUE` at day 0, marketplace delisting at day 7, dashboard read-only at day 14 — and **never** a check-in block                               |

Every outbox row is written inside the issuing transaction (`E2`); no payload carries a personal
datum (`E5`), which is why `invoice.issued` carries the invoice **number** and not the
`customer_snapshot` the document prints.

**Delivering milestones.** `M-060` (`invoice.issued`) · `M-101` (`credit-note.issued`) · Sprint 15
(`subscription.past-due`).

## 7. Consumed events

_Planned. No code in this module yet - populated by the milestones listed below._

A handler here imports nothing from its publisher; the serialised payload is the contract, enforced
by `dependency-cruiser`'s `handler-no-publisher-import` rule from the filename alone.

| Event              | Publisher   | Handler idempotency key | What the handler does                                                                                                                                                                                                                                                                                                                                                                                       |
| :----------------- | :---------- | :---------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `payment.captured` | `payments/` | `payment_id`            | **Issues the invoice.** One invoice per captured payment (`FR-INV-01`, `F-09.1`). The named file is `billing/application/handlers/payment-captured.handler.ts` (`M-060`)                                                                                                                                                                                                                                    |
| `order.paid`       | `ordering/` | `order_id`              | Carries `gross_minor`, `tax_minor`, `discount_minor`, `commission_base_minor` and `coupon_funding_source`. `ModuleDependency.md` §8.2 lists `billing/` among its consumers, but **no milestone allocates this handler** — `M-060` names only the `payment-captured` one. Either the catalogue row or the milestone is incomplete; do not build both issuance paths                                          |
| `refund.completed` | `refunds/`  | `refund_id`             | §8.2 lists `billing/` as a consumer, while §3.2 edge 36 additionally gives `refunds/` a **synchronous** `CREDIT_NOTE_PORT` call. The specification does not say which mechanism issues the document. What _is_ fixed is the grant: the only columns this handler may write on `invoices` are `status` and `pdf_url`, so `ISSUED → PARTIALLY_CREDITED → FULLY_CREDITED` is the whole of its reachable effect |

**Delivering milestone.** `M-060` for the `payment.captured` handler. The other two need their
mechanism settled first.

## 8. Jobs

_Planned. No code in this module yet - populated by the milestones listed below._

| Job                                   | `§C5`?  | Queue     | Class  | Schedule | Conc | Scope | Lock key                                   | Expected                    | Alert                              |
| :------------------------------------ | :-----: | :-------- | :----: | :------- | :--: | :---: | :----------------------------------------- | :-------------------------- | :--------------------------------- |
| `subscription.charge`                 | **Yes** | `billing` | **P0** | Daily    |  1   | `TS`  | `subscription.charge:tenant_{id}:{period}` | **60 s** (≈ 67 tenants/day) | **10 min**, or depth > 0 after 6 h |
| Invoice sequence-contiguity assurance | **No**  | `billing` |   —    | Nightly  |  —   |   —   | _not specified_                            | _not specified_             | `ALRT-16` on any hole              |

**`subscription.charge`** charges tenant subscriptions and applies the `BR-TEN-06` ladder —
`ACTIVE → PAST_DUE` on first failure, then two date-driven degradations computed from
`past_due_since`, with "7 days" and "14 days" existing once, as configuration, in a
`SubscriptionDegradation` value object. Trust layer 3 is `orders (idempotency_key)` unique with the
key derived from `{tenant_id}:{period}` (`Scalability.md` §8.3.1). If it falls behind, `A6.2` governs
the consequence: _"a failed subscription charge degrades the tenant but never blocks member check-ins
already paid for"_ — so this job falling behind must never touch the check-in path.

**The contiguity job is not one of the twenty-four `§C5` jobs.** It is added by `F-09.15` as the
`TR-03` mitigation and named in `M-060` as
`billing/application/jobs/sequence-contiguity.processor.ts`: nightly, asserting
`count(*) = max(number)` per tenant per financial year and alerting on any hole. Its schedule,
concurrency, scope, lock key and duration envelope are **absent** from `Scalability.md` §8.3 —
recorded here as a gap, because `§C5`'s standing requirement is that _every_ job runs under a
distributed lock, records start/end/outcome, emits metrics and alerts on exceeding its expected
duration.

`billing/` has **no** `data.retention-sweep` child. Every table it owns is `R-FIN`, and
`SoftDeleteStrategy.md` §11.2's `R-FIN` branch is a deliberate no-op until FY 2034-35 — for
`invoices` that is not an optimisation, it is `CON-04` statutory retention.

**Delivering milestones.** `M-060` (the contiguity job) · Sprint 15 (`subscription.charge`).

## 9. Top three failure modes (`NFR-MNT-09`)

Drawn from `Epic_09.md` **T-09.41** and its risk register `R-09.9` / `R-09.11`.

|  #  | Failure                                                                                                                                                        | Signal                                                                                                                                                                                              | First action                                                                                                                                                                                                                                                                                                                                                                                                                             |
| :-: | :------------------------------------------------------------------------------------------------------------------------------------------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
|  1  | **Invoice sequence gap** — a hole in a tenant's GST series, which is a question at assessment time that the **tenant**, not the platform, has to answer        | `ALRT-16` (**S1**): `invoice_sequence_gaps_current > 0`, from the nightly contiguity job. Contiguity is asserted per tenant **per Indian financial year (1 Apr – 31 Mar)**                          | Query the gap rows, then look for concurrent-allocation retries and rollback-after-allocation in the same window. **A void record occupies the number. Never back-fill** — a fabricated invoice is worse than a gap, and there is no back-fill code path to reach for (`R-09.9`). Unexplained at 24 h, escalate to Technical Lead                                                                                                        |
|  2  | **PDF determinism failure** — two different renders of the same GST invoice number, which is an evidentiary problem in a dispute and an audit finding in India | `ALRT-37`: `increase(invoice_pdf_determinism_failures_total[1h]) > 0`. **Any increment is a correctness defect**, not a threshold                                                                   | Diff the two renders' _inputs_: font availability in the container, locale, timezone, or a non-deterministic timestamp in the template. A determinism failure appearing in a pre-release run **blocks the release**. If the renderer digest changed legitimately, re-baseline deliberately — a silent re-baseline is how this defect hides                                                                                               |
|  3  | **Issuance stalled for a tenant** — payments are capturing but documents are not being produced, so members have paid and have no tax invoice                  | `invoice_issued_total{document_type="INVOICE"}` flat while `payment_attempts_total{status="SUCCEEDED"}` is non-zero over the same window; corroborate with dead-letter depth on the `billing` queue | Check `rel.billing.invoice-issuance` first — with the flag _off_, `M-060`'s design **defers** issuance rather than dropping it, so invoices are produced late, never skipped. If the flag is on, the `payment.captured` handler is dead-lettered: drain it, do not re-issue by hand. `ALRT-07` (`invoice_pdf_duration_seconds` p95 > 3 s) is the adjacent, lower-severity variant where the record exists and only the render is failing |

**Runbook:** `/docs/runbooks/billing.md` — the file `Monitoring.md` `ALRT-07`, `ALRT-16` and
`ALRT-37` already point at, by its `§PDF`, `§Sequence integrity` and `§Determinism` sections.
