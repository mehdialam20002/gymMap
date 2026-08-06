# Gym Owner Dashboard — UI Specification (`dash`)

**Surface:** `apps/gym-dashboard` · React 18 + Vite + TypeScript · SPA
**Screens:** `SCR-DASH-001` … `SCR-DASH-022` (22 of the 55 `SCR-` screens)
**Phase:** 6 — UI Documentation · `/docs/ui/GymDashboard.md`
**Status:** Specification. **Zero component code exists and none is written here.** Every fenced
block in this document is labelled `illustrative — not committed code` and is a description of
intent, not a file.

---

## 0. Document control

| Field | Value |
| :--- | :--- |
| Owns | The per-screen specification of all 22 `dash` screens of `MASTER_PRD.md` `B7`: layout, regions, data contract, the four mandatory states, interactions, validation, accessibility, responsive behaviour, i18n keys and acceptance checks |
| Does not own | Token values, the typography and spacing scales, the icon set → `/docs/ui/DesignSystem.md` · the component inventory and its shadcn/ui mapping → `/docs/ui/Components.md` · the navigation shell, route table and deep-link rules → `/docs/ui/Navigation.md` · WCAG conformance evidence and the audit method → `/docs/ui/Accessibility.md` · breakpoint behaviour rules → `/docs/ui/ResponsiveBehavior.md` · the customer website → `/docs/ui/CustomerApp.md` · the admin console → `/docs/ui/AdminDashboard.md` |
| Binding inputs | `PROJECT_CONSTITUTION.md` §16 (Frontend Rules) · `MASTER_PRD.md` `B2`, `B3.2`, `B4.2`, `B4.4`, `B5.*`, `B7`, `B9.1`, `B9.6` · `docs/apis/README.md` (contract law) and the nine domain files · `docs/engineering/FolderStructure.md` §5 · `LAUNCH_MARKET_INDIA.md` |
| Precedence | `PROJECT_CONSTITUTION.md` > `MASTER_PRD.md` > `docs/apis/` > this document. Where this document appears to contradict any of the three, the three win and this document is the defect |
| Launch market | **India.** `INR` / paise, `₹` prefix, **lakh-crore digit grouping**, `Asia/Kolkata` (+05:30, no DST), dates `DD MMM YYYY`, phone `+91` 10 digits starting 6–9, PIN 6 digits, single launch locale `en-IN` with **every string externalised** (`NFR-USE-08`) |

### 0.1 The two people this surface is designed for

Everything below is an argument from `B2.1` and `B2.3`. When a decision in this document looks
opinionated, it is because one of these two people loses if it goes the other way.

| Persona | `B2` ref | What the dashboard must do | What the dashboard must never do |
| :--- | :--- | :--- | :--- |
| **Rohan** — independent owner, two branches, ~400 members, formerly a trainer, **wary of "software"** | `B2.1` | Answer *"what do I need to do today"* on the home screen **without navigation**. Keep nothing critical more than **two taps** deep. Make export obvious. Show the renewal list that makes him money in week one | Present a blank analytics canvas he must assemble. Bury the expiring list behind a report builder. Hide the data-export path |
| **Sameer** — receptionist, 12:00–21:00, queue of ten, cash handler | `B2.3` | Check a person in **in under two seconds** (`NFR-PERF-03` p95 ≤ 2 s). Look a member up by phone number in **one field**. Attribute every cash entry to him — which protects him as much as it monitors him | Make him choose between two scanners. Show a success state he cannot trust. Require a mouse |

### 0.2 The nine laws every screen in this document obeys

| # | Law | Source |
| :-: | :--- | :--- |
| L1 | **Four states minimum on every screen** — loading, empty, error, permission-denied. `B6`'s preamble states why: these are where implementations diverge from intent | §16.9, `B6` |
| L2 | **WCAG 2.1 AA on `SCR-DASH-009`** (check-in desk); **Level A minimum with AA as the target** on the other 21 | `NFR-USE-01`, AX1 |
| L3 | **Full keyboard operability**, everywhere on this surface, with no exceptions | `NFR-USE-02`, AX2 |
| L4 | **44 × 44 px minimum touch target**; text contrast ≥ 4.5:1, interactive ≥ 3:1 | `NFR-USE-03`, `NFR-USE-04` |
| L5 | **Every error states what happened, why, and what to do next** — never a code alone | `NFR-USE-05`, §13.7 |
| L6 | **Every destructive action confirms with a server-computed, specific consequence** — *"this will archive a plan held by 34 active members"* | `NFR-USE-06`, FM7 |
| L7 | **320 px → 2560 px, no horizontal scrolling.** Wide tables scroll inside their own container, never the page body | `NFR-USE-07`, AX5 |
| L8 | **Every user-facing string is a key** from the first commit. No literal in JSX, no literal in a validator, no literal in an error mapper | `NFR-USE-08`, I18N1 |
| L9 | **Navigation filtering is UX, not security.** The server refuses regardless (`AC-STAF-01.2`) | `FR-NAV-03`, `FR-RBAC-02`, BL6 |

---

## 1. The surface contract

### 1.1 Stack, restated so it cannot be misread

| Concern | Ruling | Source |
| :--- | :--- | :--- |
| Application shell | **React 18 + Vite + TypeScript SPA.** No server components exist on this surface | `C1.1`, NX9 |
| Routing | `src/routes/router.tsx` — a route table with `lazy()` per route. **Routing only**: a route file composes a feature and does nothing else | F1, FolderStructure §5 |
| Styling | TailwindCSS (`A-03`) consuming **design tokens** from `packages/ui` as CSS custom properties. A hex literal or an arbitrary value (`p-[13px]`) in `apps/**` **fails lint** | UI2, UI3 |
| Primitives | shadcn/ui (Radix) **copied into `packages/ui`** (`A-04`), never a runtime dependency | UI1 |
| Server state | **TanStack Query only.** A bare `fetch` in a component is a review rejection. Query keys come from a per-feature factory | DQ1, DQ3 |
| Forms | **React Hook Form + Zod resolver** (`A-09`, `A-02`), schema shared from `packages/types` wherever the server validates the same shape | FM1, FM2 |
| Live figures | **`useLiveCounters()` — one hook, 10–15 s poll, mandatory "last updated" indicator.** No `setInterval`, no second polling hook, no per-widget `refetchInterval` | `A-08`, LC1–LC8 |
| Client state | Minimal. **Redux, Zustand and MobX are not dependencies of this project** | DQ4 |
| Charts | Dynamically imported at the point of use — the charting library is never in the initial route chunk | FP3 |
| Scanner | `@zxing/browser` (`A-10`), dynamically imported by `SCR-DASH-009` only | FP3, `A-10` |

### 1.2 Navigation, and why filtering it is not a security control

`FR-NAV-03`: *"Dashboard navigation is filtered by effective permission; a user never sees a menu
item they cannot use."* `FR-RBAC-02`: *"Permission checks are enforced server-side. Client-side
hiding of UI is presentation only and never a security control."*

Both are true simultaneously and the distinction is the whole point:

*illustrative — not committed code*

```text
                     ┌──────────────────────────────────────────────┐
  effective          │  <VisibleIf permission="plans.plan.update">  │  ← UX. Sameer does not see
  permission set     │      <NavItem to="/plans" />                 │    a door he cannot open.
  from the session   └──────────────────────────────────────────────┘
        │
        │  Sameer types /plans/01932c70-… into the address bar anyway
        ▼
  ┌────────────────────────────────────────────────────────────────────┐
  │  GET /v1/tenant/plans/01932c70-…  →  403 PERMISSION_DENIED         │  ← Security. AC-STAF-01.2.
  │  the route renders the permission-denied state from the 403,       │
  │  NOT from a client-side guard that decided on its own              │
  └────────────────────────────────────────────────────────────────────┘
```

| Rule | Statement |
| :--- | :--- |
| N1 | `packages/ui` exposes no permission logic. `src/shared/permissions/visible-if.tsx` is the **only** component that hides on permission, and its file header says *"presentation only — never a security control (`FR-RBAC-02`)"* |
| N2 | A route is **never** guarded by hiding alone. Every route renders its permission-denied state from a **server `403`**, so a deep link resolves to an explanatory screen rather than a blank page (`FR-NAV-06`) |
| N3 | Branch scoping **refuses, it does not filter** (`FR-STAF-03`, `AC-STAF-01.1`, `Gym.md` §2.5). A receptionist at Bandra West requesting Andheri East data receives `403 BRANCH_NOT_ASSIGNED_TO_STAFF`, not an empty table. The UI renders that refusal as a named state, never as "no results" |
| N4 | Role changes take effect **within 60 seconds without re-authentication** (`FR-RBAC-04`). The nav re-renders when the session permission set changes; a demoted manager does not need to sign out |
| N5 | `FR-NAV-04` — the onboarding checklist is **persistent** until the tenant is `APPROVED` with ≥ 1 published plan. It is a shell element, not a home-screen widget, so it survives navigation |

### 1.3 The navigation tree, per `B4.2`, with the permission that reveals each item

Permission strings are the ones declared by the endpoints in `docs/apis/` — the nav does not invent
its own vocabulary.

| Group | Item | Route (`B4.2`) | Revealing permission | `SCR-` |
| :--- | :--- | :--- | :--- | :--- |
| — | Home | `/` | *(always)* | `001` |
| — | Setup | `/onboarding` | `onboarding.application.read` | `002` |
| Gym | Profile | `/gym/profile` | `catalog.gym.read` | `003` |
| Gym | Branches | `/gym/branches` | `catalog.branch.list` | `004` |
| Gym | KYC | `/gym/kyc` | `onboarding.kyc_document.list` | `002` (panel) |
| Gym | Payout | `/gym/payout` | `settlements.payout_account.read` | `022` (section) |
| Sell | Plans | `/plans` | `plans.plan.list` | `005` |
| Sell | Plan editor | `/plans/:id` | `plans.plan.update` | `006` |
| Sell | Coupons | `/coupons` | `ordering.coupon.list` | `016` |
| Sell | Leads | `/leads` | `crm.lead.list` | `017` |
| People | Members | `/members` | `crm.member.list` | `007` |
| People | Member 360 | `/members/:id` | `crm.member.read` | `008` |
| People | Staff | `/staff` | `staff.staff.list` | `018` |
| Desk | Check-in | `/checkin` | `attendance.checkin.record` | `009` |
| Desk | Attendance | `/attendance` | `attendance.log.view` | `010` |
| Desk | Record sale | `/sales/offline` | `ordering.order.create_offline` | `012` |
| Money | Sales & orders | `/sales` | `ordering.order.list` | `011` |
| Money | Invoices | `/invoices` | `billing.invoice.list` | `013` |
| Money | Settlements | `/settlements` | `settlements.batch.list` | `014` |
| Money | Refunds | `/refunds` | `refunds.refund.list` | `015` |
| Insight | Reviews | `/reviews` | `reviews.review.list` | `019` |
| Insight | Reports | `/reports` | `reporting.report.read` | `020` |
| System | Notifications | `/notifications` | *(always — own centre)* | `021` |
| System | Settings | `/settings` | `tenancy.settings.read` | `022` |

**What each role actually sees.** Derived from `B3.2`, not invented:

| Role | Visible groups | Notably absent |
| :--- | :--- | :--- |
| `GYM_OWNER` | All | — |
| `GYM_MANAGER` | Home, Gym (profile `▪`, branches read), Sell (plans **read-only**, coupons read-only), People, Desk, Money (reports `▪`), Insight | **Plan create/edit/publish**, **Settlements**, **Payout account**, **Add/remove branch**, **Export tenant data** |
| `RECEPTIONIST` | Home (reduced), Desk (check-in, attendance `▪`, record sale), People (members `▪`, leads), Insight (nothing) | **Plans entirely**, Staff, Settlements, Invoices, Refunds, Coupons, Reports beyond `▪`, Settings |
| `TRAINER` | Home (reduced), Desk (check-in only — **no override**), People (assigned members `▪`), Attendance `▪` | Record sale, Members beyond assigned, Plans, all of Money, Staff, Settings |

> `RECEPTIONIST` never sees plan editing in the nav (`FR-NAV-03`). **And the server refuses it**
> (`AC-STAF-01.2`). The nav filter exists so Sameer is not confronted with twelve doors he cannot
> open during a queue — it is an ergonomics decision that happens to align with a security boundary
> enforced somewhere else entirely.

### 1.4 Feature-folder map (`FolderStructure.md` §5)

Each screen names its owning feature. A feature never imports another feature's internals (F2);
cross-feature reuse goes through `packages/ui` (presentation) or `src/shared` (infrastructure).

| Feature folder | Screens served |
| :--- | :--- |
| `features/home/` | `SCR-DASH-001` |
| `features/onboarding-wizard/` | `SCR-DASH-002` |
| `features/gym-profile/` | `SCR-DASH-003` |
| `features/branches/` | `SCR-DASH-004` |
| `features/plans/` | `SCR-DASH-005`, `SCR-DASH-006` |
| `features/members/` | `SCR-DASH-007`, `SCR-DASH-008` |
| `features/checkin-desk/` | `SCR-DASH-009` |
| `features/attendance/` | `SCR-DASH-010` |
| `features/sales/` | `SCR-DASH-011`, `SCR-DASH-012` |
| `features/invoices/` | `SCR-DASH-013` |
| `features/settlements/` | `SCR-DASH-014` |
| `features/refunds/` | `SCR-DASH-015` |
| `features/coupons/` | `SCR-DASH-016` |
| `features/leads/` | `SCR-DASH-017` |
| `features/staff/` | `SCR-DASH-018` |
| `features/reviews/` | `SCR-DASH-019` |
| `features/reports/` | `SCR-DASH-020` |
| `features/notifications/` | `SCR-DASH-021` |
| `features/settings/` | `SCR-DASH-022` |

---

## 2. Cross-cutting mechanics every screen inherits

These are specified **once** here. A screen section below references them by name and does not
restate them, so a change to a rule changes one place.

### 2.1 `useLiveCounters()` — the single live-figure seam (`A-08`, LC1–LC8)

Socket.IO is deferred to Phase 2 behind `release.attendance.realtime_transport`. Phase 1 polls.

| Property | Value |
| :--- | :--- |
| File | `src/shared/hooks/useLiveCounters.ts` — **the only file in this SPA permitted to set a TanStack Query `refetchInterval`.** A structure test greps for `refetchInterval` elsewhere and fails the build |
| Endpoint | `GET /v1/tenant/attendance/live` — **and nothing else**. It returns the `SCR-DASH-001` currently-in-gym count, the `SCR-DASH-009` recent-check-ins strip, and `generated_at` |
| Interval | **10–15 seconds**, configuration-driven, set in the hook. Not per-widget, not per-screen |
| Visibility | Polling **pauses when `document.hidden`** and resumes on visibility (LC4), so a dashboard left open overnight is not a load source |
| Return shape | `{ data, generatedAt, isStale, error }`. Components know nothing about polling, sockets or the flag (LC6) |
| Mandatory disclosure | **`<LastUpdatedIndicator generatedAt={…} isStale={…} />` from `packages/ui` renders beside every polled figure.** A surface consuming the hook without rendering the indicator **fails review** — *"a stale figure presented as live is a defect"* |
| Not a live figure | **Check-in confirmation.** `NFR-PERF-03` (p95 ≤ 2 s scan → confirmation) is a request/response path through `POST /v1/checkin/scan`. Routing confirmation through the poll would be a defect (LC7) |
| Rate budget | `RL-READ` is 300/min per user; three dashboard tabs polling at 10 s costs **18/min** (`README.md` §10.2). Headroom is deliberate |

**The indicator's three visual states** — the text is a key, the relative time is formatted through
the i18n layer with an explicit locale (I18N4):

| Condition | Rendered | Key |
| :--- | :--- | :--- |
| Fresh (< 2 poll intervals) | *"Updated 8 seconds ago"* · neutral dot | `dash.live.updated_relative` |
| Stale (≥ 2 intervals, poll still trying) | *"Last updated 1 minute ago — reconnecting"* · warning dot | `dash.live.stale_reconnecting` |
| Failed (poll erroring) | *"Not updating. Last figure from 14:32. Retry"* · error dot + retry button | `dash.live.poll_failed` |

The failed state **keeps the last figure visible and labels it as old**. Blanking the number would
be worse: an owner reading a blank tile assumes zero people are in the gym.

### 2.2 Money — formatted client-side, computed nowhere

| Rule | Statement |
| :--- | :--- |
| M-UI-1 | Every monetary value arrives as `<subject>_minor`, a **string** of integer paise, with an **adjacent `currency`** (`README.md` §11.1 M1, M2) |
| M-UI-2 | Formatting is **one function** in `packages/utils`, `formatMoney(minor, currency, locale)`. Hand-rolling it per surface is forbidden — `LAUNCH_MARKET_INDIA.md` §2 says so in as many words |
| M-UI-3 | **Indian digit grouping is lakh-crore.** `₹2,50,000` — **never** `₹250,000`. The symbol precedes the number with no space. A gym owner reading `₹250,000` where they expect `₹2,50,000` distrusts the figure, and a distrusted figure is a support ticket |
| M-UI-4 | **Money arithmetic in a component is forbidden** (BL2, §10.3). `<PriceBreakdown/>` renders eight server-supplied figures; it does not add them up to check. `<SettlementStatement/>` renders the identity the server publishes as `sum_invariant` — it does not evaluate it |
| M-UI-5 | **No request body on this surface contains a monetary field**, with exactly one apparent exception: `amount_received_minor` on `POST /v1/tenant/orders/offline` and `…/collect-balance`, which is *a record of cash handed over, not a price* (M4). Sending any other `_minor` field is `400 VALIDATION_FAILED` with `rule: "unknown_field"` |
| M-UI-6 | Rates render from integer **basis points**: `1800` → *"18%"*. A component never divides by 100 to "get the rate" — it formats what it was given (M5) |

```tsx
// illustrative — not committed code
// The only three shapes a dashboard component ever sees for money.
<Money minor={order.breakdown.total_minor} currency={order.currency} />        // ₹4,720
<Money minor={batch.summary.net_payable_minor} currency={batch.currency} />    // ₹12,84,460
<Rate bps={line.applied_commission_rate_bps} />                                // 8%
```

### 2.3 Time — `Asia/Kolkata`, and the trap it hides

| Rule | Statement |
| :--- | :--- |
| T-UI-1 | Instants arrive as RFC 3339 with an offset; **business dates arrive as `YYYY-MM-DD` and are already in the gym's timezone**. The client never converts a business date (`README.md` §12.2) |
| T-UI-2 | Display format is **`DD MMM YYYY`** — *06 Aug 2026*. Times are 24-hour — *18:45*. Both through the i18n layer with an explicit locale (I18N4) |
| T-UI-3 | **+05:30 is a half-hour offset and India observes no DST.** Midnight gym-time is **18:30 UTC the previous day**. A component that slices an ISO string at `T` to "get the date" produces yesterday's date for every check-in before 05:30. This is banned by review, not by convention |
| T-UI-4 | **Date arithmetic that carries business meaning is server-computed** in the gym's timezone and returned as a value (BL4, `BR-MEM-03`). `days_remaining` is read, never derived. The client formats it and states the timezone where ambiguity is possible |
| T-UI-5 | The financial year runs **1 April – 31 March** (`LAUNCH_MARKET_INDIA.md` §5). Every FY selector on this surface is labelled `2026-27`, never `2026` |
| T-UI-6 | Relative time (*"24 minutes ago"*) is permitted **only** where the absolute time is also present or one hover/focus away. A queue at the desk reads relative; an audit trail reads absolute |

### 2.4 The four states, as a contract rather than an aspiration

Every screen section below carries a **States** table with at least these four rows. The table is
not boilerplate: an empty state that says *"No results"* fails review.

| State | What it must do | What fails review |
| :--- | :--- | :--- |
| **Loading** | A **skeleton matching the eventual layout**. No layout shift on arrival. Controls that do not depend on the data stay interactive — the member search field is usable while the table below it loads | A centred spinner over a blank page. A skeleton of a different shape than the content |
| **Empty** | Explain **why** it is empty and offer the **next action**. Distinguish *"nothing exists yet"* from *"your filters excluded everything"* — they need different buttons | *"No data"*. A single illustration with no action |
| **Error** | A retry affordance, **the last successful data retained where possible**, and graceful degradation of non-critical regions rather than a blocking dialog. The message states what happened, why, and what next (`NFR-USE-05`) | A toast containing a correlation id and nothing else. A whole screen replaced because one widget failed |
| **Permission-denied** | State that the action needs a permission the user lacks, name **who can grant it**, and offer a way onward. Never a blank page, never a silent redirect (`FR-NAV-06`) | A redirect to `/`. A 403 rendered as a generic error |

Two additional states are mandatory wherever the domain produces them:

| Extra state | Where | Behaviour |
| :--- | :--- | :--- |
| **Branch-refused** | Every branch-scoped screen | `403 BRANCH_NOT_ASSIGNED_TO_STAFF` renders as *"You are assigned to Bandra West. Andheri East data is not available to your account. Ask an owner to add the branch to your assignment."* — **not** an empty table (N3) |
| **Tenant-suspended** | Every screen | `403 TENANT_SUSPENDED` renders a full-surface informational state with the support path and the correlation id (`EV6`). Check-in denies with `TENANT_SUSPENDED` (denial reason 15) rather than erroring |

### 2.5 Errors — what happened, why, what next (`NFR-USE-05`, §13.7)

Every non-2xx response has exactly one shape (`README.md` §9.1): `{ error: { code, message,
details?, correlation_id } }`. The dashboard consumes it in exactly three ways and no others.

| Server shape | UI placement | Rule |
| :--- | :--- | :--- |
| `400 VALIDATION_FAILED` with `details[]` | **On the offending input**, matched by `field` | FM5 — a `400` lands on the input, never in a toast |
| A business `4xx` with a domain `code` (`PLAN_PRICE_CONFIRMATION_REQUIRED`, `STAFF_SEAT_LIMIT_REACHED`, `LAST_OWNER_CANNOT_BE_REMOVED`) | **Inline, in the form or dialog that caused it**, rendering the server `message` plus the screen's own contextual action | The `message` is already resolved from an i18n key in the caller's language (EV3). The client **never** re-writes it from the `code` |
| `500` / `503` | A non-blocking banner **surfacing the correlation id**, because `KPI-25` depends on support being able to act on it (EV6) | *"Something went wrong on our side. Nothing was saved. Try again, or contact support with reference `01J9Z7QK…`."* Never *"unexpected error"* (EV7) |

**Denials are not errors.** `POST /v1/checkin/scan` returns **`200` with `result: "DENIED"`**
(`README.md` §9.4, `Membership.md` §6). The check-in desk renders a denial as a **domain outcome
with actions**, never through the error path — routing it through the error path would also make
every expired membership look like an auth failure on the error-rate dashboard that pages on-call.

### 2.6 Forms — one library, one schema, one confirmation discipline

| Rule | Applied on this surface as |
| :--- | :--- |
| FM1 | React Hook Form + `zodResolver`. Every form. No exceptions on 22 screens |
| FM2 | The Zod schema is imported from `packages/types` wherever the server validates the same shape — `CreatePlanRequest`, `InviteStaffRequest`, `ReplacePayoutAccountRequest`. Client and server **cannot** drift |
| FM3 | Client validation is **usability**. Server validation is the **security control**. Both, always |
| FM4 | `SCR-DASH-002`'s six-step wizard persists **server-side, in rows** (`Gym.md` §5.1: *"state lives in rows, not in a step pointer"*). **Local storage is not persistence** |
| FM6 | Submit is disabled while the mutation is in flight and the mutation carries an `Idempotency-Key`, so a double-click cannot create two orders or two tenants |
| FM7 | Destructive confirmations state the **server-computed** consequence. §2.7 enumerates all of them |

### 2.7 The destructive-action register (`NFR-USE-06`)

Every destructive or irreversible action on this surface, the figure its confirmation must state,
and where that figure comes from. **No figure in this table is computed on the client.**

| Action | Screen | Confirmation must state | Source of the figure |
| :--- | :--- | :--- | :--- |
| Archive a plan | `006` | *"Archiving **Annual Unlimited** removes it from sale. **412 active memberships** and **7 pending memberships** keep their terms until they end — the earliest ends **19 Aug 2026**, the latest **05 Aug 2027**. **2 orders are mid-checkout** against it."* | `POST /v1/tenant/plans/:id/archive` with `{"confirm": false}` → `200` preview carrying `affected{}` and `effects[]` |
| Change a plan price | `006` | *"This plan is priced at **₹15,000**. Changing it to **₹12,000** affects new purchases only — the **412 members** who already bought this plan keep their purchased price until their membership ends."* | `422 PLAN_PRICE_CONFIRMATION_REQUIRED`, `details[].count` |
| Change a material gym field | `003` | *"Changing your legal name sends your listing back for review. Your gym stays visible, your sales continue, and check-in is unaffected."* | `field_change_classes` map + `422 APPLICATION_PRECHECK_OVERRIDE_REQUIRED` |
| Replace the payout account | `022` | *"Payouts are held until we verify the new account. Your last four digits change from **4417**. Every owner is notified."* | `PUT /v1/tenant/payout-account` response `payout_hold{}` |
| Deactivate a branch | `004` | *"Andheri East has **118 active members** and **41 check-ins today**. Deactivating stops check-in there immediately."* | `GET /v1/tenant/branches/:id` counters |
| Remove a staff member | `018` | *"Removing Sameer revokes his access on his **next request**, not at his next login. His **1,284 recorded check-ins** and **₹2,14,500 collected** stay attributed to him."* | `GET /v1/tenant/staff/:id/activity` |
| Demote or remove the last owner | `018` | **Refused**, not confirmed: *"You are the only owner of Iron Temple Fitness. Invite another owner before changing your own role."* | `422 LAST_OWNER_CANNOT_BE_REMOVED` |
| Raise a refund | `015` | *"Refunding **₹2,750** of **₹5,000**. **18 of 90 days** were used. The gateway fee of **₹47.20** is not reversed and appears on your next settlement."* | `POST /v1/tenant/refunds` computation block |
| Pause a coupon | `016` | *"Pausing **MONSOON20** stops new redemptions immediately. **34 members** already redeemed it and are unaffected."* | `GET /v1/tenant/coupons` usage counters |
| Delete a gym photograph | `003` | *"You have **4 photographs**. The minimum is **3**. Deleting this leaves you at the minimum."* — and at 3, the delete is **refused** with the reason | `BR-GYM-02`, media count |
| Export tenant data | `022` | Not destructive, but confirms scope: *"Exporting **all 412 member records** including phone numbers. The link expires in 24 hours and every download is logged."* | `POST /v1/tenant/exports` |

### 2.8 Accessibility floor, applied

| Requirement | How it lands on this surface |
| :--- | :--- |
| `NFR-USE-01` AA on `SCR-DASH-009` | The check-in desk is a **merge gate**, not an aspiration. axe-core (`A-06`) runs on it in CI plus a **manual keyboard and screen-reader pass** each release |
| `NFR-USE-02` keyboard | Every table row exposes its actions to `Tab`; every dialog traps focus and restores it on close; every destructive confirm defaults focus to **Cancel**, never to the destructive button |
| `NFR-USE-03` 44 × 44 | Enforced by the token spacing scale. Compact table rows (`SCR-DASH-007`, 50/page) keep 44 px hit areas by padding the **hit target**, not the visual row |
| `NFR-USE-04` contrast | Enforced by the **token palette**, not by per-component choices (AX4). A component cannot pick a failing pair because the failing pair is not a token |
| AX8 live regions | Check-in outcomes announce through an `aria-live="assertive"` region. A denial is **announced**, not only coloured red |
| AX9 colour | **Colour is never the sole carrier of meaning.** Green success carries a tick and the word; red denial carries a cross, the reason and the actions |
| Motion | Every transition respects `prefers-reduced-motion`. The check-in desk's success flash becomes an instant state change, not a pulse |

### 2.9 Responsive contract (`NFR-USE-07`)

| Band | Width | Dashboard behaviour |
| :--- | :--- | :--- |
| `xs` | 320–479 | Single column. Nav collapses to a bottom bar of the **five** most-used items for the role. Tables become **stacked cards**, never horizontally scrolled rows |
| `sm` | 480–767 | Single column, denser cards. Filters collapse into a sheet |
| `md` | 768–1023 | **Tablet portrait — the check-in desk's design target.** Two-column home. Sidebar is a drawer |
| `lg` | 1024–1439 | Persistent sidebar, two/three-column home, tables render as tables |
| `xl` | 1440–1919 | Three-column home, statement tables at full width |
| `2xl` | 1920–2560 | Content **max-width capped**; extra space becomes margin, not longer line lengths. A settlement table at 2560 px stays readable |

**No page body ever scrolls horizontally.** Wide content — settlement statements, the attendance
log, the invoice register — scrolls **inside its own `overflow-x: auto` container** with a sticky
first column so the member's name stays visible.

### 2.10 Internationalisation keys

Namespace grammar per I18N2: `dash.<feature>.<element>[.<variant>]`.

| Example key | Renders |
| :--- | :--- |
| `dash.home.alerts.kyc_info_requested.title` | *"We need three more documents"* |
| `dash.checkin.denied.membership_frozen` | *"Membership is frozen until 20 August 2026…"* |
| `dash.plans.archive.confirm.body` | The `NFR-USE-06` archive sentence with interpolated counts |
| `dash.settlements.line_type.FEE_NOT_REVERSED` | *"Gateway fee not reversed on refund"* |
| `dash.common.last_updated.relative` | *"Updated {relative} ago"* |

Three rules that bite on this surface specifically:

1. **Server-resolved messages are not re-keyed.** A denial's `message` and an error's `message`
   arrive already localised (EV3, `Membership.md` §6 note 5). The client renders them. A client that
   maintained its own map of `denial_reason` → text would drift the day a reason's wording changed.
2. **Open enums need a fallback.** `settlement_line.type` and `suggested_actions` are **open**
   (`README.md` §2.3, CO-2). An unknown value renders the **server-supplied `label`**; an unknown
   `suggested_action` renders **nothing** rather than a raw enum token.
3. **A CI check fails the build** on a hard-coded user-facing string in `apps/**` and on a key
   referenced in code but missing from the catalogue (I18N5).

### 2.11 The per-screen template used from §3 onward

Every screen below is specified in the same nine parts, in the same order:

| Part | Contents |
| :--- | :--- |
| **Header** | Route · feature folder · persona · permission · WCAG target · live data · performance budget |
| **Purpose** | One paragraph naming the job the screen does and the `B7` row it implements |
| **Layout** | An ASCII sketch at `lg`, plus what changes at `md` and `xs` |
| **Regions** | A table of every region with its content and its source `FR-`/`BR-` |
| **Data** | Endpoints consumed, query-key factory entries, stale-time class, mutations and their invalidations |
| **Interactions** | Every action, its permission, its confirmation, its idempotency |
| **States** | The four mandatory states plus domain states |
| **A11y & responsive** | What the screen does beyond the §2.8/§2.9 floor |
| **Acceptance** | The `AC-` identifiers this screen must satisfy |

---

## 3. `SCR-DASH-001` — Dashboard Home

| | |
| :--- | :--- |
| **Route** | `/` (`B4.2`) |
| **Feature** | `src/features/home/` |
| **Persona** | **Rohan** (`B2.1`) primary; Sameer and trainers see the reduced variant |
| **Permission** | Always reachable. Content is composed from the effective permission set; **each region is a separate query and a denied region is simply absent**, not an error |
| **WCAG** | Level A minimum, AA target (`NFR-USE-01`) |
| **Live data** | **Yes** — currently-in-gym and the today strip, through `useLiveCounters()` (LC2) |
| **Budget** | First meaningful region ≤ 800 ms (`NFR-PERF-04`). Regions render **independently** — region 3 does not wait for region 4 |

### 3.1 Purpose

`B7` states it in one line: *"Answer 'what do I need to do today' without navigation."* Rohan is
wary of software (`B2.1`) and the thing that keeps him is *"the renewal list that makes him money in
week one"*. So this screen is not an analytics canvas. It is a **worklist with numbers attached**,
and `B2.1`'s design implication — *"nothing critical may be more than two taps deep"* — is
satisfiable here or nowhere: **every action list on this screen acts in place**, without navigating.

### 3.2 Layout at `lg` (1024–1439)

*illustrative — not committed code*

```text
┌──────────────────────────────────────────────────────────────────────────────────────┐
│ ⚠ REGION 1 · ALERTS — full width, stacked, dismissible only where dismissal is safe  │
│  ┌────────────────────────────────────────────────────────────────────────────────┐  │
│  │ ⓘ Setup 4 of 6 · You are not live yet. Next: upload Shop & Establishment  [Go] │  │
│  │ ⛔ Payout failed — batch STL-2026-W31, ₹1,28,446, bank rejected      [Details] │  │
│  │ ⚠ 3 refund requests waiting for you · oldest 2 days                  [Review] │  │
│  └────────────────────────────────────────────────────────────────────────────────┘  │
├──────────────────────────────────────────────────────────────────────────────────────┤
│ REGION 2 · TODAY — 5 tiles                          Updated 8 seconds ago ● [pause]  │
│ ┌──────────┬──────────┬──────────┬──────────┬────────────────────┐                   │
│ │ Check-ins│ Active   │ New      │ Revenue  │ ● IN THE GYM NOW   │  ← polled, 10–15s │
│ │   118    │  412     │    3     │ ₹18,400  │       27           │                   │
│ │ ▲12 vs   │ ▬ 0 vs   │ ▲2 vs    │ ▲₹4,200  │ Bandra 19 · Andh 8 │                   │
│ │ last Thu │ yesterday│ last Thu │ vs last  │                    │                   │
│ └──────────┴──────────┴──────────┴──────────┴────────────────────┘                   │
├───────────────────────────────────────────────┬──────────────────────────────────────┤
│ REGION 3 · ACTION LISTS (2/3 width)           │ REGION 4 · TREND (1/3)               │
│ ┌───────────────────────────────────────────┐ │ ┌──────────────────────────────────┐ │
│ │ [Expiring 7d · 14] [Balances · 6] [Risk·9]│ │ │ Revenue · last 30 days           │ │
│ │───────────────────────────────────────────│ │ │      ╱╲    ╱╲                    │ │
│ │ Priya Sharma   3 Mo Unltd  2 days  ₹5,000 │ │ │   ╱─╯  ╲──╯  ╲──╱╲               │ │
│ │   [Call] [WhatsApp] [Renew]               │ │ │ ┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈ prior period   │ │
│ │───────────────────────────────────────────│ │ │ ₹4,82,400  ▲ 11% vs prior 30d    │ │
│ │ Kiran Rao      Annual      4 days  ₹1,200 │ │ ├──────────────────────────────────┤ │
│ │   [Call] [WhatsApp] [Renew]               │ │ │ New members · last 30 days       │ │
│ │───────────────────────────────────────────│ │ │  ▁▂▅▃▂▇▅▃▂▁▃▅▂▁▂▃▅▇▅▃▂▁▂▃▅▂▁▃    │ │
│ │ … 12 more                    [See all →] │ │ │ 34  ▼ 6% vs prior 30d            │ │
│ └───────────────────────────────────────────┘ │ └──────────────────────────────────┘ │
├───────────────────────────────────────────────┴──────────────────────────────────────┤
│ REGION 5 · ACTIVITY — three columns          Recent check-ins updated 8 seconds ago  │
│ ┌───────────────────┬───────────────────────┬──────────────────────────────────────┐ │
│ │ Recent sales      │ Recent check-ins ●    │ Recent reviews                       │ │
│ │ 14:02 A. Nair     │ 14:11 Priya S. ✓      │ ★★★★☆ "Clean, good weights" 2h ago   │ │
│ │   Annual ₹15,000  │ 14:09 Kiran R. ✓      │   [Respond]                          │ │
│ │ 13:40 M. Iyer     │ 14:07 D. Bose ✗ frozen│ ★★☆☆☆ "AC broken again" 1d ago       │ │
│ │   1 Mo ₹2,000     │ 14:02 A. Nair ✓       │   [Respond] · unanswered 1 day       │ │
│ └───────────────────┴───────────────────────┴──────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────────────────────┘
```

At `md` (tablet): regions 3 and 4 stack; region 5 becomes a two-column then single-column list.
At `xs` (320 px): one column throughout; region 2's five tiles become a **2-2-1 grid**, with
*in-the-gym-now* full width at the bottom because it is the tile most often read at a glance; the
action-list tabs become a horizontally scrollable **tab strip** (the strip scrolls, the page does
not); each action row becomes a card with the three contact buttons at 44 × 44 px.

### 3.3 Region 1 — Alerts (`B7` region 1)

Alerts are **ordered by consequence**, not by recency. The order is fixed, not user-configurable,
because Rohan should not have to curate his own alarm list.

| # | Alert | Condition | Source | Action in place | Dismissible |
| :-: | :--- | :--- | :--- | :--- | :--- |
| 1 | **Tenant suspended** | `tenant.status = SUSPENDED` | `GET /v1/tenant` | Contact support with correlation id | No |
| 2 | **Onboarding checklist** | Not (`APPROVED` ∧ ≥1 `PUBLISHED` plan) — `FR-NAV-04` | `GET /v1/tenant/applications` `steps[]` + `missing[]` | Deep link to the **exact outstanding item** (`AC-ONB-01.1`) | No |
| 3 | **KYC / application status** | Status ∈ `SUBMITTED`, `UNDER_REVIEW`, `INFO_REQUESTED`, `REJECTED` | `GET /v1/tenant/applications` | `INFO_REQUESTED` → the targeted checklist; `REJECTED` → reasons mapped to fields (`FR-ONB-11`) | No |
| 4 | **Payout failure** | Any batch in `FAILED` (`FR-SETL-08`) | `GET /v1/tenant/settlements?status=FAILED` | Open the batch; show the bank's failure reason | No |
| 5 | **Payout held** | `payout_hold.active` (`BR-GYM-06`) | `GET /v1/tenant/payout-account` | Show `hold_until` and the reason category | No |
| 6 | **Subscription arrears** | `subscription.dunning_state ≠ CURRENT` (`BR-TEN-06`) | `GET /v1/tenant/subscription` | Pay now; state **what stops working and when** | No |
| 7 | **Refund requests pending** | Count of `refunds` in `PENDING` at this tenant | `GET /v1/tenant/refunds?status=PENDING` | Review — opens `SCR-DASH-015` filtered | No |
| 8 | **Unread reviews needing response** | Published reviews with no response, ordered oldest first (`FR-REV-05`) | `GET /v1/tenant/reviews?responded=false` | **Respond inline** — the compose box opens in the alert | Yes, per review |
| 9 | **Seat limit reached** | `seats.used = seats.limit` (`FR-STAF-06`) | `GET /v1/tenant/staff` `seats{}` | Upgrade path | Yes, 7 days |
| 10 | **Branch closure ending** | A declared closure ends within 24 h (`FR-GYM-10`) | `GET /v1/tenant/branches` | Extend or let it lapse | Yes |

**Alert rules.**

- An alert is **never** a bare count. *"3 refund requests"* is a count; *"3 refund requests waiting
  for you, oldest 2 days"* is a reason to act.
- Alerts 1–7 are **not dismissible**, because dismissing a payout failure does not fix it.
- An alert with **zero instances renders nothing**. No "all clear" rows — an empty alert region is
  itself the good news, and §3.8's empty state says so once.
- A region-1 query that fails **hides that alert and logs**; it never blocks regions 2–5
  (`NFR-AVL-03` in spirit: loss of a non-critical read must not prevent the screen from working).

### 3.4 Region 2 — Today (`B7` region 2)

| Tile | Figure | Comparison | Polled? | Source |
| :--- | :--- | :--- | :-: | :--- |
| Check-ins today | Count of `ALLOWED` visits, gym-day in `Asia/Kolkata` | Same weekday last week | ✔ | `GET /v1/tenant/attendance/live` |
| Active members | `memberships` in `ACTIVE` | Yesterday | ✔ | same |
| New members today | `crm_members` created today | Same weekday last week | ✔ | same |
| Revenue today | Sum of today's captured payments, **server-computed** | Same weekday last week | ✔ | same |
| **Currently in the gym** | Open visits with no `checked_out_at` | — (a live number has no comparison) | ✔ | same, with a **per-branch split** |

**Every one of these five carries the `<LastUpdatedIndicator/>`** — one indicator for the strip, not
five, because they arrive in one response with one `generated_at` (LC5). The indicator sits at the
strip's top-right and is `aria-live="polite"` so a screen-reader user hears freshness change without
being interrupted.

**Why same-weekday and not yesterday for check-ins.** A gym's Monday does not resemble its Sunday.
Comparing Thursday to Wednesday manufactures alarm. The comparison basis is **stated in the tile**,
never implied — *"▲12 vs last Thu"*.

**Currently-in-gym has an honesty requirement.** It depends on check-out being recorded, and
`FR-CHK-09` makes check-out **optional** with a configurable auto-checkout job. The tile therefore
carries a persistent footnote: *"Counts members who have not checked out. Auto-checkout runs at
23:00."* A number that silently over-counts is the fastest way to lose Rohan's trust in every other
number on the screen.

### 3.5 Region 3 — Action lists (`B7` region 3) — the two-tap guarantee

Three tabs. Each row acts **in place**. This is where `B2.1`'s *"nothing critical more than two taps
deep"* is either honoured or broken, and it is honoured: **tap the tab, tap the action**.

| Tab | Definition | Row content | Row actions |
| :--- | :--- | :--- | :--- |
| **Expiring in 7 days** | `GET /v1/tenant/members?expiring_within_days=7` — **already-renewed members are excluded** (`AC-MEMB-02.3`) | Name · plan · **days remaining** (server-computed, `BR-MEM-03`) · last visit · renewal value | **Call** (`tel:`) · **WhatsApp** (`https://wa.me/91…`, prefilled from a template) · **Renew** → opens `SCR-DASH-012` pre-filled for that member and plan (`AC-MEMB-02.2`: the new term starts the **day after** the current end date, with no gap) |
| **Outstanding balances** | Orders in `BALANCE_DUE` (`FR-CART-09`, `BR-PAY-09`) | Name · order ref · **amount due** · days outstanding · who took the original payment | **Collect** → `POST /v1/tenant/orders/:orderRef/collect-balance` in a drawer · **Call** · **Note** |
| **At risk** | `GET /v1/tenant/members?at_risk=true` (`FR-CRM-06`) | Name · **baseline visits/week** · **current visits/week** · last visit · plan end date | **Call** · **WhatsApp** · **Add note** · **Assign trainer** |

**The at-risk row states both numbers.** `AC-CRM-01.1` requires baseline, current frequency and last
visit — *"3.25/week → 0.5/week, last visit 19 days ago"*. *"At risk"* as a bare badge tells Rohan
nothing he can say on a phone call.

**Contact actions are honest about channel.** WhatsApp opens a chat; it does **not** claim delivery.
Anything that actually sends through the platform goes through `NOTF` and appears in the member's
`communications_sent[]` (`FR-CRM-03`) — the difference is stated in the button label
(`dash.home.action.whatsapp_open` vs `dash.home.action.send_reminder`).

**Bulk is available but never default.** A header checkbox enables `FR-CRM-07` bulk actions (send
notification, assign trainer, export). The confirmation states the **suppression outcome** because
`AC-CRM-01.2` requires it: *"Sending to 14 members. 2 will be suppressed — 1 opted out of
operational reminders, 1 is inside quiet hours until 08:00."*

### 3.6 Region 4 — Trend · Region 5 — Activity

| Region | Content | Rules |
| :--- | :--- | :--- |
| **4 · Trend** | Revenue over the last 30 days and new members over the last 30 days, **each with the prior 30 days as a dotted comparison series** (`B7` region 4) | The chart library is **dynamically imported** (FP3). Both series carry an accessible **table alternative** behind a disclosure — a line chart is not readable by a screen reader and `NFR-USE-01` does not exempt charts. Revenue is **server-aggregated**; the client sums nothing (BL2) |
| **5 · Activity** | Recent sales · recent check-ins · recent reviews (`B7` region 5) | **Recent check-ins is polled** (LC2) and carries the strip's own last-updated indicator. Denied check-ins appear in the strip with their reason — a denial Rohan can see is a renewal he can make. Reviews show rating, excerpt, age and **response state**, with respond inline |

### 3.7 The reduced variant — receptionist and trainer (`B7` permission row)

> *"Receptionists and trainers see a reduced version scoped to their branch and role."*

This is **not** the owner screen with tiles greyed out. It is a different composition, because
Sameer's question is not *"how is the business"* — it is *"what is happening at my desk right now"*.

| Region | `RECEPTIONIST` sees | `TRAINER` sees |
| :--- | :--- | :--- |
| 1 · Alerts | Branch closure today · members expiring today at **this branch** · outstanding balances at **this branch** | Assigned members expiring in 7 days · assigned members at risk |
| 2 · Today | Check-ins today (**this branch**) · currently in gym (**this branch**) · new members today (**this branch**). **No revenue tile** — `B3.2` gives `RECEPT` tenant reports at `▪` only | Check-ins today (**this branch**) · currently in gym. **No revenue, no member counts beyond assigned** |
| 3 · Actions | Expiring in 7 days (**this branch**) · outstanding balances (**this branch**) | Assigned members at risk · assigned members expiring |
| 4 · Trend | **Absent** | **Absent** |
| 5 · Activity | Recent check-ins (**this branch**) · recent sales **he recorded** | Recent check-ins by **assigned members** |
| Primary CTA | **Open the check-in desk** — full width, first thing on the screen at `md` and below | **Open the check-in desk** |

**Scoping is server-side.** The reduced variant is not a client-side filter over an owner payload:
the same endpoints return branch-scoped data because the caller's grants are branch-scoped, and a
request outside the assignment is **refused** (N3). If the client were filtering, the data would
have already crossed the boundary.

### 3.8 Data contract

| Query key | Endpoint | Stale-time class | Notes |
| :--- | :--- | :--- | :--- |
| `homeKeys.live()` | `GET /v1/tenant/attendance/live` | **live counters** — the `A-08` interval | The **only** polled key on this screen. `PRIVATE-30` cache token |
| `homeKeys.alerts()` | fan-out: `GET /v1/tenant`, `…/applications`, `…/settlements?status=FAILED`, `…/payout-account`, `…/subscription`, `…/refunds?status=PENDING`, `…/reviews?responded=false`, `…/staff`, `…/branches` | 60 s, refetch on window focus | **Nine independent queries, not one aggregate.** A failing subscription read must not remove the payout-failure alert |
| `homeKeys.expiring()` | `GET /v1/tenant/members?expiring_within_days=7` | 60 s | Default sort `full_name:asc` — **not `end_date`**, which is a mutable sort key and would skip rows under cursor pagination (`Gym.md` §14.1) |
| `homeKeys.balances()` | `GET /v1/tenant/orders?payment_status=BALANCE_DUE` | 60 s | Financial figures are never served stale beyond `FR-RPT-02`'s bound |
| `homeKeys.atRisk()` | `GET /v1/tenant/members?at_risk=true` | 5 min | `crm.risk-flags` recomputes nightly; a shorter stale time buys nothing |
| `homeKeys.trend(range)` | `GET /v1/tenant/reports/revenue-summary`, `…/new-members` | 15 min (`FR-RPT-02`) | Both dynamically imported with the chart |
| `homeKeys.activity()` | `GET /v1/tenant/orders?limit=5`, `…/reviews?limit=5` | 60 s | Check-ins come from `homeKeys.live()`, not a sixth query |

**Mutations available without leaving the screen:** respond to a review
(`POST /v1/tenant/reviews/:id/respond`), collect a balance
(`POST /v1/tenant/orders/:orderRef/collect-balance`), add a member note
(`POST /v1/tenant/members/:id/notes`), send a bulk notification. Each invalidates its own key **and**
`homeKeys.alerts()`, so an answered review leaves the alert list in the same interaction.

### 3.9 States

| State | Behaviour |
| :--- | :--- |
| **Loading** | Region skeletons **in the final layout**: three alert bars, five tiles, eight action rows, two chart placeholders with axes drawn, three activity columns. No spinner. The action-list **tabs are interactive immediately** and remember the last-used tab per user |
| **Empty — new tenant** | `B7` is explicit: *"New tenant → onboarding checklist occupies the full screen until submission."* Regions 2–5 are **not rendered at all**, not rendered empty. The checklist shows six steps, the completed ones ticked, and a direct link to each outstanding item (`AC-ONB-01.1`) |
| **Empty — approved but quiet** | Tenant is live and has zero members: tiles show `0` with the comparison suppressed (a comparison to zero is noise), and region 3 is replaced by a single card — *"No members yet. Add your first walk-in, or import your existing register."* with **Add member** and **Import CSV** (`FR-ONB-15`) |
| **Empty — nothing to do today** | Approved, has members, and all three action tabs are empty: region 3 renders *"Nothing needs you today. 14 memberships expire next week — we'll surface them here on Monday."* This is the one place a positive empty state is correct, and it still names the next event |
| **Error — one region** | The failing region shows an inline retry with its own message; **every other region renders normally**. Losing the trend chart must never cost Rohan the expiring list |
| **Error — the live poll** | Tiles keep their last values, the indicator switches to the failed state (§2.1), and a **Retry** appears on the indicator. The numbers are never blanked and never silently frozen |
| **Permission-denied — a region** | The region is **absent**, not shown as denied. A receptionist does not need to be told there is a revenue tile he cannot see; `FR-NAV-03`'s logic applies inside the screen as well as in the nav |
| **Permission-denied — an action** | If a row action is attempted and the server refuses (`403`), the row shows the server message inline with *"Ask an owner to do this"* and the owner's name from `GET /v1/tenant/staff` |
| **Tenant suspended** | Alert 1 replaces regions 2–5 with the informational state of §2.4 |

### 3.10 Accessibility and responsive specifics

- The five tiles are a `<ul>` of `<li>`, each an accessible group with the label, the figure, and the
  comparison as a single readable sentence: *"Check-ins today, 118, up 12 compared with last
  Thursday."* Reading three separate nodes gives a screen-reader user three orphaned numbers.
- The last-updated indicator is `aria-live="polite"`; the **poll itself never moves focus**.
- Action-list tabs are a WAI-ARIA `tablist` with arrow-key navigation; the active tab persists per
  user in URL state so a refresh returns to the same list.
- Charts are `role="img"` with a full `aria-label` summary **and** a `<table>` alternative behind
  *"View as table"* — which doubles as the `FR-RPT-05` drill-down entry point.
- At `xs`, `tel:` and WhatsApp buttons are 44 × 44 px and thumb-reachable at the row's right edge.

### 3.11 Acceptance

| `AC-` | Assertion on this screen |
| :--- | :--- |
| `AC-MEMB-02.1` | Memberships expiring within 7 days are listed with name, phone, plan, days remaining and a **one-tap contact action** |
| `AC-MEMB-02.3` | A member who already renewed is **excluded** from the expiring list |
| `AC-CRM-01.1` | The at-risk row shows baseline, current frequency and last visit date |
| `AC-CRM-01.2` | A bulk send reports how many were sent and how many suppressed, **with reasons** |
| `AC-ONB-01.1` | Mid-application, the checklist shows completed and outstanding items with a **direct link to each outstanding item** |
| `FR-NAV-04` | The onboarding checklist persists until `APPROVED` with ≥ 1 published plan |
| `LC5` | Every polled figure carries a last-updated indicator; the poll-failed state is explicit |
| `NFR-PERF-04` | Each region's list query returns ≤ 50 rows, p95 ≤ 800 ms |

---

## 4. `SCR-DASH-002` — Onboarding Wizard

| | |
| :--- | :--- |
| **Route** | `/onboarding` · KYC panel deep-links at `/gym/kyc` (`B4.2`) |
| **Feature** | `src/features/onboarding-wizard/` |
| **Persona** | Rohan, on his first evening with the product. `B2.1`: *"Onboarding must yield visible value in the first session."* |
| **Permission** | `onboarding.application.read` / `…submit`, `GYM_OWNER`. A `GYM_MANAGER` sees the **status panel read-only** and no step forms |
| **WCAG** | Level A minimum, AA target |
| **Live data** | No |
| **Budget** | Each step's read ≤ 800 ms; a KYC upload is `202` with async processing, so the UI never blocks on a scan |

### 4.1 Purpose and the resumability contract

Six steps — **Business → KYC → Gym → Plans → Payout → Review & Submit** (`B7`, `FR-ONB-02`…
`FR-ONB-07`). `FR-ONB-01`: *"partial state persists indefinitely."*

**There is no wizard endpoint** (`Gym.md` §5.1). The wizard is a client-side sequence over ordinary
resource endpoints, which is exactly what makes it resumable: **state lives in rows, not in a step
pointer**. Progress is **server-computed** and read from `GET /v1/tenant/applications`, which returns
`steps[]` with a boolean and a `missing[]` per step.

> A client that stored *"you are on step 4"* would be wrong the moment Rohan opened the dashboard on
> his laptop after starting on his phone. `AC-ONB-01.1` requires *"a direct link to each outstanding
> item"* — which needs the **missing items**, not a step number. FM4 forbids local storage as
> persistence for exactly this reason.

### 4.2 Layout at `lg`

*illustrative — not committed code*

```text
┌───────────────────────────────────────────────────────────────────────────────────┐
│  Get your gym live                                     Application v2 · UNDER_REVIEW│
├──────────────────────────┬────────────────────────────────────────────────────────┤
│ STEP RAIL (sticky)       │  STEP BODY                                             │
│                          │                                                        │
│ ✓ 1 Business             │  Step 2 · KYC documents            3 of 7 required done │
│ ● 2 KYC        3/7       │  ┌──────────────────────────────────────────────────┐  │
│ ✓ 3 Gym                  │  │ PAN (entity or proprietor)      ✓ ACCEPTED       │  │
│ ✓ 4 Plans                │  │ GSTIN                Conditional  ✓ ACCEPTED     │  │
│ ○ 5 Payout      missing  │  │ Business registration           ✓ ACCEPTED       │  │
│ ○ 6 Review & submit      │  │ Shop & Establishment  Required  ⬆ Upload         │  │
│                          │  │ Bank account proof    Required  ⏳ UNDER_REVIEW   │  │
│ ─────────────────────────│  │ Owner identity        Required  ⛔ REJECTED       │  │
│ STATUS PANEL             │  │    Reason: illegible scan · re-upload            │  │
│ UNDER_REVIEW since       │  │ Premises address proof Required ⬆ Upload         │  │
│ 03 Aug 2026              │  │ Trade licence         Conditional ⬆ Upload       │  │
│ Typical decision: 2 days │  │ Fire safety NOC       Conditional ⬆ Upload       │  │
│                          │  │ Music licence (PPL)   Advisory   ⬆ Upload        │  │
│ Locked while under review│  └──────────────────────────────────────────────────┘  │
│ · legal name             │                                                        │
│ · registered address     │  [ Back ]                              [ Save & next ] │
│ · branch address & pin   │                                                        │
│ · bank account           │                                                        │
│ Editable meanwhile:      │                                                        │
│ photos, description,     │                                                        │
│ amenities, hours, plans  │                                                        │
└──────────────────────────┴────────────────────────────────────────────────────────┘
```

At `md` the rail becomes a horizontal stepper above the body. At `xs` the rail collapses to
*"Step 2 of 6 · KYC"* with a disclosure listing all six and their completion, so **any step remains
one tap away** (`B7`: *"any step is revisitable"*).

### 4.3 The six steps

| Step | `FR-` | Fields | Endpoints (`Gym.md` §5.1) | Server-computed completion predicate |
| :-: | :--- | :--- | :--- | :--- |
| 1 · Business | `FR-ONB-02` | Legal entity name, trading name, entity type (`SOLE_PROPRIETOR` / `PARTNERSHIP` / `COMPANY` / `OTHER`), registration identifier, **PAN**, registered address (line 1, line 2, city, state, **6-digit PIN**), business contact (**+91, 10 digits starting 6–9**), business email | `POST /v1/tenants` then `PATCH /v1/tenant` | `legal_name`, `entity_type`, registered address and business contact present; **`pan` present for `country_code = 'IN'`** |
| 2 · KYC | `FR-ONB-03` | The **ten-document India checklist** — §4.4 | `POST` / `DELETE` / `GET /v1/tenant/kyc-documents` | Every **mandatory** checklist row has a document in `PENDING`, `UNDER_REVIEW` or `ACCEPTED` |
| 3 · Gym | `FR-ONB-04` | Display name, description, category, amenities (**platform taxonomy only** — `FR-GYM-03`), **≥ 3 and ≤ 30 photographs**, operating hours per weekday with **multiple windows** and dated exceptions, gender policy, address, **map pin with drag-to-adjust** | `POST`/`PATCH /v1/tenant/gyms`, `POST /v1/tenant/gyms/:id/media`, `POST /v1/tenant/branches`, `PUT /v1/tenant/branches/:id/hours` | ≥ 1 gym; **≥ 3 photographs**; ≥ 1 branch with a resolvable location; ≥ 1 hours row; `gender_policy` set |
| 4 · Plans | `FR-ONB-05` | At least one plan, created through the same editor as `SCR-DASH-006` — **not a cut-down copy** | `POST /v1/tenant/plans`, `POST /v1/tenant/plans/:id/publish` | **≥ 1 plan in `PUBLISHED`** |
| 5 · Payout | `FR-ONB-06` | Account holder name, account number, **IFSC** (`^[A-Z]{4}0[A-Z0-9]{6}$`), plus **explicit confirmation of the refund policy** | `PUT /v1/tenant/payout-account`, `PUT /v1/tenant/settings` | A payout row exists **and** the refund policy has been explicitly confirmed |
| 6 · Review & submit | `FR-ONB-07` | Read-only summary of steps 1–5 with an **edit link per section**, terms acceptance | `GET /v1/tenant/applications` then `POST /v1/tenant/applications` | Terms accepted in the submit body |

**Per-step validation, not per-form-submit** (`B7`: *"validation is per-step"*). Each step saves
independently; a half-finished step 3 does not block editing step 5. The **Save & next** button
disables while its mutation is in flight and carries an `Idempotency-Key` (FM6) — a double-tapped
*Create tenant* on a slow connection must not produce two tenants.

### 4.4 Step 2 in full — the India KYC checklist (ten documents)

From `LAUNCH_MARKET_INDIA.md` §6, served as configuration through `config/kyc` (`FR-ADMN-06`) and
**never hardcoded in the client**. The client renders the checklist the server returns; the list
below is what that configuration currently contains for `IN`.

| # | Document | Requirement | Field-level UI |
| :-: | :--- | :--- | :--- |
| 1 | **PAN** (entity or proprietor) | Always mandatory | Format hint `AAAAA9999A`; client-side shape check as **usability**, server validates as the control (FM3) |
| 2 | **GSTIN** | Conditional — above the registration threshold | 15 characters; the form explains **when it is not required** rather than leaving the owner guessing |
| 3 | **Business registration proof** | Mandatory | The accepted document **varies by `entity_type`** chosen in step 1: Certificate of Incorporation · Partnership Deed · Udyam/MSME certificate. The label changes with the entity type, so the owner is never asked for a document their entity cannot have |
| 4 | **Shop & Establishment registration** | Mandatory | **State-specific**, issued municipally — the helper text names the state from the registered address |
| 5 | **Bank account proof** | Mandatory | Cancelled cheque or statement **showing the account name**; the requirement is stated because a name mismatch is rejection reason 4 |
| 6 | **Owner identity** | Mandatory | PAN **+ one of** Passport / Driving Licence / Voter ID. **Aadhaar is not offered by default** — `LAUNCH_MARKET_INDIA.md` records PAN plus a non-Aadhaar document as the position pending legal sign-off, and the UI must not invite what the platform would rather not hold |
| 7 | **Address proof of premises** | Mandatory | Utility bill or rent agreement; feeds the `BR-GYM-08` geo-match |
| 8 | **Trade licence** (municipal) | Conditional — city-dependent | Shown with *"required in some cities"* and the reviewer's ability to request it later |
| 9 | **Fire safety NOC** | Conditional — floor-area threshold | As above |
| 10 | **Music licence** (PPL / IPRS) | **Advisory, never blocking** | Rendered in a separate *"Good to have"* group so it cannot be mistaken for a gate |

**Per-document UI contract.**

| Aspect | Behaviour |
| :--- | :--- |
| Upload | `POST /v1/tenant/kyc-documents` returns **`202`** — the file is accepted and processed asynchronously. The row moves to `PENDING` with a progress affordance, and the wizard **stays usable**; the owner is never held at a spinner |
| Preview | Inline preview via a **short-lived signed URL issued per access, each access logged** (`BR-DAT-07`). The client never caches the document bytes and the response is `NO-STORE!` |
| Validation | Format and size validated client-side for usability, server-side as the control. A rejected format states the accepted formats and the size cap — never *"invalid file"* |
| States per row | `MISSING` · `PENDING` · `UNDER_REVIEW` · `ACCEPTED` · `REJECTED` (with the reason and a re-upload action). **A rejected document is marked `REJECTED`, not deleted** (reason code 2) |
| Delete | `DELETE /v1/tenant/kyc-documents/:id`, permitted only while unsubmitted. Confirmation states which checklist row becomes incomplete |
| Privacy | `BR-DAT-06` — no document content, no PAN, no account number reaches a log, a trace or an analytics event. The analytics event for this step carries `document_type` and nothing else |

### 4.5 The status panel — five states, each with its own screen

`B7` names the states; `FR-ONB-09` requires status to be **visible at all times**. The panel is a
region of the wizard, not a separate page, so status and the fix are never one navigation apart.

| Status | Panel content | What happens to the step forms |
| :--- | :--- | :--- |
| **`DRAFT`** | *"Not submitted yet."* Progress `4 of 6`. The single next action is the **first incomplete step** | All six editable |
| **`SUBMITTED`** | *"Submitted 03 Aug 2026. Typically decided within 2 working days."* Version number shown | **Material fields locked** (§4.6). Non-material fields stay editable with a banner naming what the reviewer will and will not see |
| **`UNDER_REVIEW`** | As `SUBMITTED`, plus *"A verification officer is looking at your application now."* | As `SUBMITTED` |
| **`INFO_REQUESTED`** | `FR-ONB-10` — a **targeted checklist** of exactly what the reviewer asked for, each item a deep link to the field or document. Reviewer's note verbatim. A **Resubmit** button that is disabled until every requested item is addressed | The requested material fields **reopen**; everything else stays locked |
| **`REJECTED`** | `FR-ONB-11` — every cited reason code with its **corrective action**, mapped to the specific field or document (§4.7). Free text if given. Full **resubmission history** with versions | **Everything reopens** |
| **`APPROVED`** | The wizard is **replaced** by a success state: *"You are live."* Plus next steps — share your listing, invite staff, add your first member, run your first check-in — which is `FR-ONB-14`'s activation checklist continuing past approval | Wizard retired; editing moves to `SCR-DASH-003` |
| **`SUSPENDED`** | The tenant-suspended state of §2.4 | All locked |

### 4.6 The snapshot lock, stated in the UI (`FR-ONB-08`)

Submission locks `applications.snapshot` — **and nothing else**. The tenant's live rows stay
writable. The dashboard must make this legible or the owner will believe the whole product froze.

| Panel line | Text |
| :--- | :--- |
| Locked while under review | *"Legal name · registered address · entity type · registration number · branch address and map pin · ownership · bank account. Changing these now would mean the reviewer is deciding about something that no longer exists."* |
| Editable meanwhile | *"Photographs, captions and order · description · amenities · operating hours · plan prices and publishing · members · staff · leads · notes."* |
| The consequence, stated | *"Edits you make now are live for your customers but **will not reach this reviewer**. They will be reviewed with your next submission."* |

An attempt to change a locked field is `409 APPLICATION_ALREADY_SUBMITTED`; the UI renders the
server message plus the locked snapshot's submitted value, so the owner can see what the reviewer is
looking at.

### 4.7 Rejection reasons mapped to fields (`FR-ONB-11`, `AC-ONB-01.2`)

The sixteen reason codes are **data, not error codes** (`Gym.md` §4) carried in a `200` from
`GET /v1/tenant/applications`. The taxonomy is an **open enum** — an unknown code renders the
server-supplied `label` and its `target`. Each code arrives with a `target` shape that tells the
client exactly what to focus.

| `target.kind` | Client behaviour |
| :--- | :--- |
| `KYC` | Jump to step 2, **pre-select the named `document_type`** or highlight the named `document_id`, and open the re-upload control |
| `BRANCH` | Jump to step 3, focus the branch, and for `GEO_ADDRESS_MISMATCH` open the map with the pin active — the message states **measured 840 m against a 250 m tolerance**, never *"invalid location"* |
| `GYM` | Jump to step 3. `INSUFFICIENT_PHOTOS` states **both counts** — *"2 of 3 required"* (`NFR-USE-06`) |
| `MEDIA` | Jump to step 3 with the **named `media_ids` highlighted** in the gallery |
| `FIELD` | Resolve the **dotted path** (`gym.description`) and focus that control |
| `PLAN` | Jump to step 4 |
| `PAYOUT_ACCOUNT` | Jump to step 5. The message names the **mismatch category, never the name the bank returned** |
| `NONE` | `SUSPECTED_FRAUD` and `OTHER`. For `SUSPECTED_FRAUD` the message is **deliberately non-specific** and the UI must not embellish it with guesses; the only action is contact support. For `OTHER`, `reviewer_notes` is mandatory server-side and is rendered verbatim |

### 4.8 Submission and the pre-checks (`FR-ONB-12`)

`POST /v1/tenant/applications` runs six pre-checks **synchronously inside the submission
transaction**. Only one blocks.

| Check | Blocking? | UI |
| :--- | :--- | :--- |
| Address-to-geo distance (`BR-GYM-08`) | **Yes** — `422 GEO_ADDRESS_MISMATCH` | Submission is refused and the map opens with the pin active, stating **measured distance and tolerance**. Letting this through would guarantee a rejection round trip for a defect fixable in one drag |
| Duplicate approved address · duplicate registration identifier · duplicate bank account · image quality · profanity screening | No | **Not surfaced as owner-facing failures.** They are reviewer signals; showing them as warnings would make the platform the judge of ambiguous evidence, which `BR-GYM-03` reserves for a human |

### 4.9 States

| State | Behaviour |
| :--- | :--- |
| **Loading** | The rail renders with six steps and skeleton completion marks; the status panel renders its frame. The step body skeletons the form's actual field layout |
| **Empty** | A tenant with no application row: step 1 opens directly with a one-sentence orientation — *"Six steps. You can stop and come back; nothing is lost."* This addresses `B2.1`'s fear of complexity in the first sentence the owner reads |
| **Error** | A step save failure keeps every entered value, maps `details[]` onto fields (FM5), and offers retry. **A KYC upload failure never loses the other nine rows** |
| **Permission-denied** | A `GYM_MANAGER` opening `/onboarding` sees the **status panel read-only** with *"Only an owner can complete verification. Ask ⟨owner name⟩."* — the name resolved from `GET /v1/tenant/staff` |
| **`INFO_REQUESTED`** | Targeted checklist, per §4.5 |
| **`REJECTED`** | Reasons mapped to fields, per §4.7 |
| **`APPROVED`** | Wizard replaced by the success state and next steps |
| **Offline** | Uploads queue is **not** offered. An upload that cannot start says so; a KYC document silently held in a browser is a document the platform does not have |

### 4.10 Accessibility, responsive and acceptance

- The rail is a `<nav>` with an ordered list; the current step carries `aria-current="step"`.
  Completion is conveyed by **text and icon**, never colour alone (AX9).
- Each step body is a `<form>` with a single `<h2>`; server field errors set `aria-invalid` and
  `aria-describedby`, and focus moves to the **first** invalid field on a failed save.
- Uploads are reachable by keyboard: the drop zone is a `<button>` that opens the file picker; drag
  and drop is an enhancement, never the only path (`NFR-USE-02`).
- At `xs` the ten-row KYC checklist is a card list; each card is a 44 px-minimum tap target.

| `AC-` | Assertion |
| :--- | :--- |
| `AC-ONB-01.1` | Mid-application, the checklist shows completed and outstanding items with a direct link to each outstanding item |
| `AC-ONB-01.2` | On rejection, each cited reason names the specific field or document **and** the corrective action |
| `AC-ONB-01.3` | On resubmission the application returns to the queue marked as a resubmission; the owner sees the version history |
| `FR-ONB-01` | Progress persists indefinitely and any step is revisitable |
| `FR-ONB-08` | Locked and editable field sets are stated in the UI while `SUBMITTED` / `UNDER_REVIEW` |
| `FM4` | Wizard state is server-persisted; **local storage is not persistence** |

---

## 5. `SCR-DASH-003` — Gym Profile

| | |
| :--- | :--- |
| **Route** | `/gym/profile` |
| **Feature** | `src/features/gym-profile/` |
| **Persona** | Rohan, editing his shopfront |
| **Permission** | `catalog.gym.read` to view · `catalog.gym.update` to edit (`GYM_OWNER` ●, `GYM_MANAGER` `▪`) |
| **WCAG** | Level A minimum, AA target |
| **Live data** | No |
| **Budget** | Read p95 ≤ 800 ms; a media upload is `202` and never blocks the form |

### 5.1 Purpose

The tenant's public identity (`FR-GYM-01`…`FR-GYM-06`). The screen's hardest requirement is
`FR-GYM-11`: *"Material field changes route to review per `BR-GYM-06`; **the UI states this before
the change is saved**."* That sentence is why this screen has a classification mechanism instead of
a save button.

### 5.2 Layout at `lg`

*illustrative — not committed code*

```text
┌──────────────────────────────────────────────────────────────────────────────────┐
│  Iron Temple Fitness · Bandra West         APPROVED   [ View as customer ↗ ]     │
│  ⚠ 2 changes on this page will send your listing back for review                 │
├───────────────────────────────┬──────────────────────────────────────────────────┤
│ SECTION NAV (sticky)          │  BASICS                                          │
│  ● Basics                     │   Display name  [Iron Temple Fitness         ]   │
│    Photos            12       │   Slug          iron-temple-fitness  🔒 immutable │
│    Amenities         18       │   Category      [Strength & Conditioning  ▾]     │
│    Hours & exceptions         │   Established   [2019]                           │
│    Gender policy              │   Description   [ rich text, sanitised ……… ]     │
│    Location & map      ⚠      │                 1,240 / 3,000                    │
│    Contact & social           │   Contact       [+91 98201 34567] [hi@iron.in]   │
│                               │   Website       [https://…]  Instagram [@…]      │
│  ─────────────────────────    │                                                  │
│  Legal & registration    ⚠    │  ⚠ = changing this field sends the listing back  │
│  (in Settings)                │      for review. Your gym stays visible.         │
│                               │                                                  │
│                               │                      [ Discard ]  [ Save ]       │
└───────────────────────────────┴──────────────────────────────────────────────────┘
```

At `md` the section nav becomes a horizontal scrolling tab strip. At `xs` sections become an
accordion, one open at a time, with the save bar pinned to the bottom of the viewport.

### 5.3 Sections

| Section | Fields | `FR-` | Change class |
| :--- | :--- | :--- | :--- |
| **Basics** | Display name, slug (read-only after approval), category, established year, description (rich text, **sanitised server-side**) | `FR-GYM-01` | Non-material — publishes immediately, subject to content screening (`BR-GYM-07`) |
| **Photos** | Gallery with **drag-ordering**, **cover selection**, captions. Min 3, max 30. Renditions and **EXIF stripping** happen server-side | `FR-GYM-02` | Non-material, subject to media moderation |
| **Amenities** | Multi-select from the **platform taxonomy**. Free text is **not offered** — it breaks filtering (`FR-GYM-03`, `NFR-DQ-06`) | `FR-GYM-03` | Non-material |
| **Hours & exceptions** | Per weekday, **multiple windows per day**, plus dated exceptions (holidays, maintenance) | `FR-GYM-04` | Non-material, immediate |
| **Gender policy** | Mixed · women-only · men-only · **scheduled** (specific hours reserved) | `FR-GYM-05` | Non-material. It is a **policy, not an identity claim**; members are notified (`FR-NOTF-01`) |
| **Location & map** | Address lines, city, state, **6-digit PIN**, **map pin with drag-to-adjust**, landmark, parking notes | `FR-GYM-06` | **Address and pin are MATERIAL.** Landmark and parking notes are not |
| **Contact & social** | Phone `+91`, email, website, social links | `FR-GYM-01` | Non-material |

**Slug is immutable after approval** and the field says so with the reason: *"Your web address is
fixed so links and search results keep working"* (`FR-NAV-05`).

### 5.4 `FR-GYM-11` in the interface — marking before saving

Two server mechanisms, both mandatory (`Gym.md` §6.3), and the UI uses **both**.

**Mechanism 1 — the advisory map.** Every representation that can be `PATCH`ed carries
`field_change_classes` alongside the data:

```jsonc
// illustrative — not committed code — an excerpt of GET /v1/tenant/gyms/:id
"field_change_classes": {
  "name": "IMMEDIATE", "description": "IMMEDIATE", "amenity_ids": "IMMEDIATE",
  "gender_policy": "IMMEDIATE", "slug": "IMMUTABLE",
  "legal_name": "REQUIRES_REVIEW", "registered_address_line1": "REQUIRES_REVIEW"
}
```

The UI renders **from this map, never from a client-side constant**:

| Class | Rendering |
| :--- | :--- |
| `IMMEDIATE` | No marker |
| `IMMUTABLE` | Lock icon, field disabled, reason stated |
| `REQUIRES_REVIEW` | A **⚠ marker on the field label from first render**, before the field is touched. Touching it adds a live inline note: *"Changing your legal name sends your listing back for review. Your gym stays visible, your sales continue, and check-in is unaffected."* |

A page-level banner counts the pending material changes: *"2 changes on this page will send your
listing back for review."* The count updates as fields change, so the consequence is visible while
the owner is still deciding — which is what *"before the change is saved"* means.

**Mechanism 2 — the acknowledgement on the write.** A `PATCH` touching a `REQUIRES_REVIEW` field
without `"acknowledge_review": true` is refused with `422 APPLICATION_PRECHECK_OVERRIDE_REQUIRED`,
whose `details` enumerate the material fields detected. The **Save** button therefore opens a
confirmation that lists exactly those fields and states all four consequences:

> **Send listing back for review?**
> You changed: **registered address**, **map pin**.
> · Your gym **stays visible** on the marketplace and your detail page stays live.
> · Customers keep seeing your **last approved** address until a reviewer approves the change.
> · **Sales, check-in, settlement and payouts continue** unaffected.
> · A reviewer typically decides within 2 working days.
> **[ Cancel ]  [ Save and send for review ]** *(focus defaults to Cancel)*

The client-side dialog is presentation; the `acknowledge_review` flag is the control (`FR-RBAC-02`).

### 5.5 Preview — "View as customer"

`B7`: *"'View as customer' opens the live marketplace rendering."* It opens the **actual customer
detail page** in a new tab at `/gyms/:citySlug/:gymSlug`, not a dashboard-side mock. While material
changes are pending, the preview carries a banner naming which values the public currently sees
(the **last approved** ones) versus which are awaiting review — because `Gym.md` §6.2 guarantees
*"there is no window in which a member sees an unreviewed legal name or an unreviewed address"*, and
an owner who does not understand that will re-save in a panic.

### 5.6 Data and mutations

| Action | Endpoint | Idem | Invalidates |
| :--- | :--- | :--- | :--- |
| Read | `GET /v1/tenant/gyms`, `GET /v1/tenant/gyms/:id` | — | — |
| Edit | `PATCH /v1/tenant/gyms/:id` | REQ | `gymKeys.detail(id)`, `homeKeys.alerts()` |
| Add photo | `POST /v1/tenant/gyms/:id/media` → **`202`** | REQ | `gymKeys.media(id)` |
| Reorder / cover / caption | `PATCH /v1/tenant/gyms/:id/media` | REQ | `gymKeys.media(id)` |
| Delete photo | `DELETE /v1/tenant/gyms/:id/media/:mediaId` | REQ | `gymKeys.media(id)` |
| Amenities | `POST /v1/tenant/gyms/:id/amenities` | REQ | `gymKeys.detail(id)` |

**Photo ordering is optimistic; nothing else is.** DQ6 permits optimistic updates only where the
outcome is deterministic and rollback is safe — dragging a thumbnail qualifies; a material field
change does not.

### 5.7 States

| State | Behaviour |
| :--- | :--- |
| **Loading** | Section nav renders immediately with counts skeletoned; the basics form skeletons its real field layout. The **"View as customer"** link is live before the form finishes loading |
| **Empty** | No gym yet (pre-onboarding): the screen redirects into `SCR-DASH-002` step 3 with an explanation, not a blank form — profile editing before a gym exists is a state the owner should never be in |
| **Empty — photos** | Fewer than 3 photographs: *"You need at least 3 photographs to go live. You have 2."* with an upload CTA. Both counts, always (`NFR-USE-06`) |
| **Error** | A failed save keeps every value and maps `details[]` onto fields. A failed **media** upload marks that one tile as failed with retry, leaving the other eleven intact |
| **Permission-denied** | A `GYM_MANAGER` at `▪` sees editable Basics/Photos/Amenities/Hours for **their** gyms and the Location section read-only with *"Only an owner can change the address. Ask ⟨owner⟩."*. A `RECEPTIONIST` deep-linking here gets the full-screen permission-denied state from the `403` |
| **Application locked** | While `SUBMITTED`/`UNDER_REVIEW`, material fields are **disabled with the lock reason** and the banner from §4.6 appears at the top |
| **Content screening pending** | A description or photo awaiting moderation shows a **pending badge** with *"visible to you, not yet public"* — never silently withheld |

### 5.8 Accessibility, responsive, acceptance

- The ⚠ marker is **text plus icon** (`aria-describedby` pointing at the consequence note), never
  colour alone (AX9).
- The map pin is keyboard-adjustable: arrow keys nudge, `Shift`+arrow moves coarsely, and the
  **measured distance from the geocoded address is announced** after each adjustment — this is the
  control that keeps `BR-GYM-08` from becoming a mouse-only requirement.
- Drag-ordering has a **keyboard alternative**: each thumbnail exposes *"Move left / Move right /
  Make cover"* actions. Drag is an enhancement.
- The rich-text editor exposes its toolbar to keyboard and does not trap `Tab`.

| `AC-` / `FR-` | Assertion |
| :--- | :--- |
| `FR-GYM-11` | Material fields are marked **before** saving and the save confirmation states the consequence |
| `AC-GYM-02.1` | A declared closure with reason is visible to members — declared here or on `SCR-DASH-004` |
| `BR-GYM-02` | Deleting below 3 photographs is refused with both counts |
| `FR-GYM-03` | No free-text amenity input exists anywhere on the screen |

---

## 6. `SCR-DASH-004` — Branches

| | |
| :--- | :--- |
| **Route** | `/gym/branches` · detail at `/gym/branches/:id` |
| **Feature** | `src/features/branches/` |
| **Persona** | Rohan with two branches; managers see only their assigned branches |
| **Permission** | `catalog.branch.list` / `…read` · create and deactivate are **`GYM_OWNER` only** (`B3.2`: *"Add / remove branch"* is `●` for owner, `—` for manager) |
| **WCAG** | Level A minimum, AA target |
| **Live data** | **Today's check-ins per branch** comes from `useLiveCounters()`'s per-branch split — the same single poll, not a new one |
| **Budget** | List p95 ≤ 800 ms |

### 6.1 Layout

*illustrative — not committed code*

```text
┌────────────────────────────────────────────────────────────────────────────────┐
│  Branches (2)                          Updated 11 seconds ago ●   [+ Add branch]│
├────────────────────────────────────────────────────────────────────────────────┤
│ ┌────────────────────────────────────┐  ┌───────────────────────────────────┐  │
│ │ Bandra West              ACTIVE    │  │ Andheri East            ACTIVE    │  │
│ │ 14 Linking Rd, Mumbai 400050       │  │ Chakala, Mumbai 400099            │  │
│ │ Members 294 · In gym now 19        │  │ Members 118 · In gym now 8        │  │
│ │ Check-ins today 76                 │  │ Check-ins today 42                │  │
│ │ Open 06:00–22:00 · closes in 7h    │  │ ⚠ Closed today — Independence Day │  │
│ │ Staff 4 · Capacity 120             │  │ Staff 2 · Capacity 80             │  │
│ │ [Open] [Hours] [Close temporarily] │  │ [Open] [Hours] [End closure]      │  │
│ └────────────────────────────────────┘  └───────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────────────────┘
```

### 6.2 Content

| Region | Content | `FR-` |
| :--- | :--- | :--- |
| **List** | Per branch: name, **status**, address, **member count**, **today's check-ins**, currently-in-gym, open/closed right now with the next transition, staff count, capacity | `FR-GYM-07`, `FR-GYM-09` |
| **Detail** | Own address and map pin · **own hours with multiple windows and dated exceptions** · own photos · assigned staff with roles · capacity · temporary-closure history | `FR-GYM-04`, `FR-GYM-07`, `FR-GYM-09` |
| **Create** | Name, address, PIN, map pin, hours, capacity. Owner only | `FR-GYM-07` |
| **Temporary closure** | Reason, date range. Declaring it **notifies affected members automatically**; beyond the configured consecutive-day threshold the gym is **temporarily demoted in search** and the UI says so before confirming | `FR-GYM-10`, `AC-GYM-02.3` |
| **Deactivate** | Soft deactivation with the §2.7 confirmation | `FR-GYM-07` |

### 6.3 Data and mutations

| Action | Endpoint | Notes |
| :--- | :--- | :--- |
| List | `GET /v1/tenant/branches` | Branch-scoped: a manager's list contains their branches; a request for another is **refused**, not filtered (N3) |
| Detail | `GET /v1/tenant/branches/:id` | |
| Create | `POST /v1/tenant/branches` | REQ. Owner only |
| Edit / declare closure | `PATCH /v1/tenant/branches/:id` | REQ. **Address, city, state, PIN and map pin are MATERIAL** — the §5.4 acknowledgement flow applies identically here, including the `state_code` note: changing it **changes place of supply for every future invoice at that branch** |
| Replace hours | `PUT /v1/tenant/branches/:id/hours` | REQ. Full replacement of weekly hours **and** dated exceptions — the editor therefore always submits the complete set, never a delta |
| Deactivate | `DELETE /v1/tenant/branches/:id` | REQ, soft |

### 6.4 The hours editor

Operating hours are load-bearing: `BR-CHK-05` denies check-in outside them, and a mistake here
turns into `OUTSIDE_OPERATING_HOURS` denials at the desk tomorrow morning.

- Per weekday, **multiple windows** (06:00–11:00, 16:00–22:00). Overlapping windows on one day are
  refused inline with both windows named.
- **Dated exceptions** are a separate list: date, reason, and either *closed all day* or replacement
  windows. An exception produces `GYM_CLOSED_EXCEPTION` at the desk — **a different denial from
  `OUTSIDE_OPERATING_HOURS`** — and the editor says so, because the reason a member is turned away
  should be the reason that is true (`BR-CHK-05-N1`).
- Times are entered and displayed in **`Asia/Kolkata`**, stated on the editor. A 24-hour plan's
  bypass of hours (`FR-CHK-04` step 7) is noted where a 24-hour plan exists.
- A **preview strip** shows the resulting week as members will see it, before saving.

### 6.5 States

| State | Behaviour |
| :--- | :--- |
| **Loading** | Two card skeletons at the real card height; counts skeletoned individually so the live figures can arrive after the static ones |
| **Empty** | No branches (pre-onboarding): *"A gym needs at least one branch — that's the place people walk into."* with **Add branch**, and a link back to step 3 of the wizard |
| **Error** | Card-level: a branch whose counters fail renders the card with counters replaced by *"Couldn't load today's figures. Retry"* — the address and hours still render |
| **Permission-denied** | A manager sees their branches and **no Add branch button**; a deep link to another branch renders the branch-refused state of §2.4 naming their assignment. A receptionist gets the full permission-denied state |
| **Closed today** | The card shows the **exception reason and reopening time**, not a generic "closed" |
| **Deactivated** | Deactivated branches move to a collapsed *"Inactive (1)"* group; they are never deleted from the list, because attendance and orders reference them |

### 6.6 Acceptance

| `AC-` | Assertion |
| :--- | :--- |
| `AC-GYM-01.1` | With two active branches, plan creation offers **all branches or specific branches** — the branch set this screen maintains is what `SCR-DASH-006` consumes |
| `AC-GYM-02.1` | A declared closure with reason is visible to members |
| `AC-GYM-02.3` | A closure beyond the threshold warns, **before confirming**, that members will be notified and the listing temporarily demoted |
| `FR-GYM-07` | Create, edit, activate, deactivate; each branch has its own address, hours, photos, staff and capacity |

---

## 7. `SCR-DASH-005` — Plan Catalogue

| | |
| :--- | :--- |
| **Route** | `/plans` |
| **Feature** | `src/features/plans/` |
| **Persona** | Rohan deciding what to sell |
| **Permission** | `plans.plan.list` to view. **Create / edit / publish / archive / duplicate are `GYM_OWNER` only**; `GYM_MANAGER` is `○` read-only (`B3.2`, `Gym.md` §13.2) |
| **WCAG** | Level A minimum, AA target |
| **Live data** | No |
| **Budget** | ≤ 50 rows per page, p95 ≤ 800 ms (`NFR-PERF-04`) |

### 7.1 Layout

*illustrative — not committed code*

```text
┌───────────────────────────────────────────────────────────────────────────────────────┐
│ Plans (7)   [ All ▾ ][ Published ▾ ][ Branch: All ▾ ][ □ On promotion ]  [+ New plan] │
├──┬──────────────────────┬──────────┬──────────┬──────────┬─────────┬────────┬────────┤
│⠿ │ Name                 │ Type     │ Term     │ Price    │ Promo   │Branches│ Active │
├──┼──────────────────────┼──────────┼──────────┼──────────┼─────────┼────────┼────────┤
│⠿ │ Annual Unlimited     │ Duration │ 12 months│ ₹15,000  │ ₹12,000 │ All    │  412   │
│  │ PUBLISHED · PUBLIC   │          │          │          │ to 30Sep│        │  [⋯]   │
│⠿ │ 3 Month Unlimited    │ Duration │  3 months│ ₹5,000   │    —    │ All    │  186   │
│  │ PUBLISHED · PUBLIC   │          │          │          │         │        │  [⋯]   │
│⠿ │ Corporate — Wipro    │ Duration │ 12 months│ ₹9,000   │    —    │ Bandra │   34   │
│  │ PUBLISHED · STAFF    │          │          │          │         │        │  [⋯]   │
│⠿ │ 12-Session PT Pack   │ Session  │ 12 · 90d │ ₹9,600   │    —    │ All    │   21   │
│  │ DRAFT                │          │          │          │         │        │  [⋯]   │
│⠿ │ Monsoon Trial 2025   │ Duration │  1 month │ ₹1,500   │    —    │ All    │    0   │
│  │ ARCHIVED             │          │          │          │         │        │  [⋯]   │
└──┴──────────────────────┴──────────┴──────────┴──────────┴─────────┴────────┴────────┘
```

### 7.2 Columns and actions

| Column | Source | Notes |
| :--- | :--- | :--- |
| Order handle | `sort_order` | Drag to reorder; `FR-PLAN-04` gives the owner control of catalogue order. **Keyboard alternative required** — each row exposes *Move up / Move down* |
| Name | `name` | |
| Type | `plan_type` | `DURATION` \| `SESSION` — a **closed** enum |
| Term | `duration_value` + `duration_unit`, or `session_count` + `session_validity_days` | *"12 sessions · valid 90 days"* |
| Price | `price_minor` + `currency` | `₹15,000` — formatted by the one formatter (M-UI-2) |
| Promotional price | `promotion.promo_price_minor` with its window | Shows **the end date**, because a promotion is a window that reverts by itself — **no job writes the list price back** (`AC-PLAN-01.1`) |
| Branches | `branch_scope.mode` | `ALL_BRANCHES` renders as **"All"**; a subset lists the names |
| Visibility | `visibility` | `PUBLIC` \| `STAFF_ONLY`. A `STAFF_ONLY` plan is **sellable at the desk and invisible on the marketplace** — the badge says exactly that on hover/focus |
| Status | `status` | `DRAFT` \| `PUBLISHED` \| `ARCHIVED` |
| Active memberships | `active_membership_count` | **The figure that makes §2.7's archive confirmation answerable in one screen** |
| Sold (30 d) | `sold_last_30_days` | |
| Actions `[⋯]` | — | Edit · Duplicate · Publish / Unpublish · Archive · Feature |

**Filters** map one-to-one onto the endpoint's parameters: `status` (repeatable), `visibility`,
`plan_type`, `branch_id`, `has_active_promotion`. **Sort allowlist:** `sort_order:asc` (default),
`name`, `created_at:desc`, `price_minor`. A typo'd filter is `400 UNKNOWN_QUERY_PARAMETER` naming the
typo — the UI renders it as an inline filter error, never as an empty result, because silently
returning an unfiltered list to someone who believes they are looking at one segment is a defect.

### 7.3 Actions, guards and idempotency

| Action | Endpoint | Guard |
| :--- | :--- | :--- |
| Create | `POST /v1/tenant/plans` → **`DRAFT`** | Owner only. Opens `SCR-DASH-006` |
| Edit | `PATCH /v1/tenant/plans/:id` | Owner only. `plan_type` is **immutable** and the editor renders it as fixed text with the reason |
| Publish | `POST /v1/tenant/plans/:id/publish` | Owner only. `403 TENANT_NOT_APPROVED` renders as *"You're not approved yet — finish verification first"* with a deep link to the missing item. Publishing a `STAFF_ONLY` plan is legal and the response says `"public_visibility": false` — the UI reflects it rather than implying marketplace exposure |
| Unpublish | `PATCH` back to `DRAFT` | Confirmation states the marketplace consequence and that existing memberships are unaffected |
| Archive | `POST /v1/tenant/plans/:id/archive` | **Two-phase**: preview then commit — §8.6 |
| Duplicate | `POST /v1/tenant/plans/:id/duplicate` → **`201 DRAFT`** | The **only route back from `ARCHIVED`**. The UI says so on an archived row: *"Archived plans are never un-archived — duplicate it to sell it again."* |
| Reorder | `PATCH` `sort_order` | Optimistic (DQ6-safe), reverted on failure |

Every write carries an `Idempotency-Key` and disables its control while in flight (FM6).

### 7.4 States

| State | Behaviour |
| :--- | :--- |
| **Loading** | Five row skeletons at the real row height; filters interactive immediately |
| **Empty — no plans** | *"Nothing to sell yet. A plan is what a member buys."* with **Create your first plan** and a one-line explanation of `DURATION` vs `SESSION`. Not a bare "No plans" |
| **Empty — filters excluded everything** | Names **the most restrictive filter** and offers one-tap relaxation with the resulting count previewed: *"No plans match Status: Draft + Branch: Andheri East. Clearing the branch filter shows 4."* |
| **Error** | Table-level retry; filters keep their values; the last successful result stays on screen behind the retry affordance |
| **Permission-denied** | A `GYM_MANAGER` sees the table **read-only** — no New plan, no `[⋯]` write actions, and a one-line note: *"You can see plans. Only an owner can change them."* A `RECEPTIONIST` deep-linking to `/plans` gets the full permission-denied state **from the server 403**, which is `AC-STAF-01.2` |
| **Archived rows** | Rendered dimmed, in a collapsed *"Archived (2)"* group, with **Duplicate** as the only write action |
| **Not approved yet** | The table renders; **Publish** is present but explains its precondition rather than being silently disabled |

### 7.5 Accessibility, responsive, acceptance

- The table is a real `<table>` with `<caption>`, `<th scope="col">` and a `aria-sort` on the active
  sort column. At `xs` it becomes a **card list**, never a horizontally scrolled table (L7).
- Drag-reordering announces the new position through a live region; the keyboard path is equivalent.
- Status and visibility are **text badges**, not colour swatches (AX9).

| `FR-`/`AC-` | Assertion |
| :--- | :--- |
| `FR-PLAN-04` | Owner controls catalogue order; publish and unpublish are available from the list |
| `FR-PLAN-05` | Archiving retains existing memberships — stated on the row and in the confirmation |
| `FR-PLAN-06` | Duplicate produces an editable `DRAFT` copy |
| `AC-STAF-01.2` | A receptionist reaching `/plans/:id` by direct URL is refused **server-side**, and the screen renders that refusal |

---

## 8. `SCR-DASH-006` — Plan Editor

| | |
| :--- | :--- |
| **Route** | `/plans/:id` (and `/plans/new`) |
| **Feature** | `src/features/plans/` |
| **Persona** | Rohan pricing his product |
| **Permission** | `plans.plan.update` / `plans.plan.create` — **`GYM_OWNER` only** |
| **WCAG** | Level A minimum, AA target |
| **Live data** | No |
| **Budget** | Preview re-renders locally from the server's `marketplace_preview` on save; no keystroke-level round trip |

### 8.1 Layout — form left, live marketplace card right

`B7`: *"Live marketplace card preview beside the form."*

*illustrative — not committed code*

```text
┌──────────────────────────────────────────────┬────────────────────────────────────┐
│ FORM (2/3)                                   │ PREVIEW (1/3, sticky)              │
│                                              │                                    │
│ ▸ Basics                                     │  How members will see this         │
│    Name        [Annual Unlimited          ]  │  ┌──────────────────────────────┐  │
│    Type        Duration  🔒 cannot change    │  │  Annual Unlimited            │  │
│    Duration    [12] [Months ▾]               │  │  12 months                   │  │
│    Description [ ……………………………… ]              │  │                              │  │
│ ▸ Pricing                                    │  │  ₹12,000   ~~₹15,000~~       │  │
│    Price       ₹ [15,000]      ⚠ confirm     │  │  Monsoon offer · ends 30 Sep │  │
│    Joining fee ₹ [0]                         │  │                              │  │
│ ▸ Promotion                                  │  │  ✓ Freeze allowed            │  │
│    Promo price ₹ [12,000]                    │  │  ✓ All branches              │  │
│    From [01 Aug 2026] To [30 Sep 2026]       │  │                              │  │
│    Label   [Monsoon offer]                   │  │            [ Join ]          │  │
│ ▸ Eligibility                                │  └──────────────────────────────┘  │
│    Min age [16]   Gender [Any ▾]             │                                    │
│ ▸ Access                                     │  Rendered by the same projection   │
│    Branches  (•) All  ( ) Specific…          │  code the public API uses.         │
│    Access windows  [+ Add window]            │                                    │
│ ▸ Policies                                   │  ⚠ STAFF_ONLY plans have no        │
│    ☑ Freeze allowed  max [30] days           │     marketplace card.              │
│    ☐ Transfer allowed   ☐ Stackable          │                                    │
│ ▸ Visibility                                 │                                    │
│    (•) Public   ( ) Staff only               │                                    │
│                                              │                                    │
│ [ Archive ]              [ Discard ] [ Save ]│                                    │
└──────────────────────────────────────────────┴────────────────────────────────────┘
```

At `md` the preview moves **above** the form and collapses to a summary card that expands on tap —
it must stay reachable, because the preview is the point of the screen. At `xs` the groups become an
accordion with the preview pinned as a collapsed bar at the top.

### 8.2 Field groups (`FR-PLAN-01` attributes, grouped per `B7`)

| Group | Fields | Rules |
| :--- | :--- | :--- |
| **Basics** | Name (2–120), `plan_type` (**immutable after creation**), duration value + unit (`DAY`/`WEEK`/`MONTH`/`YEAR`) **or** session count + validity days, description (≤ 3000) | The type is a **discriminated union** server-side: a `SESSION` plan with a `duration_unit` is *unrepresentable*, not merely rejected. The form renders one branch or the other, never both |
| **Pricing** | `price_minor`, `joining_fee_minor` | Entered in **rupees**, submitted as **integer paise as a string**. The input shows `₹` as a prefix adornment and groups with lakh-crore separators as the owner types. **A float, a formatted string or a JSON number is `400 VALIDATION_FAILED`** |
| **Promotion** | `promo_price_minor`, `starts_at`, `ends_at`, `label` (≤ 60) | **One active promotion per plan** (`BR-PLN-07`), enforced by a database exclusion constraint. An overlap is `422 PROMOTION_OVERLAPS_EXISTING` and the UI renders the **named conflicting promotion with its dates** — *"'Monsoon offer' already runs 1 Aug – 30 Sep"* — because an owner told only *"overlapping promotion"* cannot find it in a catalogue of forty plans |
| **Eligibility** | `min_age`, `gender_eligibility` (`ANY`/`FEMALE`/`MALE`) | |
| **Access** | `branch_ids` (**absent or empty = ALL branches**), `access_windows` (≤ 21, weekday + from/to) | The response echoes `branch_scope: { mode: "ALL_BRANCHES", resolved_branch_ids: [...] }`, and the confirmation uses **those words**: *"Removing the last branch makes this plan valid at **all** branches, including branches you add later."* Removing the last branch is a **widening, not a narrowing**, and the UI must not let that read as a restriction |
| **Policies** | `freeze_allowed` + `freeze_max_days`, `transfer_allowed`, `stackable` | `freeze_max_days` with `freeze_allowed: false` is `422 CONFIG_VALIDATION_FAILED`; the form disables the day count until the toggle is on |
| **Visibility** | `PUBLIC` \| `STAFF_ONLY` | Orthogonal to `status`. The preview panel states the consequence for `STAFF_ONLY`: no marketplace card exists |

**Absent by design** from every request this form sends: `status` (always `DRAFT` at creation),
`tenant_id`, `slug`, and **any `_bps` field** — commission is never client-supplied (M5).

### 8.3 The live preview

`FR-PLAN-07` requires a preview of *"exactly how the plan will appear on the marketplace before
publishing"*. The preview is **not** a dashboard reimplementation of the customer card:
`GET /v1/tenant/plans/:id` returns `marketplace_preview.card`, **rendered by the same projection
code the public API uses**, so a preview that differs from the live card is a bug with one cause
rather than two implementations.

| Case | Preview |
| :--- | :--- |
| `PUBLISHED`, `PUBLIC` | The live card |
| `DRAFT`, `PUBLIC` | `available: true` with `is_preview_of_unpublished: true` — the card renders with a **"Not published yet"** ribbon, because previewing before publishing is the point |
| `STAFF_ONLY` | `available: false`, `preview_unavailable_reason: "STAFF_ONLY"` — the panel explains rather than showing an empty box |
| Unsaved edits | The panel shows the **last saved** card with a note: *"Preview updates when you save."* An invented client-side card would be the second implementation `FR-PLAN-07` exists to prevent |

### 8.4 The price-change confirmation (`FR-PLAN-08`, `BR-PLN-02`)

A `PATCH` that changes `price_minor`, `joining_fee_minor` or `promotion.promo_price_minor`
**without `confirm_price_change: true`** is refused with `422 PLAN_PRICE_CONFIRMATION_REQUIRED`, and
`details` carries the **real, transaction-computed** affected count. The UI renders the server
message:

> **Change the price of Annual Unlimited?**
> This plan is priced at **₹15,000**. Changing it to **₹12,000** affects **new purchases only** —
> the **412 members** who already bought this plan keep their purchased price until their membership
> ends.
> **[ Cancel ]  [ Confirm price change ]** *(focus defaults to Cancel)*

Three properties of this dialog are contractual, not stylistic:

1. **The count comes from the server**, inside the transaction. `BR-PLN-02`'s assurance is worthless
   if the number of people it is about is unknown or stale.
2. **The confirmation is a server-enforced flag, not a dialogue.** `FR-RBAC-02` and `AC-STAF-01.2`
   make client-side confirmation presentation only. A script that skips the dialog still gets `422`.
3. **The sentence names the protection, not just the risk.** Rohan's fear is that changing a price
   re-bills 412 people. The dialog answers that fear in its first clause.

### 8.5 Publish

`POST /v1/tenant/plans/:id/publish`. Failure modes rendered inline, each with the next action:

| Error | Rendering |
| :--- | :--- |
| `403 TENANT_NOT_APPROVED` | *"You're not live yet. Finish verification — you're missing your Shop & Establishment document."* with the deep link |
| `422 CONFIG_VALIDATION_FAILED` | *"This plan's gym has no active branch. Add or reactivate a branch first."* |
| `409` already published | The button reconciles to **Unpublish** rather than showing an error; a second publish is a state conflict, and the correct UI response is to show the true state |
| `422 PLAN_ARCHIVED` | *"Archived plans cannot be published. Duplicate it to create an editable copy."* |

### 8.6 The archive confirmation — `NFR-USE-06` in action

`POST /v1/tenant/plans/:id/archive` is **two-phase within one contract**. The UI calls the preview
first, always.

| Phase | Call | UI |
| :--- | :--- | :--- |
| Preview | `{ "confirm": false }` → `200`, **nothing is written** | Renders every returned figure |
| Commit | `{ "confirm": true }` → `200` | The same `affected` block is echoed as a record of what was true at the moment of archiving |

> **Archive Annual Unlimited?**
> · **412 active memberships** and **7 pending memberships** keep their terms. The earliest ends
> **19 Aug 2026**; the latest ends **05 Aug 2027**.
> · **2 orders are mid-checkout** against this plan right now. They may fail at payment.
> · The plan is **removed from sale** and **blocked in new orders** immediately.
> · **Archived plans are never un-archived.** To sell it again, duplicate it.
> **[ Cancel ]  [ Archive plan ]**

Every bullet is a returned `effects[]` value or an `affected{}` figure. None is computed on the
client, and none is generic.

### 8.7 States

| State | Behaviour |
| :--- | :--- |
| **Loading** | Form group skeletons in the real layout; the preview panel skeletons a card of the real dimensions so nothing shifts |
| **Empty** | `/plans/new` opens with defaults: type unselected (the one required first choice), visibility `PUBLIC`, `sort_order` last. The preview shows an outline card explaining what will fill it |
| **Error** | Field errors land on fields (FM5). `422 PROMOTION_OVERLAPS_EXISTING` renders on the promotion date fields **with the conflicting promotion named and a link to it** |
| **Permission-denied** | A `GYM_MANAGER` reaching `/plans/:id` sees a **read-only** rendering of every group plus the preview, and the banner *"Only an owner can change plans."* — this is `B3.2`'s `○` made literal. A receptionist gets the full-screen denial from the `403` |
| **Archived plan** | Every control disabled with the reason; **Duplicate** is the only action |
| **Price confirmation pending** | The dialog of §8.4, blocking only that save |
| **Unsaved changes** | Navigating away prompts, naming the sections with changes — not a generic "unsaved changes" |

### 8.8 Accessibility and acceptance

- Money inputs are `inputmode="numeric"` with the `₹` as a **decorative adornment outside the
  value**, so a screen reader reads *"Price, rupees, 15000"* and not a symbol.
- Each group is a `<fieldset>` with a `<legend>`; the immutable type field is `aria-disabled` with a
  visible reason, not silently greyed.
- Both confirmations are alert dialogs with focus trapped, focus defaulting to **Cancel**, and
  `Escape` cancelling.

| `FR-`/`AC-` | Assertion |
| :--- | :--- |
| `FR-PLAN-07` | The preview is rendered from the server's projection, not a second implementation |
| `FR-PLAN-08` | A price change requires explicit confirmation stating existing memberships are unaffected, with a real count |
| `FR-PLAN-05` / `NFR-USE-06` | Archive states the affected active-membership count before committing |
| `BR-PLN-07` | An overlapping promotion is refused and the conflicting promotion is **named** |

---

## 9. `SCR-DASH-007` — Member List

| | |
| :--- | :--- |
| **Route** | `/members` · walk-in creation at `/members/new` |
| **Feature** | `src/features/members/` |
| **Persona** | Rohan segmenting; **Sameer looking someone up mid-conversation** |
| **Permission** | `crm.member.list`. `RECEPTIONIST` and `TRAINER` at `▪` — **own/assigned records, at assigned branches** |
| **WCAG** | Level A minimum, AA target |
| **Live data** | No |
| **Budget** | **50 rows per page with virtualised scrolling** (`B7`, FP5), p95 ≤ 800 ms (`NFR-PERF-04`) |

### 9.1 Layout

*illustrative — not committed code*

```text
┌──────────────────────────────────────────────────────────────────────────────────────┐
│ 🔍 [ Name, phone, email or member code…            ]   412 members  [+ Add walk-in]  │
│ Segments: (Expiring 7d · 14) (No visit 21d · 38) (Joined this month · 22) (At risk·9)│
│ Filters: [Status ▾][Plan ▾][Branch ▾][Expiry ▾][Joined ▾][Trainer ▾]  [Export CSV ↓] │
├─┬────────────────┬─────────┬─────────────┬────────┬───────────┬────────┬────────────┤
│□│ Member         │ Code    │ Phone       │ Status │ Plan      │ Expiry │ Last visit │
├─┼────────────────┼─────────┼─────────────┼────────┼───────────┼────────┼────────────┤
│□│ Priya Sharma   │ IT-00412│+91 98201… 📋│ ACTIVE │ 3 Mo Unltd│ 30 Nov │ Today 07:12│
│□│ Kiran Rao      │ IT-00388│+91 99450… 📋│ EXPIRING│Annual    │ 10 Aug │ 2 days ago │
│□│ Devdatta Bose  │ IT-00341│+91 90040… 📋│ FROZEN │ Annual    │ 12 Feb │ 19 days ago│
│□│ Anjali Nair    │ IT-00297│+91 88790… 📋│ EXPIRED│ 1 Mo      │ 04 Jul │ 33 days ago│
│ │ … virtualised, 50 per page                                        [ Load more ]   │
├─┴────────────────────────────────────────────────────────────────────────────────────┤
│ 3 selected  →  [ Send notification ] [ Assign trainer ] [ Export selected ]          │
└──────────────────────────────────────────────────────────────────────────────────────┘
```

### 9.2 Search, filters and segments

| Control | Endpoint parameter | Notes |
| :--- | :--- | :--- |
| Search | `q` (2–80) | **One field** searches name, phone, email and member code — `B2.3`: *"Member lookup by phone number is one field."* Debounced 250 ms; the field is **focused on load** |
| Status | `status` repeated: `ACTIVE`, `EXPIRING`, `EXPIRED`, `FROZEN`, `NEVER_ACTIVE` | Closed enum — the UI offers exactly five |
| Plan / branch / trainer | `plan_id`, `branch_id`, `assigned_trainer_staff_id` | Repeatable |
| Expiry window | `expiring_within_days` (1–90) | Presets 7 / 15 / 30 plus a custom value |
| Joined | `joined_from` / `joined_to`, `YYYY-MM-DD` in `Asia/Kolkata` | **Two named parameters with inclusivity in the name** — never a bracket syntax |
| Inactivity | `no_visit_since_days` (1–365) | |
| At risk | `at_risk` boolean | `FR-CRM-06` |
| Saved segment | `segment_id` | `FR-CRM-02`. **A saved definition re-evaluated on read, never a materialised list** — the UI says *"14 members match right now"*, never *"14 members saved"* |

**Sort allowlist:** `full_name:asc` (default), `created_at:desc`, `member_code:asc`. **`end_date` is
deliberately absent** — a freeze extends an end date mid-scroll (`BR-MEM-05`) and a cursor over a
mutable sort key skips or repeats rows. The expiring view is served by `expiring_within_days` with
the stable default sort, and the UI offers no "sort by expiry" control at all rather than offering
one that silently loses rows.

### 9.3 Rows

Each row renders `id`, `member_code`, `full_name`, `phone`, `email`, `status`, `current_membership`
(plan, `end_date`, **`days_remaining` server-computed in the gym's timezone**), `last_visit_at`,
`risk` (`{ flagged, baseline_per_week, current_per_week }`), `assigned_trainer` and `branch`.

- **Phone has a copy affordance** and a `tel:` action inline. Sameer reads phone numbers aloud all
  day; making him open a detail page to see one is the difference between a two-second and a
  twenty-second interaction.
- `days_remaining` is **read, never derived** (BL4). A client computing it from `end_date` gets
  freezes and the +05:30 boundary wrong.
- The at-risk badge shows **both frequencies on hover/focus**, matching `AC-CRM-01.1`.
- Row density is compact; the **hit target is padded to 44 px** even where the visual row is shorter
  (`NFR-USE-03`).

### 9.4 Bulk actions and export (`FR-CRM-07`, `FR-CRM-08`)

| Action | Behaviour |
| :--- | :--- |
| Send notification | Confirmation states the **suppression outcome** before sending, and the result reports sent and suppressed **with reasons** (`AC-CRM-01.2`) |
| Assign trainer | Single mutation, invalidates the list and each member detail |
| Export CSV | `POST /v1/tenant/exports` → **`202`**. Above the size threshold it is asynchronous, delivered by notification with a **time-limited link** (`FR-RPT-03`). The UI says which path it took rather than appearing to hang |
| Import CSV | `POST /v1/tenant/members/import` → **`202`**, with column mapping, **dry-run validation**, per-row error reporting and idempotent re-run (`FR-ONB-15`). Progress polls `GET /v1/tenant/members/import/:jobId` |

**Export is deliberately obvious.** `B2.1`: *"Export must be obvious, not hidden."* Rohan's fear of
lock-in is answered by a button in the toolbar, not by a support article.

### 9.5 States

| State | Behaviour |
| :--- | :--- |
| **Loading** | Ten row skeletons at compact height. **The search field is interactive immediately** and is never blocked by the table |
| **Empty — no members** | *"No members yet. Add your first walk-in, or import your register from a spreadsheet."* with both actions. This is the state a new tenant sees, and it is the one that decides whether Rohan's existing 400 members ever enter the system |
| **Empty — filters** | Names the most restrictive filter with a **previewed relaxation count**: *"No members match Status: Frozen + Branch: Andheri East. Clearing Status shows 118."* |
| **Empty — search** | *"Nothing matches 'sharm'. Search covers name, phone, email and member code."* — stating the search scope prevents the assumption that the person is absent |
| **Error** | Table retry; the last successful page stays visible; filters and search retain their values |
| **Permission-denied** | A `TRAINER` sees only assigned members with a persistent note: *"Showing your 24 assigned members."* Requesting an unassigned member is **refused**, not filtered. A branch-scoped request outside assignment renders the branch-refused state of §2.4 |
| **Partial data** | A `TRAINER`'s member detail arrives **without** payment, invoice and refund blocks — a **distinct read grant, not a redaction flag**. The UI shows the sections that exist and does not render locked placeholders for the ones that do not |

### 9.6 Accessibility and acceptance

- Virtualised rows keep a correct `aria-rowcount` and `aria-rowindex`, so a screen-reader user hears
  *"row 12 of 412"* and not *"row 12 of 50"*.
- Selection checkboxes have per-row accessible names (*"Select Priya Sharma"*), and the bulk bar is
  announced when it appears.
- The segment chips are a `tablist`; the active segment is reflected in URL state.

| `FR-`/`AC-` | Assertion |
| :--- | :--- |
| `FR-CRM-01` | Search by name, phone, email and member code; filters by status, plan, branch, expiry window, join date, attendance frequency, trainer |
| `FR-CRM-02` | Saved segments available as presets, re-evaluated on read |
| `FR-CRM-07` | Bulk notify / assign / export on a filtered list |
| `AC-CRM-01.2` | Bulk send reports sent and suppressed counts with reasons |
| `FP5` | 50 rows with virtualised scrolling |

---

## 10. `SCR-DASH-008` — Member 360

| | |
| :--- | :--- |
| **Route** | `/members/:id` |
| **Feature** | `src/features/members/` |
| **Persona** | Sameer answering *"when does my membership end"* **instantly**; Rohan deciding whether to intervene |
| **Permission** | `crm.member.read`. `RECEPTIONIST` `▪` (own-created, assigned branches) · `TRAINER` `▪` (assigned members, **no financial blocks**) |
| **WCAG** | Level A minimum, AA target |
| **Live data** | No |
| **Budget** | p95 ≤ 800 ms; attendance history is **paged behind a cursor**, not loaded whole |

### 10.1 Layout

*illustrative — not committed code*

```text
┌───────────────────────────────────────────────────────────────────────────────────┐
│ ┌────┐ Priya Sharma                    IT-00412   ACTIVE                          │
│ │ 📷 │ +91 98201 34567 📋 · priya@…    Joined 12 Feb 2024 · Bandra West           │
│ └────┘ Trainer: Rakesh M.                                                         │
│ [Renew] [Collect balance] [Freeze] [Add note] [Message] [Assign trainer] [Refund] │
├──────────────────────────────────────┬────────────────────────────────────────────┤
│ MEMBERSHIPS                          │ ATTENDANCE                                 │
│ ┌──────────────────────────────────┐ │  Visits/week, last 8 weeks                 │
│ │ 3 Month Unlimited     ACTIVE     │ │   ▅▆▅▇▆▃▂▁   baseline 3.25 → now 0.5 ⚠     │
│ │ 01 Sep – 30 Nov 2026             │ │  Last visit  Today 07:12 · Bandra West     │
│ │ 118 days remaining               │ │  Total 84 visits · 12 this month           │
│ │ All branches · freeze 0/30 used  │ │  [ Full history → ]                        │
│ │ [Renew] [Freeze] [Upgrade] [⋯]   │ ├────────────────────────────────────────────┤
│ ├──────────────────────────────────┤ │ NOTES (3)                     [+ Add note] │
│ │ Annual Unlimited     EXPIRED     │ │  05 Aug · Sameer — "Asked about PT pack"   │
│ │ 01 Sep 2025 – 31 Aug 2026        │ │  12 Jul · Rohan — "Shoulder injury" 🔒     │
│ └──────────────────────────────────┘ ├────────────────────────────────────────────┤
├──────────────────────────────────────┤ COMMUNICATIONS SENT (8)                    │
│ PAYMENTS & INVOICES                  │  03 Aug SMS  Renewal reminder T−7  ✓       │
│ 01 Sep ORD-2026-000148 ₹4,720 PAID   │  27 Jul Email Renewal reminder T−15 ✓      │
│   INV-2026-00291 [PDF ↓]             │  19 Jul SMS  Review request        ✗ opted │
│ 01 Sep 2025 ORD-2025-000902 ₹15,000  │                                     out    │
│   INV-2025-00744 [PDF ↓]             │ REFUNDS (0)                                │
│ Outstanding: ₹0                      │                                            │
└──────────────────────────────────────┴────────────────────────────────────────────┘
```

### 10.2 The seven regions (`B7`)

| # | Region | Content | `FR-` |
| :-: | :--- | :--- | :--- |
| 1 | **Identity header** | Photo, name, member code, phone with copy and `tel:`, email, status, join date, home branch, assigned trainer | `FR-CRM-03` |
| 2 | **Memberships** | Current **and historical**, each with plan, term, **days or sessions remaining (server-computed)**, branch entitlement, freeze days used against the cap, and actions | `FR-CRM-03`, `FR-MEMB-03` |
| 3 | **Payments & invoices** | Order references, totals, payment status, invoice numbers with **PDF download**, and the outstanding balance | `FR-CRM-03`, `FR-INV-08` |
| 4 | **Attendance** | Last visit, total visits, this-month count, and a **frequency trend** with the risk baseline overlaid | `FR-CRM-03`, `FR-CRM-06` |
| 5 | **Notes** | Timestamped, attributed, **never visible to the member**. Sensitive-category notes carry a marker and are **excluded from every export** unless the requester holds the elevated permission | `FR-CRM-05`, `NFR-PRV-07` |
| 6 | **Communications sent** | Every message with channel, template, timestamp and **delivery outcome including suppression reason** | `FR-CRM-03`, `FR-NOTF-04` |
| 7 | **Trainer assignment** | Current trainer with reassignment | `FR-CRM-03`, `FR-STAF-07` |

### 10.3 Actions

| Action | Endpoint | Guard / consequence |
| :--- | :--- | :--- |
| **Edit** | `PATCH /v1/tenant/members/:id` | **`member_code` is not editable after creation** — it is printed on cards and quoted at the desk. The field renders as fixed text with that reason. `user_id`, `risk_flagged_at` and `merged_into_id` are likewise not editable; the risk flag **clears automatically on check-in** (`AC-CRM-01.3`), not by hand |
| **Renew** | Opens `SCR-DASH-012` pre-filled | `FR-MEMB-06`: same plan at **current** price, new term starting the **day after** the current end date — or **today** if already expired. The date field shows the computed start and why |
| **Collect balance** | `POST /v1/tenant/orders/:orderRef/collect-balance` | Accepts `amount_received_minor` — **a record of cash, not a price** |
| **Freeze** | Membership freeze | Offered **only if the plan allows it** (`AC-MEMB-01.5`: *"no freeze action is offered at all"*). Shows **days used against the cap**; exhausting it states used and cap (`AC-MEMB-01.4`). **Never optimistic** — a member must never see "frozen" before the server agrees (DQ6) |
| **Upgrade** | Pro-rata credit for the unused remainder; **downgrade is scheduled for the next term** (`BR-MEM-09`) | The computed credit is **server-supplied and rendered**, never calculated here |
| **Add note** | `POST /v1/tenant/members/:id/notes` | Author from the token, never the body. Editable by the author **until `editable_until`**, immutable after, and **there is no delete** — a note that can be removed after the fact is not a record. The composer states this before the first save |
| **Message** | Notification send | Respects preferences and quiet hours; the outcome lands in region 6 |
| **Assign trainer** | `PATCH` | |
| **Request refund** | `POST /v1/tenant/refunds` | Opens the §17 flow with the policy, usage and computed amount |
| **Transfer** | `POST /v1/tenant/memberships/:id/transfer` | Only where the plan permits (`BR-MEM-08`); requires approval and is fully audited |

**`FR-MEMB-12` is a design constraint, not a note:** *"The gym's member view shows the same
membership state as the member's view, always. There is no separate gym-side status concept."* This
screen renders `membership.status` verbatim. It does not derive a friendlier label, and it does not
invent a "lapsing" state that the member's own app does not show.

### 10.4 States

| State | Behaviour |
| :--- | :--- |
| **Loading** | Header renders first with name and status as soon as they arrive; the six panels skeleton independently. **Sameer's question — "when does my membership end" — is answered by the header and region 2, so those two render first by design** |
| **Empty — no memberships** | A member who never bought: region 2 shows *"No membership yet"* with **Sell a plan** opening `SCR-DASH-012` pre-filled |
| **Empty — no attendance** | *"No visits recorded. If they train here, check them in at the desk."* with a link to `SCR-DASH-009` |
| **Empty — no notes** | *"No notes. Notes are internal — members never see them."* Stating the privacy property is what makes staff use the feature |
| **Error** | Panel-level. A failed payments read never removes the attendance panel |
| **Permission-denied** | A `TRAINER` receives the profile **without** payment, invoice and refund blocks. Those regions are **absent**, not shown locked. A `RECEPTIONIST` viewing a member they did not create at a branch they are not assigned to is **refused** with the specific `403` — ownership predicate or branch predicate, each with its own message |
| **Frozen membership** | Region 2 shows the frozen notice with **until-date** and an unfreeze action; `AC-MEMB-01.3` — unfreezing early recalculates the extension to the **actual** frozen days, and the panel states the new end date after the server returns it |
| **Refunded membership** | Historical view only; attendance records are **retained** and shown, with the refund reason |
| **Merged member** | `merged_into_id` present: a banner links to the surviving record |

### 10.5 Privacy and acceptance

`BR-DAT-06` shapes this screen: the 360 is a UI-facing aggregate, and **none of it may reach a log,
a trace or an analytics event**. The analytics event for this screen carries the member's
**pseudonymous id and nothing else** — no name, no phone, no email, no note text.

| `FR-`/`AC-` | Assertion |
| :--- | :--- |
| `FR-CRM-03` | All seven regions present for a permitted viewer |
| `FR-CRM-05` | Notes are attributed, timestamped, never member-visible, and have no delete path |
| `AC-MEMB-01.4` | An exhausted freeze allowance states days used and the cap |
| `AC-MEMB-01.5` | A plan that disallows freezing offers **no freeze action at all** |
| `AC-MEMB-02.2` | Renewal from here starts the day after the current end date without a gap |
| `FR-MEMB-12` | The status shown here is identical to the member's own view |

---

## 11. `SCR-DASH-009` — Check-in Desk

| | |
| :--- | :--- |
| **Route** | `/checkin` |
| **Feature** | `src/features/checkin-desk/` |
| **Persona** | **Sameer** (`B2.3`) — 12:00 to 21:00, a queue of ten, under two seconds each |
| **Permission** | `attendance.checkin.record` (`RECEPTIONIST`, `TRAINER`, `GYM_MANAGER`, `GYM_OWNER`) · **`attendance.checkin.override` is a distinct permission** and a `TRAINER` does not hold it |
| **WCAG** | **Level AA — a merge gate, not an aspiration** (`NFR-USE-01`, AX1) |
| **Live data** | **Yes** — the recent-check-ins strip only (LC2). **The confirmation itself is never polled** (LC7) |
| **Budget** | **`NFR-PERF-03`: p95 ≤ 2 s scan → confirmation, client-observed.** 500 check-ins/minute platform-wide without degradation (`NFR-PERF-08`) |

### 11.1 Purpose, and the one sentence that governs every decision below

`B7`: *"A single always-on surface optimised for speed at the counter."* `B2.3`: Sameer needs *"to
check someone in during a queue in under two seconds"*.

**Design for the queue, not for the scan.** The screen's real unit of work is not one check-in — it
is the tenth check-in in ninety seconds. Everything below follows from that: the camera never
closes, the search field is always ready, the result auto-clears, and no state ever requires a
deliberate dismissal before the next person can be served.

### 11.2 Layout at `lg` and in full-screen mode

*illustrative — not committed code*

```text
┌──────────────────────────────────────────────────────────────────────────────────────┐
│ Check-in · Bandra West              ● Online   14:11:47 IST      [ ⛶ Full screen ]   │
├───────────────────────────────────────┬──────────────────────────────────────────────┤
│  MANUAL SEARCH (always focused)       │  RESULT PANEL                                │
│  ┌─────────────────────────────────┐  │  ┌────────────────────────────────────────┐  │
│  │ Phone, name or member code…     │  │  │            ✓  CHECKED IN               │  │
│  └─────────────────────────────────┘  │  │                                        │  │
│  Just start typing — the field is     │  │        ┌──────────┐                    │  │
│  always listening.                    │  │        │   📷     │  Priya Sharma      │  │
│                                       │  │        │  photo   │  IT-00412          │  │
│  ┌─────────────────────────────────┐  │  │        └──────────┘                    │  │
│  │                                 │  │  │                                        │  │
│  │        CAMERA VIEWFINDER        │  │  │  3 Month Unlimited                     │  │
│  │        ┌───────────────┐        │  │  │  118 days remaining                    │  │
│  │        │               │        │  │  │  Valid at all branches                 │  │
│  │        │   ▢ scan box  │        │  │  │                                        │  │
│  │        │               │        │  │  │  Checked in 14:11:44                   │  │
│  │        └───────────────┘        │  │  │                                        │  │
│  │   Hold the QR inside the box    │  │  │  Clears in 4s        [ Keep on screen ]│  │
│  └─────────────────────────────────┘  │  └────────────────────────────────────────┘  │
│  Camera: FaceTime HD ▾   [Switch]     │                                              │
├───────────────────────────────────────┴──────────────────────────────────────────────┤
│ RECENT CHECK-INS                                        Updated 6 seconds ago ●      │
│ 14:11 Priya Sharma  ✓ scan    │ 14:09 Kiran Rao   ✓ scan   │ 14:07 D. Bose ✗ frozen  │
│ 14:02 A. Nair       ✓ manual  │ 13:58 R. Menon    ✓ scan   │ 13:55 S. Iyer ✓ scan    │
└──────────────────────────────────────────────────────────────────────────────────────┘
```

**Tablet portrait (`md`, 768×1024) — the stated ergonomic target** (`NFR-USE-09`, AX6):

*illustrative — not committed code*

```text
┌───────────────────────────────┐
│ Bandra West   ● Online  14:11 │
├───────────────────────────────┤
│  ┌─────────────────────────┐  │
│  │                         │  │
│  │   CAMERA VIEWFINDER     │  │   Viewfinder occupies the upper half —
│  │   ▢ scan box            │  │   readable at arm's length.
│  │                         │  │
│  └─────────────────────────┘  │
├───────────────────────────────┤
│  RESULT (overlays viewfinder  │   The result overlays the viewfinder
│   on outcome, then clears)    │   rather than pushing it off-screen,
│                               │   so the camera position never moves.
├───────────────────────────────┤
│ 🔍 [ Phone, name or code…  ]  │   Search sits in the LOWER THIRD —
│                               │   thumb-reachable one-handed.
├───────────────────────────────┤
│ Recent: Priya ✓ · Kiran ✓ ·   │
└───────────────────────────────┘
```

**One-handed operation is a layout constraint, not a courtesy.** At `md` portrait every control
Sameer touches during a normal check-in — search field, override button, dismiss — sits in the
**lower third** of the screen. The viewfinder, which he only looks at, sits above. `NFR-USE-09`
becomes testable: no primary action above 60% screen height in portrait.

### 11.3 The five behaviours that make it fast

| # | Behaviour | Why |
| :-: | :--- | :--- |
| 1 | **The camera stream is held open continuously.** It is not stopped on success and restarted for the next person | Camera acquisition costs 300–900 ms on typical desk hardware. Paying it per member would blow `NFR-PERF-03` by itself. FP6 states it: *"holds the camera stream open and returns to ready immediately after a scan"* |
| 2 | **The manual search field is focused on any keypress**, from anywhere on the screen, unless focus is already in a text input | Sameer types a phone number without reaching for the mouse. A member without a phone costs him one keystroke of overhead, not a click |
| 3 | **The result panel auto-clears after a configurable interval** (default 5 s, tenant-configurable per `SCR-DASH-022`) | The next person is already presenting a code. A result that requires dismissal is a queue stall. **Keep on screen** cancels the timer for the rare case where he needs to read it |
| 4 | **Scanning is never blocked by the result.** A new valid code scanned while a result is displayed **replaces** it immediately | The queue does not wait for the animation |
| 5 | **The scanner deduplicates locally on token nonce** for the display, and the server deduplicates authoritatively | A camera reading the same code five times in 200 ms must produce one interaction, and `BR-CHK-06` guarantees one attendance row regardless |

### 11.4 The scan path

*illustrative — not committed code*

```text
  QR in frame
      │  @zxing/browser decodes locally — no network
      ▼
  POST /v1/checkin/scan
      Idempotency-Key: <token_nonce>        ← the nonce, NOT a fresh UUID.
      { token, branch_id }                     This is what makes a double-tap,
      │                                        a duplicated scan or a retry after
      │                                        timeout return the ORIGINAL record.
      ▼
  200 { result: "ALLOWED" | "DENIED", … }   ← A DENIAL IS A 200. Not a 4xx.
      │
      ├── ALLOWED → success state (§11.5)
      └── DENIED  → denial state (§11.6) with denial_reason + suggested_actions
```

| Contract point | Consequence for the UI |
| :--- | :--- |
| `branch_id` is **the scanning station's branch**, not taken from the token | The desk **binds its branch at session start** and shows it in the header. A station whose staff member is assigned to two branches picks once and the choice persists |
| The idempotency key is the **token nonce**, server-dictated | The client must extract and send it. A retry after a network timeout **must reuse the same key** — this is what satisfies `AC-CHK-01.5`: *"the operation either completed exactly once or not at all — never twice"* |
| Token TTL is **60 seconds** | A screenshot of an old QR is `TOKEN_EXPIRED` (`AC-CHK-01.3`). The denial says so in words Sameer can repeat to the member |
| `409 IDEMPOTENCY_FINGERPRINT_MISMATCH` | Same nonce, **different branch** — two branches scanned the same token. This is `BR-CHK-07` sharing evidence. The UI shows a **distinct** state: *"This code was just used at another branch. Do not admit; check with the member."* — not a generic error |
| `409 MEMBERSHIP_AMBIGUOUS` | The member holds two memberships at this gym. The result panel becomes a **two-item chooser**, defaulting to the one **expiring soonest**, and re-submits with `membership_id` |
| `403 BRANCH_NOT_ASSIGNED_TO_STAFF` | The branch-refused state, naming the assignment |
| Server time only | The device clock is never trusted and is not transmitted. The header clock is **display only** and labelled IST |

### 11.5 The success state (`FR-CHK-05`)

Large, green, and legible **at arm's length across a counter**.

| Element | Rule |
| :--- | :--- |
| Confirmation | A **tick, the word "Checked in", and green** — three carriers, because colour is never the sole carrier (AX9) |
| Member photo | From `member.photo_url`, at the 160 px rendition, with explicit dimensions so the panel never shifts |
| Name and member code | Name at display scale; code beneath |
| Plan | `membership.plan_name` |
| **Days or sessions remaining** | Whichever applies. `days_remaining` for `DURATION`, `sessions_remaining` for `SESSION`. **Server-computed** — never derived from `end_date` |
| Branch entitlement | *"Valid at all branches"* or the named subset |
| Timestamp | `checked_in_at`, local, 24-hour |
| Auto-clear | A visible countdown and a **Keep on screen** escape |
| Announcement | `aria-live="assertive"`: *"Checked in. Priya Sharma. 3 Month Unlimited. 118 days remaining."* (AX8) |
| Sound | An optional, tenant-configurable confirmation tone. **Off by default** — a gym at 19:00 is loud, and a tone nobody hears trains staff to trust a signal that is not arriving |

**A near-expiry success is still a success, with a nudge.** If `days_remaining ≤ 7`, the panel adds a
secondary line — *"Expires in 4 days"* — and a **Renew now** action. It does **not** turn amber and
it does **not** delay the check-in. The member is entitled; the nudge is for Sameer.

### 11.6 The denial state (`FR-CHK-06`) — all fifteen reasons

Large, red, **specific**, and actionable. The `denial_reason` enum is **closed** with exactly fifteen
values; `suggested_actions` is **open**, so an unknown action renders **nothing** rather than a raw
token.

| # | `denial_reason` | Panel headline (server-resolved) | Actions rendered | Override |
| :-: | :--- | :--- | :--- | :-: |
| 1 | `MEMBERSHIP_EXPIRED` | *"Membership expired on 31 July 2026."* | **Renew now** → `SCR-DASH-012` **pre-filled for that member** (`AC-CHK-01.2`) · Override | ✅ |
| 2 | `MEMBERSHIP_FROZEN` | *"Frozen until 20 August 2026."* | **Unfreeze** · Override | ✅ |
| 3 | `MEMBERSHIP_PENDING_START` | *"Starts on 1 September 2026. Paid and confirmed — it simply has not begun."* | View membership · Override | ✅ |
| 4 | `MEMBERSHIP_CANCELLED` | *"Cancelled on 12 July 2026."* | **Sell a new plan** | ❌ |
| 5 | `MEMBERSHIP_REFUNDED` | *"Refunded on 2 July 2026."* | **Sell a new plan** | ❌ |
| 6 | `WRONG_BRANCH` | *"This plan does not include Andheri East. Valid at Bandra West and Powai."* | View entitled branches · **Upgrade plan** · Override | ✅ |
| 7 | `OUTSIDE_OPERATING_HOURS` | *"Bandra West is closed now. Today's hours are 06:00–22:00."* | View hours · Override | ✅ |
| 8 | `OUTSIDE_PLAN_ACCESS_WINDOW` | *"Off-peak plan. Access is 06:00–10:00 and 15:00–18:00; it is 12:40."* | **Upgrade plan** · Override | ✅ |
| 9 | `GYM_CLOSED_EXCEPTION` | *"Closed today for Independence Day. Reopens 16 August at 06:00."* | View closure · Override | ✅ |
| 10 | `NO_SESSIONS_REMAINING` | *"All 12 sessions used."* | **Top up sessions** · Renew · Override | ✅ |
| 11 | `DUPLICATE_WITHIN_COOLDOWN` | *"Already checked in at 07:12 today, 24 minutes ago. No session was deducted."* | Dismiss | ❌ — nothing to override; they are inside |
| 12 | `TOKEN_EXPIRED` | *"This QR expired — codes last 60 seconds. Ask them to refresh."* | **Retry scan** · **Manual check-in** | ❌ |
| 13 | `TOKEN_INVALID` | *"Could not read this code. Ask them to refresh, or check in manually."* | **Retry scan** · **Manual check-in** | ❌ |
| 14 | `MEMBERSHIP_UNDER_REVIEW` | *"Under review. Contact the gym manager before admitting."* | Contact manager | ❌ except `MANAGER`/`OWNER` |
| 15 | `TENANT_SUSPENDED` | *"This gym's account is suspended. Contact support with the reference shown."* | Contact support | ❌ |

**Five properties of the denial panel that are contract, not styling.**

1. **The member block is present on a denial** (except `TOKEN_INVALID`, where nothing resolved).
   Sameer needs to know **who is standing in front of him**. Name, photo and member code render
   exactly as they do on success.
2. **`GYM_CLOSED_EXCEPTION` is never rendered as `OUTSIDE_OPERATING_HOURS`.** A declared closure is
   information the member can act on; *"outside hours"* on a day the gym should be open is a
   misdirection (`BR-CHK-05-N1`).
3. **The message is server-resolved.** The client renders `message`; it does not maintain its own map
   from `denial_reason` to text. Two audiences, two message keys — the desk sees staff phrasing, the
   member's own screen sees member phrasing, and the `denial_reason` value is identical.
4. **`DUPLICATE_WITHIN_COOLDOWN` says no session was deducted.** That sentence prevents the single
   most common front-desk argument.
5. **Denials do not auto-clear on the same timer as successes.** Default 10 s versus 5 s, separately
   configurable, because a denial requires a conversation. **A new scan still replaces it
   immediately** — the queue is never blocked by someone else's problem.

### 11.7 Override (`FR-CHK-08`)

> **The denial is recorded first, then overridden.** The API offers no *"scan and admit anyway"*
> call. Two rows exist afterwards: the `DENIED` row with its reason, and the `OVERRIDE` row with the
> staff identity and justification.

| Step | UI |
| :--- | :--- |
| 1 | The denial has already been recorded — the panel shows its `attendance_id` in small type, because that id is what the override references |
| 2 | **Override with reason** opens a compact dialog: a **fixed reason list** (never free text as the primary input) plus an optional note ≤ 280 characters |
| 3 | `POST /v1/checkin/override` with `denied_attendance_id`, `reason`, `note` |
| 4 | On success the panel becomes a **success state marked "Admitted by override"** with the staff name — because `FR-STAF-05` makes this reportable and Sameer should see what was recorded about him |

| Guard | UI response |
| :--- | :--- |
| `403 PERMISSION_DENIED` — a `TRAINER` may record but **not** override | The override button is **absent** for trainers (`FR-NAV-03` inside a screen) and the server refuses anyway |
| `422 DENIAL_NOT_OVERRIDABLE` — reasons 4, 5, 11, 12, 13, 15 | The button is absent for those reasons, and the alternative action is offered instead |
| `MEMBERSHIP_UNDER_REVIEW` | Override offered **only** to `GYM_MANAGER` and `GYM_OWNER` |
| `409 ALREADY_OVERRIDDEN` | Reconciles the panel to the existing override rather than erroring |
| Recency | Overriding a denial from last Tuesday is not a front-desk action; outside the window the action is absent with the reason |

### 11.8 Manual mode (`FR-CHK-07`)

For the member whose phone has no battery — `B5.13`'s named edge case.

| Step | Behaviour |
| :--- | :--- |
| Search | The always-focused field. `q` matches **phone, name or member code**. Results appear as a keyboard-navigable list (`↑`/`↓`, `Enter`) with photo, name, code, status and plan |
| Membership choice | If the member holds more than one, a chooser appears **defaulting to the one expiring soonest** |
| Reason | **Required** — an enum from the check-in override taxonomy. A deprecated code is `422`, never silently accepted |
| Submit | `POST /v1/checkin/manual` with `membership_id`, `branch_id`, `reason`, optional note |
| Validation | **The same ten-step validation runs, minus the token steps.** A manually checked-in member whose membership is frozen is **still denied** — manual mode is a different input, not a bypass |
| Record | `method='MANUAL'` with the staff identity, **reportable separately from scans**, plus an `audit_log` row (unlike a scan) because it is a staff discretionary act |

### 11.9 The offline state — *"no false success is ever shown"*

`B7` states the requirement in six words and it is the most important sentence on this screen.

*illustrative — not committed code*

```text
┌────────────────────────────────────────────────────────────────┐
│  ⛔  NO CONNECTION                                             │
│                                                                │
│  Check-in cannot be verified right now.                        │
│  We are not recording these visits.                            │
│                                                                │
│  What to do: note the member's name and code on paper and      │
│  enter them here when the connection returns.                  │
│                                                                │
│  Retrying automatically… last attempt 14:12:03                 │
│                                       [ Retry now ]            │
└────────────────────────────────────────────────────────────────┘
```

| Rule | Statement |
| :--- | :--- |
| O1 | The offline state is **full-panel and unmissable**, replacing the result area entirely. Not a toast, not a corner badge |
| O2 | **No queued check-ins. No optimistic success. No "will sync later."** The platform cannot validate entitlement offline — it cannot know whether the membership is frozen, expired or at the wrong branch — so a green tick offline would be a lie with a business consequence |
| O3 | The **camera keeps running** and decoding is disabled, so the transition back to online is instant. The header's connection pip flips to green and the panel clears itself |
| O4 | Detection is **request-outcome based**, not `navigator.onLine` alone: a captive portal reports online and answers nothing. The desk marks itself offline after one failed scan attempt with a network-class error, and recovers on the first success |
| O5 | The instruction is **actionable**: paper, then enter later. `NFR-USE-05` requires what to do next, and *"try again"* is not a plan for a queue of ten |
| O6 | Attendance can be entered retrospectively through manual mode, so the paper instruction leads somewhere real |

### 11.10 Full-screen mode and ergonomics (`FR-CHK-03`, `NFR-USE-09`)

| Aspect | Behaviour |
| :--- | :--- |
| Full screen | A **persistent** mode: it survives reload and is remembered per device. The nav shell, breadcrumbs and everything else disappear. `Esc` exits with a confirmation, because an accidental exit mid-queue is disruptive |
| Wake lock | The screen wake lock is requested in full-screen mode so the desk tablet does not sleep between members |
| Camera selection | A device chooser (front/rear/external) persisted per device, with a **Switch camera** control. A desk with a USB scanner camera must not have to re-select it daily |
| Hardware scanner | A USB HID barcode scanner emits keystrokes ending in `Enter`. Because the search field is always listening, **a hardware scanner works with no extra configuration** — it types the code and submits |
| Portrait | Fully supported and explicitly designed for; §11.2 shows the layout |
| Reach | No primary action above 60% screen height in portrait |
| Contrast | Success and denial states meet **AA at arm's length**: ≥ 4.5:1 text on their backgrounds, large type for the outcome word |

### 11.11 Keyboard map — every primary action reachable (`NFR-USE-02`, AX2)

| Key | Action |
| :--- | :--- |
| *Any printable character* | Focuses the search field and inserts the character |
| `Enter` | Submits the search, or confirms the highlighted member |
| `↑` / `↓` | Move through search results |
| `Esc` | Clears the result panel and the search field, returning to ready |
| `F` | Toggle full screen |
| `O` | Open the override dialog **when a denial is displayed and the user holds the permission** |
| `M` | Switch to manual mode |
| `R` | Retry the last scan (offline recovery) |
| `?` | Shortcut reference |

Shortcuts are **suppressed while a text input has focus**, except `Esc` and `Enter`. Every shortcut
also has a visible, focusable control — the keyboard is a fast path, never the only path.

### 11.12 Data contract

| Call | Endpoint | Notes |
| :--- | :--- | :--- |
| Scan | `POST /v1/checkin/scan` | `Idempotency-Key: <token_nonce>` · `RL-CHECKIN`, its own rate class, deliberately looser than `RL-WRITE` **because a queue of twenty members is legitimate traffic** |
| Manual | `POST /v1/checkin/manual` | Idempotency required |
| Override | `POST /v1/checkin/override` | Idempotency required |
| Check-out | `POST /v1/checkin/:id/checkout` | Optional (`FR-CHK-09`) |
| Member search | `GET /v1/tenant/members?q=` | Debounced 200 ms, `limit=8` |
| Recent strip | `useLiveCounters()` | **The only polled data on this screen.** The strip carries the last-updated indicator |

**Query invalidation is deliberately narrow.** A successful check-in invalidates the recent strip's
key and nothing else. Invalidating the member list or the home dashboard on every scan would put a
refetch storm behind a queue of ten and jeopardise `NFR-PERF-03`.

### 11.13 States

| State | Behaviour |
| :--- | :--- |
| **Loading** | The **camera initialises first**; the result panel shows *"Ready — present a QR code or start typing"*. Search is usable before the camera is ready. No spinner covers the viewfinder |
| **Camera permission denied** | *"We can't use the camera. Check-in still works — search for the member by phone, name or code."* with the browser's permission path. **Manual mode remains fully functional**; the screen is degraded, not broken |
| **No camera present** | The viewfinder is replaced by manual mode at full width. Not an error |
| **Empty** | Ready state with the day's count: *"42 check-ins today at Bandra West."* — orientation, not decoration |
| **Error — scan request failed** | If it is a network class, §11.9's offline state. If it is a `5xx`, an explicit *"We couldn't record that check-in. Nothing was recorded. Scan again."* with the correlation id — **never a tick** |
| **Permission-denied** | A user without `attendance.checkin.record` reaching `/checkin` gets the full-screen denial naming who can grant it. Override is absent for those lacking `attendance.checkin.override` |
| **Branch not assigned** | `403 BRANCH_NOT_ASSIGNED_TO_STAFF` → *"You are assigned to Bandra West. This station is set to Andheri East. Change the station's branch or ask an owner to update your assignment."* |
| **Offline** | §11.9 |
| **Tenant suspended** | Every scan denies with reason 15; the header carries a persistent banner |
| **Ambiguous membership** | `409 MEMBERSHIP_AMBIGUOUS` → chooser, defaulting to the soonest expiry |
| **Cross-branch replay** | `409 IDEMPOTENCY_FINGERPRINT_MISMATCH` → the sharing-evidence state of §11.4 |

### 11.14 Accessibility — AA, enumerated

| Criterion | Implementation |
| :--- | :--- |
| 1.4.3 Contrast | Success green and denial red pass **4.5:1 for text** and **3:1 for the outcome iconography**, verified as tokens, not per-component choices |
| 1.4.1 Use of colour | Every outcome carries an icon **and** a word (AX9) |
| 4.1.3 Status messages | Outcomes announce through `aria-live="assertive"`; the recent strip updates through `aria-live="polite"` so the poll never interrupts an outcome announcement |
| 2.1.1 / 2.1.2 Keyboard | §11.11; no keyboard trap; the override dialog traps and restores focus |
| 2.4.3 Focus order | After a result, focus returns to the search field — the next member's field, not a dead end |
| 2.5.5 Target size | 44 × 44 px minimum; primary actions are considerably larger |
| 2.3.3 Animation | Success/denial flashes respect `prefers-reduced-motion` and become instant state changes |
| 1.3.1 Info and relationships | The result panel is a labelled region; the member's details are a description list, not a visual layout |

### 11.15 Performance budget, decomposed

`NFR-PERF-03` is **client-observed**, so the whole path is in scope:

| Segment | Budget | Note |
| :--- | ---: | :--- |
| QR decode (local, `@zxing/browser`) | ≤ 200 ms | No network. Decoding runs continuously on frames |
| Request → response | ≤ 1,200 ms p95 | `POST /v1/checkin/scan`. Token signature and `exp` are verified **before any database access**, so a forged or expired token costs one Ed25519 verification and no I/O |
| Render | ≤ 100 ms | Photo is a **pre-sized 160 px rendition** with explicit dimensions; no layout shift |
| Ready for next | ≤ 0 ms | The camera never stopped. The scanner is ready **during** the result display |
| **Total** | **≤ 2 s p95** | Measured client-side and reported as a RUM metric |

**What is deliberately excluded from the path:** any polled data, any home-dashboard invalidation,
any analytics flush, any photo fetch that is not already cached. LC7 is explicit — routing
confirmation through the poll would be a defect.

### 11.16 Acceptance

| `AC-` | Assertion |
| :--- | :--- |
| `AC-CHK-01.1` | Confirmation within 2 s at p95 **and the scanner is immediately ready for the next person** |
| `AC-CHK-01.2` | An expired membership denies with *"Membership expired on ⟨date⟩"* and a **Renew now** action that opens the sale flow **pre-filled for that member** |
| `AC-CHK-01.3` | A screenshot of an old QR is denied as expired — the 60-second TTL |
| `AC-CHK-01.4` | The same token scanned twice within its TTL returns the **original** attendance record; no second visit |
| `AC-CHK-01.5` | A network drop mid-scan resolves as **exactly once or not at all**, via the nonce-keyed idempotency |
| `AC-GYM-01.3` | A branch-restricted plan at an excluded branch denies with the reason **and shows which branches are valid** |
| `AC-MEMB-01.2` | A frozen membership denies with *"frozen until ⟨date⟩"* |
| `NFR-USE-09` | Operable one-handed on a tablet at arm's length, in portrait, with a full-screen mode |
| `AX1` | WCAG 2.1 **AA** — a merge gate |

---

## 12. `SCR-DASH-010` — Attendance Log

| | |
| :--- | :--- |
| **Route** | `/attendance` · **Feature** `src/features/attendance/` · **Persona** Rohan (staffing decisions), managers (disputes) |
| **Permission** | `attendance.log.view`. `RECEPTIONIST` and `TRAINER` at `▪` — own/assigned records at assigned branches |
| **WCAG** | Level A minimum, AA target · **Live data** No · **Budget** ≤ 50 rows, p95 ≤ 800 ms; heatmap cached 15 min |

**Purpose.** The filterable record of every visit, plus the weekday × hour heatmap that answers
`B2.1`'s *"the attendance chart that tells him when to staff the floor"* (`FR-CHK-10`, `FR-CHK-13`).

### 12.1 Content

| Region | Content |
| :--- | :--- |
| **Filters** | `from`/`to` (default last 7 days, **max 90-day span**, interpreted in the **gym's timezone**) · `branch_id` (repeatable) · `member_id` · `staff_id` (serves `FR-STAF-05`) · `method` (`SCAN` \| `MANUAL` \| `OVERRIDE`) · `result` (`ALLOWED` \| `DENIED`) · `denial_reason` (repeatable, **all fifteen**) |
| **Table** | Timestamp (`DD MMM YYYY · HH:mm`) · member (linked to `SCR-DASH-008`) · branch · **method badge** · result · **denial reason** · staff who recorded it · override note · duration where checked out |
| **Heatmap** | `GET /v1/tenant/attendance/heatmap` — weekday rows × hour columns, visit counts. Requires ≥ 14 days of data (`AC-CHK-02.1`); below that it states the requirement and the days collected so far |
| **Export** | `POST /v1/tenant/exports` → `202`. One row per visit with member id, timestamp, branch, method and result (`AC-CHK-02.3`) |

### 12.2 Rules this screen must not violate

- **`method` is visible on every row.** `BR-CHK-08` makes manual check-ins *"reportable separately
  from scanned check-ins"*, and that is what makes `FR-STAF-05` staff-activity review meaningful. A
  table that renders manual and scanned identically destroys the distinction.
- **`DUPLICATE_WITHIN_COOLDOWN` rows are marked "no entitlement consumed"**, because
  `decremented_entitlement = false` and both peak analysis and session disputes depend on telling
  them apart from real visits.
- **Reads go to the replica**, so a check-in written moments ago may lag by replication delay. The
  response carries `as_of` and the UI **renders it** — this is a freshness disclosure of the same
  family as §2.1's indicator, for a different reason.
- **Attendance is append-only and immutable** (`BR-CHK-09`). There is **no edit and no delete
  control anywhere on this screen**, and the empty-actions column is deliberate.
- `400 DATE_RANGE_TOO_WIDE` renders inline on the date control with the maximum stated.

### 12.3 States

| State | Behaviour |
| :--- | :--- |
| **Loading** | Filter bar interactive immediately; twelve row skeletons; the heatmap renders its grid with cells skeletoned so the axis labels do not shift |
| **Empty — no visits in range** | *"No visits between 01 and 07 Aug at Bandra West. Your last recorded visit was 28 Jul."* — naming the last known visit prevents the "is it broken?" ticket |
| **Empty — never any visits** | *"No check-ins recorded yet. Open the check-in desk to record your first."* with the link |
| **Empty — heatmap under 14 days** | *"A heatmap needs 14 days of data. You have 9."* Both numbers |
| **Error** | Table and heatmap fail independently; each retries alone |
| **Permission-denied** | A `TRAINER` sees only assigned members' visits with the scope stated; a branch outside assignment is **refused** (§2.4), never an empty table |

**Acceptance:** `AC-CHK-02.1` (heatmap at ≥ 14 days) · `AC-CHK-02.2` (branch filter reflects in the
heatmap) · `AC-CHK-02.3` (CSV one row per visit with the five named columns) · `FR-CHK-10`.

---

## 13. `SCR-DASH-011` — Sales & Orders

| | |
| :--- | :--- |
| **Route** | `/sales` · **Feature** `src/features/sales/` · **Persona** Rohan reconciling the day; Vikram-style scrutiny at tenant scale |
| **Permission** | `ordering.order.list`. Not held by `TRAINER` |
| **WCAG** | Level A minimum, AA target · **Live data** No · **Budget** ≤ 50 rows, p95 ≤ 800 ms · **Cache** `NO-STORE!` |

**Purpose.** Every order the tenant made, marketplace and direct, with a drawer that explains any one
of them completely (`FR-CART-11`).

### 13.1 Content

| Region | Content |
| :--- | :--- |
| **Filters** | Date range · status · **origin (`MARKETPLACE` \| `DIRECT`)** · payment method · plan · branch · member · `q` on order reference |
| **Table** | Reference · date · member · plan · **gross · discount · net** · status · origin · payment method · collected-by staff |
| **Drawer** | Full breakdown (§13.2) · invoice with PDF · **payment events in order** · refund history · the coupon applied with its funding source · audit of who created it |
| **Export** | `POST /v1/tenant/exports` → `202`. Every export carries the identifiers needed to **join it to other exports** — order ref, member id, invoice number, settlement batch id |

### 13.2 The breakdown — eight figures, rendered not computed

The drawer renders the server's `breakdown` object exactly (`README.md` §11.3):

| Line | Field | Example |
| :--- | :--- | :--- |
| Plan price | `plan_price_minor` | ₹5,000 |
| Joining fee | `joining_fee_minor` | ₹0 |
| Add-ons | `add_ons_minor` | ₹0 |
| Discount | `discount_minor` | −₹1,000 |
| **Net** | `net_minor` | ₹4,000 |
| Tax | `tax_minor` with **`tax_components[]`** | ₹720 |
| — CGST 9% | component line | ₹360 |
| — SGST 9% | component line | ₹360 |
| **Total** | `total_minor` | **₹4,720** |

**CGST and SGST are two separate lines, never one combined 18%.** A gym is consumed at a physical
location, so supply is almost always intra-state, and an Indian invoice must show them separately
(`LAUNCH_MARKET_INDIA.md` §4, `FR-INV-04`). `component` is an **open enum** — `IGST` appears on the
inter-state edge case and the UI **must render an unknown component** rather than dropping it, or the
lines stop summing to the tax total. **The client does not add these up** (BL2, M-UI-4).

### 13.3 States

| State | Behaviour |
| :--- | :--- |
| **Loading** | Filters live immediately; ten row skeletons; the drawer, if deep-linked, skeletons the breakdown's exact line count |
| **Empty — no orders** | *"No sales yet. Record a sale at the desk, or publish a plan so people can buy online."* — two actions because there are two ways to get an order |
| **Empty — filters** | Most restrictive filter named, relaxation count previewed |
| **Error** | Table retry with the last successful page retained; the drawer errors independently |
| **Permission-denied** | A `RECEPTIONIST` sees **only orders they recorded**, stated in the header, and a request for another is refused. A `TRAINER` gets the full-screen denial |
| **`BALANCE_DUE`** | Rendered as a **distinct status with the outstanding amount** and a **Collect** action, not as "partially paid" prose |
| **Refunded / partially refunded** | The row shows the net position and the drawer shows the refund lines with references |

**Acceptance:** `FR-CART-11` · `AC-RPT-01.3` (export columns human-readable, monetary columns plain
numbers with a separate currency column) · `NFR-PERF-04`.

---

## 14. `SCR-DASH-012` — Record Offline Sale

| | |
| :--- | :--- |
| **Route** | `/sales/offline` · **Feature** `src/features/sales/` · **Persona** **Sameer taking cash at the desk** |
| **Permission** | `ordering.order.create_offline` — `RECEPTIONIST` ●, `GYM_MANAGER` ●, `GYM_OWNER` ● |
| **WCAG** | Level A minimum, AA target · **Live data** No · **Budget** p95 ≤ 1.5 s; `RL-PAY`, the strictest rate class |

**Purpose.** `FR-CART-09` — sell a plan and take payment at the counter, in one screen, with the
money attributed to whoever took it. `B2.3`: *"Every cash entry is attributed to him, which protects
him as much as it monitors him."* The UI says that out loud rather than leaving it implied.

### 14.1 Flow

*illustrative — not committed code*

```text
 1 MEMBER      ( • ) Existing  [ 🔍 phone / name / code …          ]
               ( ) New walk-in  → name + phone only (FR-CRM-04 minimum)
 2 PLAN        [ 3 Month Unlimited · ₹5,000 ▾ ]   ← STAFF_ONLY plans appear here
 3 START DATE  [ 06 Aug 2026 ]  ( ) today  (•) day after current expiry
 4 COUPON      [ MONSOON20            ] [Apply]   ✓ 20% — gym-funded
 5 BREAKDOWN   Plan ₹5,000 · Discount −₹1,000 · Net ₹4,000
               CGST 9% ₹360 · SGST 9% ₹360 · TOTAL ₹4,720      ← server-computed
 6 PAYMENT     ( • ) Cash  ( ) Card  ( ) Bank transfer  ( ) Other
               Amount received  ₹ [ 4,720 ]      ( ) Full  ( ) Part payment
 7 NOTES       [ ………………………………………………… ]
                                        Recorded by Sameer K. · 06 Aug 14:22
                                                       [ Record sale ]
```

### 14.2 The money rules that shape this form

| Rule | Consequence |
| :--- | :--- |
| **The client never sends a price** | Step 5 is **read-only output**, computed by the server from the plan, the coupon and the tax profile. There is no editable total, no editable tax, no editable discount |
| **`amount_received_minor` is the one apparent exception, and it is not one** | It is *a record of cash handed over, not a price*. It is validated against the server-computed total; a shortfall becomes **`BALANCE_DUE`** (`FR-CART-09`, `BR-PAY-09`) |
| **Part payment is explicit** | Selecting *Part payment* shows *"Balance ₹1,720 will be recorded against this order and appears on your home screen until collected."* Never a silent partial |
| **Overpayment is refused inline** | An amount above the total is `400`; the message states the total |
| **Idempotency is required** | `Idempotency-Key` per desk action; submit disables while in flight (FM6). A double-tap at a busy counter must not sell two memberships |
| **Attribution** | The recording staff member is taken from the token, never the form, and is shown in the footer **before** submission |

### 14.3 Coupon behaviour

Applied through the order's coupon endpoint and **re-validated at payment initiation** (`FR-CPN-03`).
A refusal renders inline with the specific reason — first-purchase-only against a user with prior
orders, per-user limit reached, total cap exhausted, expired, not valid at this branch — never a
generic *"invalid coupon"* (`AC-CPN-01.1`, `AC-CPN-01.2`, `AC-CPN-01.3`). The funding source is shown
because a gym-funded coupon changes the commission base to the post-discount net (`AC-CPN-01.4`).

### 14.4 Result

Order created → invoice issued → **membership activated per configuration** → balance recorded if
partial. The success panel shows the order reference, the invoice number with a PDF link, the
membership's start and end dates, and **two next actions**: *Check them in now* (opens
`SCR-DASH-009` primed) and *Record another sale*.

### 14.5 States

| State | Behaviour |
| :--- | :--- |
| **Loading** | Member search is live immediately; the plan list skeletons; the breakdown area shows its empty frame with *"Select a plan to see the price"* |
| **Empty — no published plans** | *"You have no plans to sell. Create one first."* with the link — the form is not rendered in a state that cannot succeed |
| **Error** | Field errors land on fields. `422 PLAN_ARCHIVED` mid-flow states it and offers alternatives. A `503` states **nothing was recorded** and preserves every entered value |
| **Permission-denied** | A `TRAINER` reaching `/sales/offline` gets the full-screen denial. A receptionist outside their branch assignment is **refused** on the branch, not shown an empty plan list |
| **Duplicate submission** | Idempotency returns the **original** order; the UI shows the success panel for that order rather than an error |
| **New-member duplicate code** | `409 MEMBER_CODE_ALREADY_EXISTS` **offering the generated alternative**, which the UI presents as a one-tap accept |

**Acceptance:** `FR-CART-09` · `BR-PAY-09` · `AC-CPN-01.1`…`01.4` · `AC-STAF-01.3` (every collection
appears in the staff activity log with amount, member, timestamp and order reference).

---

## 15. `SCR-DASH-013` — Invoices

| | |
| :--- | :--- |
| **Route** | `/invoices` · **Feature** `src/features/invoices/` · **Persona** Rohan at GST filing time |
| **Permission** | `billing.invoice.list` / `billing.invoice.download` · **Cache** `NO-STORE!` |
| **WCAG** | Level A minimum, AA target · **Live data** No · **Budget** ≤ 50 rows p95 ≤ 800 ms; PDF ≤ 3 s (`NFR-PERF-07`) |

**Purpose.** The invoice register for the financial year, plus credit notes and a bulk export
(`FR-INV-08`, `FR-INV-10`).

### 15.1 Content and the India specifics

| Region | Content |
| :--- | :--- |
| **FY selector** | **`2026-27`**, not `2026`. The Indian financial year runs **1 April – 31 March** and invoice numbering is *"gapless and sequential per tenant per financial year"* (`FR-INV-02`), restarting at the FY boundary (`AC-INV-01.3`) |
| **Filters** | Date range · member · status (`ISSUED`, `PAID`, `CREDITED`) · document type (invoice / **credit note**) · `q` on invoice number |
| **Table** | Invoice number · date · member · **taxable value** · **tax with component split** · total · status · linked order |
| **Row actions** | **Download PDF** (`GET /v1/tenant/invoices/:id/pdf`) · view the linked order · view the credit note if one exists |
| **Bulk export** | By date range → `POST /v1/tenant/exports` → `202`, delivered with a time-limited link |

### 15.2 Rules

- **Invoices are immutable.** There is **no edit control**. A correction is a **credit note**, and the
  UI shows the pair linked, never a mutated original (`BR-PAY-10`, `BR-PAY-11`).
- **Gapless numbering is visible.** A gap in the sequence would be a compliance problem, so the
  register renders in number order by default and states the FY the sequence belongs to.
- **The tax column shows components**, matching the PDF. A register that shows one 18% figure while
  the PDF shows CGST + SGST invites a mismatch the owner cannot explain to an accountant.
- **The PDF is server-generated, template-driven and locale-aware**, including *"total in words"*
  (`FR-INV-04`, I18N6). The client does not render invoices; it downloads them.

### 15.3 States

| State | Behaviour |
| :--- | :--- |
| **Loading** | FY selector and filters live immediately; ten row skeletons |
| **Empty — no invoices this FY** | *"No invoices in 2026-27 yet. Invoices are issued automatically when a sale is paid."* — explaining the mechanism prevents the belief that invoicing is a manual step someone forgot |
| **Empty — filters** | Most restrictive filter named with relaxation count |
| **Error** | Table retry. A **failed PDF** shows an inline retry on that row and never replaces the register |
| **Permission-denied** | `RECEPTIONIST` and `TRAINER` do not hold `billing.invoice.list`; a deep link renders the full-screen denial naming who can view invoices |
| **Credit note present** | The original row shows a **credited** badge linking to the note; the note shows the original |
| **PDF generating** | ≤ 3 s expected; beyond that a progress state that never blocks the register |

**Acceptance:** `FR-INV-08` · `FR-INV-10` · `AC-INV-01.3` (sequence restarts at the FY boundary) ·
`NFR-PERF-07`.

---

## 16. `SCR-DASH-014` — Settlements

| | |
| :--- | :--- |
| **Route** | `/settlements` · detail `/settlements/:id` · **Feature** `src/features/settlements/` |
| **Persona** | Rohan asking *"why did I receive this amount"* — `US-SETL-01` verbatim |
| **Permission** | `settlements.batch.list` / `settlements.batch.read` — **`GYM_OWNER` only** (`B3.2`: managers are `—`) · **Cache** `NO-STORE!` |
| **WCAG** | Level A minimum, AA target · **Live data** No · **Budget** summary renders immediately; **lines are cursor-paginated inside the statement** (default 100, cap 500) |

**Purpose.** `AC-SETL-01.1`: *"every transaction is listed with all eight figures **and the
arithmetic visibly sums to the payout amount**."* This screen exists to make that sentence true on a
screen, not only in a database.

### 16.1 Batch list

| Column | Source |
| :--- | :--- |
| Period | `period_start` – `period_end` in `Asia/Kolkata`, plus the **financial year** |
| Gross · commission · fees · reserve · **net payable** | The summary figures, each `_minor` + `currency` |
| Status | `PENDING` · `APPROVED` · `PROCESSING` · `PAID` · `FAILED` · `ON_HOLD` (`FR-SETL-07`) |
| Payout date | Actual for `PAID`, expected otherwise |
| Statement | Download |

**`FAILED`** shows the bank's failure reason and states that the batch **returns to `PENDING`**
(`FR-SETL-08`). **`ON_HOLD`** shows the reason **category** — the tenant sees that a hold exists and
why in general terms, not the platform's internal dispute detail. A batch below the minimum payout
**rolls forward with the reason shown** (`FR-SETL-05`), rendered as its own row state, not hidden.

### 16.2 Statement detail — the arithmetic, on screen

*illustrative — not committed code*

```text
┌──────────────────────────────────────────────────────────────────────────────────┐
│ Statement · 27 Jul – 02 Aug 2026 · FY 2026-27            PENDING APPROVAL        │
│ Paying to HDFC Bank ••••4417 · Iron Temple Fitness Private Limited               │
├──────────────────────────────────────────────────────────────────────────────────┤
│  Opening balance (carried forward)                              −  ₹420          │
│  Gross                                                          + ₹15,120        │
│  Commission                                                     −    ₹960        │
│  Commission tax                                                        —         │
│  Gateway fees                                                   −    ₹285.40     │
│  Refunds                                                        −    ₹450        │
│  Reserve held @ 5%                                              −    ₹756        │
│  Reserve released (batch of 05 Jul)                             +    ₹596        │
│ ─────────────────────────────────────────────────────────────────────────────    │
│  NET PAYABLE                                                     = ₹12,844.60    │
│                                                                                  │
│  net_payable = opening_balance + gross − commission − commission_tax             │
│                − fees − refunds − reserve_held + reserve_released       ✓ ties   │
├──────────────────────────────────────────────────────────────────────────────────┤
│ LINES (14)                        [ All ▾ ] SALE · REFUND · RESERVE · FEE …      │
│ ┌──────────────────────────────────────────────────────────────────────────────┐ │
│ │ 28 Jul  SALE  ORD-2026-000148  Priya S.  3 Month Unlimited                   │ │
│ │   Gross ₹5,000 · Discount −₹1,000 · Net ₹4,000 · Tax ₹720                    │ │
│ │   Commission base ₹4,000 · rate 8% (TIER) · Commission ₹320                  │ │
│ │   Gateway fee ₹94.40                       →  Payable to you  ₹4,305.60      │ │
│ ├──────────────────────────────────────────────────────────────────────────────┤ │
│ │ 30 Jul  REFUND  ORD-2026-000132 · RFD-2026-000019                            │ │
│ │   Gross −₹2,500 · Net −₹2,500 · Tax −₹450 · Commission −₹200 (reversed)      │ │
│ │                                            →  Payable to you −₹2,750         │ │
│ ├──────────────────────────────────────────────────────────────────────────────┤ │
│ │ 30 Jul  FEE_NOT_REVERSED  Gateway fee not reversed on refund      −₹47.20    │ │
│ │   Borne per your agreement and shown explicitly, never absorbed silently.    │ │
│ ├──────────────────────────────────────────────────────────────────────────────┤ │
│ │ 02 Aug  RESERVE_HELD  Rolling reserve withheld @ 5%              −₹756       │ │
│ │   Scheduled for release on 02 Sep 2026.                                      │ │
│ └──────────────────────────────────────────────────────────────────────────────┘ │
│                                                     [ Download statement ↓ ]     │
└──────────────────────────────────────────────────────────────────────────────────┘
```

### 16.3 The eight figures, and the ninth

`A6.3` persists **G, D, N, T, B, C, F, P** per transaction — gross, discount, net, tax, commission
base, commission, gateway fee, payable — and `BR-FIN-02` forbids recomputation at display time.
**All eight appear on every `SALE` and `REFUND` line.** `Cₜ` (`commission_tax_minor`) is present as a
**`null` field on every line and on the summary from day one**, not absent — a field that appears
later is a schema change the client must handle; a field that is present and null is a value change
it already handles.

| Rule | UI consequence |
| :--- | :--- |
| **`sum_invariant` is published as data** | The identity string is **rendered from the response**, not hard-coded in the component. The moment `commission_tax` is adopted, the sentence on screen changes because the server's string changed |
| **`sum_verified`** | Rendered as an explicit **✓ ties** marker. If it were ever `false`, the UI states *"This statement does not balance. We have been alerted. Reference ⟨correlation id⟩."* — silence would be worse than an alarming message |
| **`settlement_line.type` is an open enum** | An unknown type **renders the server-supplied `label` and `amount_minor` and is included in the total**. A client that skipped unknown types would produce a total that does not match `net_payable_minor` and would report it as a platform defect. This is a **contractual obligation** (CO-2) |
| **No client arithmetic** | The component renders `net_payable_minor`. It does **not** sum the lines to check. Exactness is the server's guarantee (`BR-FIN-03`) and a client re-derivation would introduce the only floating-point risk on the screen |
| **Historical rates** | Each line carries its own `applied_commission_rate_bps` and `commission_source`. The statement **never joins to current commission rules**; a rate change next month does not alter last month's statement (`AC-ADMN-01.4`) |

### 16.4 States

| State | Behaviour |
| :--- | :--- |
| **Loading** | The **summary renders first** and the lines paginate in — a busy tenant's weekly batch can carry several hundred lines and the payout figure must not wait for them |
| **Empty — no batches** | *"No settlements yet. Your first batch is created after your first online sale settles."* — naming the trigger, because an owner selling only cash will otherwise wait for something that is not coming |
| **Empty — no lines of a filtered type** | The filter is named; the summary stays visible, because filtering lines never changes the payout |
| **Error** | Summary and lines fail independently. A lines failure keeps the summary and the identity on screen |
| **Permission-denied** | A `GYM_MANAGER` reaching `/settlements` gets the full-screen denial: *"Settlement statements are visible to owners only."* |
| **`ON_HOLD`** | The reason category with what happens next and when |
| **`FAILED`** | The bank failure reason, *"returns to pending for another attempt"*, and a link to check the payout account |
| **Negative net** | An explicit **opening balance line** in the next batch showing the recovery (`AC-SETL-01.4`) — never a silently smaller payout |
| **Payout account unverified** | `422 PAYOUT_ACCOUNT_UNVERIFIED` explained on the batch with the re-verification path |

**Acceptance:** `AC-SETL-01.1` (all eight figures; **the arithmetic visibly sums to the payout**) ·
`AC-SETL-01.2` (a refund is a negative line **referencing the original sale**) · `AC-SETL-01.3`
(reserve shows amount, reason and **scheduled release date**) · `AC-SETL-01.4` (negative balance
recovery shown as an explicit opening balance line) · `FR-SETL-02`, `FR-SETL-05`, `FR-SETL-07`.

---

## 17. `SCR-DASH-015` — Refunds

| | |
| :--- | :--- |
| **Route** | `/refunds` · **Feature** `src/features/refunds/` · **Persona** Rohan handling a leaving member |
| **Permission** | `refunds.refund.list` / `refunds.refund.create` — owner and manager; **not** receptionist or trainer · **Cache** `NO-STORE!` |
| **WCAG** | Level A minimum, AA target · **Live data** No · **Budget** ≤ 50 rows p95 ≤ 800 ms; `RL-PAY` on the write |

**Purpose.** Raise a refund, see where every request stands, and understand a platform decision
(`FR-RFND-01`, `FR-RFND-11`).

### 17.1 Content

| Region | Content |
| :--- | :--- |
| **List** | Member · order reference · **requested amount** · reason · status · **requester** (member / gym staff / platform) · age |
| **Detail** | **The policy stored on the order** (`BR-REF-02`, `FR-RFND-02`) rendered in full — not a link · **usage**: days consumed or sessions used against the entitlement · **the computed amount with its computation shown** (`FR-RFND-04`) · approval state and full history · the gateway reference once executed |
| **Raise** | `POST /v1/tenant/refunds` — order, reason from a structured taxonomy, optional note. **No amount field**: the amount is server-computed |

### 17.2 The computation, shown

`FR-RFND-04` requires *"the computation shown to all parties"*. The detail renders the server's
breakdown line by line:

*illustrative — not committed code*

```text
 Paid                                    ₹5,000
 Term                90 days · used 18 · unused 72
 Pro-rata on unused duration             ₹4,000
 Cancellation fee (per policy, 10%)      −₹500
 Amount refundable                       ₹3,500
 Refunded to                             original instrument only (BR-REF-04)
 Gateway fee ₹47.20 is NOT reversed and appears on your next settlement as a
 FEE_NOT_REVERSED line (BR-REF-05).
```

The last sentence is mandatory. An owner who discovers the non-reversed fee on a settlement
statement three weeks later experiences it as an unexplained deduction; stated here it is a known
cost of the decision.

### 17.3 Authority and status

| Status | Meaning in the UI |
| :--- | :--- |
| `PENDING` | Awaiting evaluation |
| `AUTO_APPROVED` | Within window, usage below threshold, value below threshold (`FR-RFND-03`) — **the three conditions are named**, not summarised as "eligible" |
| `AWAITING_PLATFORM` | Routed to Super Admin because it is out of policy. The UI states **why it routed** and that the tenant cannot approve it |
| `APPROVED` / `REJECTED` | With the decision, the decider's role and the reason |
| `PROCESSING` / `COMPLETED` / `FAILED` | Execution state with the gateway reference |

**Approve within delegated authority** appears only where the tenant holds it; otherwise the button
is absent and the panel says *"This one is decided by the platform"* — which is `FR-NAV-03` applied
inside a screen, with the server refusing regardless.

### 17.4 States

| State | Behaviour |
| :--- | :--- |
| **Loading** | Filters live; eight row skeletons; the detail drawer skeletons the computation's line structure |
| **Empty** | *"No refund requests. When a member asks for one, raise it here or from their member page."* with the path stated |
| **Error** | List and detail fail independently; the raise form preserves entered values on failure |
| **Permission-denied** | `RECEPTIONIST` / `TRAINER` deep-linking get the full-screen denial. A manager without delegated authority sees the list and detail but no approve control |
| **Out of policy** | Raising an out-of-policy refund is **permitted** and routes to the platform; the form states this **before** submission, with the expected decision time |
| **Already refunded** | The order shows the existing refund; a second request is refused with the reference |
| **Dispute open** | A chargeback on the order blocks a new refund with the reason and the platform contact path |

**Acceptance:** `FR-RFND-02` (the order's stored policy displayed alongside) · `FR-RFND-04` (the
computation shown) · `BR-REF-04` (original instrument only, stated) · `BR-REF-05` (non-reversed
gateway fee disclosed at decision time) · `NFR-USE-06`.

---

## 18. `SCR-DASH-016` — Coupons

| | |
| :--- | :--- |
| **Route** | `/coupons` · **Feature** `src/features/coupons/` · **Persona** Rohan running a monsoon offer |
| **Permission** | `ordering.coupon.list` · **create / update are `GYM_OWNER`**; `GYM_MANAGER` is `○` |
| **WCAG** | Level A minimum, AA target · **Live data** No · **Budget** ≤ 50 rows p95 ≤ 800 ms |

**Purpose.** Create, monitor, pause and resume discount codes, and see what each one actually cost
(`FR-CPN-01`…`FR-CPN-08`).

### 18.1 Content

| Region | Content |
| :--- | :--- |
| **List** | Code · type (percentage / fixed) · value · validity window · **usage / limit** · status (`ACTIVE`, `PAUSED`, `EXPIRED`, `EXHAUSTED`) · **funding source** (`PLATFORM` / `GYM`) · performance |
| **Performance** | Redemptions · **discount cost** · gross revenue influenced · net after discount (`FR-CPN-08`) |
| **Editor** | All `BR-CPN-01` attributes: code, type, value, min order value, validity window, total usage cap, **per-user limit**, first-purchase-only, applicable plans, applicable branches, funding source, stackability |
| **Bulk generation** | Auto-generated unique single-use codes for win-back campaigns (`FR-CPN-05`), with a downloadable list |
| **Pause / resume** | `PATCH /v1/tenant/coupons/:id` — no deletion (`FR-CPN-07`) |

### 18.2 Rules

- **Funding source is prominent, not buried.** A gym-funded coupon makes the **commission base the
  post-discount net** (`AC-CPN-01.4`); a platform-funded one does not. The editor states the
  consequence in a sentence beside the control, because it is the field with the largest financial
  effect and the least obvious name.
- **Exhaustion is automatic and visible.** When the total cap is reached the coupon is *"automatically
  marked exhausted in the dashboard"* (`AC-CPN-01.3`). The list reflects it without a refresh cycle
  the owner has to guess at.
- **Pausing is not deleting.** The confirmation states the split: new redemptions stop immediately;
  the members who already redeemed are unaffected, with the count (§2.7).
- **Validation happens twice server-side** — at apply and again at payment initiation (`FR-CPN-03`) —
  and the coupon detail says so, because an owner who sees a coupon "work" at apply time and fail at
  payment needs to know that is by design, not a bug.

### 18.3 States

| State | Behaviour |
| :--- | :--- |
| **Loading** | Filters live; six row skeletons; performance figures skeleton separately from the static columns |
| **Empty** | *"No coupons. A coupon is a code a member types at checkout — useful for a launch offer or winning back a lapsed member."* with **Create coupon** and the two named use cases |
| **Error** | Table retry; the editor preserves values |
| **Permission-denied** | `GYM_MANAGER` sees the list and performance **read-only**; receptionist and trainer get the full-screen denial |
| **Expired / exhausted** | Grouped and dimmed with the terminal reason stated; the only action is **Duplicate** |
| **Code collision** | `409` on create renders on the code field with a suggested alternative |

**Acceptance:** `FR-CPN-01`, `FR-CPN-04`, `FR-CPN-05`, `FR-CPN-07`, `FR-CPN-08` · `AC-CPN-01.3`
(exhausted state appears automatically) · `AC-CPN-01.4` (funding source and its commission effect
are visible).

---

## 19. `SCR-DASH-017` — Leads

| | |
| :--- | :--- |
| **Route** | `/leads` · **Feature** `src/features/leads/` · **Persona** Sameer capturing a walk-in enquiry; Rohan chasing conversion |
| **Permission** | `crm.lead.list` / `crm.lead.create` — **`RECEPTIONIST` ● on create**, `▪` elsewhere |
| **WCAG** | Level A minimum, AA target · **Live data** No · **Budget** ≤ 50 per column, p95 ≤ 800 ms |

**Purpose.** The enquiry pipeline, as a board or a table, ending in a conversion that opens the sale
flow (`FR-CRM-01`).

### 19.1 Board

*illustrative — not committed code*

```text
┌──────────┬───────────┬───────────┬────────────┬──────────┐
│ NEW (12) │CONTACTED 8│ TRIAL (3) │CONVERTED 21│ LOST (14)│
├──────────┼───────────┼───────────┼────────────┼──────────┤
│ M. Desai │ R. Kulkar │ P. Shetty │ A. Nair    │ V. Joshi │
│ Walk-in  │ Website   │ Walk-in   │ Marketplace│ Website  │
│ Follow up│ Follow up │ Trial ends│ ORD-…00148 │ Too far  │
│ today ⚠  │ 08 Aug    │ 09 Aug    │ ₹15,000    │          │
│ [Call]   │ [Call]    │ [Convert] │            │          │
└──────────┴───────────┴───────────┴────────────┴──────────┘
```

**The five columns are the five values of a closed enum** — `NEW`, `CONTACTED`, `TRIAL`,
`CONVERTED`, `LOST`. **A client must not invent a sixth.** A board that offers a custom column would
be offering a state the server cannot store.

### 19.2 Content and rules

| Aspect | Behaviour |
| :--- | :--- |
| Card | Name · phone with `tel:` · source · assigned staff · **follow-up date, overdue ones flagged** · last note |
| Table view | The same data sorted by `follow_up_on:asc` (default), `created_at:desc`, `full_name:asc`. Toggle persists per user in URL state |
| Filters | Status · branch · assigned staff · source · follow-up range · `q` |
| Advance | Drag between columns, or a status control on the card. **Both paths exist** — drag is never the only way (`NFR-USE-02`) |
| **Convert** | Opens `SCR-DASH-012` pre-filled with the lead's name and phone. On completion the lead is set `CONVERTED` **with `converted_order_id`** |
| **A lead is never silently promoted into a member** | Conversion **is a sale**. This endpoint records the link; it does not manufacture a member. Setting `CONVERTED` without an order is `422`, and the UI therefore does not offer that state as a free choice |

### 19.3 States

| State | Behaviour |
| :--- | :--- |
| **Loading** | Five column headers with counts skeletoned; three card skeletons per column |
| **Empty — no leads** | *"No enquiries yet. Add the next person who walks in and asks about prices — that's a lead."* with **Add lead**. The definition matters: staff who do not know what a lead is will not create one |
| **Empty — one column** | Per-column empty text, e.g. *"Nothing in trial."* — never a blank column with no explanation |
| **Error** | Board-level retry; a failed drag **reverts the card with the reason** |
| **Permission-denied** | A `TRAINER` gets the full-screen denial. A receptionist sees their branch's leads; another branch is **refused** |
| **Overdue follow-up** | Flagged on the card and surfaced in the board header count, so the pipeline nags rather than waits |

**Acceptance:** `FR-CRM-01` · closed five-state enum respected · conversion opens the sale flow and
records `converted_order_id`.

---

## 20. `SCR-DASH-018` — Staff

| | |
| :--- | :--- |
| **Route** | `/staff` · detail `/staff/:id` · **Feature** `src/features/staff/` · **Persona** Rohan hiring a receptionist |
| **Permission** | `staff.staff.list` · invite / update / remove — **`GYM_OWNER` ●, `GYM_MANAGER` `▪`** (own branches, **at or below their own role**) |
| **WCAG** | Level A minimum, AA target · **Live data** No · **Budget** p95 ≤ 800 ms |

**Purpose.** `US-STAF-01` — *"a receptionist who can take money but cannot change prices"*
(`FR-STAF-01`…`FR-STAF-09`).

### 20.1 Content

| Region | Content |
| :--- | :--- |
| **Seats** | **`seats: { used: 6, limit: 10, tier_key: "GROWTH" }`** rendered as a persistent header figure — the limit is visible **before** it bites (`FR-STAF-06`) |
| **List** | Name · role · branches · status (`INVITED`, `ACTIVE`, `SUSPENDED`, `REMOVED`) · invited/joined dates · **last activity**. Email is **masked** for a manager (`s****a@example.in`) |
| **Removed staff** | **Remain listed** behind *"Show removed"*, because `AC-STAF-01.4` preserves historical attribution and a name that cannot be resolved makes an activity log unreadable |
| **Invite** | Email **or** phone (`+91`, 10 digits starting 6–9), full name, **role and branches fixed at invitation** (`FR-RBAC-06`) |
| **Detail** | **Activity log** — check-ins performed, payments collected, members created, overrides used (`FR-STAF-05`) — plus a **permission summary** in plain language |

### 20.2 The guards, and how they read

| Guard | UI |
| :--- | :--- |
| **Branch assignment required** | A `RECEPTIONIST` or `TRAINER` invited with no branches is `400 BRANCH_ASSIGNMENT_REQUIRED`. The form makes branches **required** for those two roles and explains why: *"A branch-scoped role with no branch is either everything or nothing, and both are wrong."* `GYM_OWNER` is tenant-scoped and the branch control is **hidden**, not merely ignored |
| **Seat limit** | `422 STAFF_SEAT_LIMIT_REACHED` → *"Your Growth plan includes 10 staff seats and all 10 are in use. Remove a member or upgrade to add more."* rendered **with the upgrade path**, not as a dead end |
| **Manager ceiling** | A `GYM_MANAGER` may invite only into their own branches and **only at or below their own role** — the role selector omits `GYM_OWNER` for them, and the server refuses regardless |
| **Last owner** | `422 LAST_OWNER_CANNOT_BE_REMOVED` fires on **`PATCH` exactly as on `DELETE`**: demotion and removal are the same threat. The UI disables both for the last owner **with the reason**, and the server enforces it as an aggregate invariant |
| **Removal timing** | The confirmation states it precisely: access is revoked **at their next request, not at their next login**, and every session scoped to this tenant is revoked |
| **Role change latency** | *"Takes effect within 60 seconds. They do not need to sign out."* (`FR-RBAC-04`) |
| **Attribution** | The removal confirmation names what is preserved: *"His 1,284 recorded check-ins and ₹2,14,500 collected stay attributed to him."* |
| **Invitations** | Hashed, single-use, **7-day** expiry. Expired → `410` **offering a resend**; reused → `409` routing to sign-in |

### 20.3 The permission summary — plain language, not a matrix

The detail page renders what this person **can and cannot do**, generated from their effective
permission set, in sentences:

> **Sameer Kulkarni · Receptionist · Bandra West**
> Can: check members in and override denials with a reason · create and edit members he creates ·
> record offline sales and collect balances · capture and advance leads · see attendance for Bandra
> West.
> Cannot: create or edit plans · see settlements or invoices · invite staff · change gym or payout
> details · see any data for Andheri East.

This is the screen that answers Rohan's actual question — *"can he change prices?"* — without making
him read `B3.2`.

### 20.4 States

| State | Behaviour |
| :--- | :--- |
| **Loading** | Seat counter and list skeletons; the invite button is live immediately |
| **Empty** | *"You're the only person here. Invite a receptionist so you don't have to be at the desk."* — `B2.1`'s *"less time at the desk"* stated as the benefit |
| **Error** | List retry; the invite form preserves values and maps `details[]` to fields |
| **Permission-denied** | A `RECEPTIONIST` or `TRAINER` gets the full-screen denial. A `GYM_MANAGER` sees only their branches' staff and no `GYM_OWNER` option |
| **Seat limit reached** | The invite button stays visible and explains rather than disappearing — a hidden control teaches nothing |
| **`INVITED` pending** | Shows the expiry countdown with **Resend** and **Cancel invitation** |
| **`SUSPENDED`** | Distinguished from `REMOVED` in words: *"temporarily off shift"* versus *"access revoked"* |

**Acceptance:** `AC-STAF-01.1` (a receptionist at branch 1 sees check-in, members and sales for
branch 1 only) · `AC-STAF-01.2` (direct-URL plan editing is refused **server-side**) · `AC-STAF-01.3`
(every collection listed with amount, member, timestamp, order reference) · `AC-STAF-01.4` (removal
revokes immediately and preserves attribution) · `FR-RBAC-06`, `FR-RBAC-07`, `FR-STAF-06`.

---

## 21. `SCR-DASH-019` — Reviews

| | |
| :--- | :--- |
| **Route** | `/reviews` · **Feature** `src/features/reviews/` · **Persona** Rohan, who fears reviews and needs a fair answer |
| **Permission** | `reviews.review.list` · respond and report — `GYM_MANAGER` ● and `GYM_OWNER` ● |
| **WCAG** | Level A minimum, AA target · **Live data** No · **Budget** ≤ 50 rows p95 ≤ 800 ms |

**Purpose.** `US-REV-01` states the design brief exactly: *"a fair chance to answer a bad review, and
**no ability to hide it**."*

### 21.1 Content

| Region | Content |
| :--- | :--- |
| **Header metrics** | Displayed rating as the **plain mean with the count** (`BR-REV-07`, `FR-REV-08`) · rating trend chart · **response rate** · median time to respond |
| **Filters** | Rating · date range · branch · **response state** (answered / unanswered) · sub-rating |
| **Review card** | Stars overall · **sub-ratings** (equipment, cleanliness, staff, crowd, value) · text · date · **member tenure** (*"member for 14 months"*) · verified-visit indicator · response state |
| **Respond** | One public response per review (`FR-REV-05`), screened identically to the review. The composer states: *"Your response is public and permanent, and it is screened the same way reviews are."* |
| **Report** | A **structured reason**, never free text as the primary input. The confirmation says the quiet part out loud: *"Reporting does not remove or hide this review. A moderator will look at it and you will be told the outcome."* (`FR-REV-06`, `AC-REV-01.3`) |

### 21.2 What must not exist on this screen

`AC-REV-01.2`: *"when I look for a delete or edit action on it, then **none exists anywhere in the
interface or API**."*

- **No delete control. No unpublish control. No hide control.** Not disabled, not behind a
  permission — **absent**.
- No mechanism to reorder or feature selected reviews.
- No way to solicit a review from a chosen member outside the platform's own prompt schedule
  (`FR-REV-10`).

A component test asserts that the review card renders no destructive action for any role on this
surface. This is one of the few places where the specification names a **negative** requirement,
because the trust layer's integrity is worth more than its volume.

### 21.3 States

| State | Behaviour |
| :--- | :--- |
| **Loading** | Metrics skeleton; four card skeletons at real height; the trend chart is dynamically imported |
| **Empty — no reviews** | *"No reviews yet. Members can review after they check in — the first ones usually arrive a few weeks after you go live."* Setting the expectation prevents the belief that reviews are broken |
| **Empty — fewer than three** | The **count is shown and no numeric rating is displayed** (`BR-REV-07`, `AC-DETL-02.1`). The header explains: *"We show a rating once you have 3 reviews. You have 2."* |
| **Empty — filters** | Filter named with relaxation count |
| **Error** | List and metrics fail independently |
| **Permission-denied** | `RECEPTIONIST` and `TRAINER` get the full-screen denial |
| **Held for moderation** | A review under moderation shows *"Held for moderation — not currently public"* and **cannot be responded to** until resolved |
| **Response pending screening** | The owner's response shows as *"Submitted — being screened"*, never as published before it is |
| **Reported** | The card shows *"Reported — under review, still published"*, which is the honest state |

**Acceptance:** `AC-REV-01.1` (one public response) · `AC-REV-01.2` (**no delete or edit exists**) ·
`AC-REV-01.3` (reporting keeps it published, opens a case, notifies the outcome) · `FR-REV-05`,
`FR-REV-06`, `FR-REV-08`.

---

## 22. `SCR-DASH-020` — Reports

| | |
| :--- | :--- |
| **Route** | `/reports` · individual `/reports/:reportKey` · **Feature** `src/features/reports/` |
| **Persona** | Rohan asking *"which plan actually makes me money"* (`US-RPT-01`) |
| **Permission** | `reporting.report.read`. `RECEPTIONIST`, `TRAINER` and `GYM_MANAGER` at `▪` — scoped reports only |
| **WCAG** | Level A minimum, AA target · **Live data** No · **Budget** ≤ 5 s synchronous for ≤ 12 months; **beyond that asynchronous with notification** (`NFR-PERF-06`) |

**Purpose.** A catalogue of sixteen tenant reports, each with a date range, branch filter, chart,
table, drill-down and export (`FR-RPT-01`…`FR-RPT-05`).

### 22.1 The catalogue, as cards

Sixteen cards, grouped, each showing its name, one-line description and last-run figure where cheap:

| Group | Reports |
| :--- | :--- |
| **Money** | Revenue summary · Revenue by plan · Outstanding balances · Tax report · Settlement statement |
| **Members** | New members · Renewals · Churn cohort · Member activity · Expiring memberships |
| **Operations** | Attendance summary · Peak hours · Staff activity |
| **Growth** | Coupon performance · Review summary · Lead funnel |

### 22.2 The report view

| Element | Behaviour |
| :--- | :--- |
| Controls | **Date range** (with FY presets — `2026-27`, Q1…Q4 on the **April boundary**) · **branch filter** · grouping (day / week / month) |
| Chart | Dynamically imported; **always accompanied by the table**, never chart-only |
| Table | The figures, with monetary columns rendered from `_minor` + `currency` |
| **Drill-down** | `FR-RPT-05` — **clicking a total reveals its constituent records.** Revenue by plan → the individual orders composing that net (`AC-RPT-01.2`) |
| Export | CSV. **Human-readable headers**, every monetary column a **plain number with a separate currency column** (`AC-RPT-01.3`) — never `₹1,23,456` inside a CSV cell |
| Scheduled delivery | Daily / weekly / monthly by email (`FR-RPT-04`), configured per report with recipients |
| **Freshness** | Non-financial reports read data **no more than 15 minutes stale**; **financial reports read the ledger and are always current** (`FR-RPT-02`). Every report **states which it is**, in the header, next to the date range |

### 22.3 States

| State | Behaviour |
| :--- | :--- |
| **Loading** | Catalogue cards render immediately; a report view skeletons its chart frame and table columns |
| **Loading — long report** | Above the threshold, the request becomes **asynchronous**: *"This range is large. We'll email you a link when it's ready — usually under two minutes."* The UI does not sit at a spinner for a job it does not own |
| **Empty — no data in range** | Names the range and the nearest range that has data: *"No sales between 01 and 07 Aug. Your last sale was 28 Jul."* |
| **Empty — insufficient history** | Churn cohort and peak hours state their minimum and the history collected |
| **Error** | Retry on the report; the catalogue is never replaced |
| **Permission-denied** | A `RECEPTIONIST` sees only `▪`-scoped reports — attendance and their own activity. Financial reports are **absent from the catalogue**, and a deep link returns the full-screen denial from the `403` |
| **Export queued** | Explicit queued → ready transition with the **time-limited link** and its expiry stated (`FR-RPT-03`) |

**Acceptance:** `AC-RPT-01.1` (revenue by plan shows units, gross, discounts, net, share) ·
`AC-RPT-01.2` (clicking a net figure reveals the composing orders) · `AC-RPT-01.3` (CSV headers
human-readable; monetary columns plain with a currency column) · `FR-RPT-02` freshness stated ·
`NFR-PERF-06`.

---

## 23. `SCR-DASH-021` — Notifications

| | |
| :--- | :--- |
| **Route** | `/notifications` · **Feature** `src/features/notifications/` · **Persona** Rohan checking whether the renewal reminder actually went |
| **Permission** | The centre is always available to the signed-in user. **Template overrides where the tier permits** (`FR-NOTF-03`); the delivery log needs tenant-level permission |
| **WCAG** | Level A minimum, AA target · **Live data** No — the centre is `NO-STORE`, deliberately **not** the polled cache token |
| **Budget** | ≤ 50 rows p95 ≤ 800 ms |

**Purpose.** Three things in one place: what the platform is telling **me**, what **my members**
were told, and what the messages say (`FR-NOTF-03`, `FR-NOTF-04`, `FR-NOTF-07`).

### 23.1 Content

| Tab | Content |
| :--- | :--- |
| **Centre** | In-app notifications with **read/unread state**, category badge (transactional / operational / marketing), timestamp and a deep link to the thing it is about. `POST /v1/tenant/notifications/:id/read`. Bulk **mark all read** |
| **Delivery log** | Per message: recipient (masked), channel, template and **version**, timestamp, status, retry count and the **provider response category**. Filters by channel, status, template, date, recipient (`FR-NOTF-04`) |
| **Templates** | Tenant overrides **where the tier permits**; otherwise the platform template is shown **read-only with the tier requirement named**, not hidden. Templates are **versioned and previewable**; preview renders with sample data through the same template engine that sends |
| **Defaults** | Which operational notifications are enabled, and the renewal reminder schedule with its **per-tenant override** (`FR-MEMB-10`, `BR-MEM-11`) |

### 23.2 Rules

- **A failed delivery states the category, never the provider's raw message.** *"Not delivered —
  the number is unreachable"*, with the retry count and whether more retries are scheduled.
- **Suppression is a first-class outcome, not a failure.** *"Not sent — the member opted out of
  operational reminders"* and *"Held until 08:00 — quiet hours in the recipient's timezone"*
  (`FR-NOTF-02`, `FR-NOTF-05`) are rendered distinctly from an error.
- **Transactional messages cannot be disabled**, and the defaults tab says so on the control rather
  than rendering a toggle that silently refuses.
- **The centre is `NO-STORE`.** It deliberately does **not** borrow the polled counter's 30-second
  cache token — that would make a just-read notification reappear unread for up to 30 seconds.
- **No recipient phone number or email reaches a log or an analytics event** (`BR-DAT-06`); the
  delivery log masks them on screen too.

### 23.3 States

| State | Behaviour |
| :--- | :--- |
| **Loading** | Tab bar live; eight row skeletons |
| **Empty — centre** | *"Nothing new. We'll tell you here about sales, reviews, payouts and anything that needs you."* — naming the categories so silence is interpretable |
| **Empty — delivery log** | *"No messages sent in this range."* with the range named |
| **Error** | Per-tab retry |
| **Permission-denied** | Template editing absent below the required tier, **with the tier named and an upgrade path**. Delivery log absent for roles without the permission |
| **Rate-limited** | `FR-NOTF-06` storm protection: *"Some messages were held to avoid flooding this member. They will send over the next hour."* — stated, never silent |

**Acceptance:** `FR-NOTF-03` (versioned, previewable, tier-gated overrides) · `FR-NOTF-04` (every
attempt logged with provider response) · `FR-NOTF-07` (read/unread) · `BR-DAT-06`.

---

## 24. `SCR-DASH-022` — Settings

| | |
| :--- | :--- |
| **Route** | `/settings` · subscription at `/settings/subscription` · payout at `/gym/payout` · **Feature** `src/features/settings/` |
| **Permission** | `tenancy.settings.read` / `…update`. **Payout, subscription, data export and the danger zone are `GYM_OWNER` only** |
| **WCAG** | Level A minimum, AA target · **Live data** No · **Budget** p95 ≤ 800 ms; payout writes are `RL-PAY` |

**Purpose.** Nine sections (`B7`), each of which changes behaviour somewhere else in the product —
so every one states **what it affects** beside the control, not in a help article.

### 24.1 Sections

| # | Section | Contents | Consequence stated |
| :-: | :--- | :--- | :--- |
| 1 | **Tenant profile** | Legal name, trading name, entity type, registration number, **PAN**, **GSTIN**, registered address | **Every field here is MATERIAL** — the §5.4 acknowledgement flow applies. PAN and GSTIN are **printed on every invoice** |
| 2 | **Timezone & locale** | `Asia/Kolkata` (+05:30, no DST), `en-IN`, `DD MMM YYYY` | *"Membership validity, expiry and operating hours are all computed in this timezone."* (`BR-MEM-03`) |
| 3 | **Tax profile** | GST registration status, **18%** on fitness services, **CGST + SGST as two lines**, SAC code, place of supply = branch location, **FY start 1 April** | *"Changes apply to future invoices only. Issued invoices are immutable."* |
| 4 | **Refund policy editor** | Window, usage threshold, cancellation fee, pro-rata basis | **`BR-REF-02`: the policy stored on the order governs that order.** *"Changing this affects new orders only. The 412 orders already placed keep the policy they were sold under."* |
| 5 | **Check-in configuration** | **Duplicate cooldown** · **auto-checkout time** · **override reason list** · success/denial display durations · confirmation sound | Each states its desk effect: *"Cooldown 30 minutes — a second scan inside 30 minutes is recorded but consumes no session."* |
| 6 | **Notification defaults** | Category toggles, renewal reminder schedule override, quiet hours | Transactional cannot be disabled and the control says so |
| 7 | **Subscription & billing** | Tier, **seat limit and seats used**, dunning state, invoices, upgrade path | `BR-TEN-06` — an arrears state names **what stops working and when** |
| 8 | **Payout account** | Masked account (last four only), IFSC, bank, verification state, **hold state with `hold_until`** | §24.2 |
| 9 | **Data export & danger zone** | Full tenant export · account closure request | *"Your data leaves with you."* — `B2.1`'s lock-in fear, answered by a visible control |

### 24.2 The payout account — the most dangerous control on this surface

| Property | UI |
| :--- | :--- |
| Display | **Only the last four digits exist to return.** The full number lives tokenised with the provider; there is nothing to mask because there is nothing stored |
| Required acknowledgement | `confirm_payout_suspension: true` is a **request field**, so the confirmation is server-enforced, not a dialogue: *"Payouts are held until we verify the new account. Your last four digits change from 4417. Every owner is notified, including on the previous account's last four."* |
| Verification | Penny-drop runs asynchronously; the UI shows `IN_PROGRESS` with the server-supplied `poll_after_seconds`. Failure **names the mismatch category, never the name the bank returned** |
| Hold | `payout_hold` is **a date, not a boolean**. The UI shows `hold_until`. **Batches keep accruing; only the payout is held** — stated, because an owner who thinks sales stopped will panic |
| Listing | Unaffected. *"A bank change is a money event, not a listing event."* |
| **Impersonation** | A `SUPPORT_AGENT` acting as the owner is refused with `403 IMPERSONATION_FORBIDS_FINANCIAL_MUTATION` **before validation**, and the message tells the agent to have the owner do it themselves. The UI renders that message verbatim |
| Provider unreachable | `503` → **the row is not written**. The UI says so explicitly: *"Nothing changed. A payout destination we cannot verify is worse than no change."* |

### 24.3 States

| State | Behaviour |
| :--- | :--- |
| **Loading** | Section nav renders immediately; each section skeletons its own form |
| **Empty** | Not applicable — settings always have values. **Unset optional values render as "Not set" with the default that applies**, never as blank |
| **Error** | Section-level. A failed tax-profile save never loses the check-in configuration on the same page |
| **Permission-denied** | A `GYM_MANAGER` sees sections 2, 5 and 6 editable and 1, 3, 4, 7, 8, 9 **absent** — not locked, absent (`FR-NAV-03`). Receptionist and trainer get the full-screen denial |
| **Application locked** | While `SUBMITTED`/`UNDER_REVIEW`, section 1 and the payout account are locked with §4.6's explanation |
| **Arrears** | Section 7 shows the dunning state, the amount, the date on which functionality is affected, and what specifically stops |
| **Export in progress** | Queued → ready, with the **24-hour link expiry** stated and the fact that **every download is logged** |

**Acceptance:** `BR-REF-01`, `BR-REF-02` (policy editor states order-scoped effect) · `BR-GYM-06`
(payout change suspends payouts, listing untouched) · `FR-STAF-06` (seats visible before they bite) ·
`BR-TEN-06` (dunning state legible) · `BR-DAT-05` (export logged, link time-limited) ·
`NFR-USE-06` on every section.

---

## 25. Screen → endpoint → permission traceability

Every screen, the endpoints it consumes, and the permission that reveals it. This table is the
Phase-6 acceptance evidence that all 22 `dash` screens are specified.

| `SCR-` | Screen | Primary endpoints | Permission | Four states | Live |
| :--- | :--- | :--- | :--- | :-: | :-: |
| `001` | Home | `GET /tenant/attendance/live` + nine alert reads | *(always; composed by permission)* | §3.9 | ✔ |
| `002` | Onboarding Wizard | `GET`/`POST /tenant/applications` · `POST /tenants` · `PATCH /tenant` · `GET`/`POST`/`DELETE /tenant/kyc-documents` | `onboarding.application.read` / `…submit` | §4.9 | — |
| `003` | Gym Profile | `GET`/`PATCH /tenant/gyms/:id` · `POST`/`PATCH`/`DELETE …/media` · `POST …/amenities` | `catalog.gym.read` / `…update` | §5.7 | — |
| `004` | Branches | `GET`/`POST`/`PATCH`/`DELETE /tenant/branches` · `PUT …/:id/hours` | `catalog.branch.list` / `…create` | §6.5 | ✔ |
| `005` | Plan Catalogue | `GET /tenant/plans` · `POST …/publish` · `…/archive` · `…/duplicate` | `plans.plan.list` | §7.4 | — |
| `006` | Plan Editor | `GET`/`PATCH /tenant/plans/:id` · `POST /tenant/plans` | `plans.plan.update` / `…create` | §8.7 | — |
| `007` | Member List | `GET /tenant/members` · `POST /tenant/members` · `POST /tenant/members/import` · `POST /tenant/exports` | `crm.member.list` | §9.5 | — |
| `008` | Member 360 | `GET`/`PATCH /tenant/members/:id` · `GET`/`POST …/notes` · `GET /tenant/memberships/:id` | `crm.member.read` | §10.4 | — |
| `009` | **Check-in Desk** | `POST /checkin/scan` · `/checkin/manual` · `/checkin/override` · `/checkin/:id/checkout` · `GET /tenant/members?q=` · `useLiveCounters()` | `attendance.checkin.record` (+ `…override`) | §11.13 | ✔ |
| `010` | Attendance Log | `GET /tenant/attendance` · `…/heatmap` · `POST /tenant/exports` | `attendance.log.view` | §12.3 | — |
| `011` | Sales & Orders | `GET /tenant/orders` · `GET /tenant/payments` · `POST /tenant/exports` | `ordering.order.list` | §13.3 | — |
| `012` | Record Offline Sale | `POST /tenant/orders/offline` · `POST …/collect-balance` · `GET /tenant/plans` · `POST /tenant/members` | `ordering.order.create_offline` | §14.5 | — |
| `013` | Invoices | `GET /tenant/invoices` · `GET …/:id/pdf` · `POST /tenant/exports` | `billing.invoice.list` | §15.3 | — |
| `014` | Settlements | `GET /tenant/settlements` · `GET …/:id` | `settlements.batch.list` / `…read` | §16.4 | — |
| `015` | Refunds | `GET`/`POST /tenant/refunds` | `refunds.refund.list` / `…create` | §17.4 | — |
| `016` | Coupons | `GET`/`POST /tenant/coupons` · `PATCH …/:id` | `ordering.coupon.list` | §18.3 | — |
| `017` | Leads | `GET`/`POST`/`PATCH /tenant/leads` | `crm.lead.list` / `…create` | §19.3 | — |
| `018` | Staff | `GET`/`POST /tenant/staff` · `PATCH`/`DELETE …/:id` · `GET …/:id/activity` | `staff.staff.list` / `…invite` | §20.4 | — |
| `019` | Reviews | `GET /tenant/reviews` · `POST …/:id/respond` · `…/report` | `reviews.review.list` | §21.3 | — |
| `020` | Reports | `GET /tenant/reports/:reportKey` · `POST`/`GET /tenant/exports` | `reporting.report.read` | §22.3 | — |
| `021` | Notifications | `GET /tenant/notifications` · `…/delivery-log` · `POST …/:id/read` · `GET`/`POST`/`PATCH /tenant/notification-templates` | *(centre always; log and templates gated)* | §23.3 | — |
| `022` | Settings | `GET`/`PUT /tenant/settings` · `GET`/`PUT /tenant/payout-account` · `GET /tenant/subscription` · `POST /tenant/exports` | `tenancy.settings.read` / `…update` | §24.3 | — |

### 25.1 `NFR-USE-*` coverage

| NFR | Where it is discharged |
| :--- | :--- |
| `NFR-USE-01` | §0.2 L2, §2.8, §11.14 (AA enumerated for the check-in desk) |
| `NFR-USE-02` | §2.8, §11.11 (the desk's full keyboard map), keyboard alternatives for drag in §5.8, §7.5, §19.2 |
| `NFR-USE-03` | §2.8, §9.3 (44 px hit targets on compact rows), §11.14 |
| `NFR-USE-04` | §2.8 (token palette enforcement), §11.14 |
| `NFR-USE-05` | §2.5 — three error placements, none of them a bare code |
| `NFR-USE-06` | §2.7 — the eleven-row destructive register, every figure server-computed; §8.4, §8.6 in detail |
| `NFR-USE-07` | §2.9 — six bands, tables scroll inside their container |
| `NFR-USE-08` | §2.10 — key grammar, server-resolved messages not re-keyed, CI gate |
| `NFR-USE-09` | §11.2, §11.10 — lower-third reach rule, portrait layout, full-screen mode |

### 25.2 Where each persona's stated need is answered

| Need | Screen and section |
| :--- | :--- |
| Rohan: *"what do I do today"* in one screen | `SCR-DASH-001` §3.1–§3.6 |
| Rohan: nothing critical more than two taps deep | §3.5 — every action list acts **in place** |
| Rohan: the renewal list that makes money in week one | §3.5 Expiring tab → §14 pre-filled sale |
| Rohan: the attendance chart that tells him when to staff | §12.1 heatmap, `AC-CHK-02.1` |
| Rohan: export must be obvious, not hidden | §9.4 toolbar export, §24.1 section 9 |
| Rohan: fear that a price change re-bills people | §8.4 — the confirmation's first clause |
| Sameer: under two seconds per check-in | §11.3, §11.15 |
| Sameer: member lookup by phone in **one field** | §9.2, §11.8 |
| Sameer: not blamed for a discrepancy | §14.2 attribution shown before submission; §20.3 permission summary |

---

## 26. Component inventory this surface requires

Named here so `/docs/ui/Components.md` can map each to its shadcn/ui primitive. **`packages/ui`
contains no API calls, no query hooks, no business logic and no domain types beyond primitives**
(UI5); a component that encodes domain meaning lives in the owning feature (UI4).

| Component | Home | Owner |
| :--- | :--- | :--- |
| `LastUpdatedIndicator` | `packages/ui` | Renders `generatedAt` / `isStale`. **Mandatory beside every polled figure** (LC5) |
| `Money` · `Rate` | `packages/ui` | Format-only wrappers over the single `packages/utils` formatter (M-UI-2) |
| `DataTable` (virtualised, sticky first column, card fallback at `xs`) | `packages/ui` | §2.9, FP5 |
| `EmptyState` · `ErrorState` · `PermissionDeniedState` · `BranchRefusedState` | `packages/ui` | The §2.4 contract, so a screen cannot ship a bare "No results" |
| `DestructiveConfirmDialog` | `packages/ui` | Takes a **server-computed consequence string**; has no default text (FM7) |
| `VisibleIf` | `src/shared/permissions/` | Presentation-only filtering — **never a security control** (N1) |
| `BranchScope` | `src/shared/branch/` | `FR-STAF-03` scoping in the UI |
| `ScannerViewfinder` | `features/checkin-desk/` | Domain-specific; wraps the dynamically imported `@zxing/browser` |
| `CheckinResultPanel` | `features/checkin-desk/` | Success / denial / offline; owns the `aria-live` region |
| `MarketplaceCardPreview` | `features/plans/` | Renders the server's `marketplace_preview.card` — **never a second implementation** (§8.3) |
| `SettlementStatement` | `features/settlements/` | Renders the eight figures and the published `sum_invariant`; **computes nothing** |
| `PriceBreakdown` | `features/sales/` | Renders `breakdown` including `tax_components[]`; **sums nothing** |
| `FieldChangeClassMarker` | `features/gym-profile/` | Renders from `field_change_classes` (§5.4) |
| `OnboardingStepRail` · `KycChecklist` | `features/onboarding-wizard/` | Server-computed progress only |

---

## 27. Open items this document depends on

| # | Item | Blocks | Owner |
| :-: | :--- | :--- | :--- |
| 1 | `Tenant.md` (Phase-5) has not yet published per-endpoint detail for the ten financial `API-TEN` rows (`GET /tenant/orders`, `/tenant/invoices`, `/tenant/settlements`, `/tenant/refunds`, `POST /tenant/orders/offline`, `…/collect-balance`, `GET /tenant/reports/:reportKey`, `POST /tenant/exports`). This document specifies them from `API_Catalog.md` §3.9 and `Admin.md` §10.2's shape | §13, §14, §15, §16, §17, §22 exact field names | API |
| 2 | `commission_tax_minor` (`Cₜ`) — the ninth figure — is `PENDING_CLIENT_DECISION`. The statement renders it as a present-and-null field and reads `sum_invariant` **as data**, so adoption changes no component | `SCR-DASH-014` | Owner + Finance |
| 3 | `OQ-09` — whether **all** denials are overridable. The recorded default is yes-with-a-reason; §11.7 renders the server's per-reason authority rather than a client list, so a resolution changes no component | `SCR-DASH-009` | Product |
| 4 | Check-in success/denial display durations, cooldown, auto-checkout time and the override reason list are **tenant configuration** (§24.1 section 5), not constants | `SCR-DASH-009`, `SCR-DASH-022` | Product |
| 5 | Tier gating for notification template overrides (`FR-NOTF-03`) — the tier boundary is configuration; §23.1 names the tier from the server | `SCR-DASH-021` | Product |
| 6 | The exact at-risk threshold behind `FR-CRM-06` is configuration; §3.5 renders baseline and current rather than a threshold | `SCR-DASH-001`, `SCR-DASH-007` | Product |

---

## 28. Review checklist for any pull request touching `apps/gym-dashboard`

- [ ] The screen implements **loading, empty, error and permission-denied**, and the empty state
      explains **why** and offers the next action.
- [ ] Branch refusal renders as a **named state**, not an empty list (N3).
- [ ] No `refetchInterval` outside `src/shared/hooks/useLiveCounters.ts`; every polled figure carries
      `LastUpdatedIndicator` (LC1, LC5).
- [ ] No money arithmetic, no date arithmetic with business meaning, no eligibility decision in a
      component (BL2, BL3, BL4).
- [ ] Every monetary render goes through the single formatter; **lakh-crore grouping** verified.
- [ ] Every destructive action confirms with a **server-computed** consequence (§2.7).
- [ ] No user-facing string literal; every key exists in the catalogue (I18N1, I18N5).
- [ ] Every form is React Hook Form + Zod with the shared schema; server `details[]` map onto fields.
- [ ] Every write carries an `Idempotency-Key` where §14.2.1 requires it, and the submit disables
      while in flight.
- [ ] Permission hiding is presentation only; the route renders its denial from a **server `403`**.
- [ ] axe-core passes; the check-in desk additionally passes a **manual keyboard and screen-reader**
      pass.
- [ ] No horizontal page scroll from 320 px to 2560 px; wide content scrolls in its own container.
- [ ] No hex literal, no arbitrary Tailwind value; tokens only (UI3).
- [ ] The feature's `README.md` names the `SCR-` screens and `FR-` identifiers it implements (F3).

---

*End of GymDashboard.md.*
