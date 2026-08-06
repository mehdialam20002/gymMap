# billing runbook

> **`NFR-MNT-09`** — every module carries a runbook naming its top failure modes, the signal each is
> detected by, the first action, and where it escalates. Companion to
> `apps/server/src/billing/README.md` §9.
>
> **No code exists in `billing/` yet.** The failure modes, signals and first actions below are
> derived from `Monitoring.md` §3.5 and §5, `Schema.md` §2.12 and §7.5, `BusinessRules.md` §9, and
> `Epic_09.md` **T-09.41** with risks **R-09.9** and **R-09.11**. The dashboards and queries that
> make them executable arrive with the milestones named in **Dashboards and queries**.
>
> **`Monitoring.md` already routes three alerts to this file by name:** `ALRT-07` → `§PDF`,
> `ALRT-16` → `§Sequence integrity`, `ALRT-37` → `§Determinism`. Those section anchors are created
> when the panels below are built.

---

## Scope

`billing/` produces and stores the statutory document. It owns `invoices`, `credit_notes`,
`subscription_invoices` and `document_number_counters`; it allocates every document number from a
row-locked counter inside the issuing transaction — never from a PostgreSQL `SEQUENCE`, which gaps on
rollback — and it freezes the tax treatment onto the document so a later GST change can never rewrite
a filed invoice. For India that means **CGST 9% + SGST 9%** as two component lines for intra-state
supply (almost every gym sale, because the service is consumed at a physical location), **IGST 18%**
for inter-state, place of supply taken from the **branch**, rounding applied per component and then
summed, and a financial year running **1 April – 31 March** evaluated in `Asia/Kolkata` — which is
**31 March 18:30 UTC**. `billing/` also runs the tenant's own SaaS billing and the `BR-TEN-06`
dunning ladder. Two operational facts shape every incident here: **an invoice is immutable** (the
application role holds no `UPDATE` grant beyond `status` and `pdf_url`, and there is no `VOID`
status), and **the consequences of a defect land on the tenant, at assessment time, months later** —
which is why the escalations below run toward Finance and the Technical Lead rather than toward a
quick repair.

## Top failure modes

| Signal | Likely cause | First action | Escalation |
| :--- | :--- | :--- | :--- |
| **`ALRT-16`** (**S1**) — `invoice_sequence_gaps_current > 0`. The nightly contiguity job asserts `count(*) = max(number)` per tenant **per Indian financial year** | A hole in a tenant's GST invoice series. Concurrent allocation that retried without reusing the number; a transaction that committed the counter increment and then failed downstream; or — the one to rule out first — an allocation attempted from a `SEQUENCE` rather than the counter row | Query the gap rows: `SELECT tenant_id, financial_year, missing_number FROM invoice_sequence_gaps WHERE resolved_at IS NULL;` Then look for concurrent-allocation retries and rollback-after-allocation in the same window. **A documented void record occupies the number. Never back-fill.** A fabricated invoice is worse than a gap; a numbered void with a reason is what a tax auditor expects. The counter is **never manually advanced or rewound** (`AC-INV-01.2`, `R-09.9`) | Ticket to Backend Lead (billing) **and** Finance. **A gap unexplained at 24 h escalates to Technical Lead.** If a filing has already been made against the affected series it becomes a `REG-03`-class matter for the tax advisor, not an engineering fix |
| **`ALRT-37`** — `increase(invoice_pdf_determinism_failures_total[1h]) > 0`. **Any increment is a correctness defect**, not a threshold breach | Two different renders of the same invoice number. Font availability drift in the render container; a locale or timezone difference between render hosts; or a non-deterministic value — a render timestamp, a generated id — reaching the template | Diff the two renders' **inputs**, not their outputs. `FR-INV-07` is only achievable because the renderer reads snapshots: if a live value has entered the template, that is the defect. If the renderer digest changed for a legitimate reason, **re-baseline deliberately and record it** — a silent re-baseline is how this defect hides for a year | Ticket to Backend Lead (billing). **It blocks the release if it appears in a pre-release run.** A 2026 invoice must re-render byte-comparably in 2029; treat a determinism regression as evidentiary, not cosmetic |
| `invoice_issued_total{document_type="INVOICE"}` flat while `payment_attempts_total{status="SUCCEEDED"}` is non-zero over the same window; corroborating dead-letter depth on the `billing` queue | Issuance stalled — payments are capturing and no document is being produced. Either `rel.billing.invoice-issuance` is *off* (in which case issuance is **deferred**, by design, not dropped), or the `payment.captured` handler is dead-lettering | Check the flag first. With it *off*, `M-060`'s design enqueues issuance and the job defers — *"invoices are produced late, never skipped, which is the only acceptable degradation for a statutory document."* With it on, drain the dead-letter queue. **Do not issue by hand**: a manual insert bypasses the counter transaction and creates failure mode 1 | Ticket to Backend Lead (billing) + Finance. Notify affected tenants only once the backlog is draining, since the documents will arrive. `ALRT-07` (`invoice_pdf_duration_seconds` p95 > 3 s, or the Chromium pool wait) is the lower-severity neighbour where the **record** exists and only the render is behind |

**Two more entries `T-09.41` requires**, held for the sections named there rather than promoted to
the top three because neither has a standing alert: the **FY rollover procedure** (the first
issuance after 18:30 UTC on 31 March, where an implicit new counter key materialises with
`next_value = 1`), and **wrong-FY invoice recovery** — *void and reissue in the correct year with a
cross-reference, **never renumber*** (`R-09.11`).

**One adjacent failure that will look like `billing/` and is not.** `BR-TEN-06` degradation
complaints — a tenant delisted at day 7 or read-only at day 14 — originate in `subscription.charge`,
which is a `billing/` job, but *"check-in for existing members is never blocked by subscription
arrears"*. A report that members cannot check in **is not** a subscription-arrears symptom, and
`Milestones_060-089.md` asserts it structurally: no file under `attendance/` reads
`tenants.subscription_status`.

## Dashboards and queries

_To be populated by `M-060` ("The gapless per-tenant-per-FY invoice number and the India GST
breakdown"), the deterministic Chromium renderer milestone in the following band, `M-101` ("The
credit note in its own sequence") and the Sprint-15 `subscription.charge` milestone._

Intended content, so the shape is agreed before the panels exist:

- **`§Sequence integrity`** — the `ALRT-16` anchor. `invoice_sequence_gaps_current` over time, plus
  the gap query above and its resolution state. `Monitoring.md` correction **C-2** removed
  `tenant_id` and `financial_year` from the metric labels precisely so that the nightly job writes
  the offending `(tenant_id, financial_year, missing_number)` rows to a table this section queries:
  *the metric detects, the query localises.*
- **`§Determinism`** — the `ALRT-37` anchor. `invoice_pdf_determinism_failures_total`, the current
  renderer digest, and the date the digest was last re-baselined with the reason.
- **`§PDF`** — the `ALRT-07` anchor. `invoice_pdf_duration_seconds` p95 against `NFR-PERF-07`'s 3 s,
  split by **Chromium pool wait** versus **render time**, which is `ALRT-07`'s stated diagnostic
  split. Note that PDF rendering happens **outside** the counter transaction, so a slow render never
  extends the sequence lock.
- **Issuance-parity panel** — `invoice_issued_total{document_type}` against
  `payment_attempts_total{status="SUCCEEDED"}`, which is the only way failure mode 3 is visible: a
  stalled issuer produces no error, only an absence (`Monitoring.md` principle **P10**).
- **India tax panel** (`Monitoring.md` §10, the Finance dashboard) — GST collected split
  **CGST / SGST / IGST**; `commission_tax_minor` accrued once open item **`O-1`** is agreed;
  invoice count and sequence integrity **per tenant per financial year**; FY-to-date totals with the
  FY boundary marked.
- **`tax_breakdown` sum assertion** — `SUM(amount_minor)` over the component array must equal
  `tax_minor`. `Schema.md` §7.5 is explicit that a mismatch **blocks the invoice, it does not
  round**, so this needs a standing query as well as the issuance-time check.
- **FY boundary rehearsal** — a table-driven check at 18:29:59Z, 18:30:00Z and 18:30:01Z on 31 March,
  run against the live configuration in the week before each rollover. The defect this catches
  surfaces *once a year, in April, in production, in a tax document*.
- **Subscription dunning panel** — tenants by days past due against the 0 / 7 / 14 thresholds, with
  an explicit assertion that no check-in denial reason in the same window is arrears-derived
  (`BR-TEN-06-N1`).

## Known incidents

_None yet._
