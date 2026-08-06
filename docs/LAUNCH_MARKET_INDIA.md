# Launch Market — India

**Decision date:** 2026-08-06 · **Decided by:** Project owner · **Resolves:** `OQ-01`, `OQ-02`, `OQ-16`, `OQ-20`

> `OQ-01` was the PRD's only **Blocking** open question. Answering it unlocks the tax profile, the
> KYC checklist, the payment gateway, the SMS provider, the currency, the timezone and the
> deployment region — and, as this document sets out, it also **surfaces six conflicts with PRD
> baselines** that must be resolved before Sprint 5.

---

## 1. Decisions recorded

| ID | Question | Decision |
| :--- | :--- | :--- |
| **`OQ-01`** | Launch country and city | **India.** Launch city selected separately per the `C9.4` city-gating criteria; the country decision is what unblocks engineering. |
| **`OQ-02`** | Standard commission rate and reduced renewal rate | **Market standard adopted: 10% standard, 5% renewal** — the PRD's own stated default, which lands the blended take rate inside the `KPI-16` target band of 8–12%. |
| **`OQ-16`** | Data residency requirement | **India region, mandatory** — not a preference. See §9. |
| **`OQ-20`** | On-premise or private cloud? | **Managed cloud**, India region. |
| — | Git repository | **Declined for now.** `BLK-01` closed as *deliberately deferred*. See §12. |

---

## 2. Currency and money

| Property | Value |
| :--- | :--- |
| ISO-4217 code | `INR` |
| Minor unit | **paise**, 100 per rupee |
| Storage | `bigint` count of paise + explicit `currency` column (`BR-PAY-01`, `NFR-DQ-02`) |
| Display | `₹` prefix, Indian digit grouping (**2,50,000** — lakh/crore grouping, *not* 250,000) |
| Rounding | `round_half_even` per `A6.3` |

> **Engineering note.** Indian digit grouping is a real formatting requirement, not a nicety. A gym
> owner reading `₹250,000` where they expect `₹2,50,000` will distrust the figure. This belongs in
> `packages/utils` as a single formatter and must never be hand-rolled per surface.

## 3. Timezone

| Property | Value |
| :--- | :--- |
| IANA identifier | `Asia/Kolkata` |
| UTC offset | **+05:30** — a half-hour offset |
| DST | **None.** India observes no daylight saving. |

**Why this matters more than it looks.** `BR-MEM-03` computes membership validity in the *gym's*
timezone, and `FR-MEMB-09` runs the expiry job in the gym's timezone. A **+05:30** offset means
midnight gym-time is **18:30 UTC the previous day**. Any job scheduled on a naive hourly UTC cron
will fire at the wrong local moment. The absence of DST is a genuine simplification — but the design
must not *depend* on it, because `NFR-PRV-05` and `A11` both anticipate other markets.

## 4. Tax — GST

| Property | Value | Confidence |
| :--- | :--- | :--- |
| Regime | Goods & Services Tax (GST) | Certain |
| Rate on gym / fitness services | **18%** | High — verify current notification with a tax advisor |
| SAC code | 9997xx (physical well-being / fitness services) | Medium — **must be confirmed** |
| Treatment | **Exclusive** — tax added on top of net (matches the `A6.3` worked example) | High |
| Intra-state split | CGST 9% + SGST 9% | High |
| Inter-state | IGST 18% | High |
| Place of supply | Performance-based service → **the branch location** | High |

Because a gym is consumed at a physical location, supply is almost always **intra-state**, so the
tax profile must model **CGST + SGST as two separate lines** on the invoice, not one combined 18%.
`FR-INV-04` requires a *"tax breakdown by rate"* — for India that means the breakdown is by
*component*, and the invoice template must show both.

**Two separate taxable supplies exist and the PRD only models one:**

1. Gym → Member: the membership sale. Modelled by `A6.3`. ✅
2. **Platform → Gym: the commission.** This is a service the platform supplies to the tenant, and it
   attracts **18% GST on the commission amount**. The `A6.3` formula computes
   `payable_to_gym = (N + T) − C − F` with **no GST on `C`**. ⚠️ **Gap — see §11, Conflict 2.**

## 5. Financial year — **conflicts with `FR-INV-02`**

**India's financial year runs 1 April to 31 March.**

`FR-INV-02` requires invoice numbering *"gapless and sequential per tenant per financial year"*, and
`AC-INV-01.3` requires the sequence to restart when *"a financial year rolls over"*. The
implementation must therefore treat the FY boundary as **1 April**, not 1 January.

This is trivially cheap to get right now and expensive to discover in April. The FY start month
belongs in the **tax profile as configuration**, not as a constant — `OBJ-09` requires the platform
to be country-agnostic, and FY start varies by country.

## 6. KYC document checklist — India

Populates `config/kyc` per `FR-ADMN-06` and `FR-ONB-03`.

| # | Document | Mandatory | Validates | Notes |
| :-: | :--- | :--- | :--- | :--- |
| 1 | **PAN** (entity or proprietor) | ✅ Always | Tax identity | Format `AAAAA9999A`; 4th char encodes entity type |
| 2 | **GSTIN** | Conditional | Tax registration | Required above the registration threshold; 15 chars, embeds state code + PAN |
| 3 | **Business registration proof** | ✅ | Legal existence | Certificate of Incorporation · Partnership Deed · Udyam / MSME certificate — varies by `entity_type` |
| 4 | **Shop & Establishment registration** | ✅ | Right to trade | **State-specific**, issued municipally |
| 5 | **Bank account proof** | ✅ | Payout destination | Cancelled cheque or bank statement showing account name |
| 6 | **Owner identity** | ✅ | Person behind the business | PAN + one of Aadhaar / Passport / Driving Licence / Voter ID |
| 7 | **Address proof of premises** | ✅ | `BR-GYM-08` geo-match | Utility bill / rent agreement |
| 8 | **Trade licence** (municipal) | Conditional | Local permission | City-dependent |
| 9 | **Fire safety NOC** | Conditional | Premises safety | Commonly required for gyms above a floor-area threshold |
| 10 | **Music licence** (PPL / IPRS) | ❌ Advisory | Copyright | Flagged to the owner, not blocking |

> **Aadhaar caution.** Aadhaar is subject to specific statutory handling restrictions. If collected,
> it must be masked at rest, must never appear in logs (`BR-DAT-06`), and its use requires legal
> review. **Prefer PAN + a non-Aadhaar identity document** so the platform avoids Aadhaar handling
> obligations entirely. Recorded as the default position pending legal sign-off.

## 7. Payment gateway — **conflicts with the PRD's reference adapter**

`ASM-03` assumes *"a payment gateway supporting split settlement is available in each launch
market"*, and `C1.1` names **Stripe Connect** as the reference implementation.

**Stripe Connect's support for domestic Indian marketplace split settlement is materially more
limited than in its primary markets.** Treating it as the India adapter is a risk, not a plan.

| Provider | Split settlement | Notes |
| :--- | :--- | :--- |
| **Razorpay Route** | ✅ Native | Widely used for Indian marketplaces; RBI-licensed payment aggregator; strong UPI support |
| **Cashfree Easy Split** | ✅ Native | Comparable capability |
| **PayU** | ✅ | Established |
| **Stripe** | ⚠️ Limited domestically | Named by the PRD, but not clearly viable as the India split-settlement adapter |

**This is precisely what the `PaymentProvider` port exists for.** `C1.1` states a second adapter *"can
be added without touching domain code"*, and the Baseline Decisions table rates a second adapter as
**Low** impact. So adding an Indian adapter is **not** a deviation — it is the abstraction working as
designed. **Recommendation: Razorpay Route as the Phase-1 India adapter**, with Stripe retained as
the reference implementation for the port's contract tests and future markets.

**Three RBI regimes bind the design:**

| Regime | Requirement | PRD alignment |
| :--- | :--- | :--- |
| **Payment Aggregator licensing** | The platform must not hold funds in its own name | ✅ Already an explicit non-goal (`A4.3`) — using a licensed PA keeps this true |
| **Card tokenisation** | Card numbers may not be stored; network tokens only | ✅ Already required by `BR-PAY-08`, `FR-PAY-09` |
| **e-Mandate / recurring payments** | AFA on registration, **pre-debit notification in advance**, per-transaction ceilings without re-authentication | ⚠️ Affects `BR-MEM-10` and `FR-PAY-11`. UPI AutoPay is the practical rail. **Verify current thresholds.** |

**UPI will be the dominant payment method.** The `payments.method` enum already includes `UPI` — good.
But `FR-PAY-02` says instruments are *"provider-driven and rendered dynamically"*, which is exactly
right for a market where UPI, cards, netbanking and wallets all matter.

## 8. SMS and OTP — **conflicts with `FR-NOTF-03`**

India requires **TRAI DLT registration** for commercial SMS: the sender header and **every message
template** must be registered and approved before use.

| Requirement | Consequence |
| :--- | :--- |
| Header (sender ID) registration | One-time, per brand |
| **Template pre-approval** | ⚠️ **Every SMS template needs DLT approval before it can send** |
| Transactional vs promotional routing | Different rails, different DND treatment |
| DND registry | Promotional SMS cannot reach DND-registered numbers; transactional can |

**The conflict.** `FR-NOTF-03` requires templates to be *"versioned, previewable, and editable by
Super Admin **without deployment**"*. For **SMS in India that is not achievable** — an edited template
must go back through DLT approval before it can send.

**Resolution:** SMS templates carry a `dlt_template_id` and an approval state. Editing an SMS
template moves it to `PENDING_DLT_APPROVAL` and the **previous approved version continues to send**
until the new one clears. Email and in-app templates remain instantly editable as the PRD intends.
This preserves the requirement's intent for the channels where it is possible, and degrades honestly
where the law does not permit it.

**Candidate providers:** MSG91, Gupshup, Kaleyra, Airtel IQ. Selection unblocks addition **A-19**.

**`BR-MEM-11` renewal reminders** (T−15/−7/−3/−1) are classed *Operational* in the PRD's notification
catalogue. Under Indian rules these are **service/transactional** messages tied to an existing
customer relationship, so they may reach DND numbers — but the template wording must stay
transactional and must not become promotional, or the routing classification breaks.

## 9. Data residency and privacy — now mandatory, not configurable

| Regime | Requirement |
| :--- | :--- |
| **RBI payment data localisation** | Payment system data must be stored **in India**. This makes the deployment region a compliance requirement, not a preference. |
| **DPDP Act 2023** | India's data protection statute: consent, notice, data-principal rights, breach notification, obligations that scale with data volume. |

**Deployment region: India** (Mumbai primary; a second Indian region for DR).

This **hardens** `NFR-PRV-05` — data residency stops being *"configurable per deployment region"* and
becomes *fixed to India for Phase 1*, with configurability retained in the architecture for later
markets. `NFR-AVL-04`'s RPO ≤ 15 min / RTO ≤ 4 h must be met **using Indian regions only**, which
constrains the DR design.

**DPDP maps cleanly onto rules the PRD already has** — `BR-DAT-03` (export), `BR-DAT-04` (deletion),
`NFR-PRV-02` (granular consent), `NFR-PRV-03` (subject rights). The tension in `CON-04` (statutory
retention preventing true deletion of financial records) is real under Indian tax law too: books of
account carry a multi-year retention obligation that overrides a deletion request. The PRD's
pseudonymisation approach is the correct resolution.

## 10. Commission — `OQ-02` resolved

| Parameter | Value | Basis |
| :--- | :--- | :--- |
| **Standard commission** | **10.0%** (1000 bps) | PRD stated default; lands blended take rate inside `KPI-16`'s 8–12% band |
| **Reduced renewal rate** | **5.0%** (500 bps) | PRD stated default; `A6.3` renewal step-down, applied from the **second** renewal |
| First renewal | Charged at **standard** rate | `A6.3` explicit |
| Commission base | Net of discount, **excluding tax** | `BR-FIN-04` |

**Effective rate by tier**, applying the `A6.2` percentage-point deltas:

| Tier | Delta | Effective standard rate |
| :--- | :--- | ---: |
| Starter | — | **10.0%** |
| Growth | − 2pp | **8.0%** |
| Professional | − 4pp | **6.0%** |
| Enterprise | Negotiated | per contract |

**This partially resolves `KL-006`.** At a 10% standard rate, no tier delta drives the effective rate
negative, so the arithmetic hazard is not *reachable* at these values. **The 0 bps floor rule must
still be implemented** — the values are configurable (`A6.2`: *"values are configurable"*), and a
future 3% standard rate with a −4pp tier delta would go negative.

**Still unresolved from `KL-006`:** whether tier deltas apply to the **renewal** rate as well as the
standard rate. Adopted interpretation: **deltas apply to the standard rate only; the renewal rate is
flat 5% across tiers.** This is the simplest defensible reading and is recorded as the working
assumption. Flag for client confirmation before Sprint 11.

## 11. Conflicts requiring a decision before Sprint 5

| # | Conflict | PRD clause | Severity | Proposed resolution |
| :-: | :--- | :--- | :--- | :--- |
| **1** | Stripe Connect is not a viable India split-settlement adapter | `C1.1`, `ASM-03` | **High** | Add a Razorpay Route adapter behind the existing `PaymentProvider` port. Not a deviation — the port was built for this. |
| **2** | **GST on platform commission is not modelled.** `A6.3` computes `payable_to_gym = (N + T) − C − F` with no tax on `C`. The platform owes 18% GST on its own commission service. | `A6.3`, `BR-FIN-02` | **High** | Add a ninth persisted figure — `commission_tax_minor` — and a corresponding `COMMISSION_TAX` ledger entry type. **This changes the settlement statement and must be agreed before Sprint 11.** |
| **3** | **GST TCS / income-tax TDS obligations for e-commerce operators are entirely unmodelled.** A marketplace collecting on a merchant's behalf may have statutory collection-and-remit duties with periodic returns. | `A6.4`, `A4.3` | **High** | **Requires a qualified Indian tax advisor** — I can specify the mechanism, not the liability. If applicable, it adds ledger entry types, settlement lines and a filing report. |
| **4** | Financial year is April–March, not calendar | `FR-INV-02`, `AC-INV-01.3` | Medium | FY start month becomes tax-profile configuration. Cheap now, painful in April. |
| **5** | DLT template pre-approval breaks *"editable without deployment"* for SMS | `FR-NOTF-03` | Medium | Approval-state machine on SMS templates; previous approved version keeps sending. Email and in-app unaffected. |
| **6** | Data residency is mandatory, not configurable | `NFR-PRV-05` | Medium | Fix Phase 1 to Indian regions; retain configurability in the architecture. Constrains the `NFR-AVL-04` DR design. |

## 12. Git repository — deferred

**`BLK-01` closed as deliberately deferred** at the project owner's instruction (2026-08-06).

Consequences, recorded honestly rather than argued:

- `PROJECT_CONSTITUTION.md` §20 (Git strategy) and `ENGINEERING_PLAN.md` §15–16 (branch strategy,
  CI/CD) are **written but unenforceable** until a repository exists.
- ~24,000 lines of documentation currently have **no version history**. An accidental overwrite is
  unrecoverable.
- Conventional Commits carrying PRD identifiers — the traceability mechanism the constitution relies
  on — cannot start accruing.

None of this blocks Phase 2 through 7. It becomes blocking at **Phase 8**, where the first code
commit needs somewhere to go. Re-raise before Phase 8 begins.

## 13. Items needing professional advice, not engineering judgement

I can specify mechanisms. I cannot determine liability. These need a qualified Indian **tax advisor**
and **legal counsel** before the settlement design is finalised:

1. Whether the platform is an *e-commerce operator* for GST TCS purposes, and at what rate.
2. Whether TDS on e-commerce participant payments applies, and at what rate.
3. The correct SAC code for gym membership services, and confirmation of the 18% rate.
4. Whether the platform must register for GST in every state where a tenant operates, or only where
   it has a place of business.
5. Current RBI e-mandate thresholds and pre-debit notification timing for UPI AutoPay.
6. Aadhaar handling — confirmation that the PAN-plus-alternative-ID approach avoids Aadhaar
   obligations entirely.
7. DPDP applicability thresholds and whether the platform becomes a *Significant Data Fiduciary* at
   the `NFR-SCAL-01` Year-1 volume of 500,000 users.

**Every rate and threshold in this document is stated to the best of current understanding and must
be verified before it is written into a tax profile.** Regulatory parameters change; the architecture
correctly holds them as configuration, so verification is a data task, not a code change.

---

## Change log for this document

| Date | Change |
| :--- | :--- |
| 2026-08-06 | Created. `OQ-01` = India, `OQ-02` = 10% / 5%, `OQ-16` = India region, `OQ-20` = managed cloud, `BLK-01` deferred. Six PRD conflicts raised. |
