# EP-09 — Invoicing, Tax & Subscription Billing

> **Phase-0 delivery backlog.** Detailed expansion of `ENGINEERING_PLAN.md` §2 (epic row `EP-09`)
> and §3 (`F-09.1` … `F-09.11`). No application code exists yet.
>
> **Two India rulings govern this epic and both change the PRD's defaults.**
> **(1)** The financial year runs **1 April – 31 March**, not January–December, so `FR-INV-02`'s
> *"per tenant per financial year"* numbering and `AC-INV-01.3`'s rollover are April-boundary
> events evaluated in `Asia/Kolkata` — which is **31 March 18:30 UTC** (`LAUNCH_MARKET_INDIA.md`
> §5, `TR-19`, `REG-04`).
> **(2)** GST is **18% exclusive, split CGST 9% + SGST 9%** for intra-state supply, which is almost
> every gym sale because the service is consumed at a physical location. The invoice must show
> **two component lines**, not one combined 18% figure (`LAUNCH_MARKET_INDIA.md` §4).
>
> ⛔ **`BLK-03` conflict 2 is unresolved and is BLOCKING for Sprint 11.** See §13.

---

## 1. Metadata

| Field | Value |
| :--- | :--- |
| **Epic id** | `EP-09` |
| **Name** | Invoicing, Tax & Subscription Billing |
| **Priority (MoSCoW)** | **M** — Must. `BAC-04` requires *"a compliant invoice"* on every capture; a gap in a tax-invoice series is a GST compliance failure **for the tenant**, caused by the platform |
| **Complexity** | **M** (T-shirt, §2) · module rating **High** for `billing/` (§13.1) |
| **Story points** | **34** (epic/feature view, §2) · `billing/` module view **55 pts / 28 engineer-days** (§13.1) |
| **Target sprint(s)** | **Sprint 6** primary (`F-09.1` … `F-09.10`, `F-09.12`, `F-09.13`, `F-09.15`), gated by **`E2E-02`** and milestone **`M3`** · **Sprint 13** bulk export (moved with the export harness) · **Sprint 15** `F-09.11` subscription billing (moved with `FR-ADMN-04` tier configuration) |
| **Owning PRD module** | `INV` (`B5.11`) |
| **Owning code module** | `billing/` |
| **Surfaces** | `customer-web` — `SCR-WEB-007` (invoice download), `SCR-WEB-011` · `gym-dashboard` — `SCR-DASH-013` · `admin-dashboard` — `SCR-ADM-006` (invoice column), `SCR-ADM-011` (tax profiles) |
| **Primary APIs** | `GET /v1/tenant/invoices`, invoice and credit-note download endpoints, `GET|PUT /v1/admin/config/tax-profiles`, bulk export via `POST /v1/tenant/exports` |
| **Background jobs** | `subscription.charge` (daily, `C5`) · **new**: `billing.sequence-contiguity-check` (nightly) · **new**: `billing.pdf-determinism-corpus` (nightly) |
| **Launch market** | **India** — GST 18% exclusive as **CGST 9% + SGST 9%** intra-state, **IGST 18%** inter-state, place of supply = **branch location**, SAC 9997xx (**unconfirmed**), FY starts **1 April**, INR/paise with lakh–crore grouping, `₹` glyph embedded in the renderer font |
| **Status** | `PLANNED` — Phase 0. Not started. **One blocking item open** (`BLK-03` c2) |
| **Epic owner** | Backend Lead — billing. Two approvals required on `billing/` (money path) |

---

## 2. Business Goal

**A gapless, immutable, reproducible invoice series that survives an audit.** That is the whole
epic, and every word in it is load-bearing. *Gapless*, because a missing number in a GST tax-invoice
sequence is a compliance failure discovered by the tenant's accountant at filing time, with the
platform as the cause — and `AC-INV-01.2` is explicit that a silently skipped number is a defect,
not an inconvenience. *Immutable*, because an editable invoice has no evidentiary value in a
chargeback or an audit; corrections are credit notes in their own sequence, referencing the
original. *Reproducible*, because `FR-INV-07` promises byte-identical regeneration, and a promise
that the same document can be produced twice is the difference between an archive and a rendering
service.

**Second, this epic is where the platform's country-agnostic ambition (`OBJ-09`) is either real or
decorative.** Tax is not a constant; it is a **profile**: a rate table, inclusive or exclusive
treatment, place-of-supply rules, a rounding method and — the India decision adds this —
a **financial-year start month**. The India profile is 18% exclusive, split into CGST 9% and SGST 9%
for intra-state supply, IGST 18% inter-state, place of supply at the branch, FY starting month 4.
Every one of those is configuration, held in the tax profile, snapshotted onto the invoice at issue,
and never re-read afterwards (`BR-PAY-11`). If any of it becomes a literal in code, the second
market is a rewrite and the first GST rate change silently rewrites history.

**Third, invoicing is the point at which the platform's own commercial arrangement becomes visible
to the tenant — and there is a hole in it.** `A6.3` computes `payable_to_gym = (N + T) − C − F`
with **no GST on the commission `C`**. But the platform supplies a service (marketplace
intermediation) to the tenant, and in India that service attracts 18% GST on the commission amount.
`BR-FIN-02` requires every figure to be persisted and `BR-FIN-03` requires statement lines to sum
exactly; as written they cannot both hold once commission GST exists. The resolution — a **ninth
persisted figure `commission_tax_minor`**, a `COMMISSION_TAX` ledger entry type, and **a second
invoice series in which the platform bills the tenant for its commission** — lands partly in this
epic and partly in `EP-15`. It is `REG-02`, scored **20 (Severe)**, and it is flagged blocking for
Sprint 11 in §13.

---

## 3. Scope

### 3.1 In scope — explicit

| # | Item | Anchor |
| :-: | :--- | :--- |
| 1 | Automatic invoice on **every** successful payment, including staff-recorded offline payments | `FR-INV-01`, `BR-PAY-10` |
| 2 | Gapless sequential numbering **per tenant per financial year**, configurable prefix format, allocated inside the invoice transaction as the **last** write before commit | `FR-INV-02`, `AC-INV-01.1`, `TR-03` |
| 3 | **Financial year starting 1 April**, held as tax-profile configuration (default month 4 for India), derived by a single `financialYearOf(instant, timezone, fyStartMonth)` used by the allocator, the report, the export and the PDF alike | `AC-INV-01.3`, `LAUNCH_MARKET_INDIA.md` §5, `TR-19`, `REG-04` |
| 4 | Documented **void records** for a post-allocation failure — a number is occupied by a void entry with a reason, never left as a hole and never back-filled | `AC-INV-01.2`, `TR-03` contingency |
| 5 | Immutability: no `UPDATE`/`DELETE` grant on `invoices` for the application role; `Invoice` has no mutators | `FR-INV-03`, `BR-PAY-10` |
| 6 | Credit notes as the only correction mechanism, in **their own** gapless sequence, referencing the original invoice number | `FR-INV-09`, `FR-INV-03` |
| 7 | Full invoice content: tenant legal entity and tax identifiers (PAN, GSTIN), customer name and identifiers, line items, discount, **tax breakdown by component**, total in words, payment reference and method, and the refund policy applicable to the order | `FR-INV-04` |
| 8 | Country tax profiles: rate table, inclusive/exclusive treatment, place-of-supply rules, rounding method, FY start month | `FR-INV-05`, `FR-ADMN-05`, `OBJ-09` |
| 9 | **India GST profile**: 18% exclusive; intra-state **CGST 9% + SGST 9%** as two lines; inter-state **IGST 18%**; place of supply = **branch location**; SAC 9997xx; `round_half_even` | `LAUNCH_MARKET_INDIA.md` §4 |
| 10 | Tax treatment frozen on the invoice; no invoice read path joins to `tax_profiles` | `FR-INV-06`, `BR-PAY-11` |
| 11 | Deterministic PDF: pinned Chromium **digest** (not tag), fonts embedded including the `₹` glyph, `TZ=UTC`, `en-IN` locale, timestamps from `issued_at`, renderer digest recorded on the invoice row | `FR-INV-07`, `TR-15`, `NFR-PERF-07` |
| 12 | Download by member, tenant and Finance; emailed on issue | `FR-INV-08` |
| 13 | Bulk export by date range in PDF and CSV for the tenant's accountant | `FR-INV-10` |
| 14 | Tier-gated tenant branding (logo, footer text) on invoices | `FR-INV-11`, `A6.2` Growth tier and above |
| 15 | Subscription charging of the tenant, `PAST_DUE` transition and staged degradation — marketplace visibility lost at 7 days, dashboard write access at 14 days, **check-in never blocked** | `BR-TEN-06`, `C5 subscription.charge` |
| 16 | Nightly **contiguity check** asserting `count(*) = max(number)` per tenant per financial year, alarmed at any non-zero gap | `TR-03` mitigation |
| 17 | Nightly **determinism corpus** regenerating a fixed set of historical invoices and comparing SHA-256 hashes | `TR-15` mitigation |
| 18 | One consolidated invoice for an offline order paid in instalments — both payments appear on it | `AC-CART-02.3`, `E2E-10` |
| 19 | **Scaffolding only** for the platform's commission tax invoice to the tenant: the second series' shape and the `commission_tax_minor` field, present and zero, pending `REG-02` | `REG-02`, `BLK-03` c2 |

### 3.2 Out of scope — explicit, with destination

| Item | Why it is not here | Where it went |
| :--- | :--- | :--- |
| Order pricing, discount and the tax **computation** at order time | `ordering/` computes and snapshots `tax_snapshot`; `billing/` renders from the snapshot | **`EP-07`** T-07.17 |
| Payment capture, webhooks, the event that triggers issuance | The invoice is a consumer of `payment.captured` | **`EP-08`** T-08.28 |
| Ledger entries, commission posting, settlement statements, payouts | An invoice is a document; the ledger is the truth | **`EP-15`** |
| The `COMMISSION_TAX` **ledger entry type** and the settlement statement line | `EP-09` provides the invoice series; `EP-15` posts the entries | **`EP-15`**, blocked on `REG-02` |
| Refund execution, proration, approval routing | `EP-09` issues the **credit note** that a completed refund produces | **`EP-16`** |
| Dispute evidence packs (which include invoices) | `EP-09` supplies the document; assembly is `refunds/` | **`EP-16`** |
| Financial reports and drill-down over invoices | Reading is reporting's job | **`EP-18`** |
| The generic async export harness | `EP-09` registers an export type against it | **`EP-18`**, sprint 13 |
| Subscription **tier definition and pricing** (`FR-ADMN-04`) | `EP-09` charges what admin config defines | **`EP-19`**, which is why `F-09.11` moved to sprint 15 |
| GST return filing, GSTR-1/3B generation, TCS/TDS remittance | Requires a qualified Indian tax advisor to determine liability | Out of Phase 1; `REG-03`, `BLK-04` #1–#2 |
| E-invoicing (IRN / QR under the GST e-invoice mandate) | Applicability depends on tenant turnover thresholds that are unverified | **Not in Phase 1** — registered in `KNOWN_LIMITATIONS.md`; the invoice model must not preclude it |

---
## 4. Features

`F-09.1` … `F-09.11` are carried from `ENGINEERING_PLAN.md` §3. Rows marked *(new)* are additions
this backlog surfaces from `LAUNCH_MARKET_INDIA.md` §4–§5 and `RiskAnalysis.md` §3.3.3, §3.3.8,
§3.3.9 and §4.2.

| Feature | Description | Satisfies | Pri | Pts | Sprint |
| :--- | :--- | :--- | :-: | :-: | :-: |
| **F-09.1** | Automatic invoice on every successful payment, driven by the `payment.captured` outbox event | `FR-INV-01`, `BR-PAY-10` | M | 3 | 6 |
| **F-09.2** | Gapless sequential numbering per tenant per financial year, with documented void records for post-allocation failure | `FR-INV-02`, `AC-INV-01.1`, `AC-INV-01.2`, `TR-03` | M | 8 | 6 |
| **F-09.3** | Immutability; corrections issued only as credit notes in their own sequence | `FR-INV-03`, `FR-INV-09` | M | 3 | 6 |
| **F-09.4** | Full invoice content contract, including the applicable refund policy from the order snapshot | `FR-INV-04` | M | 3 | 6 |
| **F-09.5** | Country tax profiles: rate table, inclusive/exclusive, place of supply, rounding, **FY start month** | `FR-INV-05`, `FR-ADMN-05`, `OBJ-09` | M | 5 | 6 |
| **F-09.6** | Tax treatment frozen on the invoice; no read path joins to `tax_profiles` | `FR-INV-06`, `BR-PAY-11` | M | 2 | 6 |
| **F-09.7** | Deterministic, byte-identical PDF regeneration | `FR-INV-07`, `NFR-PERF-07`, `TR-15` | M | 5 | 6 |
| **F-09.8** | Download by member, tenant and Finance; emailed on issue | `FR-INV-08` | M | 2 | 6 |
| **F-09.9** | Bulk export by date range in PDF and CSV | `FR-INV-10` | M | 2 | 6 → 13 |
| **F-09.10** | Tier-gated tenant branding on invoices | `FR-INV-11`, `A6.2` | S | 2 | 6 |
| **F-09.11** | Subscription charging, `PAST_DUE` transitions and staged degradation | `BR-TEN-06`, `C5 subscription.charge` | M | 5 | 6 → **15** |
| **F-09.12** *(new)* | **India GST profile**: 18% exclusive · intra-state **CGST 9% + SGST 9%** as two invoice lines · inter-state **IGST 18%** · place of supply = branch location · SAC 9997xx · `round_half_even` | `LAUNCH_MARKET_INDIA.md` §4, `FR-INV-04`, `FR-INV-05` | M | 5 | 6 |
| **F-09.13** *(new)* | **`financialYearOf(instant, timezone, fyStartMonth)`** — one function, used by the allocator, the report, the export and the PDF; default month **4**; lazy counter creation by upsert inside the first invoice transaction of the year | `AC-INV-01.3`, `TR-19`, `REG-04` | M | 3 | 6 |
| **F-09.14** *(new)* | **Platform commission tax invoice series** — a second gapless per-FY sequence in which the platform bills the tenant for commission plus its GST. **Scaffolded only in sprint 6**; issuance blocked on `REG-02` | `REG-02`, `BLK-03` c2, `BR-FIN-02` | M | 5 | scaffold 6 · **issue 11 (blocked)** |
| **F-09.15** *(new)* | **Assurance jobs**: nightly sequence-contiguity check (`count(*) = max(number)` per tenant per FY) and nightly PDF-determinism corpus with SHA-256 comparison | `TR-03`, `TR-15` mitigations | M | 3 | 6 |
| **F-09.16** *(new)* | **India invoice template**: GST-compliant tax-invoice layout, both tax lines with fixed column widths, SAC code, place of supply, GSTIN of both parties, total in words in Indian English, `₹` with lakh grouping | `FR-INV-04`, `TR-15` drift source 6 | M | 3 | 6 |

**Feature roll-up.** 16 features · 34 core points (`F-09.1` … `F-09.11`) + 19 points for the five
additions, absorbed inside the `billing/` module estimate of 55 points. Priorities: 15 `M`, 1 `S`.

---

## 5. User Stories

`US-INV-01` is restated from `MASTER_PRD.md` §B5.11 with its PRD acceptance criteria preserved.
`US-INV-02` onward are **new** — the PRD's functional requirements and the India analysis imply them
without writing them as stories.

### US-INV-01 — *As Vikram in finance, I want a gapless invoice series so that the audit doesn't turn into an investigation.* **(PRD)**

- **AC-INV-01.1** — **Given** concurrent payments complete simultaneously for one tenant, **when**
  invoices are issued, **then** numbers are unique, sequential and **without gaps**.
- **AC-INV-01.2** — **Given** an invoice generation fails **after** the number was allocated,
  **when** the failure is handled, **then** either the number is used by the retry or a documented
  **void record** occupies it. A silently skipped number is a **defect**.
- **AC-INV-01.3** — **Given** a financial year rolls over, **when** the first invoice of the new year
  issues, **then** the sequence restarts per the configured format and the prior year's series is
  closed.
- **AC-INV-01.4** *(new)* — **Given** the India profile, **when** the boundary is evaluated, **then**
  it is **1 April 00:00 `Asia/Kolkata` = 31 March 18:30 UTC**; an invoice issued at 19:00 UTC on
  31 March belongs to the **new** financial year, and a test asserts exactly that offset.
- **AC-INV-01.5** *(new)* — **Given** a crash between creating the new year's counter and issuing the
  first invoice of that year, **when** the system recovers, **then** no counter sits at 0 with no
  invoice and the gap detector raises no false positive.

### US-INV-02 — *As Priya, I want a proper tax invoice I can show my employer for reimbursement.* **(new — implied by `FR-INV-04`, `FR-INV-08`)**

- **AC-INV-02.1** — **Given** a captured payment, **when** the invoice issues, **then** it is emailed
  to me and downloadable from `SCR-WEB-011` without contacting anyone.
- **AC-INV-02.2** — **Given** the invoice, **when** I open it, **then** it shows the gym's legal
  entity, GSTIN and PAN, my name, the line items, the discount, **CGST 9% and SGST 9% as two
  separate lines** summing to 18%, the SAC code, the place of supply, the total in words, the
  payment reference and method, and the refund policy that applied to my order.
- **AC-INV-02.3** — **Given** the same invoice downloaded twice, **when** the files are compared,
  **then** they are **byte-identical**.
- **AC-INV-02.4** — **Given** my membership was later refunded, **when** I open my orders, **then** I
  see the original invoice **and** the credit note, both downloadable, with the original unaltered.

### US-INV-03 — *As Rohan, I want to hand my accountant a month of invoices without asking support.* **(new — implied by `FR-INV-10`, `BR-DAT-05`)**

- **AC-INV-03.1** — **Given** a date range, **when** I request a bulk export, **then** I receive both
  a PDF bundle and a CSV, with human-readable headers and money as a plain number beside a separate
  currency column.
- **AC-INV-03.2** — **Given** a range large enough to exceed the synchronous threshold, **when** I
  request it, **then** it goes asynchronous with a notification and a time-limited link.
- **AC-INV-03.3** — **Given** any export, **when** it completes, **then** it is audited and
  rate-limited, and it contains **zero** rows belonging to another tenant.
- **AC-INV-03.4** — **Given** a financial-year range, **when** the CSV renders, **then** the
  `financial_year` label is the India FY string (for example `2026-27`), not a calendar year.

### US-INV-04 — *As Rohan, I want a mistake corrected without the original invoice changing.* **(new — implied by `FR-INV-03`, `FR-INV-09`)**

- **AC-INV-04.1** — **Given** an issued invoice, **when** any interface or job attempts to update it,
  **then** the operation is refused by the **grant**, not merely by application code.
- **AC-INV-04.2** — **Given** a correction is needed, **when** a credit note issues, **then** it
  takes the next number in the **credit-note** sequence, references the original invoice number, and
  carries the same frozen tax treatment.
- **AC-INV-04.3** — **Given** a partial refund, **when** the credit note issues, **then** it shows the
  refunded portion with its tax components apportioned using the **same** rounding as the original.
- **AC-INV-04.4** — **Given** a credit note, **when** it is regenerated, **then** it too is
  byte-identical.

### US-INV-05 — *As the platform, I want the 1 April rollover to be a non-event.* **(new — implied by `AC-INV-01.3`, `TR-19`, `REG-04`)**

- **AC-INV-05.1** — **Given** staging with the clock advanced across 31 March 18:30 UTC, **when** the
  rollover rehearsal runs, **then** the first invoice of the new year is number 1 with the new FY
  label, and the prior series is closed.
- **AC-INV-05.2** — **Given** two invoice transactions in flight across the boundary, **when** both
  commit, **then** one lands in the closing year and one in the opening year, each contiguous within
  its own sequence.
- **AC-INV-05.3** — **Given** any code path, **when** the codebase is scanned, **then** no FY literal
  and no `getFullYear()` on an invoice date exists outside the tax profile and
  `financialYearOf()`.
- **AC-INV-05.4** — **Given** an invoice whose `financial_year` label disagrees with `issued_at`
  converted to `Asia/Kolkata`, **when** the monitoring query runs, **then** it returns zero rows.

### US-INV-06 — *As a Growth-tier owner, I want my brand on the invoice my member receives.* **(new — implied by `FR-INV-11`, `A6.2`)**

- **AC-INV-06.1** — **Given** my tier permits branding, **when** I upload a logo and footer text,
  **then** they appear on subsequently issued invoices.
- **AC-INV-06.2** — **Given** I am on Starter, **when** I open the branding setting, **then** it is
  shown as a tier feature rather than silently absent.
- **AC-INV-06.3** — **Given** I change my logo, **when** an older invoice is regenerated, **then** it
  regenerates with the branding it was **issued** with — branding is part of the frozen snapshot.

### US-INV-07 — *As the platform, I want a tenant who stops paying to degrade predictably, without punishing their members.* **(new — implied by `BR-TEN-06`, `C5 subscription.charge`)**

- **AC-INV-07.1** — **Given** a failed subscription charge, **when** it is recorded, **then** the
  tenant enters `PAST_DUE` immediately and is notified with the amount and the retry schedule.
- **AC-INV-07.2** — **Given** `PAST_DUE` for 7 days, **when** the job runs, **then** marketplace
  visibility is withdrawn.
- **AC-INV-07.3** — **Given** `PAST_DUE` for 14 days, **when** the job runs, **then** dashboard
  **write** access is withdrawn while read access and exports remain (`BR-DAT-05`).
- **AC-INV-07.4** — **Given** any degradation state, **when** a member presents a valid QR, **then**
  **check-in is never blocked by subscription arrears**.
- **AC-INV-07.5** — **Given** payment is made, **when** it captures, **then** all degradations lift
  within one job cycle and the tenant is notified.

### US-INV-08 — *As Vikram, I want the platform's own GST on its commission to appear somewhere.* **(new — implied by `REG-02`, `BLK-03` c2 · ⛔ BLOCKED)**

- **AC-INV-08.1** — **Given** a settled transaction, **when** the statement renders, **then** the
  platform's commission carries an explicit **18% GST** line (`commission_tax_minor`), and the
  statement still sums exactly to the payout (`BR-FIN-03`).
- **AC-INV-08.2** — **Given** a settlement period, **when** it closes, **then** the platform issues
  the tenant a **tax invoice for its commission** from a second gapless per-FY series, so the tenant
  can claim input credit.
- **AC-INV-08.3** — **Given** a refund, **when** commission is reversed proportionally, **then** the
  commission **tax** is reversed with the **same rounding** as the original (`BR-REF-05`, `TR-05`).
- **AC-INV-08.4** — **Given** the decision has not been taken, **when** sprint 11 begins, **then**
  `commission_tax_minor` already exists **present and set to zero**, so enabling it is a
  configuration change and a backfill, never a schema migration through live money.

> ⛔ **`US-INV-08` cannot be marked Ready.** `PROJECT_CONSTITUTION.md` §23.1 item 10 forbids starting
> an item with an unanswered blocking question. Only `AC-INV-08.4` — the zero-valued field — is
> deliverable in sprint 6. See §13.

---
## 6. Acceptance Criteria for the Epic

| # | Criterion | Evidence |
| :-: | :--- | :--- |
| **AC-EP09-01** | **Launch-blocking.** 50 concurrent invoice issuances for one tenant produce **50 contiguous numbers with zero gaps** | `E6.6`, `AC-INV-01.1`, task 6.23 |
| **AC-EP09-02** | **Launch-blocking.** 500 concurrent payments across two tenants produce two independent gapless sequences with no duplicates | `BR-PAY-10-P1` |
| **AC-EP09-03** | A failure **after** number allocation leaves a documented **void record**, not a hole; asserted by forcing a rollback mid-issue | `E6.6`, `BR-PAY-10-N2`, `AC-INV-01.2` |
| **AC-EP09-04** | A detected gap is **never back-filled**; the contingency is a numbered void with a reason | `TR-03` contingency |
| **AC-EP09-05** | **Launch-blocking.** The numbering series is per tenant **per financial year starting 1 April**, and the first invoice after the boundary restarts at 1 with the new FY label | `E6.8`, `AC-INV-01.3`, `BR-PAY-10-P2` |
| **AC-EP09-06** | The FY boundary is evaluated in `Asia/Kolkata`: an invoice issued at **31 March 19:00 UTC** belongs to the **new** financial year, asserted with that exact instant | `AC-INV-01.4`, `TR-19` failure shape 2 |
| **AC-EP09-07** | A rollover rehearsal has been run against staging with the clock advanced across 31 March 18:30 UTC, and is a **named sprint exit criterion** | `TR-19` mitigation, `AC-INV-05.1` |
| **AC-EP09-08** | No FY literal and no `getFullYear()` on an invoice date exists outside the tax profile and `financialYearOf()`; asserted by a lint/scan target | `AC-INV-05.3`, `REG-04` early-warning |
| **AC-EP09-09** | The counter row `(tenant_id, financial_year)` is created **lazily by upsert inside the same transaction** as the first invoice of that year, so a crash cannot leave a counter at 0 with no invoice | `AC-INV-01.5`, `TR-19` failure shape 4 |
| **AC-EP09-10** | **Launch-blocking.** The invoice shows **CGST 9% and SGST 9% as two separate lines** summing to 18%, with the SAC code and place of supply | `E6.7`, `LAUNCH_MARKET_INDIA.md` §4 |
| **AC-EP09-11** | An inter-state supply renders a single **IGST 18%** line instead, determined by the **branch** location as place of supply | `LAUNCH_MARKET_INDIA.md` §4, `AC-EP09-10` sibling |
| **AC-EP09-12** | An invoice issued at 18% (9+9) regenerates **byte-identically** after the tax profile is changed to 12%, with both components still shown | `BR-PAY-11-P1` |
| **AC-EP09-13** | No invoice read path returns a live-profile figure; asserted by mutating `tax_profiles` directly and re-reading **every** invoice surface and the PDF | `BR-PAY-11-N1` |
| **AC-EP09-14** | `dependency-cruiser` forbids the invoice renderer importing the live tax-profile repository | `BR-PAY-11` `L12-CI` |
| **AC-EP09-15** | **Launch-blocking.** The same invoice regenerated twice produces **byte-identical** files; the CI checksum test runs on every PR touching `billing/` or the render image | `E6.9`, `FR-INV-07`, `TR-15` |
| **AC-EP09-16** | The renderer image digest is **recorded on the invoice row**, so a determinism mismatch is explainable rather than mysterious | `TR-15` mitigation |
| **AC-EP09-17** | The renderer pins Chromium **by digest**, embeds its fonts including the `₹` glyph, runs `TZ=UTC` and `en-IN`, and takes metadata timestamps from `issued_at` — never `now()` | `TR-15` drift sources 1–6 |
| **AC-EP09-18** | An `UPDATE` on an issued invoice is refused by the **grant**, verified against a real database | `BR-PAY-10-N1` |
| **AC-EP09-19** | A credit note takes the next number in its **own** sequence, references the original invoice number, and carries the same frozen tax treatment | `FR-INV-09`, `AC-INV-04.2` |
| **AC-EP09-20** | An offline order paid in two instalments produces **one consolidated invoice** carrying both payments, gapless in the tenant's FY sequence | `AC-CART-02.3`, `E2E-10` step 5 |
| **AC-EP09-21** | Invoice PDF generation p95 ≤ **3 s** | `E6.10`, `NFR-PERF-07` |
| **AC-EP09-22** | Every invoice is downloadable by the member, the tenant and Finance, and is emailed on issue; access is permission-checked and audited | `FR-INV-08`, `BR-TEN-01` |
| **AC-EP09-23** | Bulk export by date range produces PDF and CSV with human-readable headers, money as a plain number beside a currency column, and **zero** cross-tenant rows | `FR-INV-10`, `AC-INV-03.*`, `E2E-11` step 4 |
| **AC-EP09-24** | Tenant branding is tier-gated and is part of the **frozen snapshot** — regenerating an old invoice reproduces the branding it was issued with | `FR-INV-11`, `AC-INV-06.3` |
| **AC-EP09-25** | The nightly contiguity job asserts `count(*) = max(number)` per tenant per FY; `gym.invoice.sequence_gap.count` is a gauge whose **only acceptable value is 0**, and it is alarmed | `TR-03` early-warning, `RiskAnalysis.md` §9 trigger 8 |
| **AC-EP09-26** | The nightly determinism corpus regenerates a fixed set of historical invoices and compares SHA-256 hashes; `gym.invoice.pdf.determinism_failures` is alarmed | `TR-15` mitigation |
| **AC-EP09-27** | A failed subscription charge moves the tenant to `PAST_DUE`, withdraws marketplace visibility at 7 days and dashboard **write** access at 14 days, and **never blocks check-in** | `BR-TEN-06`, `AC-INV-07.*` |
| **AC-EP09-28** | `commission_tax_minor` exists on the settlement-relevant records, is populated (as zero pending `REG-02`), and the second invoice series' shape is defined — so enabling commission GST is configuration plus a backfill, not a migration through live money | `REG-02` contingency, `AC-INV-08.4` |
| **AC-EP09-29** | All invoice and credit-note artefacts, including stored PDFs, reside in an **Indian** region | `REG-06`, RBI localisation |
| **AC-EP09-30** | `SCR-DASH-013` and `SCR-WEB-011` are axe-core clean and completable keyboard-only; money renders with `₹` and lakh grouping from the single formatter | `NFR-USE-01`, `LAUNCH_MARKET_INDIA.md` §2 |

---

## 7. Business Rules Enforced

Enforcement detail lives in `BusinessRules.md` §9 and is **not duplicated here**.

| Rule | Ownership | Enforcement point in `EP-09` | Authoritative layer |
| :--- | :--- | :--- | :--- |
| `BR-PAY-10` | **Owner** (`billing/`) | `UNIQUE (tenant_id, financial_year, invoice_number)` plus allocation from a per-tenant-per-FY counter taken `SELECT … FOR UPDATE` **inside** the invoice transaction, with the number as the **last** write before commit; no `UPDATE`/`DELETE` grant on `invoices`; `CreditNote` is a separate aggregate with its own sequence | `L1-DB` |
| `BR-PAY-11` | **Owner** (`billing/`) | `invoices.tax_breakdown jsonb` persists the applied treatment; **no invoice read path joins to `tax_profiles`**; `TaxProfile.apply()` returns a snapshotted `TaxAssessment`, never a reference; `dependency-cruiser` forbids the renderer importing the live profile repository | `L1-DB` |
| `BR-TEN-06` | **Owner** (`billing/`) | `subscription.charge` daily job applying `PAST_DUE`, the 7-day visibility withdrawal and the 14-day write withdrawal; check-in is structurally unreachable from this path | `L10-JOB` |
| `BR-PAY-09` | **Co-owner** with `ordering/` | One **consolidated** invoice on `→ PAID`, not one per payment; both payments listed | `L1-DB` |
| `BR-REF-05` | **Contributor** (`ledger/`, `refunds/` own) | The credit note apportions tax with the **same rounding** as the original invoice, so statements continue to tie out | `L5-DOM` |
| `BR-PAY-01` | **Inherited** from `EP-01` | Every invoice amount is `bigint` paise with an explicit currency; the total in words is derived from `Money`, never from a float | `L5-DOM` |
| `BR-TEN-01` | **Inherited** | `invoices`, `credit_notes` and the counter table are tenant-scoped with RLS; invoice download is permission-checked on the **resource** tenant | `L2-RLS` |
| `BR-TEN-04` | **Inherited** | Deleting a tenant is a soft delete; invoices are retained for the statutory period regardless (`CON-04`) | `L1-DB` |
| `BR-DAT-01` | **Inherited** | Invoice issue and credit-note issue are audited. **There is no update to audit, by construction** | `L9-INT` |
| `BR-DAT-05` | **Contributor** | Bulk invoice export is part of the tenant's right to its own data and survives `PAST_DUE` write withdrawal | `L7-GUARD` |
| `BR-FIN-02` | **Contributor** (`ledger/`, `settlements/` own) | The invoice renders persisted figures only; nothing on an invoice is recomputed at display time | `L1-DB` |
| `BR-GYM-02` | **Contributor** | The tenant's GSTIN and PAN captured at onboarding are what the invoice's `tenant_snapshot` carries | `L1-DB` |

> **`BAC-06` obligation.** `BR-PAY-10`, `BR-PAY-11` and `BR-TEN-06` are `M` priority; each needs a
> `-P` and a `-N` test. `BR-PAY-10` additionally needs its concurrency case proven against a real
> database, not a mocked repository, because its authoritative layer is `L1-DB`.

---

## 8. Dependencies

### 8.1 Upstream — must exist first

| Epic | What `EP-09` needs from it | Hard or soft |
| :--- | :--- | :--- |
| **EP-01** | `Money`; transactional outbox (the PDF renders **after** commit so a rendering failure cannot orphan a number); job harness with distributed locks; audit interceptor; object storage client for the stored PDF; error registry | **Hard** |
| **EP-07** | `orders.tax_snapshot`, the line-item breakdown, `refund_policy_snapshot`, the customer and plan references — an invoice is rendered from the order, not from live configuration | **Hard** |
| **EP-08** | The `payment.captured` event, the payment reference and method that appear on the invoice, and the offline-payment records for the consolidated case | **Hard** |
| **EP-03** | Tenant legal entity, PAN and GSTIN from KYC — without them the invoice is not a valid tax invoice | **Hard** |
| **EP-04** | The **branch** whose location determines place of supply | **Hard** for `F-09.12` |
| **EP-19** | Tax-profile administration (`FR-ADMN-05`), subscription-tier definitions (`FR-ADMN-04`) and tier-gating of branding | **Soft at sprint 6** (seeded India profile is acceptable); **hard for `F-09.11` at sprint 15** |
| **EP-16** | The completed-refund event that triggers a credit note | **Soft at sprint 6** — the credit-note aggregate ships here; its trigger arrives in sprint 12 |
| **EP-18** | The async export harness that `F-09.9` registers against | **Soft** — moved to sprint 13 for exactly this reason |
| **DevOps** | The pinned Chromium render container: digest-pinned, fonts bundled, `TZ=UTC`, fixed locale (sprint-6 task 6.27) | **Hard** for `F-09.7` |

### 8.2 Downstream — what this unblocks

| Epic | What it takes from `EP-09` |
| :--- | :--- |
| **EP-15** | Invoice references on settlement lines; the tax figures that must tie out; and — once `REG-02` resolves — the platform's own commission tax invoice series |
| **EP-16** | Credit notes as the correction mechanism for every refund, and invoices as dispute evidence |
| **EP-10** | Nothing structurally, but the member's membership detail links to the invoice |
| **EP-18** | Invoice-level financial reporting and the tax report the tenant's accountant needs |
| **EP-19** | The tax-profile configuration screen has a real consumer to preview against |
| **EP-20** | Support agents resolving "where is my invoice" without engineering — one of `OBJ-10`'s ten common issues |

### 8.3 External dependencies and open questions

| Dependency | Type | Effect on `EP-09` |
| :--- | :--- | :--- |
| ⛔ **`BLK-03` conflict 2 — GST on platform commission** | **BLOCKING for Sprint 11**, `REG-02` score **20 (Severe)**, owner **Client Sponsor** | See §13. Sprint 6 ships the zero-valued field and the series shape; sprint 11 cannot close without the decision |
| **`BLK-04` #3 — the correct SAC code for gym membership services, and confirmation of the 18% rate** | Professional advice | The SAC printed on every invoice is currently **9997xx, Medium confidence, must be confirmed**. It is tax-profile data, so a correction is a data change — but invoices already issued with a wrong SAC are not correctable except by credit note |
| **`BLK-04` #4 — whether the platform must register for GST in every state where a tenant operates** | Professional advice | Affects the platform's own commission invoice (`F-09.14`), not the tenant's sale invoice |
| **`BLK-04` #1, #2 — GST TCS / income-tax TDS** | Professional advice, `REG-03` | If applicable, adds deduction lines and a filing report. `EP-09` must not model deductions as a closed list of two |
| **GST e-invoicing (IRN/QR)** thresholds | Unverified | Out of Phase 1, recorded in `KNOWN_LIMITATIONS.md`; the invoice model must not preclude adding an IRN field |
| `OQ-03` — subscription tier prices | Open, due sprint 5 | `F-09.11` cannot be meaningfully tested until tiers are priced — a second reason it sits in sprint 15 |
| `ASM-05` — client-supplied legal copy | Assumption | Invoice footer text, terms and the refund-policy wording must land before UAT |
| `REG-06` — data residency | Resolved: India | Stored invoice PDFs and the render pipeline must not leave Indian regions |

### 8.4 Dependency graph

```mermaid
graph TD
  EP01["EP-01 Foundation<br/>outbox · Money · jobs · storage"]:::found
  EP03["EP-03 Onboarding<br/>PAN · GSTIN · legal entity"]:::up
  EP04["EP-04 Gym & Branch<br/>place of supply"]:::up
  EP07["EP-07 Orders<br/>tax_snapshot · line items"]:::up
  EP08["EP-08 Payments<br/>payment.captured"]:::up
  EP19["EP-19 Admin Config<br/>tax profiles · tiers"]:::soft
  DEVOPS(["Pinned Chromium renderer<br/>digest · fonts · TZ=UTC · en-IN"]):::ext

  EP09["EP-09 Invoicing, Tax & Subscription Billing<br/>billing/ · 34 pts · FY 1 Apr · CGST+SGST"]:::self

  BLK(["⛔ BLK-03 c2 / REG-02<br/>GST on platform commission<br/>BLOCKING Sprint 11"]):::block

  EP15["EP-15 Ledger & Settlements"]:::down
  EP16["EP-16 Refunds → credit notes"]:::down
  EP18["EP-18 Reporting & Exports"]:::down
  EP20["EP-20 Support"]:::down

  EP01 --> EP09
  EP03 --> EP09
  EP04 --> EP09
  EP07 --> EP09
  EP08 --> EP09
  EP19 -.soft at S6, hard at S15.-> EP09
  DEVOPS --> EP09

  EP09 --> EP15
  EP09 --> EP16
  EP09 --> EP18
  EP09 --> EP20
  BLK -.blocks F-09.14 issuance.-> EP09
  BLK -.blocks statement arithmetic.-> EP15

  classDef found fill:#1f2937,stroke:#111827,color:#f9fafb
  classDef up fill:#374151,stroke:#111827,color:#f9fafb
  classDef soft fill:#4b5563,stroke:#111827,color:#f9fafb,stroke-dasharray: 4 3
  classDef ext fill:#7c2d12,stroke:#431407,color:#fff7ed
  classDef self fill:#b45309,stroke:#78350f,color:#fff7ed
  classDef block fill:#7f1d1d,stroke:#450a0a,color:#fef2f2
  classDef down fill:#065f46,stroke:#022c22,color:#ecfdf5
```

---
## 9. Technical Tasks

Layers: `DB` · `API` · `worker` · `web` · `dash` · `admin` · `infra` · `test` · `docs`. Estimates
are **engineer-days** including implementation, tests and review. Ids align with
`SprintPlanning.md` sprint-6 tasks `6.11`–`6.17`, `6.20`, `6.22`, `6.23`, `6.25`, `6.27`.

| # | Task | Layer | Est (ed) | Depends on | Serves |
| :--- | :--- | :--- | :-: | :--- | :--- |
| **T-09.01** | `invoices` and `credit_notes` migrations: `tenant_id`, `order_id`, `invoice_number`, `financial_year`, `issued_at`, `tenant_snapshot`, `customer_snapshot`, `line_items`, `tax_breakdown`, totals in `bigint` paise, `pdf_url`, `pdf_sha256`, `renderer_digest`, `status` | DB | 1.5 | EP-01, EP-07 | `C2.2`, `FR-INV-04`, `TR-15` |
| **T-09.02** | `UNIQUE (tenant_id, financial_year, invoice_number)` and the equivalent on credit notes; `invoice_counters (tenant_id, financial_year, next_number)` | DB | 0.5 | T-09.01 | `BR-PAY-10` |
| **T-09.03** | **`REVOKE UPDATE, DELETE`** on `invoices` and `credit_notes` for `app_rw`; the `append-only-grants` CI check extended to cover both | DB + infra | 0.5 | T-09.01 | `FR-INV-03`, `BR-PAY-10-N1` |
| **T-09.04** | RLS policies and generated isolation specs for invoice, credit-note and export endpoints | DB + test | 1.0 | T-09.01 | `BR-TEN-01`, `BAC-10` |
| **T-09.05** | `tax_profiles` table and seed: rate table, inclusive/exclusive, place-of-supply rule, rounding method, **`fy_start_month`** | DB | 1.0 | EP-19 shape | `FR-INV-05`, `TR-19` |
| **T-09.06** | **`financialYearOf(instant, timezone, fyStartMonth)`** in `packages/utils`, with property tests across the 31 March 18:30 UTC boundary and two DST-observing zones | API + test | 1.5 | T-09.05 | `F-09.13`, `AC-INV-01.4`, `TR-19` |
| **T-09.07** | **Number allocator**: per-`(tenant_id, financial_year)` counter taken `SELECT … FOR UPDATE` **inside** the invoice transaction, number written **last** before commit; counter row created lazily by **upsert** in the same transaction | API | 3.0 | T-09.02, T-09.06 | `FR-INV-02`, `TR-03`, `TR-19` |
| **T-09.08** | **Void-record workflow**: a post-allocation failure occupies the number with a `VOID` invoice carrying a reason; no back-fill path exists | API | 1.0 | T-09.07 | `AC-INV-01.2`, `TR-03` contingency |
| **T-09.09** | `Invoice` aggregate with **no mutators**; `CreditNote` as a separate aggregate with its own sequence and an `original_invoice_id` reference | API | 1.5 | T-09.07 | `FR-INV-03`, `FR-INV-09` |
| **T-09.10** | Invoice-on-payment consumer of the `payment.captured` outbox event, idempotent by event id; one **consolidated** invoice on `→ PAID` for an instalment order | API | 1.5 | EP-08 T-08.28 | `FR-INV-01`, `BR-PAY-09` |
| **T-09.11** | **India GST tax profile implementation**: 18% exclusive; intra-state split **CGST 9% + SGST 9%**; **IGST 18%** inter-state; place of supply from the **branch**; SAC 9997xx; `round_half_even`; two component lines in `tax_breakdown` | API | 2.5 | T-09.05, EP-04 | `F-09.12`, `LAUNCH_MARKET_INDIA.md` §4 |
| **T-09.12** | Tax snapshot freeze: `TaxProfile.apply()` returns a `TaxAssessment` value object written to `invoices.tax_breakdown`; **no** invoice read path joins to `tax_profiles`; `dependency-cruiser` rule enforcing it | API + infra | 1.5 | T-09.11 | `FR-INV-06`, `BR-PAY-11` |
| **T-09.13** | Invoice content assembly: tenant legal entity, PAN, GSTIN, customer identifiers, line items, discount, tax components, **total in words** derived from `Money`, payment reference and method, refund policy from the order snapshot | API | 2.0 | T-09.09, EP-03 | `FR-INV-04` |
| **T-09.14** | Tier-gated branding resolved at issue and stored in `tenant_snapshot`, so regeneration reproduces the branding of the day | API | 1.0 | EP-19 tiers | `FR-INV-11`, `AC-INV-06.3` |
| **T-09.15** | **Deterministic PDF renderer client**: metadata timestamps from `issued_at`, `en-IN` locale, `TZ=UTC`, renderer digest recorded on the row, SHA-256 stored; render happens **after** commit through the outbox | API + worker | 2.5 | T-09.13, T-09.29 | `FR-INV-07`, `TR-15` |
| **T-09.16** | Download endpoints for member, tenant and Finance with resource-tenant permission evaluation and audit; email-on-issue through the outbox | API | 1.5 | T-09.15, EP-17 | `FR-INV-08` |
| **T-09.17** | Bulk export by date range: PDF bundle and CSV with human-readable headers and money as a plain number beside a currency column; async above the threshold | API + worker | 1.5 | EP-18 harness | `FR-INV-10` |
| **T-09.18** | **Credit-note issuance** on a completed refund: own sequence, references the original, apportions tax with the **same rounding** | API | 1.5 | T-09.09, EP-16 | `FR-INV-09`, `BR-REF-05` |
| **T-09.19** | **`commission_tax_minor` scaffolding**: the field present and zero on the settlement-relevant records, plus the **shape** of the platform's commission tax-invoice series (a second counter keyed by `(platform, financial_year)`), issuance disabled by flag pending `REG-02` | API + DB | 2.0 | T-09.07 | `F-09.14`, `REG-02` contingency, `AC-EP09-28` |
| **T-09.20** | `subscription.charge` daily job: charge tenants due, apply `PAST_DUE`, withdraw marketplace visibility at 7 days and dashboard write access at 14 days, lift on payment; **check-in unreachable from this path** | worker | 2.0 | EP-08 port, EP-19 tiers | `BR-TEN-06`, `F-09.11` (**sprint 15**) |
| **T-09.21** | **Nightly `billing.sequence-contiguity-check`**: assert `count(*) = max(number)` per tenant per FY; emit `gym.invoice.sequence_gap.count`; alert on any non-zero value | worker + infra | 1.0 | T-09.07 | `TR-03`, `AC-EP09-25` |
| **T-09.22** | **Nightly `billing.pdf-determinism-corpus`**: regenerate a fixed corpus of historical invoices, compare SHA-256, emit `gym.invoice.pdf.determinism_failures`, alert on non-zero | worker + infra | 1.0 | T-09.15 | `TR-15`, `AC-EP09-26` |
| **T-09.23** | **India invoice PDF template**: GST-compliant tax-invoice layout, both tax lines with **fixed column widths**, SAC, place of supply, both GSTINs, total in words, `₹` with lakh grouping | dash (HTML/CSS) | 3.0 | Design, T-09.13 | `F-09.16`, `TR-15` drift source 6 |
| **T-09.24** | `SCR-DASH-013` Invoices screen: list with number, date, member, amount, tax, status; credit notes; bulk export by date range | dash | 3.0 | T-09.16, T-09.17 | `SCR-DASH-013` |
| **T-09.25** | `SCR-WEB-011` invoice and credit-note download affordances, and the `SCR-WEB-007` invoice link on confirmation | web | 1.5 | T-09.16 | `FR-INV-08`, `SCR-WEB-007` |
| **T-09.26** | `SCR-ADM-011` tax-profile configuration surface with a reason-required write and an affected-entity preview | admin | 1.5 | T-09.05, EP-19 | `FR-ADMN-05`, `SCR-ADM-011` guard |
| **T-09.27** | `SCR-ADM-006` invoice column and drill-down from the finance orders view | admin | 0.5 | T-09.16 | `SCR-ADM-006` |
| **T-09.28** | Tenant billing surface for `PAST_DUE`: amount owed, retry schedule, degradation timeline, pay-now action | dash | 2.0 | T-09.20 | `BR-TEN-06`, sprint 15 |
| **T-09.29** | **Chromium render container**: digest-pinned image, fonts bundled including a `₹`-bearing face, fixed locale, `TZ=UTC`, no system font fallback | infra | 5.0 | — | Sprint-6 task 6.27, `TR-15` |
| **T-09.30** | **Concurrency test: 50 simultaneous invoices for one tenant, asserting zero gaps**; and 500 concurrent across two tenants asserting two independent gapless sequences | test | 4.0 | T-09.07 | `E6.6`, `AC-EP09-01`, `AC-EP09-02` |
| **T-09.31** | Post-allocation-failure test forcing a rollback mid-issue and asserting a **void record**, not a hole | test | 1.0 | T-09.08 | `AC-INV-01.2`, `BR-PAY-10-N2` |
| **T-09.32** | **FY rollover rehearsal** on staging with the clock advanced across 31 March 18:30 UTC, plus a unit assertion that an invoice at 19:00 UTC on 31 March lands in the new FY | test | 2.0 | T-09.06, T-09.07 | `E6.8`, `AC-EP09-06`, `AC-EP09-07` |
| **T-09.33** | **Byte-identical PDF regeneration checksum test in CI** on every PR touching `billing/` or the render image | test | 2.0 | T-09.15, T-09.29 | `E6.9`, `TR-15` |
| **T-09.34** | Tax-immutability test: mutate `tax_profiles` directly, then re-read **every** invoice surface and the PDF, asserting nothing changed and both components still render | test | 1.5 | T-09.12 | `BR-PAY-11-N1`, `BR-PAY-11-P1` |
| **T-09.35** | GST correctness matrix: intra-state (CGST+SGST) × inter-state (IGST) × discounted × zero-payable × instalment-consolidated × credit-note-apportioned, all paise-exact | test | 3.0 | T-09.11, T-09.18 | `AC-EP09-10`, `AC-EP09-11` |
| **T-09.36** | Grant test: an `UPDATE` on an issued invoice is refused at the database, verified via Testcontainers | test | 0.5 | T-09.03 | `BR-PAY-10-N1` |
| **T-09.37** | Invoice-PDF timing integration test against `NFR-PERF-07` (≤ 3 s p95) | test | 0.5 | T-09.15 | `E6.10` |
| **T-09.38** | `E2E-02` invoice half (steps 9–11) and `E2E-10` step 5 (one consolidated invoice) automation | test | 2.0 | T-09.10, T-09.16 | `E2E-02`, `E2E-10` |
| **T-09.39** | axe-core and keyboard passes on `SCR-DASH-013` and `SCR-WEB-011` | test | 1.0 | T-09.24, T-09.25 | `NFR-USE-01` |
| **T-09.40** | Observability: `gym.invoice.issued.count`, `gym.invoice.sequence_gap.count`, `gym.invoice.pdf.determinism_failures`, invoice-creation and PDF p95; alert on any FY-label/`issued_at` disagreement | infra | 1.0 | T-09.21, T-09.22 | `TR-03`, `TR-19`, `TR-15` |
| **T-09.41** | Runbooks: sequence gap detected (**void, do not back-fill**), renderer digest change without a determinism re-baseline, invoice issuance frozen for a tenant, FY rollover procedure, wrong-FY invoice recovery (**void and reissue with cross-reference, never renumber**) | docs | 2.0 | all | `NFR-MNT-09`, `TR-03`/`TR-19` contingencies |
| **T-09.42** | Docs: `/docs/apis/API-INV.md`, `/docs/database/invoices.md`, `/docs/ui/SCR-DASH-013.md`, `/docs/features/invoicing.md`, `/docs/features/tax-profiles.md`, `billing/README.md`; `KNOWN_LIMITATIONS.md` entries for the unconfirmed SAC code, the zero-valued `commission_tax_minor` and the absence of e-invoicing | docs | 2.0 | all | DoD 22–25 |

**Task roll-up.** 42 tasks · **73.0 engineer-days** of raw task estimate before the role
reconciliation in §10.

---

## 10. Estimated Time

### 10.1 Roll-up by role

| Role | Engineer-days | What it covers |
| :--- | :-: | :--- |
| **BE** (backend, `billing/`) | 28.0 | T-09.01 … T-09.22 — schema, grants, allocator, void records, tax profile, snapshot freeze, PDF client, credit notes, subscription charging, assurance jobs |
| **FE-web** (`customer-web`) | 1.5 | T-09.25 |
| **FE-dash** (`gym-dashboard` + `admin-dashboard`) | 10.0 | T-09.23, T-09.24, T-09.26, T-09.27, T-09.28 |
| **QA** | 17.5 | T-09.30 … T-09.39 — concurrency, void, FY rollover, determinism, immutability, GST matrix, grants, timing, `E2E`, a11y |
| **DevOps** | 6.0 | T-09.29 render container, T-09.40 observability |
| **Design** | 4.0 | The GST tax-invoice layout (a compliance artefact, not decoration), `SCR-DASH-013`, the `PAST_DUE` billing surface |
| **Docs** | 4.0 | T-09.41, T-09.42 |
| **Total** | **71.0** | |

### 10.2 Reconciliation with the plan's two views

| View | Figure | Note |
| :--- | :--- | :--- |
| `ENGINEERING_PLAN.md` §2 — epic/feature view | **34 points ≈ 17 engineer-days** | Feature delivery only |
| `ENGINEERING_PLAN.md` §13.1 — `billing/` module view | **55 points ≈ 28 engineer-days**, rated **High** | Backend build including its tests; the 21-point difference is §13.3's engineering tax |
| This backlog — all roles | **71.0 engineer-days** | 28 backend + 11.5 frontend + 17.5 QA + 6 DevOps + design and docs, which §13.2/§13.3 pool separately |

**Why QA is 25% of this epic.** Three of the four hardest things here — gaplessness under
concurrency, the 1 April boundary, and byte-identical PDFs — are *properties*, not features. A
property is proven by a test or it is not proven at all. `TR-03`, `TR-19` and `TR-15` are all
mitigated primarily by test assets (T-09.30, T-09.32, T-09.33) plus two nightly jobs. Removing them
does not save 7 engineer-days; it converts three managed risks into annual production surprises.

### 10.3 Confidence range

| Scenario | Engineer-days | Probability | Drivers |
| :--- | :-: | :-: | :--- |
| **Optimistic (P10)** | 58 | 10% | The render container behaves deterministically on the first pinned digest; the allocator passes the 50-concurrent test first time; `REG-02` is decided at sprint 5 so `F-09.14` is a straight build rather than scaffolding-then-rework |
| **Expected (P50)** | **71.0** | 50% | The plan as written, with `F-09.11` in sprint 15 and bulk export in sprint 13 |
| **Pessimistic (P90)** | 96 | 90% | Chromium determinism proves elusive and the fallback (serve the stored PDF, freeze the digest, record a boundary) has to be designed and documented; the SAC code or the 18% rate is corrected late and issued invoices need credit notes; `REG-02` resolves **after** sprint 11 and the commission-tax backfill runs through settled money; `PAST_DUE` degradation interacts badly with `EP-19`'s tier configuration |

**Sprint-6 capacity note.** Sprint 6 backend runs at 114% and DevOps at 143%, largely because of
T-09.29. `SprintPlanning.md` already moves `F-09.11` (2.0 ed) to sprint 15 and bulk export (0.5 ed)
to sprint 13, and assigns the PDF template to frontend because it is HTML/CSS. **T-09.30 and
T-09.33 must not be traded away** — they are the evidence for two launch-blocking criteria.

---
## 11. Risks

| Id | Risk | P | I | Score | Mitigation | Maps to |
| :--- | :--- | :-: | :-: | :-: | :--- | :--- |
| **R-09.1** | **Invoice number gaps under concurrency.** A Postgres `SEQUENCE` is fast and **gappy**; an application `MAX()+1` is gapless and **racy**. Only one formulation satisfies both `AC-INV-01.1` and `AC-INV-01.2` | 3 | 4 | **12** | Allocation inside the same transaction that commits the invoice, serialised per `(tenant_id, financial_year)` with `SELECT … FOR UPDATE`, the number written **last** so nothing can fail after it; the PDF renders **after** commit via the outbox; `UNIQUE (tenant_id, financial_year, number)` as the final line of defence; a nightly gap detector. `TD-020` records the throughput cost: roughly **30 invoices/minute per tenant** | **`TR-03`** |
| **R-09.2** | **The 1 April financial-year rollover.** Four compounding failures: a hard-coded January boundary; the boundary evaluated in UTC so invoices between 18:30 and 23:59 UTC on 31 March land in the wrong year; concurrent captures across the boundary contending on two different counter rows; and a non-atomic sequence restart | 4 | 4 | **16** | FY start month is **tax-profile configuration**, defaulting to 4; one `financialYearOf()` used by allocator, report, export and PDF; the counter row created **lazily by upsert inside the same transaction** as the first invoice of the year; a **rollover rehearsal** on staging with the clock advanced across 31 March 18:30 UTC, named as a sprint exit criterion | **`TR-19`**, `REG-04` |
| **R-09.3** | **Deterministic PDF is not deterministic.** Six drift sources: metadata timestamps, font subsetting by Chromium version, locale-dependent number formatting, container timezone, Chromium version drift, and the India-specific `₹` glyph plus shifting CGST/SGST column widths | 3 | 3 | **9** | Timestamps pinned from `issued_at`; fonts embedded from a version-pinned file with **no system fallback**; explicit `en-IN` and the `packages/utils` lakh formatter; `TZ=UTC`; the renderer as a **separately versioned image pinned by digest** with the digest recorded on the invoice row; fixed tax-table column widths; a nightly corpus comparing SHA-256; CI determinism assertion before image promotion | **`TR-15`** |
| **R-09.4** | ⛔ **GST on platform commission is unmodelled.** `A6.3` gives `payable_to_gym = (N + T) − C − F` with no tax on `C`. `BR-FIN-02` (persist everything) and `BR-FIN-03` (lines sum exactly) cannot both hold once commission GST exists. **This is arithmetic, not opinion** | 5 | 4 | **20** | Add a **ninth persisted figure `commission_tax_minor`** and a `COMMISSION_TAX` ledger entry type; the statement gains a line; `BR-REF-05`'s proportional reversal must reverse the tax with the **same rounding**; the platform issues a **tax invoice to the tenant** for its commission — a second series with its own gapless per-FY sequence to which `TR-19` applies identically. **Contingency if undecided by sprint 11: the figure exists and is set to zero**, so enabling it is configuration plus a backfill, never a schema migration through live money | **`REG-02`** (Severe) · `BLK-03` c2 |
| **R-09.5** | **The SAC code and the 18% rate are unconfirmed.** `LAUNCH_MARKET_INDIA.md` §4 rates SAC 9997xx as **Medium** confidence and explicitly says it *"must be confirmed"* | 3 | 4 | **12** | Both are tax-profile **data**, so a correction is a data change; but invoices already issued carry the wrong value and can only be corrected by credit note. Escalate `BLK-04` #3 before the first production invoice; record the current value in `KNOWN_LIMITATIONS.md` as adopted-pending-verification | `BLK-04` #3, `REG-03` neighbour |
| **R-09.6** | **GST TCS / TDS obligations discovered late.** A marketplace collecting on a merchant's behalf may have statutory collect-and-remit duties | 3 | 5 | **15** | Not `EP-09`'s to decide, but `EP-09` must not preclude it: deductions are modelled as a **first-class extensible entry type**, not a hard-coded list of two; the rate and applicability are tax-profile configuration; the filing report is a **query over the ledger**, not a separate accumulator that can drift | **`REG-03`**, `BLK-04` #1–#2 |
| **R-09.7** | **A tax-profile change silently rewrites history**, so a tenant's filed returns no longer match their own invoice archive | 2 | 5 | **10** | The applied treatment is snapshotted in `invoices.tax_breakdown`; **no** invoice read path joins to `tax_profiles`; `dependency-cruiser` forbids the renderer importing the live repository; T-09.34 mutates the profile and re-reads every surface | `BR-PAY-11` |
| **R-09.8** | **CGST and SGST collapsed into one 18% line**, making the invoice non-compliant for the member's or employer's input-credit purposes | 3 | 4 | **12** | The snapshot holds **two component lines** by construction; `AC-EP09-10` is a launch-blocking criterion and a sprint-6 exit item; the template has fixed column widths so the two lines cannot be visually merged | `LAUNCH_MARKET_INDIA.md` §4, `E6.7` |
| **R-09.9** | **A gap is discovered and someone back-fills it**, fabricating an invoice | 2 | 5 | **10** | The runbook says explicitly: **void, never back-fill**. A fabricated invoice is worse than a gap; a numbered void with a reason is what tax auditors expect and what `CON-04` retention preserves. There is no back-fill code path to reach for | `TR-03` contingency |
| **R-09.10** | **Invoice issuance throughput caps a large tenant** at roughly 30 invoices/minute because of per-tenant serialisation | 2 | 3 | **6** | Registered as `TD-020` with a stated revisit trigger; a tenant exceeding it is a real business signal, and the mitigation (per-tenant invoice serialisation with queued issuance) is documented before it is needed. Memberships still activate; the invoice queues | `TD-020` |
| **R-09.11** | **A wrong-FY invoice is renumbered** rather than voided and reissued | 2 | 4 | **8** | The runbook forbids renumbering: void and reissue in the correct year with a cross-reference. If filings are already affected it becomes a `REG-03`-class matter for the tax advisor, not an engineering fix | `TR-19` contingency |
| **R-09.12** | **Subscription degradation blocks a member's check-in**, punishing people who already paid | 2 | 5 | **10** | `BR-TEN-06` is explicit; the check-in path is **structurally unreachable** from `subscription.charge`, and `AC-INV-07.4` tests the negative case directly | `BR-TEN-06` |
| **R-09.13** | **Stored invoice PDFs leave the Indian region** through a CDN or a backup target | 3 | 3 | **9** | Region fixed in Terraform; invoice artefacts served from an origin in India and never cached abroad; the storage bucket and its replication targets are both asserted at plan review | `REG-06`, `TR-31` neighbour |

---

## 12. Definition of Done

`PROJECT_CONSTITUTION.md` §23.2 applies in full. This section adds only what is specific to
`EP-09`.

### 12.1 Constitution items that bite hardest in this epic

| Item | Why it matters here |
| :--- | :--- |
| §23.2 #6 — money is integer minor units; the `A6.3` figures are persisted and never recomputed at display | An invoice that recomputes anything at render time is not reproducible |
| §23.2 #7 — every business-date computation takes an explicit IANA timezone | The FY boundary is the highest-consequence date computation in the product |
| §23.2 #14 — integration tests against a real Postgres via Testcontainers | `BR-PAY-10`'s authoritative layer is `L1-DB`; a mocked repository proves nothing |
| §23.2 #25 — `KNOWN_LIMITATIONS.md` where a requirement is unmet | Three entries are already owed: the unconfirmed SAC code, the zero-valued commission tax, and the absence of e-invoicing |
| §23.2 #27 — runbook updated where a failure mode changed | The void-not-back-fill rule lives in a runbook, and it is the rule most likely to be broken under pressure |
| §23.2 #33 — migrations forward-only and backward-compatible | Adding `commission_tax_minor` later through settled money is precisely what `REG-02`'s contingency exists to avoid |

### 12.2 Epic-specific completion checklist

- [ ] **D-09.1** All 30 criteria in §6 pass in CI; the five **launch-blocking** ones are demonstrated live in the sprint-6 demo.
- [ ] **D-09.2** The 50-concurrent and 500-concurrent gaplessness tests run against a real Postgres and are part of the standard suite, not a one-off spike.
- [ ] **D-09.3** A forced post-allocation rollback produces a **void record** with a reason; no back-fill code path exists anywhere in `billing/`.
- [ ] **D-09.4** `financialYearOf()` is the **only** place a financial year is derived; a scan proves no FY literal and no `getFullYear()` on an invoice date exists elsewhere.
- [ ] **D-09.5** The **31 March 18:30 UTC rollover rehearsal** has been executed on staging and its evidence is linked from `PHASES.md`.
- [ ] **D-09.6** The invoice renders **CGST 9% and SGST 9% as two lines** intra-state and **IGST 18%** inter-state, with place of supply taken from the **branch**.
- [ ] **D-09.7** The SAC code, the rate, the treatment, the rounding method and the FY start month all live in the tax profile; **none is a constant in code**.
- [ ] **D-09.8** `REVOKE UPDATE, DELETE` on `invoices` and `credit_notes` is verified in **every** environment, not only locally, by the `append-only-grants` check.
- [ ] **D-09.9** The renderer image is pinned **by digest**, its digest is recorded on each invoice row, and the CI determinism assertion runs before the image is promoted.
- [ ] **D-09.10** The nightly contiguity job and the nightly determinism corpus both run, both emit their gauge, and both are **alarmed** — `gym.invoice.sequence_gap.count` has 0 as its only acceptable value.
- [ ] **D-09.11** `commission_tax_minor` exists and is populated as zero, the second invoice series' shape is defined, issuance is flag-disabled, and `KNOWN_LIMITATIONS.md` records why.
- [ ] **D-09.12** `KNOWN_LIMITATIONS.md` additionally records the unconfirmed SAC code (`BLK-04` #3) and the absence of GST e-invoicing (IRN/QR) in Phase 1.
- [ ] **D-09.13** `TECH_DEBT.md` carries `TD-020` (per-tenant invoice throughput) and `TD-009` (headless Chromium as a determinism vehicle) with their revisit triggers.
- [ ] **D-09.14** Runbooks exist and have been walked through for: gap detected (void, never back-fill), renderer digest change, invoice issuance frozen for a tenant, FY rollover, and wrong-FY recovery (void and reissue, never renumber).
- [ ] **D-09.15** Feature flags registered: `release.billing.commission_tax_invoice` (off), `release.billing.tenant_branding`, `ops.billing.invoice_issuance_frozen{tenant}`, `ops.billing.async_export_threshold_rows`.
- [ ] **D-09.16** `E2E-02` steps 9–11 and `E2E-10` step 5 pass.
- [ ] **D-09.17** `M3` evidence recorded: a real invoice issued in staging against a real payment, with a byte-identical regeneration.
- [ ] **D-09.18** `F-09.11` is explicitly deferred to sprint 15 in `SprintPlanning.md` and `PHASES.md`, not silently dropped.

---

## 13. Open Questions

### 13.1 ⛔ The blocking item

> **`BLK-03` conflict 2 / `REG-02` — GST on platform commission. Severity High · Score 20 (Severe) ·
> Owner: Client Sponsor · Must resolve by Sprint 11 · Decision needed at Sprint 5.**
>
> **The question.** `A6.3` computes `payable_to_gym = (N + T) − C − F` with **no GST on the
> commission `C`**. The platform supplies marketplace intermediation to the tenant, and in India
> that service attracts **18% GST on the commission amount**, split CGST 9% + SGST 9% intra-state.
> `LAUNCH_MARKET_INDIA.md` §4 identifies **two taxable supplies** where the PRD models one.
>
> **Why it is blocking, and blocking *Sprint 11* specifically.** `BR-FIN-02` requires every figure
> to be persisted and `BR-FIN-03` requires statement lines to sum **exactly** to the payout. As the
> formula stands, those two cannot both hold once commission GST exists. Sprint 11 is where the
> settlement statement is built and where `BAC-07` — *"Finance reconciles to zero variance"* — is
> first demonstrable. A statement that reconciles only because a real liability is missing from it
> is not a passing `BAC-07`; it is a deferred failure.
>
> **What must be decided.** (1) Whether the platform charges GST on its commission — a liability
> question for a qualified Indian tax advisor, not an engineering judgement. (2) If so, whether the
> commission is quoted GST-inclusive or GST-exclusive to the tenant, because that changes
> `payable_to_gym` and therefore every tenant's economics. (3) Whether the platform must register
> for GST in every state where a tenant operates or only where it has a place of business
> (`BLK-04` #4), because that determines whether the commission invoice carries CGST+SGST or IGST.
>
> **What `EP-09` does regardless, in sprint 6.** The **ninth figure `commission_tax_minor` is
> written present and set to zero** (T-09.19, `AC-EP09-28`), and the **second invoice series'
> shape** — a platform-scoped gapless per-FY sequence for commission tax invoices, to which `TR-19`
> applies identically — is defined and flag-disabled. This is `REG-02`'s stated contingency, and it
> converts a late "yes" from a schema migration through settled money into a configuration change
> plus a backfill.
>
> **What is *not* mitigated by that.** If the answer is "yes" and arrives after sprint 11, real
> payouts will have been made with the platform under-collecting against its own liability, and
> `BR-REF-05`'s proportional commission reversal will need a matching tax reversal at the **same
> rounding** applied retrospectively (`TR-05`). The ledger being append-only makes that computable;
> it does not make it cheap.

### 13.2 The rest

| Id | Question | Status | Due | Effect if unanswered |
| :--- | :--- | :--- | :--- | :--- |
| `BLK-04` #3 | The correct **SAC code** for gym membership services, and confirmation of the **18%** rate | **Open** — needs a tax advisor | Before the first production invoice | Current value 9997xx / 18% is adopted and recorded in `KNOWN_LIMITATIONS.md`; a later correction requires credit notes for invoices already issued |
| `BLK-04` #4 | GST registration in every state where a tenant operates, or only where the platform has a place of business | Open — tax advisor | Sprint 11 | Determines whether the platform's commission invoice carries CGST+SGST or IGST; blocks `F-09.14` issuance alongside `REG-02` |
| `BLK-04` #1, #2 | GST **TCS** / income-tax **TDS** for e-commerce operators | Open — tax advisor, `REG-03` | Sprint 11 | `EP-09` keeps deductions extensible; if confirmed after launch the ledger makes the liability computable retrospectively |
| `OQ-03` | Subscription tier prices | Open | Sprint 5 | `F-09.11` cannot be meaningfully tested; a second reason it sits in sprint 15 |
| `OQ-16` | Data residency | **Resolved** — India, mandatory | Sprint 0 | Stored PDFs and the render pipeline stay in Indian regions |
| **`OQ-09.a`** *(new)* | What is the **invoice number format**? `FR-INV-02` says *"a configurable prefix format"* and names no default | Open | **Sprint 6** | Adopted default: `<PREFIX>/<FY>/<NNNNNN>`, for example `IRONWORKS/2026-27/000148`, prefix per tenant, six-digit zero-padded sequence. Recorded per constitution §23.1 item 10 |
| **`OQ-09.b`** *(new)* | Does a **credit note** share the invoice prefix or take its own? `FR-INV-09` requires a separate sequence but not a separate prefix | Open | **Sprint 6** | Adopted default: `<PREFIX>/CN/<FY>/<NNNNNN>`, so the two series are visually distinguishable in an accountant's export |
| **`OQ-09.c`** *(new)* | Is an invoice issued for a **zero-payable** order — one where a coupon floored the total to zero (`BR-CPN-04`)? | Open | **Sprint 6** | Adopted default: **yes**, a zero-value tax invoice is issued, because `FR-INV-01` says *every* successful payment and because omitting it creates a gap in the member's own records. Requires confirmation that a zero-value tax invoice is acceptable under GST |
| **`OQ-09.d`** *(new)* | Does the **member's GSTIN** get captured for B2B reimbursement, and does the invoice carry it? | Open | Sprint 13 | Adopted default: **no** in Phase 1 — the invoice carries the member's name and contact only. Recorded because corporate memberships (`A6.1` stream 5) will need it |
| **`OQ-09.e`** *(new)* | On **`PAST_DUE` degradation**, does invoice **issuance** continue for a tenant that has lost dashboard write access? | Open | Sprint 15 | Adopted default: **yes** — issuance is automatic and members must receive tax invoices for money they paid; only the tenant's own write actions are withdrawn |
| **`OQ-09.f`** *(new)* | Is **GST e-invoicing (IRN/QR)** applicable at any tenant's turnover, and if so from when? | Open | Post-launch | Out of Phase 1, recorded in `KNOWN_LIMITATIONS.md`; the invoice model reserves space for an IRN and a signed QR so adding it is not a rewrite |

---

## 14. Traceability

### 14.1 Functional requirements

| `FR-` | Feature | Epic AC | Test id family |
| :--- | :--- | :--- | :--- |
| `FR-INV-01` | F-09.1 | AC-EP09-20 | `BR-PAY-10-P1`, `E2E-02` step 9 |
| `FR-INV-02` | F-09.2, F-09.13 | AC-EP09-01 … AC-EP09-09 | `AC-INV-01.1`, `AC-INV-01.2`, `AC-INV-01.3` |
| `FR-INV-03` | F-09.3 | AC-EP09-18 | `BR-PAY-10-N1` |
| `FR-INV-04` | F-09.4, F-09.12, F-09.16 | AC-EP09-10, AC-EP09-11 | `AC-INV-02.2` |
| `FR-INV-05` | F-09.5, F-09.12 | AC-EP09-10 … AC-EP09-13 | GST matrix, T-09.35 |
| `FR-INV-06` | F-09.6 | AC-EP09-12, AC-EP09-13, AC-EP09-14 | `BR-PAY-11-P1/N1` |
| `FR-INV-07` | F-09.7 | AC-EP09-15 … AC-EP09-17, AC-EP09-26 | `E6.9`, T-09.33 |
| `FR-INV-08` | F-09.8 | AC-EP09-22 | `AC-INV-02.1` |
| `FR-INV-09` | F-09.3 | AC-EP09-19 | `AC-INV-04.*` |
| `FR-INV-10` | F-09.9 | AC-EP09-23 | `AC-INV-03.*` |
| `FR-INV-11` | F-09.10 | AC-EP09-24 | `AC-INV-06.*` |
| `FR-ADMN-05` | F-09.5 | AC-EP09-13 | T-09.26 |

### 14.2 Business rules, screens, journeys and metrics

| Identifier | Kind | Where it lands in `EP-09` |
| :--- | :--- | :--- |
| `BR-PAY-10` | Rule (**owned**) | T-09.02, T-09.03, T-09.07, T-09.08; AC-EP09-01 … AC-EP09-05, AC-EP09-18 |
| `BR-PAY-11` | Rule (**owned**) | T-09.11, T-09.12; AC-EP09-12 … AC-EP09-14 |
| `BR-TEN-06` | Rule (**owned**) | T-09.20, T-09.28; AC-EP09-27 |
| `BR-PAY-09` | Rule (co-owned with `ordering/`) | T-09.10; AC-EP09-20 |
| `BR-REF-05` | Rule (contributor) | T-09.18 credit-note tax apportionment at the same rounding |
| `BR-PAY-01` | Rule (inherited) | Every invoice amount in paise; total in words derived from `Money` |
| `BR-TEN-01`, `BR-TEN-04` | Rules (inherited) | T-09.04; statutory retention regardless of soft delete |
| `BR-DAT-01`, `BR-DAT-05` | Rules (inherited/contributor) | Issue and credit-note issue audited; export survives `PAST_DUE` |
| `BR-FIN-02` | Rule (contributor) | Invoices render persisted figures only |
| `SCR-DASH-013` | Screen | T-09.24 |
| `SCR-WEB-011` | Screen | T-09.25 |
| `SCR-WEB-007` | Screen (invoice link) | T-09.25 |
| `SCR-ADM-006` | Screen (invoice column) | T-09.27 |
| `SCR-ADM-011` | Screen (tax profiles) | T-09.26 |
| `C5 subscription.charge` | Job | T-09.20 |
| `billing.sequence-contiguity-check` | Job *(new)* | T-09.21 |
| `billing.pdf-determinism-corpus` | Job *(new)* | T-09.22 |
| `E2E-02` | Journey | Steps 9–11 — gapless FY-2026-27 number, two tax lines, byte-identical regeneration |
| `E2E-10` | Journey | Step 5 — one consolidated invoice for an instalment sale |
| `E2E-07` | Journey | Step 3 — credit note issued, original invoice immutable |
| `E2E-11` | Journey | Invoice and export endpoints in the generated isolation suite |
| `E2E-12` | Journey | Consumes invoice references on settlement lines |
| `NFR-PERF-07` | NFR | AC-EP09-21; T-09.37 |
| `NFR-DQ-02` | NFR | Integer minor units on every invoice amount |
| `NFR-USE-01`, `NFR-USE-08` | NFRs | T-09.39; AC-EP09-30 |
| `NFR-MNT-09` | NFR | T-09.41 runbooks |
| `KPI-26` | Metric | Settlement accuracy 100% — depends on the tax figures this epic freezes |
| `OBJ-04`, `OBJ-09` | Objectives | §2 |
| `BAC-04`, `BAC-06`, `BAC-07`, `BAC-12` | Business acceptance | AC-EP09-01 … AC-EP09-30 |
| `M3` | Milestone | D-09.17 |
| `TR-03`, `TR-15`, `TR-19`, `TR-05`, `TR-24` | Technical risks | §11 |
| `REG-02`, `REG-03`, `REG-04`, `REG-06` | India regulatory risks | §11, §13.1 |
| `TD-009`, `TD-020` | Tech debt | D-09.13 |
| `CON-04` | Constraint | Statutory retention overrides deletion for invoices |
| `ADR-0014`, `ADR-0017`, `ADR-0028` | Decisions | `Money`, outbox (PDF renders after commit), tax profile and regulatory parameters as configuration |
| `LAUNCH_MARKET_INDIA.md` §2, §4, §5, §11 c2, c4 | India rulings | INR formatting, CGST/SGST, 1 April FY, the blocking commission-GST question |

---

*End of Epic_09.*




