# Super-Admin Console — UI Specification (`admin`)

`/docs/ui/AdminDashboard.md` · surface `admin` · app `apps/admin-dashboard`

---

## 0. Document control

| Field | Value |
| :--- | :--- |
| **Scope** | The fifteen `SCR-ADM-*` screens of `MASTER_PRD.md` §B8, their four mandatory states, their keyboard model, their consumption of the frozen API contracts, and the density rules that separate this surface from the other two |
| **Surface** | `admin` — `apps/admin-dashboard`, React 18 + Vite + TypeScript, **SPA**. No server components (`PROJECT_CONSTITUTION.md` §16.1 NX9) |
| **Audience** | The six platform-staff roles of `B3.1`: `SUPER_ADMIN`, `VERIFICATION_OFFICER`, `SUPPORT_AGENT`, `FINANCE`, `MODERATOR` — plus `SUPER_ADMIN` acting as any of them |
| **Precedence** | `PROJECT_CONSTITUTION.md` §16 (Frontend Rules) > `docs/apis/README.md` (contract law) > `docs/apis/Admin.md` (endpoints) > `MASTER_PRD.md` §B8 > this file. Where this file appears to contradict any of them, they win and this file is defective |
| **Sibling documents** | `/docs/ui/DesignSystem.md` — tokens, typography scale, spacing scale, icon set, component inventory. This file **consumes** those tokens and defines none of its own (`UI2`, `UI3`, `UI7`) |
| **Status** | Specification written **before** any component exists. Every fenced block in this document is labelled *illustrative — not committed code* and none of it is the implementation |
| **Launch market** | India. INR, `Asia/Kolkata`, `en-IN`, single locale, every string externalised (`NFR-USE-08`) |

### 0.1 What this document is not

| Not here | Where it lives |
| :--- | :--- |
| Colour values, type ramp, spacing scale, radii, shadow tokens | `/docs/ui/DesignSystem.md` |
| Endpoint request/response shapes | `/docs/apis/Admin.md`, `/docs/apis/Authentication.md`, `/docs/apis/Reviews.md`, `/docs/apis/Notifications.md` |
| Business-rule definitions | `MASTER_PRD.md` §A8, §B5 |
| The gym-owner dashboard's twenty-two screens | `/docs/ui/GymDashboard.md` |
| Component code | Nowhere yet. That is the point of writing this first |

---

## 1. Who this surface is for

`B2.4` and `B2.5` are the two personas that decide every layout choice below. They are not
"users"; they are two people doing a job all day, and the console is their instrument panel.

### 1.1 Anita — verification officer (`B2.4`)

| Fact | Design consequence |
| :--- | :--- |
| Reviews **30–60 applications per day** | The cost of one extra click on `SCR-ADM-003` is 30–60 extra clicks a day. Approve and Reject carry keyboard shortcuts and the queue advances without a mouse |
| Needs to decide in **under three minutes** (`US-ONB-02`) | Every piece of evidence on one screen. No tab that hides a document. No download step — `AC-ONB-02.1` says *"documents render in an inline viewer alongside the structured checklist without downloading"* |
| Needs a **structured reason** for every rejection, not prose | The sixteen `C4.8` application-rejection codes are a picker, not a text box. Free text is additive (`RS4`) |
| Needs to see whether this address or this owner has applied before | The pre-check panel is above the fold with **failures expanded and passes collapsed** (`AC-ONB-02.2`), and prior versions carry a field-level diff |

### 1.2 Vikram — finance analyst (`B2.5`)

| Fact | Design consequence |
| :--- | :--- |
| Needs a **ledger he can trust** | Nothing is recomputed at display time. Every one of the eight `A6.3` figures is rendered from a persisted field (`FR-SETL-02`, `BL2`) |
| Needs statements that **tie out to the minor unit** | The settlement statement shows the arithmetic and the visible sum equals the payout (`AC-SETL-01.1`, `BR-FIN-03`). If it does not, the screen says so rather than rounding it away |
| Needs a refund queue with **enough context to decide** | `SCR-ADM-008` renders the full `FR-RFND-04` computation before the confirm button becomes active |
| Needs **exports that open in a spreadsheet without cleanup** | Every export carries the join keys. Money is a plain integer column beside an explicit currency column (`AC-RPT-01.3`) |

### 1.3 The other four platform roles

| Role | Screens they can reach | Screens they cannot |
| :--- | :--- | :--- |
| `SUPER_ADMIN` | All fifteen | — |
| `VERIFICATION_OFFICER` | 001 (reduced), 002, 003, 004 (read-only Profile & KYC tab), 011 (`/config/kyc` read), 015 (read) | 005–010, 012, 013, 014, the rest of 011 |
| `FINANCE` | 001 (reduced), 004 (read), 006, 007, 008 (read; **decide is `SUPER_ADMIN`**), 009, 010, 011 (`/config/commission` and `/config/tax` **read**), 014, 015 (read) | 002, 003, 005, 012, 013 |
| `SUPPORT_AGENT` | 001 (reduced), 005, 006 (read), 013, 015 (read) | 002, 003, 007–012, 014 |
| `MODERATOR` | 001 (reduced), 011 (`/config/taxonomy` **write**), 012, 015 (read) | 002–010, 013, 014 |

**`FR-NAV-03` governs the navigation, `FR-RBAC-02` governs the truth.** A `MODERATOR` never sees a
*Finance* menu item. If they deep-link to `/finance/settlements`, the router renders the
permission-denied state of §5.4 — it does not redirect, does not blank, and does not pretend the
route is missing. The server refuses independently with `403 PERMISSION_DENIED`, and that refusal is
the control (`BL6`).

---

## 2. The visual language of this surface — density is the requirement

The customer website is a shop. This is a cockpit. The two must not look alike, and the reason is
not taste.

### 2.1 The argument, stated once

Anita opens roughly forty applications a day. Vikram scans a variance list every morning at 09:00
IST and a settlement run every Monday. Whitespace that helps a first-time consumer parse a gym
listing costs a professional a scroll, and a scroll costs a comparison they would otherwise have
made by eye. **On this surface, the number of rows visible without scrolling is a usability metric.**

| Dimension | `web` (consumer) | `admin` (this surface) | Why |
| :--- | :--- | :--- | :--- |
| Base body size | `text-base` (16 px) | **`text-sm` (14 px)**, `text-xs` (12 px) for metadata and table cells | 14 px at 4.5:1 contrast satisfies `NFR-USE-04`; the gain is ~18% more rows per viewport |
| Row height, data tables | n/a | **32 px** default, **40 px** comfortable, user-togglable and persisted per user | 32 px shows 22 rows at 1080 p against 14 at 48 px |
| Section padding | `p-6`/`p-8` | **`p-3`/`p-4`** | Panels are adjacent, not floating |
| Card usage | Heavy — cards are the unit of browse | **Rare.** Panels with a 1 px border and a titled header bar. No drop shadows except on overlays | A shadow implies elevation; twelve elevated cards imply nothing |
| Colour | Brand-led, generous | **Monochrome by default.** Colour is reserved for state: SLA breach, variance, denial, hold, override | If everything is coloured, nothing is a signal |
| Icon-only buttons | Avoided | Permitted in table row actions **with an accessible name and a tooltip** | Row actions cannot afford labels; screen-reader users cannot afford their absence |
| Empty space | Reassuring | **Suspicious.** An empty region on this surface usually means a failed fetch, so empty states are explicit and labelled (§5.4) | |

### 2.2 What density does not license

Density is not compression of the accessibility floor. All of the following hold **identically** to
the consumer site:

| Floor | Value | Source |
| :--- | :--- | :--- |
| Text contrast | ≥ 4.5:1 | `NFR-USE-04`, `AX4` |
| Interactive contrast | ≥ 3:1 | `NFR-USE-04` |
| Touch target | **44 × 44 px minimum on touch input** | `NFR-USE-03`, `AX3` |
| Keyboard operability | **Full**, every screen, every action | `NFR-USE-02`, `AX2` |
| Horizontal scrolling of the page | **Never**, 320 px → 2560 px | `NFR-USE-07`, `AX5` |

**The 44 px rule and the 32 px row are not in conflict.** The 32 px row is the *pointer* density.
The console detects coarse pointers (`@media (pointer: coarse)`) and switches to the 44 px comfortable
row automatically; the manual density toggle is then locked to comfortable with an explanatory
tooltip. A verification officer on an iPad gets 44 px targets; the same officer on a 27-inch monitor
gets 32 px rows. Neither is a downgrade of the other.

### 2.3 Wide content and the no-horizontal-scroll rule

`NFR-USE-07` forbids the **page** scrolling horizontally. It does not forbid a table scrolling inside
its own bounds, and on a fifteen-column payments log at 1280 px it must.

| Rule | Statement |
| :--- | :--- |
| **D1** | Every data table lives inside an `overflow-x: auto` container with `max-width: 100%`. The page body never scrolls horizontally at any width from 320 px to 2560 px |
| **D2** | The first column (the identifying column — application, tenant, order reference, variance id) is **sticky-left** with a visible edge shadow when scrolled |
| **D3** | The row-actions column is **sticky-right** |
| **D4** | Columns are user-selectable from a column picker, persisted per user per screen. The default set is the one named in each screen's Regions table below, never "everything" |
| **D5** | Below 1024 px a data table degrades to a **stacked record list** — one bordered block per row, label-value pairs — rather than a scrolling table. `SCR-ADM-003` and `SCR-ADM-010` are the two screens that also drop to single-column layout |
| **D6** | Numeric columns are right-aligned and set in tabular figures (`font-variant-numeric: tabular-nums`), so a column of rupee amounts is comparable by eye. This is a token, not a per-component choice |

### 2.4 The layout shell at four widths

| Width | Shell |
| :--- | :--- |
| **≥ 1600 px** | Pinned nav 232 px · fluid content, 1440 px max content column · persistent 320 px context panel |
| **1280–1599** | Pinned nav 232 px · fluid content · the context panel becomes a right drawer |
| **1024–1279** | Nav collapses to a 56 px icon rail with labels on hover **and on focus** · content full width |
| **< 1024 px** | Top bar with a menu button · nav is an overlay sheet · tables become stacked record lists (`D5`) |

The console is **designed for ≥ 1280 px** and **usable to 320 px**. It is not a mobile product —
`NFR-USE-07` requires it to survive 320 px, not to be pleasant there. The screens that must remain
genuinely workable on a tablet are `SCR-ADM-002` and `SCR-ADM-003`, because triage happens away
from a desk; those two are specified at 768 px explicitly.

---

## 3. The pre-auth gate — MFA is the door, not a setting

> `NFR-SEC-11`: *"MFA is mandatory for all platform staff roles."* `Admin.md` §2.1 **AM1**: every
> endpoint on this surface requires `amr` to contain `totp`. There is **no read-only exemption**.

The router guard wraps the entire tree (`FolderStructure.md` §6: *"MFA guard wraps the entire tree"*).
There is no route inside `apps/admin-dashboard` reachable with a session that has not satisfied TOTP —
including `/`, including a 404 page.

### 3.1 The four gate states

```text
illustrative — not committed code

              ┌──────────────────────────────────────────────────┐
              │  GymMap · Platform Console                        │
              │                                                   │
              │  ▸ STATE A — UNAUTHENTICATED                      │
              │    Email · Password · [Sign in]                   │
              │    "This console is for platform staff."          │
              │                                                   │
              │  ▸ STATE B — MFA_CHALLENGE                        │
              │    "Enter the 6-digit code from your              │
              │     authenticator app."                           │
              │    [_][_][_] [_][_][_]      ← 6 single-char boxes │
              │    Use a recovery code instead                    │
              │    Signed in as anita.iyer@gymmap.in · Not you?   │
              │                                                   │
              │  ▸ STATE C — MFA_ENROLMENT_REQUIRED               │
              │    "Your account needs two-factor authentication  │
              │     before you can continue. This is required for │
              │     every platform staff account."                │
              │    [QR code]  secret · manual entry               │
              │    [_][_][_] [_][_][_]  [Confirm and continue]    │
              │    → then: ten recovery codes, shown ONCE         │
              │                                                   │
              │  ▸ STATE D — MFA LOCKED                           │
              │    "Too many incorrect codes. Code entry is       │
              │     locked for 15 minutes. Your account itself is │
              │     not locked. Try again at 3:47 PM IST, or use  │
              │     a recovery code now."                         │
              └──────────────────────────────────────────────────┘
```

| State | Trigger | API | UI obligation |
| :--- | :--- | :--- | :--- |
| **A** Unauthenticated | No session | `POST /v1/auth/login` | Password field only. Never hints whether the email exists |
| **B** Challenge | `next_action: "SATISFY_MFA"` | `POST /v1/auth/mfa/verify` with `intent: 'LOGIN'` | Six single-character inputs with `inputmode="numeric"`, `autocomplete="one-time-code"`, paste of a 6-digit string distributes across all six, auto-submit on the sixth character. Focus is on box 1 on mount |
| **C** Enrolment | `next_action: "ENROL_MFA"` — a platform role with no TOTP secret | `POST /v1/auth/mfa/enrol` then `/verify` with `intent: 'ENROL'` | The **only** reachable route (`Authentication.md` §8.12: *"a platform role with no enrolment can reach only this endpoint"*). Recovery codes are shown once, with a mandatory "I have saved these" checkbox before the console loads |
| **D** Locked | `403 ACCOUNT_LOCKED` after 5 TOTP failures in 15 minutes | — | **State what is locked and what is not.** *"MFA verification is locked for 15 minutes; the account itself is not"* is the exact distinction the API makes and the exact distinction the message must carry (`NFR-USE-05`) |

### 3.2 Step-up — `AM2`, the 900-second window

`Admin.md` §2.1 **AM2**: reads are satisfied by `amr` alone; **every write that moves money, changes
authority or changes configuration** requires `now − auth_time ≤ 900 s`.

| Rule | Statement |
| :--- | :--- |
| **SU1** | The console **never pre-empts** the step-up. It does not disable buttons at 901 seconds and it does not poll a countdown. It attempts the write, receives `403 MFA_REQUIRED`, and opens the step-up dialog. Anything else duplicates a server rule in the client and drifts from it |
| **SU2** | The step-up dialog is **modal, focus-trapped, and preserves the pending payload**. On success it **replays the original mutation with the same `Idempotency-Key`** — so a step-up in the middle of a settlement approval cannot produce two approvals |
| **SU3** | The dialog says why: *"Confirm your identity to approve this payout. Money-moving actions need a fresh code."* Not *"MFA required"* |
| **SU4** | Cancelling returns to the screen with the form intact and an inline notice. It never discards the reason the operator typed |
| **SU5** | The `useAdminMutation()` wrapper implements SU1–SU4 **once**, in `shared/mfa/`. A feature that implements its own step-up handling is a review rejection |

```tsx
// illustrative — not committed code
// apps/admin-dashboard/src/shared/mfa/useStepUpMutation.ts
// Every admin write goes through this. It is the ONLY place MFA_REQUIRED is handled.
export function useStepUpMutation<TReq, TRes>(fn: MutationFn<TReq, TRes>) {
  const stepUp = useStepUpDialog();
  return useMutation({
    mutationFn: async (vars: TReq & { idempotencyKey: string }) => {
      try { return await fn(vars); }
      catch (e) {
        if (!isApiError(e, 'MFA_REQUIRED')) throw e;
        await stepUp.open({ messageKey: 'admin.mfa.stepUp.money' });  // SU3
        return fn(vars);                                              // SU2 — same key
      }
    },
  });
}
```

### 3.3 What the gate does **not** do

| Non-behaviour | Reason |
| :--- | :--- |
| It does not offer "remember this device for 30 days" | `AM2` exists because a 30-day refresh family cannot carry one MFA assertion forever. A trusted-device cookie would reintroduce exactly that |
| It does not offer SMS as a second factor on this surface | Not in the `Authentication.md` contract for platform staff; TOTP or recovery code only |
| It does not let a staff member disable their own MFA | `AM3` — `422 MFA_MANDATORY_FOR_ROLE`, *including when the actor is editing their own row*. The toggle is not rendered, and the server refuses regardless (`FR-RBAC-02`) |
| It does not admit an impersonation token | `AM4` — an `IMPERSONATION` token holds the impersonated user's authority, never platform elevation. The console detects `typ: 'IMPERSONATION'` at the router and shows the impersonation surface, not the admin surface |

---

## 4. Shell, navigation and the keyboard model

### 4.1 Navigation tree (`B4.3`), filtered by effective permission (`FR-NAV-03`)

```text
illustrative — not committed code

PLATFORM
  ▸ Dashboard                 /                        SCR-ADM-001   any platform role
ONBOARDING
  ▸ Approval queue            /approvals               SCR-ADM-002   onboarding.application.list_all
  ▸ Tenants                   /tenants                 SCR-ADM-004   admin.tenant.list
  ▸ Users                     /users                   SCR-ADM-005   admin.user.list
FINANCE
  ▸ Orders                    /finance/orders          SCR-ADM-006   admin.order.list
  ▸ Payments                  /finance/payments        SCR-ADM-006   admin.payment.list
  ▸ Settlements               /finance/settlements     SCR-ADM-007   settlements.batch.list_all
  ▸ Refunds            ● 23   /finance/refunds         SCR-ADM-008   refunds.refund.list_all
  ▸ Disputes           ● 4    /finance/disputes        SCR-ADM-009   refunds.dispute.list
  ▸ Reconciliation     ▲ 3    /finance/reconcile       SCR-ADM-010   settlements.reconciliation.read
CONFIGURATION — all SCR-ADM-011, each gated on its own admin.config_<family>.read
  ▸ Commission /config/commission · Subscription tiers /config/subscription
  ▸ Tax profiles /config/tax · KYC checklists /config/kyc · Taxonomy /config/taxonomy
  ▸ Feature flags /config/flags · Notification templates /config/notifications
MODERATION — all SCR-ADM-012
  ▸ Reviews            ● 11   /moderation/reviews            reviews.moderation.list
  ▸ Gym content        ● 2    /moderation/content            admin.moderation_content.list
  ▸ User reports              /moderation/reports            admin.moderation_report.list
OPERATIONS
  ▸ Support                   /support/tickets         SCR-ADM-013   support.ticket.list
  ▸ Analytics                 /analytics               SCR-ADM-014   reporting.platform_report.read
  ▸ Audit log                 /audit                   SCR-ADM-015   audit.audit_log.search
  ▸ Platform staff            /admin/users             SCR-ADM-005   admin.staff.list
```

| Rule | Statement |
| :--- | :--- |
| **N1** | An item renders only if the session's resolved permission set contains its declared permission. A `MODERATOR` sees **Platform**, **Configuration → Taxonomy**, **Moderation**, **Audit log** and nothing else — not greyed items, **absent** items (`FR-NAV-03`) |
| **N2** | A group header with zero visible children is itself absent |
| **N3** | The permission set is **resolved server-side** and delivered on session bootstrap (`BL7`, `C1.5`). The client never evaluates a targeting rule or a role name. `FR-RBAC-04` requires role changes to take effect within 60 seconds without re-authentication, so the set is refetched on window focus and on a 60-second interval |
| **N4** | Badge counts (`● 23`, `▲ 3`) come from the **same** `useLiveCounters()` hook as everything else (`LC1`) and carry the same freshness contract. A badge is a polled figure |
| **N5** | `▲` (variance) is rendered in the alert token, `●` (queue depth) in the neutral token. Colour is never the sole carrier — the glyph differs (`AX9`) |
| **N6** | Deep links resolve after authentication (`FR-NAV-06`). `/finance/settlements/01932e40` opened cold → MFA gate → the settlement, not the dashboard |

### 4.2 The keyboard model

`NFR-USE-02` requires **full** keyboard operability. On this surface that is not a compliance box —
it is Anita's throughput.

| Key | Scope | Action |
| :--- | :--- | :--- |
| `Ctrl/⌘ + K` | Global | Command palette: jump to any screen, any tenant by name, any order by reference, any application by id |
| `g` then `a` | Global | Go to approvals · `g d` dashboard · `g t` tenants · `g u` users · `g f` finance orders · `g s` settlements · `g r` refunds · `g c` reconciliation · `g m` moderation · `g l` audit log |
| `/` | Any list screen | Focus the filter/search input |
| `j` / `k` | Any list screen | Next / previous row (moves focus, does not open) |
| `Enter` | Any list screen | Open the focused row |
| `x` | Any list screen | Toggle row selection where bulk actions exist |
| `Esc` | Anywhere | Close the topmost overlay; in a form with unsaved input, prompt before discarding |
| `?` | Global | Keyboard shortcut reference sheet |
| `Alt + A` / `Alt + R` / `Alt + I` | `SCR-ADM-003` only | Approve · Reject · Request information (§6.3.6) |
| `[` / `]` | `SCR-ADM-003` only | Previous / next document in the viewer |
| `1`…`9` | `SCR-ADM-003` checklist | Jump to checklist item *n* |

| Rule | Statement |
| :--- | :--- |
| **K1** | Single-letter shortcuts are **suppressed while focus is in a text input, textarea or contenteditable**. Typing "just" into a search box must not navigate |
| **K2** | Every shortcut has a visible, discoverable equivalent. `?` lists them all; row actions show their key in the tooltip |
| **K3** | Focus order follows visual order. Every interactive element has a **visible** focus ring meeting 3:1 against both its own and the adjacent background |
| **K4** | Modals trap focus, return focus to the invoking element on close, and are labelled by their heading (`aria-labelledby`) |
| **K5** | No action is mouse-only. Drag-to-reorder (taxonomy, §6.11) has explicit *Move up* / *Move down* buttons that are not a fallback but the primary mechanism |
| **K6** | Destructive shortcuts do not exist. `Alt + A` on `SCR-ADM-003` opens the confirmation, it does not approve |

---

## 5. Cross-cutting patterns

Nine patterns are specified once here and referenced by every screen. A screen that re-solves one of
them is a defect.

### 5.1 The reason dialog — `FR-ADMN-02` as a component

> `FR-ADMN-02`: *"Every administrative action requires a reason and is written to the audit log."*
> `Admin.md` §2.2 **RS1**: `reason` is required on **every** `POST`, `PUT` and `PATCH` in the admin
> API. There is no endpoint where it is optional.

```text
illustrative — not committed code

┌─ Suspend Iron Temple Fitness LLP ─────────────────────────────┐
│  Category *   ( ) Fraud suspected  ( ) KYC lapsed              │
│               (•) Persistent negative balance                  │
│               ( ) Member safety    ( ) Content violation       │
│               ( ) Tenant request   ( ) Other                   │
│                                                                │
│  Reason *                                          38 / 1000   │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ Balance −₹18,400 for three consecutive cycles; owner      │  │
│  │ unreachable since 22 Jul. Escalated as FIN-1182.          │  │
│  └──────────────────────────────────────────────────────────┘  │
│  Minimum 10 characters. Recorded in the audit log and shown    │
│  to the gym owner.                                             │
│                                                                │
│  ⚠ This will suspend a tenant with 214 active members and      │
│    ₹1,84,200 of unsettled balance. Members keep gym access;    │
│    the listing is hidden and payouts stop.                     │
│                                                                │
│  [ Cancel ]                                   [ Suspend ]      │
└────────────────────────────────────────────────────────────────┘
```

| Rule | Statement |
| :--- | :--- |
| **RD1** | The component is `shared/reason/require-reason.tsx` (`FolderStructure.md` §6). Every mutation hook takes a `reason` typed as a branded non-empty `Reason` string; a default of `''` is a review rejection |
| **RD2** | Client-side minimum is **10 characters after trimming**, matching `RS3`. The console trims before counting, exactly as the server does, so the counter and the server agree |
| **RD3** | Where the domain carries a structured taxonomy, the **code picker is required in addition to** the free text, never instead (`RS4`). The picker renders server-supplied labels, never a client-side map, because `FR-ADMN-07` makes the taxonomy Super-Admin-managed |
| **RD4** | The higher floors are enforced client-side too and stated in the helper text: **20 characters** for a pre-check override (§6.3.7), **50 characters** for a reconciliation variance resolution (§6.10.5), **20 characters** for an impersonation reason (§6.5.4) |
| **RD5** | The submit button is disabled until the floor is met **and** re-disabled while the mutation is in flight (`FM6`) |
| **RD6** | On `400 ADMIN_ACTION_REASON_REQUIRED` the error maps onto the reason field by `details[0].field`, not into a toast (`FM5`) |
| **RD7** | The dialog never pre-fills the reason. A pre-filled reason is a reason nobody wrote |

### 5.2 The destructive-confirmation pattern — `NFR-USE-06`

> *"Every destructive action requires confirmation and states its consequence specifically."*

| Rule | Statement |
| :--- | :--- |
| **DC1** | The consequence line carries **server-computed figures**, fetched before the dialog opens, never counted in the client (`FM7`, `BL2`) |
| **DC2** | It names **what will happen to whom**, not what the operator is doing. *"This will suspend a tenant with 214 active members"* — not *"Are you sure?"* |
| **DC3** | Actions above a defined blast radius require **typing the entity's name** to confirm: tenant suspension, tenant closure, commission configuration replacement, feature-flag change at 100% rollout, review removal (terminal per `C4.6`) |
| **DC4** | The confirming button carries the **verb**, never "OK" — *Suspend*, *Reject*, *Remove permanently* |
| **DC5** | Where the action is reversible, the dialog says so and names the reverse: *"Reinstate restores the listing and resumes payouts"* |
| **DC6** | Where it is **not** reversible, the dialog says that too, in the same position, every time: *"Removing a review is permanent. `C4.6` gives `REMOVED` no way back; reinstating would require the member to write a new review"* |

**The eleven destructive actions on this surface, enumerated:**

| # | Action | Screen | Consequence line must state |
| :-: | :--- | :--- | :--- |
| 1 | Reject application | 003 | The owner's progress is preserved and resubmission is unlimited (`BR-GYM-05`) — so this is *less* destructive than it feels, and saying so prevents over-use of *Request information* |
| 2 | Approve with a pre-check override | 003 | Which blocking check is being overridden, its measured value and its tolerance |
| 3 | Suspend tenant | 004 | Active member count, unsettled balance, that members keep access, that the listing hides |
| 4 | Force re-verification | 004 | That the listing stays live and payouts suspend (`BR-GYM-06`) |
| 5 | Change commission override | 004 | Effective rate before and after, validity window, that historical statements are untouched (`AC-ADMN-01.4`) |
| 6 | Force logout / revoke sessions | 005 | Number of sessions, and that the user must sign in again |
| 7 | Approve payout run | 007 | The exact `net_payable_minor`, the destination account (masked), that this instructs a bank transfer |
| 8 | Approve refund | 008 | The refunded amount, that the membership moves to `REFUNDED`, that QR access revokes immediately on a full refund (`FR-RFND-06`) |
| 9 | Resolve variance as `WRITE_OFF` | 010 | The amount written off, that `KPI-26` stays breached for that day, that this is `SUPER_ADMIN`-only |
| 10 | Replace a configuration object | 011 | The dry-run's affected-entity counts (§5.3) |
| 11 | Remove a review | 012 | That `REMOVED` is terminal and the aggregate loses it permanently; and, at exactly three reviews, that the gym's **numeric rating disappears entirely** (`BR-REV-07`) |

### 5.3 The dry-run preview pattern — `SCR-ADM-011`'s guard, generalised

> `SCR-ADM-011` guard: *"Every configuration change requires a reason, shows a preview of affected
> entities, and is audited."* `Admin.md` §14.0 **CF2**: every configuration `PUT` accepts
> `?dry_run=true` and **must** be called that way first; the response carries a `preview_token` and a
> non-dry-run `PUT` without a matching token is `422 CONFIG_VALIDATION_FAILED` with
> `"rule": "preview_required"`.

```text
illustrative — not committed code
Three panes, always in this order, never collapsible past the second.

  ① EDIT ───────────────► ② PREVIEW ───────────────► ③ COMMIT
  the form                 what it will do            reason + confirm

┌─ ② Preview — commission configuration ─────────────────────────────────┐
│  Valid ✓            Preview expires 13:45 IST (14 min)                  │
│                                                                          │
│  Affected                                                                │
│    Tenants                     412    Starter 288 · Growth 97 · Pro 27   │
│    Live plans                    0                                       │
│    Orders, last 30 days      3,180                                       │
│    Est. monthly commission  −₹1,84,000                                   │
│                                                                          │
│  Sample (2 of 412)                    before → after        source       │
│    Iron Temple Fitness LLP     Growth  800 → 750 bps         TIER         │
│    Shakti Strength Studio     Starter  900 → 900 bps         TENANT_OVER. │
│                                        └ unaffected: a tenant override    │
│                                          outranks the tier (§7.2)         │
│                                                                          │
│  ⚠ 412 tenants move to a lower effective rate.                           │
│  ⚠ Applies to sales from the effective date onward only. Settlements     │
│    already computed are untouched (BR-FIN-05, AC-ADMN-01.4).             │
│  ✓ No tenant crosses the 0 bps floor (KL-006).                           │
│                                                                          │
│  [ Back to edit ]                            [ Continue to commit → ]    │
└──────────────────────────────────────────────────────────────────────────┘
```

| Rule | Statement |
| :--- | :--- |
| **DR1** | The commit button does not exist until a valid, unexpired `preview_token` is held. It is not disabled — it is **absent** — because a disabled commit button invites a hunt for the enabling condition |
| **DR2** | **Editing any field after previewing destroys the token** and returns the wizard to pane ①. The token binds to the canonicalised payload hash; the UI must make that visible rather than let the operator discover it as a `422` |
| **DR3** | The preview expiry is rendered as a **countdown in IST**, not as an absolute UTC instant. At expiry the token clears and pane ② re-runs automatically on the operator's next interaction |
| **DR4** | `warnings[]` and `errors[]` render **verbatim from the server**, in order, never summarised, never truncated. They are the server's account of the consequence and the client is not qualified to edit it |
| **DR5** | `errors[]` non-empty → pane ③ is unreachable and each error links to the field it names |
| **DR6** | Three of the seven configuration families are **append-only** (`CF3`: subscription tiers, tax profiles, KYC checklists; commission rules likewise). For those, the commit pane's heading is *"Supersede with a new version"* and it renders the `effective_from` picker prominently — because `PUT` there means *supersede*, never *edit*, and calling it "Save" would teach the wrong model |
| **DR7** | The other four are `ETag`-versioned (`CF4`). A `412 PRECONDITION_FAILED` renders as *"Someone else changed this configuration while you were editing. Here is what changed."* with a side-by-side of the operator's draft and the current server state — never a silent overwrite and never a bare error code |

### 5.4 The four mandatory states

`PROJECT_CONSTITUTION.md` §16.9 and `B6`'s preamble: *"the empty, loading, error and
permission-denied cases are where implementations diverge from intent."* Each of the fifteen screens
below carries its own table; these are the surface-wide defaults every one of them refines.

| State | Default on this surface |
| :--- | :--- |
| **Loading** | A skeleton matching the eventual layout at the eventual row height — never a spinner over a blank panel, never a layout shift. Filters, the search box and the navigation stay interactive throughout. On a list, the skeleton renders the **number of rows the last successful fetch returned**, capped at the page size, so the page does not jump |
| **Empty** | States **why** and offers the next action. *"No applications match these filters"* with the most restrictive filter named and a one-tap relaxation — never a bare "No results". A genuinely empty queue is a different message and a good one: *"The approval queue is clear. 14 decided today."* |
| **Error** | Retry affordance; the **last successful data is retained and labelled stale** where the region is non-critical; the failing region degrades alone rather than taking the page. Every message states what happened, why, and what to do next, and carries the `correlation_id` in a copy-to-clipboard chip (`EV5`, `EV6`) |
| **Permission-denied** | A full-region explanatory state naming **the permission, the roles that hold it, and who to ask**. Never a blank page, never a silent redirect (`FR-NAV-06`) |

```text
illustrative — not committed code — the permission-denied region

┌────────────────────────────────────────────────────────────────┐
│  🔒  You cannot open the settlement register                    │
│                                                                 │
│  This screen needs the permission  settlements.batch.list_all.  │
│  It is held by Finance and Super Admin. Your roles: Moderator.  │
│                                                                 │
│  Ask a Super Admin to grant it, or open a request from          │
│  Support → New internal request.                                │
│                                                                 │
│  [ Back to dashboard ]    [ Copy reference 01J9Z7QK3M4N ]       │
└────────────────────────────────────────────────────────────────┘
```

| Rule | Statement |
| :--- | :--- |
| **PD1** | The message names the permission string. On this surface the audience is staff; a permission string is more useful to them than a euphemism |
| **PD2** | It names the roles that hold it, read from the server's `403` body (`Admin.md` error tables consistently *"name the role that can"*) |
| **PD3** | Client-side hiding is **presentation only**. Rendering this state is a usability courtesy; the refusal already happened on the server (`FR-RBAC-02`, `BL6`) |
| **PD4** | Distinguish `403 PERMISSION_DENIED` from `403 MFA_REQUIRED`. The first is this state; the second is the step-up dialog of §3.2. Conflating them sends an operator hunting for a permission they already have |
| **PD5** | A **partial** denial — `FINANCE` opening `SCR-ADM-008`, who may read the queue but not decide — renders the screen with the decide controls replaced by an inline notice: *"Only a Super Admin can decide a refund that fell outside policy."* Not a disabled button |

### 5.5 Money — `₹`, minor units, and lakh-crore grouping

| Rule | Statement |
| :--- | :--- |
| **MN1** | Every monetary value arrives from the API as a **string of minor units** plus an explicit `currency` (`README.md` §11.1). The client parses it as `bigint`, never as `number` |
| **MN2** | Formatting is **client-side, once**, through `formatMoney(minor, currency, locale)` in `packages/utils`. No screen formats money inline. No screen concatenates a symbol |
| **MN3** | INR renders **symbol before the number with no space** and **lakh-crore digit grouping**: `₹2,50,000` — never `₹250,000`, never `₹ 2,50,000`. `LAUNCH_MARKET_INDIA.md` §3: *"an owner reading ₹250,000 where they expect ₹2,50,000 will distrust the figure"* |
| **MN4** | Arithmetic in a component is **forbidden** (`BL2`, §10.3). `SettlementStatement.tsx` renders eight server-supplied figures; it does not add them to check. Where a sum must be shown, the server supplies the sum |
| **MN5** | Negative amounts render with a **leading minus and the alert token**, not with parentheses and not with colour alone: `−₹18,400` (`AX9`) |
| **MN6** | Rates are integers in **basis points** on the wire and render as a percentage to one decimal with the bps in parentheses: `8.0% (800 bps)`. Finance reads bps; the percentage is the courtesy |
| **MN7** | In **exports**, money is a plain integer minor-unit column with a separate `currency` column and a separate human-formatted column. `AC-RPT-01.3` requires the spreadsheet to open without cleanup, and a `₹` in a CSV cell is cleanup |
| **MN8** | Where a figure is a **minor-unit total that must tie out**, the console renders the full precision and never abbreviates. `₹1,84,92,000` never becomes `₹1.85 Cr` on a financial screen. Abbreviation is permitted **only** on `SCR-ADM-001` KPI tiles and `SCR-ADM-014` charts, and there the full figure is in the tooltip and the `title` attribute |

### 5.6 Time — `Asia/Kolkata`, and the `+05:30` trap

| Rule | Statement |
| :--- | :--- |
| **TM1** | Instants arrive as UTC ISO-8601 and render in **`Asia/Kolkata`** with the zone stated: `06 Aug 2026, 3:41 PM IST` |
| **TM2** | Business dates arrive as `YYYY-MM-DD` and render as **`DD MMM YYYY`** — `06 Aug 2026`. They are **not** parsed as instants; a business date shifted by a timezone is a bug that surfaces as an off-by-one day in a settlement period |
| **TM3** | Date **ranges** render inclusively both ends and say so: `27 Jul 2026 – 02 Aug 2026 (inclusive)` |
| **TM4** | Ages, SLA remainders and countdowns are **server-computed** and rendered (`BL4`, `Admin.md` §5.1.1). The console never subtracts two timestamps to produce "51 hours". A client in a browser set to IST computing from a UTC instant gets a different answer 23% of the day |
| **TM5** | Relative time is always paired with the absolute: `2 hours ago · 06 Aug 2026, 1:41 PM IST`. On an audit or financial screen the absolute is primary and the relative is secondary |
| **TM6** | India has **no DST**. The console still renders the zone label, because an operator reading a settlement statement should never have to infer it |

### 5.7 Live figures — `useLiveCounters()` and the freshness indicator

`A-08` defers Socket.IO. Phase 1 polls. `PROJECT_CONSTITUTION.md` §16.3.

| Rule | Statement |
| :--- | :--- |
| **LV1** | **One hook.** `apps/admin-dashboard/src/shared/hooks/useLiveCounters.ts` is the only polling mechanism on this surface. No `setInterval` in a component, no per-widget `refetchInterval` (`LC1`) |
| **LV2** | Interval **10–15 seconds**, configuration-driven, set in the hook (`LC3`) |
| **LV3** | Polling **pauses when the document is hidden** and resumes on visibility (`LC4`). A console left open overnight is not a load source |
| **LV4** | **A "last updated" indicator is mandatory on every surface showing a polled figure** (`LC5`). *"A stale figure presented as live is a defect."* |
| **LV5** | Components consume `{ data, lastUpdatedAt, isStale }` and know nothing about polling (`LC6`) |
| **LV6** | The indicator has three renderings, and the third is the one that matters |

```text
illustrative — not committed code

  ● Updated 4s ago                     fresh — within one interval
  ● Updated 38s ago                    ageing — beyond one interval, poll still healthy
  ▲ Last updated 3m 12s ago · retrying  STALE — a poll failed. The figures below are
    [ Retry now ]                       from 3m 12s ago and may have changed.
```

| Rule | Statement |
| :--- | :--- |
| **LV7** | In the **stale** rendering the figures themselves are visually de-emphasised and carry `aria-describedby` pointing at the staleness notice. A screen reader is told the number is stale, not only a sighted user |
| **LV8** | The polled figures on this surface are exactly: `SCR-ADM-001`'s KPI strip, SLA strip, queue depths and system-health strip; the navigation badge counts (`N4`); `SCR-ADM-002`'s `queue_summary`; `SCR-ADM-007`'s payout execution states; `SCR-ADM-013`'s ticket queue depth. **Nothing else polls.** Any future live figure is added to this hook, not beside it (`LC2`) |
| **LV9** | **Financial detail screens do not poll.** `SCR-ADM-007`'s statement, `SCR-ADM-008`'s computation and `SCR-ADM-010`'s variance list are fetched on open and refetched on explicit action. A figure that changes under an approver's cursor is worse than a figure that is one minute old, and the guarded-write patterns (`computation_hash`, `expected_net_payable_minor`, `expected_variance_minor`) exist precisely so staleness is caught at submit rather than papered over by polling |

### 5.8 Error rendering — `NFR-USE-05`

> *"Every error message states what happened, why, and what to do next, in the user's language,
> never an error code alone."*

| Rule | Statement |
| :--- | :--- |
| **ER1** | The `error.message` from the envelope (`README.md` §9.1) is **already** written to that standard and is rendered verbatim. The console does not substitute its own prose for a server message |
| **ER2** | `error.details[]` maps onto form fields by `field` (`FM5`). A `400` lands on the offending input, not in a toast |
| **ER3** | The `correlation_id` is **always** rendered, as a copy chip, on `500` and `503` (`EV6`) and on any error the operator may escalate. On this surface it is rendered on **every** error, because `CP6` makes the same ULID the `audit_log.correlation_id` — an operator's screenshot joins to the audit row without a text search |
| **ER4** | The four placements: **inline** under a field for `400`/`422` field errors; **panel-level** for a failed region fetch; **modal** only where the operator's action cannot proceed (`409 RESOURCE_VERSION_CONFLICT`, `422 CONFIG_VALIDATION_FAILED` on a stale computation); **toast** only for a *successful* action's confirmation. **An error is never only a toast** |
| **ER5** | `429 RATE_LIMIT_EXCEEDED` renders the `Retry-After` as a countdown and disables the action until it elapses. `RL-ADMIN` is 300/min per staff user; hitting it means a script, and the message says so |
| **ER6** | `409 RESOURCE_VERSION_CONFLICT` is never *"try again"*. It is *"this changed while you were reading it"* plus **what** changed plus a reload action that preserves the operator's typed input |

### 5.9 Externalisation and the key namespace — `NFR-USE-08`

| Rule | Statement |
| :--- | :--- |
| **I1** | No user-facing string literal appears in any component on this surface, from the first commit (`I18N1`) |
| **I2** | Keys are `admin.<feature>.<element>.<variant>` — `admin.approvals.precheck.geo_mismatch`, `admin.reconciliation.variance.blocked_payout`, `admin.refunds.decide.confirm_body` (`I18N2`) |
| **I3** | Server-supplied strings are **never** keyed: error messages (`EV3`, resolved server-side by `Accept-Language`), reason-code labels (`FR-ADMN-07`, taxonomy-managed), pre-check details, dry-run warnings. Keying them would create two sources of truth and the client's would be wrong |
| **I4** | Number, currency and date formatting go through the i18n layer with an explicit locale, never string concatenation (`I18N4`) |
| **I5** | CI fails the build on a hard-coded user-facing string in `apps/**` and on a key referenced but absent from the catalogue (`I18N5`) |
| **I6** | Pluralisation is a catalogue feature, never `count === 1 ? 'x' : 'xs'` in JSX. *"1 member"* / *"214 members"* / *"0 members"* are three catalogue forms |

---

## 6. Screen specifications

> **Amended 2026-08-08 by `ADR-0037`.** The LAYOUTS, column orders, region lists and wireframes in
> this section are **advisory** — the owner lifted visual prescription so a design is not bound to
> the arrangement recorded here. They remain the reasoned default, and the reasoning is worth reading
> before departing from it: `SCR-ADM-002` leads with the SLA because that is the column which decides
> which row gets opened, not because of where it sits.
>
> What is **not** advisory, in this section or any other: the contrast floors, colour never carrying
> meaning alone, full keyboard operability, the four mandatory states, and the rule that no screen
> shows a fabricated figure as though it were read from the database. Those are `MASTER_PRD.md` §B9
> requirements and the `AX` rules, not style. `ADR-0037` lists them and says why each one breaks
> something real if removed.


Every screen below carries the same eight blocks: **identity**, **purpose**, **API contracts
consumed**, **layout**, **regions**, **interactions and keyboard**, **states** (the four mandatory
plus any the domain demands), and **acceptance checks** traced to `AC-` identifiers.

---

### 6.1 `SCR-ADM-001` — Platform Dashboard

| Field | Value |
| :--- | :--- |
| **Route** | `/` |
| **Feature** | `src/features/platform-dashboard/` |
| **Route file** | `src/routes/platform-dashboard.route.tsx` |
| **Primary persona** | All six platform roles. The morning screen |
| **Permission** | Any platform role. **Every region is independently permission-gated** |

**Purpose.** One screen that answers *"is the platform healthy and what needs a human today"*. It is
a router to work, not a report — `SCR-ADM-014` is the report.

**API contracts consumed**

| Region | Endpoint | Notes |
| :--- | :--- | :--- |
| KPI strip | `GET /v1/admin/analytics/gmv-take-rate` | `FR-RPT-02` — financial figures read the ledger and are current |
| Approvals SLA strip | `GET /v1/admin/applications` (`queue_summary` only, `page_size=1`) | `queue_summary` is `FR-ADMN-11` as data (`Admin.md` §5.1) |
| Reconciliation status | `GET /v1/admin/reconciliation?date=<yesterday>` (`summary` + `kpi_26`) | §6.10 |
| Refunds / disputes | `GET /v1/admin/refunds` (`summary`), `GET /v1/admin/disputes` (`summary`) | |
| Moderation depth | `GET /v1/admin/moderation/reviews?status=HELD&limit=1` | |
| System health | `GET /v1/admin/system-health` | `FR-ADMN-13` — queue depths, webhook failures, job failures |

```text
illustrative — not committed code

┌ Platform · 06 Aug 2026 ────────────────────── ● Updated 6s ago  [Refresh] ┐
│ GMV today        GMV MTD        Active tenants   Payment success          │
│ ₹8,42,100        ₹1,84,92,000   1,247            94.2%  ▲0.4              │
│ ↑12% vs 5 Aug    ↑8% vs Jul     +14 this month   target ≥92% (KPI-19)     │
├───────────────────────────────────────────────────────────────────────────┤
│ ▲ RECONCILIATION 04 Aug · 3 unresolved variances · 2 tenants blocked      │
│   ₹6,006 of payouts held · KPI-26 99.75% BREACHED     [ Open →  g c ]     │
├──────────────────────────────┬────────────────────────────────────────────┤
│ APPROVALS                    │ NEEDS A DECISION                           │
│  Open              63        │  Refunds pending        23   ₹84,715       │
│  Unassigned        11        │    of which overdue      4                 │
│  SLA approaching    7        │  Disputes open           4   ₹31,400       │
│  SLA BREACHED       2  ▲     │    deadline < 48 h       1  ▲              │
│  Oldest open      79 h       │  Reviews held           11                 │
│  [ Open queue → g a ]        │  Gym content flags       2                 │
├──────────────────────────────┴────────────────────────────────────────────┤
│ TENANT FUNNEL (30 d)   signup 214 → submitted 168 → approved 141 →        │
│                        activated 118 → transacting 96                     │
├───────────────────────────────────────────────────────────────────────────┤
│ CITY LEADERBOARD          GMV MTD    gyms   conv.   │ SYSTEM HEALTH        │
│  Bengaluru             ₹42,10,000     289   3.1%    │  Queue depth    412  │
│  Mumbai                ₹38,64,000     241   2.8%    │  Webhook fails    0  │
│  Pune                  ₹21,08,000     167   3.4%    │  Job failures     1▲ │
└───────────────────────────────────────────────────────────────────────────┘
```

**Regions**

| # | Region | Content | Gate |
| :-: | :--- | :--- | :--- |
| 1 | KPI strip | GMV today, GMV MTD, active tenants, payment success rate against `KPI-19`'s ≥92% | `reporting.platform_report.read` |
| 2 | Reconciliation banner | Present **only** when `variance_count > 0`. Full-width, alert token, states blocked tenants and held payout total | `settlements.reconciliation.read` |
| 3 | Approvals | Open, unassigned, approaching, **breached**, oldest open hours | `onboarding.application.list_all` |
| 4 | Needs a decision | Refunds pending + value + overdue; disputes open + value + nearest deadline; reviews held; content flags | Per-row, each independently gated |
| 5 | Tenant funnel | `A7.1`'s five stages over 30 days | `reporting.platform_report.read` |
| 6 | City leaderboard | Top eight cities: GMV MTD, verified gyms, checkout conversion | `reporting.platform_report.read` |
| 7 | System health | Queue depth, webhook failure count, job failures, reconciliation status (`FR-ADMN-13`) | `SUPER_ADMIN` only |

**Interactions and keyboard.** Every tile is a link with a visible focus ring; `Enter` opens it. Tab
order is region order. The `[Refresh]` control forces an immediate poll and is the accessible
equivalent of waiting.

**States**

| State | Behaviour |
| :--- | :--- |
| **Loading** | Region skeletons at final dimensions. The navigation and the command palette are usable immediately. No full-page spinner |
| **Empty** | Per-region and meaningful: *"The approval queue is clear. 14 decided today."* · *"No refunds are waiting for a decision."* · **The reconciliation banner's empty state is its absence**, replaced by a single quiet line in region 7: `Reconciliation 05 Aug · matched · KPI-26 100%` |
| **Error** | Each region fails **alone**. A failed KPI strip shows *"Couldn't load platform totals. [Retry]"* and the rest of the page renders. **The reconciliation banner is the exception:** if it fails to load it renders an explicit unknown state — *"Reconciliation status unavailable. Check `/finance/reconcile` before approving any payout."* Silence there would read as "no variance" |
| **Permission-denied** | Per-region. A `MODERATOR` sees regions 1 (no — see gate) … in practice: the moderation depth tile and nothing financial. If **every** region is denied the page renders the §5.4 state naming the roles |
| **Stale** | `LV6`'s third rendering across the whole page when a poll fails; every figure de-emphasised together, one notice, not seven |

**Acceptance checks.** Reconciliation variance is visible on the landing screen without navigation
(`BR-FIN-07` operational intent) · every polled figure carries a freshness indicator (`LC5`) · a role
without a permission sees no tile for it (`FR-NAV-03`) · GMV renders `₹1,84,92,000`, not `₹18,492,000`
(`MN3`).

---

### 6.2 `SCR-ADM-002` — Approval Queue

| Field | Value |
| :--- | :--- |
| **Route** | `/approvals` |
| **Feature** | `src/features/approvals/` |
| **Primary persona** | **Anita** — she opens this first and returns to it 30–60 times a day |
| **Permission** | `onboarding.application.list_all` · assign needs `onboarding.application.assign` |

**Purpose.** Pick the next application rather than search for it (`Admin.md` §5.1). Every column
exists to support that one decision.

**API contracts consumed**

| Action | Endpoint |
| :--- | :--- |
| Queue | `GET /v1/admin/applications` — **offset paginated**, `page`/`page_size`/`page_count`/`has_more`, **no `next_cursor`** (`README.md` §7.5 exception 1) |
| Assign / unassign | `POST /v1/admin/applications/:id/assign` — `assignee_staff_id: null` unassigns |

```text
illustrative — not committed code

┌ Approval queue ───────────────────────────────────────── ● Updated 8s ago ┐
│ Open 63 · Unassigned 11 · Approaching 7 · BREACHED 2 · Oldest 79 h        │
│ Workload  Ananya 14 · Rahul 9 · Devika 7 · unassigned 11                  │
├───────────────────────────────────────────────────────────────────────────┤
│ [Status ▾ open] [Assignee ▾ any] [SLA ▾ any] [Type ▾ any] [Pre-check ▾]   │
│ [City ▾] [Submitted 01–06 Aug] [/ search name…]   Sort: oldest first ▾    │
├───────────────────────────────────────────────────────────────────────────┤
│ SLA    Age   Tenant / gym                    City      Type  Pre  Assignee│
│ ▲BRE  -7h   Apex Athletics — Whitefield     B'luru    NEW   ✕1  —        │
│ ▲BRE  -2h   Zen Yoga Collective             Chennai   RESUB ✓   Rahul    │
│ ⏱ 21h  51h   Iron Temple — Koregaon Park     Pune      RESUB ✕1  Ananya   │
│ ⏱ 19h  53h   Rep Range Strength             Indore    NEW   ✓   —        │
│   66h   6h   Pulse Fitness — Indiranagar     B'luru    NEW   ✓   —        │
│ …                                                                         │
├───────────────────────────────────────────────────────────────────────────┤
│ Page 1 of 2 · 63 open            [◀ prev] [1] [2] [next ▶]  50 per page ▾ │
└───────────────────────────────────────────────────────────────────────────┘
```

**Regions**

| # | Region | Content |
| :-: | :--- | :--- |
| 1 | Queue summary | `queue_summary`: open total, unassigned, breached, approaching, oldest open hours — computed over the **filtered** set |
| 2 | Workload strip | `queue_summary.by_officer`, computed over **all** open applications, not the filter (`Admin.md` §5.1) — a workload filtered to one city tells an assigner nothing |
| 3 | Filters | `status` (default: the three open states), `assigned_to` (with the reserved literal **`unassigned`**), `sla_state`, `submission_type`, `precheck`, `city`/`state`, `submitted_from`/`submitted_to`, `q` (2–80 chars), `sort` (four allowlisted values) |
| 4 | Table | SLA chip, age, tenant + gym, city, type, pre-check, assignee. Default sort **`submitted_at:asc`** — oldest first is the queue's whole point |
| 5 | Pagination | **Offset**: page numbers, jump, `page_count`. Hard cap 100 pages; beyond it the server asks for a narrower filter |

**Column semantics**

| Column | Rendering |
| :--- | :--- |
| SLA | `sla.state` as a chip **with a glyph, not colour alone**: `▲ BRE` breached, `⏱ 21h` approaching (≤24 h remaining), plain hours within. A breach shows **negative** `hours_remaining` and stays in the queue — a breach that disappears is a breach nobody fixes |
| Age | `age_hours`, server-computed (`TM4`). Where the SLA is paused (`INFO_REQUESTED`), the chip reads `paused` and the tooltip carries `age_hours_wall_clock` so a paused queue cannot hide a stalled application |
| Type | `NEW` (version 1) or `RESUB` (version > 1). `RESUB` carries a tooltip with `prior_decision`: the reason codes and the decision date |
| Pre-check | `✓` all pass · `✕n` where *n* is `fail_count`, with the failing keys in the tooltip |
| Assignee | Name or `—`. Inline assign picker on the row, keyboard-reachable |

**Interactions and keyboard.** `/` focuses search · `j`/`k` move the focused row · `Enter` opens
`SCR-ADM-003` · `x` selects for bulk assign · `a` opens the assign picker for the focused row. Filter
state is encoded in the URL so a queue view is shareable and restorable. **Opening an application
does not change its status** — assignment and `UNDER_REVIEW` are different facts (`Admin.md` §5.6).

**States**

| State | Behaviour |
| :--- | :--- |
| **Loading** | Summary strip and 50 row skeletons at 32 px. Filters interactive immediately |
| **Empty — filtered** | *"No applications match these filters. The narrowest is **City: Indore**."* with one-tap removal of that filter and the resulting count previewed |
| **Empty — genuinely clear** | *"The approval queue is clear. 14 decided today, median 41 minutes."* This is a good state and reads as one |
| **Error** | Table region retries; the summary strip retains its last value labelled stale. `400 SORT_FIELD_NOT_ALLOWED` cannot occur through the UI (the sort control is the allowlist) but is handled: it resets to default and reports |
| **Permission-denied** | §5.4 state naming `onboarding.application.list_all`, held by Verification Officer and Super Admin |
| **Page beyond cap** | `400 LIMIT_EXCEEDS_MAXIMUM` → *"That's past page 100. Narrow the filters — try a city or a date range."* with the filter panel opened |

**Acceptance checks.** Applications approaching or breaching the SLA are visually distinct
(`SCR-ADM-002` SLA row) · sortable and assignable (`SCR-ADM-002` content row) · a resubmission is
marked as one (`AC-ONB-01.3`) · assignment shows its workload consequence without a second call
(`Admin.md` §5.6 `workload`).

---

### 6.3 `SCR-ADM-003` — Application Review

| Field | Value |
| :--- | :--- |
| **Route** | `/approvals/:id` |
| **Feature** | `src/features/approvals/` |
| **Primary persona** | **Anita**, 30–60 times a day, three minutes each |
| **Permission** | `onboarding.application.review` · approve `…approve` · reject `…reject` · request-info `…request_info` · assign `…assign` |
| **Carries** | **`OBJ-03`** (*"guarantee that every listed gym is a real, verified business"*) and **`RSK-01`** (fake or non-existent gyms listed — probability 4, impact 5, **score 20**, the highest in the register) |

**This is the most consequential screen in the platform.** Everything the marketplace sells rests on
a human at this screen having seen enough, in time, to be right. `A3.2` OBJ-03: *"Trust is the
marketplace's only durable moat. It is cheap to lose and expensive to rebuild."*

#### 6.3.1 API contracts consumed

| Action | Endpoint | Notes |
| :--- | :--- | :--- |
| Load | `GET /v1/admin/applications/:id?diff_against=<n>` | Returns the frozen snapshot, `kyc_documents[]` with **time-limited, single-use, audited** `view_url`s, `prechecks[]`, `approval_readiness`, `diff[]`, `history[]` |
| Approve | `POST /v1/admin/applications/:id/approve` | `AdminActionBase` + `expected_version` + `precheck_overrides[]` + `publish_immediately`. **Idempotency required**, `auth_time ≤ 900 s` |
| Reject | `POST /v1/admin/applications/:id/reject` | + `reason_codes[] (min 1, max 16)` + `items[] (min 1, max 40)` |
| Request info | `POST /v1/admin/applications/:id/request-info` | + `requested_items[] (min 1, max 20)` + optional `respond_by` |
| Reassign | `POST /v1/admin/applications/:id/assign` | |

#### 6.3.2 Layout — split view, documents left, checklist right

```text
illustrative — not committed code — ≥1440 px

┌ Iron Temple Fitness Pvt Ltd — Koregaon Park, Pune ────────────────────────────────────┐
│ v2 RESUBMISSION · UNDER_REVIEW · submitted 04 Aug 06:11 IST · 51 h · SLA ⏱ 21 h left   │
│ Assigned: Ananya Iyer   [Reassign]        Alt+A Approve · Alt+R Reject · Alt+I Info    │
├───────────────────────────────────────────────────────────────────────────────────────┤
│ ▲ PRE-CHECKS · 1 of 5 failed                                              [collapse ▾] │
│ ┌───────────────────────────────────────────────────────────────────────────────────┐ │
│ │ ✕ GEO_ADDRESS_DISTANCE           BLOCKING · BR-GYM-08 · override required          │ │
│ │   Map pin is 940 m from the geocoded registered address. Tolerance 500 m.          │ │
│ │   pin 18.53621, 73.89344 · geocoded 18.54402, 73.89512     [ view both on map ]    │ │
│ └───────────────────────────────────────────────────────────────────────────────────┘ │
│ ✓ 4 passed — duplicate address · minimum photos · published plan · content screening ▸ │
├──────────────────────────────────────────┬────────────────────────────────────────────┤
│ DOCUMENTS                                │ CHECKLIST  IN/COMPANY/v3      3 of 9 done   │
│ ┌──────────────────────────────────────┐ │ ┌────────────────────────────────────────┐ │
│ │                                      │ │ │ 1. PAN — legible, name matches    ✓    │ │
│ │        [ inline document render ]    │ │ │    evidence: PAN p.1  note: —          │ │
│ │                                      │ │ │ 2. Shop & Establishment cert      ✕    │ │
│ │                                      │ │ │    evidence: S&E p.1                   │ │
│ │                                      │ │ │    note: cut off at reg. number        │ │
│ │                                      │ │ │ 3. Registered address matches PAN ⌛   │ │
│ │  − ⊕ 100% ↺ ↻  [1/3]  ◀ [ ] ▶       │ │ │ 4. Bank account name matches      ○    │ │
│ └──────────────────────────────────────┘ │ │ 5. Photographs are of the premises ○   │ │
│ ▸ PAN                    CLEAN  03 Aug   │ │ 6. Minimum 3 photographs          ✓    │ │
│ ▸ Shop & Establishment   CLEAN  03 Aug   │ │ 7. ≥1 published plan               ✓    │ │
│ ▸ Fire safety NOC     NOT PROVIDED  opt. │ │ 8. Operating hours complete       ○    │ │
│                                          │ │ 9. Gender policy stated           ○    │ │
│ APPLICATION DATA          [ diff v1→v2 ] │ └────────────────────────────────────────┘ │
│ Legal name  Iron Temple Fitness Pvt Ltd  │ INTERNAL NOTES (not shown to the owner)     │
│ Entity      COMPANY                      │ ┌────────────────────────────────────────┐ │
│ Reg. no.    U93030PN2021PTC201884        │ │ …                          [Add note]  │ │
│ PAN         AABCI9021K                   │ └────────────────────────────────────────┘ │
│ GSTIN       27AABCI9021K1ZP              │                                            │
│ Address     Survey 41/3, North Main Rd,  │ HISTORY                                    │
│             Koregaon Park, Pune 411001   │ v1 · 26 Jul · REJECTED by Ananya Iyer      │
│ Contact     +91 98220 14477              │    KYC_DOCUMENT_ILLEGIBLE                  │
│ Gym         Iron Temple — Koregaon Park  │    INSUFFICIENT_PHOTOS               [▸]   │
│ Categories  STRENGTH, CROSSFIT           │                                            │
│ Photos      7   Plans 3   Hours complete │ DIFF v1 → v2                               │
│ Geo         18.53621, 73.89344           │  gym.photos           3 → 7                │
│                                          │  kyc.SHOP_AND_ESTAB.  replaced 03 Aug      │
│                                          │  ▲ gym.geo   UNCHANGED AND STILL FAILING   │
├──────────────────────────────────────────┴────────────────────────────────────────────┤
│ [ Reassign ]  [ Add internal note ]      [ Request information ]  [ Reject ] [Approve]│
└───────────────────────────────────────────────────────────────────────────────────────┘
```

**Below 1280 px** the split becomes a two-tab layout (`Documents` / `Checklist`) with the pre-check
panel and the action bar persistent above and below both. **Below 768 px** the document viewer takes
the full width and the checklist becomes a bottom sheet. The action bar is **always** visible — it is
`position: sticky; bottom: 0` at every width, because an officer must never scroll to decide.

#### 6.3.3 The document viewer — inline, zoom, rotate, **no download**

> `AC-ONB-02.1`: *"documents render in an inline viewer alongside the structured checklist **without
> downloading**."*

| Rule | Statement |
| :--- | :--- |
| **DV1** | Documents render **inline**. PDF pages are rasterised in-viewer; images render directly. There is **no download button, no "open in new tab", no context-menu save, and no print affordance** on this surface |
| **DV2** | The absence is a **control, not a UI omission**. `BR-DAT-07` requires every KYC access to be logged; a downloaded file is an access nobody logged and a copy nobody can revoke. `NFR-SEC-02` encrypts these with a separate key precisely so their circulation is bounded |
| **DV3** | `view_url` is **time-limited (15 minutes), single-use and audited**. The viewer holds the rendered bitmap, not the URL, and a re-render re-mints — which writes another audit row, correctly |
| **DV4** | On expiry mid-review: *"This document link expired. Reloading it is recorded in the audit log. [Reload document]"* — the honesty is deliberate; the officer should know the access is logged |
| **DV5** | Controls: **zoom** (25%–400%, `−`/`+`, `Ctrl + scroll`, fit-to-width, fit-to-page, 100%), **rotate** 90° left/right (`,` and `.`), **pan** by drag or arrow keys at zoom > 100%, **page** navigation for multi-page documents |
| **DV6** | Rotation and zoom are **per document and remembered** for the life of the review. An officer who rotated a sideways scan does not re-rotate it after checking item 4 |
| **DV7** | `[` and `]` move to the previous/next document. The document list shows `scan_state` — `CLEAN`, `PENDING`, `NOT_PROVIDED` — and `mandatory` |
| **DV8** | `409 KYC_DOCUMENT_SCAN_PENDING` renders in place of the viewer: *"Still checking one document for viruses. It'll be ready in a moment. [Retry]"*. Not an error dialog; the rest of the review continues |
| **DV9** | The viewer is keyboard-operable in full and announces the current document and page to assistive technology (`aria-live="polite"` on document change) |

#### 6.3.4 The pre-check panel — failures expanded, passes collapsed

> `AC-ONB-02.2`: *"any failing check is visible at the top with its detail, and passing checks are
> collapsed."* `SCR-ADM-003`'s Pre-check panel row names six checks.

| Rule | Statement |
| :--- | :--- |
| **PC1** | The panel is **above the split**, full width, and is the first thing below the header. It is not a tab and it is not collapsible when anything is failing |
| **PC2** | Every check with `result: "FAIL"` renders **expanded**, with its `detail` object rendered field-by-field, its `rule` identifier, its `severity`, and whether `override_required` |
| **PC3** | Passing checks collapse into **one summary row**: `✓ 4 passed — duplicate address · minimum photos · published plan · content screening ▸`. Expanding shows each with its detail |
| **PC4** | `severity: "BLOCKING"` and `severity: "ADVISORY"` are visually distinct and labelled. Advisory failures do **not** require an override; blocking ones do |
| **PC5** | The panel renders **unknown `prechecks[].key` values** from their `detail` object rather than dropping them. The array is read by key and the contract permits additions (`Admin.md` §5.2 future compatibility) |
| **PC6** | The six checks and their renderings are enumerated below. Each has a purpose-built detail view because a generic key-value dump is not evidence |

| `precheck_key` | Rule | Detail rendering |
| :--- | :--- | :--- |
| `GEO_ADDRESS_DISTANCE` | `BR-GYM-08` | Measured metres vs tolerance metres, both coordinate pairs, and a **two-pin map** showing the geocoded address and the owner's pin with the distance drawn between them |
| `DUPLICATE_APPROVED_ADDRESS` | `BR-GYM-09` | Each match as a card: gym name, address, approval date, tenant, and a **link that opens that gym's tenant detail in a new panel** — `AC-ONB-02.4` requires the reviewer to be able to look |
| `DUPLICATE_REGISTRATION_ID` | `FR-ONB-12` | The colliding registration identifier, the other tenant, its status, its submission date |
| `DUPLICATE_BANK_ACCOUNT` | `FR-ONB-12` | Masked account number, IFSC, the other tenant holding it, and whether that tenant is approved. **The single strongest fraud signal on the screen** and it renders first among duplicates |
| `IMAGE_QUALITY` | `FR-ONB-12` | Per-photo: resolution, blur score, duplicate-image cluster id, and a thumbnail grid with the flagged images marked |
| `CONTENT_SCREENING` | `FR-ONB-12` | Each flagged span **in context**, with the field it came from and the classifier's category. Never just "flagged" |
| `MINIMUM_PHOTOS` | `BR-GYM-02` | Count vs minimum |
| `PUBLISHED_PLAN_PRESENT` | `FR-ONB-05` | Count |

#### 6.3.5 The structured checklist

| Rule | Statement |
| :--- | :--- |
| **CL1** | The checklist is driven by `application.kyc_checklist_version` — the checklist **snapshotted at submit** (`Schema.md` §4.2). Adding a tenth required document in March must not retroactively make a February application incomplete, and the UI must render the version it was submitted against, labelled: `IN/COMPANY/v3` |
| **CL2** | Every requirement carries exactly three states plus unset: **pass ✓**, **fail ✕**, **needs-info ⌛**, unset ○ |
| **CL3** | Every requirement carries an **evidence reference** — a picker bound to the loaded document set and, where relevant, a page number. Selecting an evidence reference **scrolls the viewer to it**. This is the single highest-leverage interaction on the screen: it turns "which document said that" into a click |
| **CL4** | Every requirement carries a **note field**, optional, max 500 characters, internal by default. A note marked *include in decision* is carried into the reject/request-info payload as an item's `corrective_action` |
| **CL5** | Marking an item **fail** or **needs-info** pre-populates the corresponding structured item when the officer opens Reject or Request information. Anita should never retype a finding she has already recorded |
| **CL6** | Checklist state is **local to the review session and persisted per officer per application**, so a review interrupted at item 4 resumes at item 4. It is **not** part of the decision payload except through CL5 |
| **CL7** | `1`…`9` jump to checklist item *n*; within an item, `p`/`f`/`i` set pass/fail/needs-info and advance. This is the keyboard path that makes a three-minute review possible |
| **CL8** | The header shows `3 of 9 done`. The checklist does **not** gate the action bar — `BR-GYM-02` is re-evaluated server-side at decision time on freshly read state, and a client-side gate would be both redundant and wrong when a plan is unpublished mid-review |

#### 6.3.6 The action bar and the keyboard path

> `B2.4` design implication: *"Approve/reject are keyboard-accessible."* Anita does this sixty times
> a day; reaching for a mouse each time is the difference between a three-minute and a five-minute
> decision. Sixty reviews × two minutes is **two hours a day**.

| Key | Action | Behaviour |
| :--- | :--- | :--- |
| `Alt + A` | Approve | **Opens the approve dialog with focus in the reason field.** It never approves directly (`K6`) |
| `Alt + R` | Reject | Opens the reject dialog with focus on the reason-code list, pre-selected from any checklist `fail` items (`CL5`) |
| `Alt + I` | Request information | Opens the request-info dialog with the targeted checklist pre-populated from `needs-info` items |
| `Alt + N` | Add internal note | Focuses the internal-note composer |
| `Alt + S` | Reassign | Opens the assignee picker |
| `Ctrl/⌘ + Enter` | In any decision dialog | Submits, when the dialog's own floor is met |
| `Esc` | In any decision dialog | Closes and **preserves** everything typed |
| `Shift + J` | After a decision | Opens the next application in the queue in the same sort order, without returning to `SCR-ADM-002` |

| Rule | Statement |
| :--- | :--- |
| **AB1** | Every action in the bar is reachable by `Tab` in the order Reassign → Note → Request information → Reject → Approve. The two decisive actions are last, which is also where they sit visually |
| **AB2** | After a successful decision the console shows a **confirmation strip with an Undo-free statement of fact** — approvals and rejections are not undoable — plus `[ Next application → Shift+J ]` and `[ Back to queue ]`. Auto-advance is **off by default** and is a per-officer preference; silently advancing after an irreversible decision is how a wrong application gets decided |
| **AB3** | The submit button in every dialog disables while the mutation is in flight and the mutation carries an `Idempotency-Key` (`FM6`) — a double-tapped Approve cannot approve twice |
| **AB4** | `expected_version` is sent on approve, reject and request-info, taken from the loaded snapshot. On `409 RESOURCE_VERSION_CONFLICT` the console renders: *"This application was resubmitted while you were reviewing it. You were reading version 2; version 3 arrived at 11:58. [Load version 3]"* — and preserves the officer's typed reason for reuse |

#### 6.3.7 Approve — and the explicit override

> `AC-ONB-02.3`/`AC-ONB-02.4`: approving past a failed blocking pre-check **requires an explicit
> override with a reason**. `Admin.md` §5.3.2 guard 2 enforces it server-side with a **20-character**
> minimum on each `override_reason` — longer than the base reason, because overriding a blocking
> check is a bigger claim than approving a clean one.

```text
illustrative — not committed code

┌─ Approve Iron Temple Fitness Pvt Ltd ───────────────────────────────────┐
│  ▲ One blocking pre-check is failing. Approving requires an override.    │
│  ┌ GEO_ADDRESS_DISTANCE · BR-GYM-08 ────────────────────────────────┐    │
│  │ Map pin is 940 m from the geocoded registered address.            │    │
│  │ Tolerance 500 m.                                                  │    │
│  │ Override reason *                                    0 / 1000     │    │
│  │ ┌───────────────────────────────────────────────────────────────┐ │    │
│  │ └───────────────────────────────────────────────────────────────┘ │    │
│  │ Minimum 20 characters. This is recorded as its own audit entry    │    │
│  │ and is independently searchable.                                  │    │
│  └───────────────────────────────────────────────────────────────────┘    │
│  Decision reason *                                        0 / 1000       │
│  ┌────────────────────────────────────────────────────────────────────┐  │
│  └────────────────────────────────────────────────────────────────────┘  │
│  Minimum 10 characters.                                                  │
│  ☑ Publish the listing immediately                                       │
│                                                                          │
│  Approving publishes this gym to the marketplace within 60 seconds and   │
│  notifies the owner by email, SMS and in-app.                            │
│                                                                          │
│  [ Cancel ]                                        [ Approve · ⌘↵ ]      │
└──────────────────────────────────────────────────────────────────────────┘
```

| Rule | Statement |
| :--- | :--- |
| **AP1** | The dialog reads `approval_readiness` from the load. `can_approve: false` with `required_action: "EXPLICIT_OVERRIDE_WITH_REASON"` renders the override block; `can_approve: true` renders the plain dialog. **The server still refuses without the override** — the client's copy is presentation only (`FR-RBAC-02`) |
| **AP2** | **One override block per failing blocking pre-check**, each with its own reason field and its own 20-character floor. There is no single "override all" |
| **AP3** | An override is **never** pre-filled, never has a canned option, and never accepts a code alone. It is prose because it is testimony |
| **AP4** | The dialog states that each override becomes **its own audit row** (`Admin.md` §5.3: *"One extra row per override, so an override is independently searchable"*). Saying so changes what gets typed |
| **AP5** | On `422 APPLICATION_PRECHECK_OVERRIDE_REQUIRED` the server names the pre-check and its detail; the console renders that message verbatim and scrolls to the corresponding block |
| **AP6** | On `422 CONFIG_VALIDATION_FAILED` for an override against a check that **now passes**, the console does not silently drop the override — it reloads the application and reports: *"The map-pin check now passes; your screen was from before the resubmission. Reloaded to version 3."* That is a reviewer working from a stale screen and the message must say so |
| **AP7** | On `422 APPLICATION_INCOMPLETE` the server **enumerates** what is missing. The console renders the enumeration as a list, each item linked to where it lives on the screen. Never "incomplete" |
| **AP8** | On `422 GYM_APPROVAL_REQUIRES_HUMAN_ACTOR` — which a human at a keyboard should never see — the console renders *"Approval needs a signed-in reviewer with MFA. Sign in again."* and routes to the step-up. This path exists because `BR-GYM-03` is the only contract in the platform that names the species of the caller |
| **AP9** | On success the confirmation strip renders `publication.state` and a **live countdown to `target_visible_by`** — `FR-ONB-13`'s 60-second bound made observable (`P4`). If it passes without publication, the strip says *"Publication is taking longer than 60 seconds. The approval is committed; the listing is queued."* — because the approval succeeded and the projection is late, and conflating those would look like a failed approval |

#### 6.3.8 Reject — at least one structured reason

> `FR-ONB-11` / `BR-GYM-04`: a rejection returns **one or more structured reason codes** plus
> optional free text, and identifies **exactly which fields or documents to fix**. `min(1)` on
> `reason_codes` is the rule, enforced at `L8-PIPE` **and** `L1-DB`.

| Rule | Statement |
| :--- | :--- |
| **RJ1** | The sixteen `C4.8` codes render as a **searchable multi-select with server-supplied labels**, grouped: KYC (4), address and geo (3), listing quality (4), commercial (2), integrity (2), other (1). Labels come from the taxonomy, never a client map (`I3`) |
| **RJ2** | Selecting a code adds **at least one item row** requiring `target_type` (`FIELD`/`DOCUMENT`/`PHOTO`/`PLAN`/`GEO`), `target_ref` and `corrective_action` (10–500 chars). `target_ref` is a **picker over the snapshot's addressable paths**, never free text — a reviewer cannot point an owner at a field that does not exist |
| **RJ3** | Items pre-populate from checklist `fail` entries with their evidence reference and note (`CL5`) |
| **RJ4** | **The owner-visible preview is mandatory and non-collapsible.** The dialog renders exactly the `owner_visible` object the owner will read — code labels, targets, corrective actions, free text — because *"a rejection reason the reviewer cannot preview is a rejection reason that says `KYC_DOCUMENT_ILLEGIBLE` to a gym owner in Bengaluru"* |
| **RJ5** | The dialog states that **resubmission is unlimited** (`resubmission.limit: null`, `BR-GYM-05`) and that prior versions are retained. Rejection is less final than it feels, and knowing that produces better rejections |
| **RJ6** | `400 REJECTION_REASON_REQUIRED` cannot be reached through the UI — the submit button requires ≥1 code — but is handled and reported against the code list |

#### 6.3.9 Request information — the targeted checklist, and the paused clock

> `FR-ONB-10`: ask for specific information **without rejecting**, preserving the owner's progress.
> `Admin.md` §5.5: **the SLA pauses**, and that is the point.

| Rule | Statement |
| :--- | :--- |
| **RI1** | The dialog builds a checklist of 1–20 `requested_items`, each with `target_type`, `target_ref`, `what_is_needed` (10–500 chars) and a **`blocking`** toggle |
| **RI2** | Items pre-populate from checklist `needs-info` entries (`CL5`) |
| **RI3** | An optional `respond_by` business date, `≥ tomorrow`, rendered in `DD MMM YYYY` IST |
| **RI4** | The dialog states plainly: *"The SLA clock pauses until the owner responds. Their progress is preserved and the snapshot stays frozen; they respond by uploading against this checklist, which creates version 3."* Every clause there is a contract fact and each one changes whether an officer chooses this over Reject |
| **RI5** | After success the header SLA chip reads `paused` with `paused_at`, and the tooltip carries `age_hours_wall_clock` — a paused queue must not hide a stalled application |

#### 6.3.10 History and the field-level diff

> `AC-ONB-01.3`: *"the reviewer can see a diff against the prior version."*

| Rule | Statement |
| :--- | :--- |
| **HD1** | `history[]` lists every prior version: version, submitted date, decision, decider, decision date, reason codes, reviewer notes. Expandable to the full prior snapshot |
| **HD2** | The diff panel defaults to `version − 1` and offers a version picker (`?diff_against=n`) |
| **HD3** | Three change kinds render distinctly: `COUNT_CHANGED`, `REPLACED`, and **`UNCHANGED_BUT_STILL_FAILING`** |
| **HD4** | **`UNCHANGED_BUT_STILL_FAILING` renders first, in the alert token, with the cited reason code from the prior rejection beside it.** A resubmission that did not fix the cited defect is the single most useful thing to show a reviewer, and rendering it as "unchanged" buries it |
| **HD5** | Each diff row links to the field or document it names, scrolling the left pane to it |

#### 6.3.11 States

| State | Behaviour |
| :--- | :--- |
| **Loading** | Skeleton in the exact split geometry: pre-check band, viewer frame, checklist rows. Document bitmaps stream in per document; the checklist is interactive before the first document finishes |
| **Empty** | Not reachable — an application always has a snapshot. **Sub-empty:** `kyc_documents[]` with every entry `NOT_PROVIDED` renders *"No documents were uploaded with this submission. That is itself a `KYC_DOCUMENT_MISSING` rejection."* · `history: []` on version 1 renders *"First submission. No prior version to compare."* · `prechecks: []` renders *"Pre-checks have not completed. Do not approve until they have. [Refresh]"* — an absent pre-check panel must never read as a passing one |
| **Error** | The document pane and the checklist fail **independently**. A failed document does not block the decision; a failed **application load** does, and renders a full-region error with retry. `404` → *"That application no longer exists, or it has already been decided. [Back to queue]"* |
| **Permission-denied** | §5.4 naming `onboarding.application.review`, held by Verification Officer and Super Admin. A `FINANCE` principal following a link lands here, not on a blank page |
| **Already decided** | `status` in `APPROVED`/`REJECTED` renders the screen **read-only** with a decision banner: decision, decider, timestamp, reason codes, overrides applied, and the owner-visible object. The action bar is replaced by *"Decided by Ananya Iyer on 29 Jul 2026, 3:10 PM IST"* — not disabled buttons |
| **Info requested** | Read-only with the outstanding checklist and the paused-SLA chip. Actions collapse to Reassign and Add note |
| **Scan pending** | `409 KYC_DOCUMENT_SCAN_PENDING` on one document → DV8; on all documents → a banner and Approve is **not** offered, because there is nothing to have reviewed |

#### 6.3.12 Acceptance checks

| Check | Source |
| :--- | :--- |
| Documents render inline alongside the checklist without downloading | `AC-ONB-02.1` |
| Failing pre-checks are visible at the top with detail; passing ones are collapsed | `AC-ONB-02.2` |
| Geo mismatch beyond tolerance is flagged and approval requires an explicit override with a reason | `AC-ONB-02.3` |
| A duplicate approved address shows a link to that gym and approval requires an override | `AC-ONB-02.4` |
| On approval the listing is live within 60 s and the decision, identity and timestamp are audited | `AC-ONB-02.5` |
| A rejection names the specific field or document and the corrective action | `AC-ONB-01.2` |
| A resubmission is marked and diffed against the prior version | `AC-ONB-01.3` |
| Approve and reject are reachable and completable without a mouse | `B2.4`, `NFR-USE-02` |
| Every reason meets its floor before the action is offered | `FR-ADMN-02`, `RS3` |

---

### 6.4 `SCR-ADM-004` — Tenant List and Detail

| Field | Value |
| :--- | :--- |
| **Route** | `/tenants` · `/tenants/:id` |
| **Feature** | `src/features/tenants/` — **never imports `features/finance/**`** (`F2`; `FolderStructure.md` §6 names this the seam where a "just show the payouts here" shortcut would appear) |
| **Permission** | `admin.tenant.list` · `admin.tenant.read` · writes per action below |

**Purpose.** The tenant's whole record, and the eight administrative actions of `FR-ADMN-01`.

**API contracts consumed.** `GET /v1/admin/tenants` · `GET /v1/admin/tenants/:id` ·
`PATCH /v1/admin/tenants/:id` · `POST …/suspend` · `POST …/reinstate` ·
`POST …/commission-override` · `POST …/tier`.

**List columns.** Name · city · tier · status · members · GMV (MTD and lifetime) · effective
commission rate **with its source** · last activity · risk flags. Filters: status, tier, city, state,
risk flag, commission source, `q`. Cursor paginated, 50 per page.

**Detail tabs** (`SCR-ADM-004` detail-tabs row), each independently permission-gated:

| Tab | Content | Gate |
| :--- | :--- | :--- |
| Profile & KYC | Legal entity, registration id, PAN, GSTIN, registered address, contacts, the approved application snapshot with a link to `SCR-ADM-003` in read-only mode | `VERIF` ○, `S.ADMIN` ● |
| Gyms & branches | Each gym, its status, its address, its geo, its photo count | `admin.tenant.read` |
| Plans | Catalogue with published state and price | `admin.tenant.read` |
| Members | Count, active/expired split, link to `SCR-ADM-005` filtered to this tenant | `admin.tenant.read` |
| Financials | Orders, settlements, refunds, disputes — **summary counts and totals with deep links into `SCR-ADM-006`…`009` filtered to this tenant**, never a re-implementation of those screens | `FINANCE` ○, `S.ADMIN` ● |
| Staff | The tenant's users, roles, branch scopes, last seen | `admin.tenant.read` |
| Activity | The tenant's audit slice — a filtered view of `SCR-ADM-015`, `entity_type`-agnostic, `tenant_id` fixed | `audit.audit_log.search` |
| Configuration | Tier, commission override, settlement cycle, reserve percentage, feature-flag overrides | `S.ADMIN` ● |
| Actions | The eight of `FR-ADMN-01` | Per action |

**The effective-rate panel — `FR-ADMN-03`, `AC-ADMN-01.2`.** The Configuration tab renders the
resolved rate **with its source**, always in this form:

```text
illustrative — not committed code

Effective commission            8.0% (800 bps)   standard
                                5.0% (500 bps)   renewal, from renewal #2

Source   TENANT OVERRIDE
         set by Arjun Nair on 14 Jul 2026
         reason "Promotional rate for the Pune launch cohort, agreed with
                 Commercial. Reverts automatically."
         valid 15 Jul 2026 – 14 Oct 2026 · 69 days remaining
         Without this override: TIER (Growth) 8.0% ← 10.0% global −200 bps

⚠ Renewal-rate tier deltas: an open assumption (KL-006). Adopted reading —
  deltas apply to the standard rate only. Awaiting client confirmation.
```

| Rule | Statement |
| :--- | :--- |
| **TN1** | The precedence chain (**global < tier < tenant override**) is rendered in full, with the rate that *would* apply without the override. A rate without its provenance is a rate somebody will dispute |
| **TN2** | An override with an end date shows a **countdown in days** and states that the reversion is automatic and notified (`AC-ADMN-01.3`) |
| **TN3** | The `renewal.assumption` object is rendered **verbatim on the screen**, not buried — the contract returns it on every read precisely so the assumption is visible on the finance screen (`Admin.md` §14.1) |
| **TN4** | Historical statements show the rate that applied then (`AC-ADMN-01.4`). The Financials tab labels every settlement's rate as **"rate at the time"** with the date, so nobody reads today's rate onto last quarter's payout |

**The eight actions.** Each opens the §5.1 reason dialog with the §5.2 consequence line:

| Action | Endpoint | Consequence line states |
| :--- | :--- | :--- |
| Suspend | `POST …/suspend` | Active members, unsettled balance, that members keep gym access, that the listing hides, that payouts stop. Requires a `suspension_category` from the seven-value enum **and** free text. **Name-typing confirmation** (`DC3`) |
| Reinstate | `POST …/reinstate` | That the listing republishes and, with `resume_payouts: true`, that payouts resume — **unless a reconciliation variance blocks them**, in which case the dialog says so before submit |
| Change tier | `POST …/tier` | Old and new tier, the resulting effective commission rate, the limits that change |
| Override commission | `POST …/commission-override` | Before and after in bps and percent, the validity window, and *"settlements already computed are untouched"* |
| Force re-verification | `PATCH …` | That the **listing stays live** and payouts suspend until re-verified (`BR-GYM-06`) |
| Adjust settlement cycle | `PATCH …` | Current cycle, new cycle, the date of the first batch affected |
| Adjust reserve | `PATCH …` | Current %, new %, current withheld amount, release schedule |
| Close tenant | `PATCH …` | Terminal. Name-typing confirmation. States what happens to active members and to unsettled balance |

**States.** *Loading* — list skeleton at 32 px; detail renders the header and tab bar first, tab
bodies stream. *Empty* — filtered: names the narrowest filter; unfiltered: unreachable in production
and rendered as an error. *Error* — per tab; a failed Financials tab does not take the Profile tab.
*Permission-denied* — per tab, with the tab still visible in the bar and its body carrying the §5.4
region, because hiding the tab would make an operator think the data does not exist.

---

### 6.5 `SCR-ADM-005` — User Administration

| Field | Value |
| :--- | :--- |
| **Route** | `/users` · `/users/:id` · `/admin/users` (platform staff) |
| **Feature** | `src/features/users/`, `src/features/platform-staff/` |
| **Permission** | `admin.user.list` · `admin.user.read` · impersonation `iam.impersonation.start` · staff `admin.staff.*` |

**Purpose.** Find any user by phone, email, name or **order reference**, and give a support agent
one screen with everything (`FR-ADMN-10`).

**Search.** `q` matches a **normalised** phone (`+91XXXXXXXXXX`), a lowercased email, a trigram name,
and an **exact** `order_ref`. The input accepts `98201 34567`, `9820134567` and `+919820134567`
identically and normalises client-side for display only — the server does the matching. **An order
reference is matched as a string and never parsed**; `ORD-2026-PN-004182` is opaque (CO-3).

**Detail regions.** Identity (name, phone, email with verified flags, city, locale, status, MFA
enrolment) · memberships (gym, plan, status, dates, days remaining — **server-computed** in the gym's
timezone, `BL4`) · orders (count, lifetime value, recent) · payments (successful, failed, last
method) · refunds · reviews (count, published, moderated) · tickets (open, closed) · **sessions** ·
**impersonation history** · data-subject requests.

| Rule | Statement |
| :--- | :--- |
| **UA1** | `sessions[]` renders `user_agent_family` and `ip_country` — **never a raw user-agent string and never a raw IP**. Those live on the audit row, which is separately access-controlled (`NFR-PRV-03`) |
| **UA2** | **There is no edit affordance on a user record.** No `PATCH /v1/admin/users/:id` exists, and the screen offers no name field, no email field and no phone field in an editable state. Support acts by impersonation or by asking. Editing a member's personal data from an admin console is not a `B3.2` capability |
| **UA3** | `impersonation_history` renders the **same rows the member sees in their own account activity**. Symmetry is the control: an agent who knows the member can see this behaves accordingly (`BR-DAT-02`) |
| **UA4** | PII masking follows the caller's permission qualifier (`CP4`), applied server-side. The console renders what it receives and never un-masks |

#### 6.5.4 Impersonation — `FR-AUTH-12`

> *"Support impersonation issues a distinctly-typed token, is capped at 30 minutes, cannot perform
> financial mutations, and surfaces a persistent banner in the impersonated session."*

```text
illustrative — not committed code

┌─ View GymMap as Priya Sharma ─────────────────────────────────────────────┐
│  You will see exactly what she sees. You will not be able to take          │
│  payments, request or decide refunds, change payout details, approve       │
│  payouts, record offline sales, create coupons, or change commission.      │
│  Everything you do is recorded and is visible to her in her own account    │
│  activity.                                                                 │
│  Reason *                                                    0 / 500       │
│  ┌──────────────────────────────────────────────────────────────────────┐ │
│  └──────────────────────────────────────────────────────────────────────┘ │
│  Minimum 20 characters. Priya will read this.                              │
│  Ticket reference (optional)  [ SUP-____ ]                                 │
│  Session length  ( ) 5 min  ( ) 15 min  (•) 30 min ← maximum               │
│  [ Cancel ]                                        [ Start session ]       │
└────────────────────────────────────────────────────────────────────────────┘

… and for the whole session, on every screen, unremovable:

╔════════════════════════════════════════════════════════════════════════════╗
║ ⚠ You are viewing GymMap as Priya Sharma. This session ends at 5:32 PM IST ║
║   (28:14 remaining). Everything you do is recorded and visible to her.     ║
║                                                        [ End session now ] ║
╚════════════════════════════════════════════════════════════════════════════╝
```

| Rule | Statement |
| :--- | :--- |
| **IM-U1** | The reason floor is **20 characters** and the dialog says the member will read it. It is stored as data and HTML-escaped on display |
| **IM-U2** | `duration_minutes` offers 5/15/30 only. **30 is the maximum and the UI cannot express more**; a `45` would be a `400`, not a silent clamp |
| **IM-U3** | The banner is rendered by the **root layout**, from `shared/impersonation/banner.tsx`, imported by the layout and **not by any feature** — so it is impossible to render a page without it (`FolderStructure.md` §6). `banner.required: true` is a directive, not a suggestion |
| **IM-U4** | The banner shows a **live countdown**. At expiry the session ends itself and the console falls back to the agent's own session with a notice, never a dead screen |
| **IM-U5** | The nine `forbidden_actions` are **not hidden buttons**. Where a forbidden action would appear, it renders disabled with an inline explanation: *"Not available in a support session."* `FR-RBAC-02` — the server refuses with `403 IMPERSONATION_FORBIDS_FINANCIAL_MUTATION` regardless, and hiding would leave an agent hunting |
| **IM-U6** | An impersonation token **cannot reach this console** (`AM4`). Starting a session navigates the browser to the customer or dashboard surface; the admin console is not available inside it |
| **IM-U7** | Ending is explicit (`POST /auth/impersonate/end` with an optional `outcome_note`) or automatic at the cap. **Both write a closing audit row with the duration**, so a forgotten session and a tidy one are indistinguishable in the record |
| **IM-U8** | `403 IMPERSONATION_TARGET_FORBIDDEN` renders *"You cannot impersonate a platform staff account."* — without this, impersonation is a ladder from Support Agent to Super Admin |

**Force logout.** Revokes sessions with a reason. Consequence line: *"This signs Priya out of 3
devices. She will need to sign in again."*

**Platform staff (`/admin/users`, `FR-ADMN-10`).** Invite (role-scoped), role assignment, session
revocation, MFA status. **The MFA toggle does not exist** — `AM3` refuses to clear it with
`422 MFA_MANDATORY_FOR_ROLE`, *including on the actor's own row*, so the console does not render a
control whose only outcome is a refusal.

**States.** *Loading* — identity block first, panels stream. *Empty* — no search yet: *"Search by
phone, email, name or order reference."* No results: *"No user matches `9820134567`. Phone numbers
match in any format."* *Error* — per panel. *Permission-denied* — `admin.user.read` named; a
`MODERATOR` reaching a user link lands here.

---

### 6.6 `SCR-ADM-006` — Finance: Orders and Payments

| Field | Value |
| :--- | :--- |
| **Route** | `/finance/orders` · `/finance/payments` |
| **Feature** | `src/features/finance/orders/` |
| **Primary persona** | **Vikram**, and a support agent answering *"where is my money"* |
| **Permission** | `admin.order.list` (`SUPPORT` ○, `FINANCE` ○, `S.ADMIN` ●) · `admin.payment.list` (`FINANCE` ●, `S.ADMIN` ●) |

**Purpose.** Every order and every **payment attempt** across all tenants, with gateway state,
provider references and failure reasons — the screen that answers a payment question in one search.

**Two tabs, one screen.** Orders and Payments share filters and a URL parameter. A payment row links
to its order; an order row expands to its attempts, including the failed ones. **Failed attempts are
first-class rows** — `KPI-19` (≥92% success) is unreadable if failures are hidden.

| Column set | Orders | Payments |
| :--- | :--- | :--- |
| Default | Order ref · tenant · member · status · gross · discount · net · tax · total · origin (`MARKETPLACE`/`DIRECT`) · created · paid | Payment id · order ref · tenant · provider ref · method (UPI/CARD/NETBANKING/WALLET) · state · amount · gateway fee · failure reason · attempted at |
| Available via `D4` | Coupon, plan, branch, invoice number, refund state, settlement batch | Provider order id, RRN/UTR, bank, retry index, webhook received at |

| Rule | Statement |
| :--- | :--- |
| **FO1** | `tenant_id` is a **filter**, not a context (`Admin.md` §9.3). The screen is platform-scope; filtering to one tenant narrows a cross-tenant read and never switches the caller's tenancy |
| **FO2** | **Drill-down to the raw provider payload is redacted and read-only.** Card PAN, CVV, tokens and any authorisation credential are absent server-side; the panel renders what arrives and has no "show unredacted" affordance, because none exists (`NFR-SEC-03`, SAQ-A scope) |
| **FO3** | Money renders per `MN1`–`MN8`. The eight `A6.3` figures where present are labelled with their `A6.3` symbol (`G`, `D`, `N`, `T`, `B`, `C`, `F`, `P`) so Vikram can map a row to the formula without a legend |
| **FO4** | Failure reasons render the **provider's reason plus the platform's classification**, never a raw provider code alone (`NFR-USE-05`) |
| **FO5** | Export produces one CSV per tab, with `order_ref` and `payment_id` in both so they join (`B2.5`: *"every export includes the identifiers needed to join it to other exports"*) |

**States.** *Loading* — 50 row skeletons; filters interactive. *Empty* — filtered: names the
narrowest filter and offers removal; a date range with no orders reads *"No orders were placed
between 01 and 06 Aug 2026 with these filters."* *Error* — table-level retry, summary strip retains
last value labelled stale. *Permission-denied* — a `SUPPORT_AGENT` sees Orders and is refused
Payments; the Payments tab renders the §5.4 region naming `admin.payment.list` and Finance.

---

### 6.7 `SCR-ADM-007` — Finance: Settlements

| Field | Value |
| :--- | :--- |
| **Route** | `/finance/settlements` · `/finance/settlements/:id` |
| **Feature** | `src/features/finance/settlements/` |
| **Permission** | `settlements.batch.list_all` · `settlements.batch.read_all` · `settlements.batch.approve` · `settlements.batch.build` |

**Purpose.** Settlement runs by cycle, the statement that ties out, and the approval — with dual
control above a threshold (`FR-SETL-06`, `BR-FIN-08`).

**List.** Cycle period (inclusive both ends, `TM3`) · tenant · batch total · **status** (`OPEN`,
`CLOSED`, `PENDING_APPROVAL`, `APPROVED`, `PROCESSING`, `PAID`, `FAILED`, `ON_HOLD` — `C4.7`) ·
line count · approver(s) · payout state · destination (masked). Filters: status, cycle, tenant,
amount range, hold reason. Status is a chip with a glyph per `AX9`.

**The statement (`/:id`) — `BR-FIN-03`, `AC-SETL-01.1`.**

```text
illustrative — not committed code

Iron Temple Fitness LLP · 27 Jul – 02 Aug 2026 (inclusive) · CLOSED
                                     G        D        N       T      B      C      F        P
ORD-2026-PN-004077  01 Aug  sale  11,800    0    10,000  1,800 10,000  1,000   236   12,564
ORD-2026-PN-004091  02 Aug  sale   5,900    0     5,000    900  5,000    500   118    6,282
RFD-2026-PN-000214  02 Aug  refnd −4,786    0    −4,056  −730 −4,056   −406     0   −4,380
RESERVE 5% withheld, releases 01 Sep 2026                                            −1,124
OPENING BALANCE carried forward from 20–26 Jul                                         −318
                                                                          NET PAYABLE 13,024
                                                                       ✓ lines sum exactly
```

| Rule | Statement |
| :--- | :--- |
| **ST1** | **All eight `A6.3` figures per line, rendered from persisted fields.** No figure is recomputed at display (`FR-SETL-02`, `BL2`, `MN4`) |
| **ST2** | The arithmetic **visibly sums to the payout** (`AC-SETL-01.1`). The console renders the sum the server supplies and a `✓ lines sum exactly` assertion. If the server reports a mismatch the screen renders **`▲ LINES DO NOT SUM — this batch cannot be approved`** and the approve control is absent. A batch whose lines no longer sum is never approved and alerts (`BR-FIN-03`) |
| **ST3** | A refund is a **negative line referencing the original sale** (`FR-SETL-03`, `AC-SETL-01.2`), with the order reference as a link |
| **ST4** | Reserve is its own visible line with the amount, the reason and the **scheduled release date** (`FR-SETL-04`, `AC-SETL-01.3`) |
| **ST5** | A recovered negative balance is an **explicit opening-balance line** naming the period it came from (`AC-SETL-01.4`) |
| **ST6** | A batch below the minimum payout renders `BATCH_BELOW_MINIMUM_PAYOUT` as a state, not an error: *"Rolls forward to the next cycle — below the ₹1,000 minimum"* (`FR-SETL-05`) |
| **ST7** | A `FEE_NOT_YET_REPORTED` line is shown **held out of the batch** with its reason. `BR-FIN-06` never estimates a fee and the screen never implies one |

**Approval.** Opens the §5.1 reason dialog with the §5.2 consequence line, and sends
`expected_net_payable_minor` + `expected_status` as **confirmation tokens** — the operator proves
they saw the right number (`Admin.md` §10.5).

| Gate | UI rendering |
| :-: | :--- |
| 1 State | Approve is offered only for `CLOSED`/`PENDING_APPROVAL`. Other states render *"This batch is `PAID`. Nothing to approve."* |
| 2 **Variance** | `422 SETTLEMENT_BLOCKED_BY_VARIANCE` → a **blocking panel** naming the variance, its amount and its id, with a link to `SCR-ADM-010`. **There is no acknowledge checkbox, no force toggle and no override.** `RC3`/`RC4`: a Finance approver cannot self-certify past a control that exists to catch Finance errors |
| 3 Payout account | `422 PAYOUT_ACCOUNT_UNVERIFIED` → *"The payout account changed on 02 Aug and has not been re-verified. Payouts are suspended until it is (`BR-GYM-06`)."* |
| 4 **Dual approval** | Above `threshold_minor`, the panel shows `approved_by_1`, `approved_by_2: null`, `complete: false` and *"A second, different approver is required."* This is a **success state, not an error** — the first approver did everything right, and the screen says so |

| Rule | Statement |
| :--- | :--- |
| **SA1** | A second attempt by the **same** actor renders `422 PAYOUT_REQUIRES_DUAL_APPROVAL` as *"You already approved this batch. A second, different approver is required."* — never as a generic failure |
| **SA2** | `409 RESOURCE_VERSION_CONFLICT` on a stale `expected_net_payable_minor` renders *"This batch changed since you opened it: net payable is now ₹13,024, was ₹12,900. [Reload]"* — the second approver must be approving the same number as the first |
| **SA3** | Payout execution state (`QUEUED` → `PROCESSING` → `PAID`/`FAILED`) is **polled through `useLiveCounters()`** with a freshness indicator (`LV8`). The statement itself does not poll (`LV9`) |
| **SA4** | `FAILED` renders the bank's rejection reason and states that the batch returned to `PENDING_APPROVAL` and that both tenant and Finance were notified (`FR-SETL-08`) |

**States.** *Loading* — statement skeleton with the eight column headers in place, so the shape is
recognisable before the numbers land. *Empty* — no batches for the cycle: *"No settlement batches for
27 Jul – 02 Aug. The build job runs at 02:00 IST on Mondays."* *Error* — statement-level; the list
retains. *Permission-denied* — `settlements.batch.list_all`, held by Finance and Super Admin; a
`VERIFICATION_OFFICER` reaching it gets the §5.4 region (`PE4` — platform scope is not platform
authority).

---

### 6.8 `SCR-ADM-008` — Finance: Refund Approval

| Field | Value |
| :--- | :--- |
| **Route** | `/finance/refunds` · `/finance/refunds/:id` |
| **Feature** | `src/features/finance/refunds/` |
| **Permission** | `refunds.refund.list_all` (`FINANCE` ○, `S.ADMIN` ●) · **`refunds.refund.decide` — `SUPER_ADMIN` only** · `refunds.refund.create_platform` (`SUPPORT` ●, `FINANCE` ●, `S.ADMIN` ●) |

**Purpose.** The queue of refunds that `BR-REF-03` routed to a human, and the decision — taken with
**the full pro-rata computation on screen** (`FR-RFND-04`).

**Queue.** Age (with `age_state` `FRESH`/`DUE_TODAY`/`OVERDUE` against the 48-hour internal SLA) ·
amount · **usage** · **policy position** · tenant · requester type · reason code · **which predicate
was breached**. Default filter `status=PENDING_APPROVAL` — the default *is* the queue. Sort by age
descending. `summary` renders pending count, pending value and overdue count, computed over the
**filtered** set, so a Finance lead filtering to one tenant sees that tenant's exposure.

| Rule | Statement |
| :--- | :--- |
| **RF1** | The `breached_predicate` column is why this one needs a human: `WINDOW`, `USAGE`, `VALUE`, or a combination. It renders as chips with the stored values in the tooltip — *"requested 15 days after payment; the stored policy allows 7"* |
| **RF2** | The policy shown is **the one stored on the order** (`orders.refund_policy_snapshot`, `BR-REF-02`), labelled with its capture date. Never the tenant's current settings. The label says so: *"policy as captured 18 Jul 2026"* |
| **RF3** | Eligibility is **read** from `refunds.computation.eligibility`, never recomputed at list time. A decision taken nine days later is explicable against the world as it was |

#### 6.8.4 The computation panel — shown **before** the approver confirms

> `FR-RFND-04`: *"Refund amount computation: full, or pro-rata on unconsumed duration or sessions,
> less any stated cancellation fee, **with the computation shown to all parties**."* `AC-RFND-01.2`.

```text
illustrative — not committed code

┌ Refund RFD-2026-PN-000214 · Sneha D. · Iron Temple Fitness LLP ────────────┐
│ Requested 02 Aug 09:14 IST · 74 h · OVERDUE · RELOCATION · by MEMBER        │
│ Breached: WINDOW (15 d vs 7 d)  ·  VALUE (₹11,800 vs ₹5,000 ceiling)        │
├─────────────────────────────────────────────────────────────────────────────┤
│ POLICY   from the order, captured 18 Jul 2026 05:42 IST                     │
│          cooling-off 7 days · usage 3 visits / 20% · cancellation fee ₹500  │
│                                                                             │
│ METHOD   PRORATA_DURATION                                                   │
│ TERM     18 Jul → 16 Oct 2026 · 90 days · 49 consumed · 41 unconsumed       │
│                                                                             │
│ PAID     gross      ₹11,800                                                 │
│          discount        ₹0                                                 │
│          net        ₹10,000                                                 │
│          tax @18%    ₹1,800                                                 │
│                                                                             │
│ PRO-RATA net × unconsumed ÷ total = 10,000 × 41 ÷ 90                        │
│          raw            ₹4,555.5555                                         │
│          rounded        ₹4,555.56    HALF_EVEN                              │
│ LESS     cancellation fee  −₹500.00   from the stored policy                │
│ PLUS     tax on refunded net  ₹729.99                                       │
│ ─────────────────────────────────────────────────────────────────────────── │
│ REFUNDABLE                 ₹4,785.55                                        │
├─────────────────────────────────────────────────────────────────────────────┤
│ PLATFORM CONSEQUENCE (written when the refund COMPLETES, not now)           │
│  commission reversal      −₹405.60   BR-REF-05, at the rate persisted on    │
│                                      the original line (1000 bps), not      │
│                                      the tenant's rate today                │
│  commission GST reversal    pending  O-1 / BLK-03 — unresolved, see §8      │
│  gateway fee reversal          ₹0    BR-FIN-06 — Razorpay does not reverse  │
│                                      the MDR; it is borne per agreement and │
│                                      appears as its own settlement line     │
│  net effect on tenant     −₹4,379.95                                        │
│  appears in               the batch covering 06 Aug 2026, as three lines    │
├─────────────────────────────────────────────────────────────────────────────┤
│ EVIDENCE  order · invoice · payment · 8 check-ins · terms accepted 18 Jul   │
│ [ Decline ]                                        [ Approve refund ]       │
└─────────────────────────────────────────────────────────────────────────────┘
```

| Rule | Statement |
| :--- | :--- |
| **RC-U1** | **Every figure is rendered from the server's `computation` object. None is typed by a human and none is computed in the client** (`BL2`). The raw pre-rounding value and the rounding mode are both shown, because a finance analyst who cannot see the rounding cannot trust the total |
| **RC-U2** | The panel is **not collapsible and not behind a tab**. The decision buttons sit below it, so the arithmetic is passed on the way to the decision |
| **RC-U3** | `computation_hash` from the `GET` is held and sent with the decision. On `422 CONFIG_VALIDATION_FAILED` with `rule: "stale_computation"` the console renders the server's message verbatim — *"The refund calculation changed since you opened it — a check-in was recorded at 11:58. Review the updated figures."* — **re-renders the computation with the changed values highlighted**, and requires a fresh confirm. A version integer would say *something* changed; the hash plus the re-render says **what** |
| **RC-U4** | The **platform consequence** block is rendered even though those entries are written on `COMPLETED`, not on approval. An approver deciding a member's refund without seeing the tenant's −₹4,379.95 is deciding half the transaction |
| **RC-U5** | The `commission_tax_reversal_status: PENDING_CLIENT_DECISION` field renders as a **visible open item on the screen**, not as a hidden null. `LAUNCH_MARKET_INDIA.md` §11 conflict 2 is unresolved and the finance surface is where it must be visible |
| **RC-U6** | An approver may approve **less** than requested, never more. The amount field is bounded by `refundable_minor` client-side and refused with `422 REFUND_EXCEEDS_PAID_AMOUNT` server-side. `BR-PAY-04` does not become negotiable when the client is a Super Admin |
| **RC-U7** | **Decline carries the same computation panel.** A declined member is owed the arithmetic that justified the decline as much as an approved one is. Decline requires a `decline_reason_code` from the seven-value enum **plus** free text |
| **RC-U8** | The success state says **`PROCESSING`, not "refunded"**: *"Refund instructed. The bank typically takes 5–7 working days. The membership moves to `REFUNDED` and the QR stops generating when the provider confirms."* A Super Admin who approves has approved an *instruction* |

**States.** *Loading* — queue skeleton; detail renders the header and policy block first, computation
last with a labelled placeholder (never a blank space where a number will be). *Empty* — *"No refunds
are waiting for a decision. 6 decided today."* *Error* — computation fetch failure blocks the
decision and says so: *"Couldn't load the refund calculation. You cannot decide without it.
[Retry]"* — the buttons are **absent**, not disabled. *Permission-denied* — `FINANCE` sees the queue
and the computation, and in place of the buttons: *"Only a Super Admin can decide a refund that fell
outside policy."* (`PD5`).

---

### 6.9 `SCR-ADM-009` — Finance: Disputes

| Field | Value |
| :--- | :--- |
| **Route** | `/finance/disputes` · `/finance/disputes/:id` |
| **Feature** | `src/features/finance/disputes/` |
| **Permission** | `refunds.dispute.list` · `refunds.dispute.read` · `refunds.dispute.submit_evidence` · `refunds.dispute.intake_manual` — `FINANCE` ●, `S.ADMIN` ● |

**Purpose.** Chargeback cases with a **deadline countdown**, the pre-assembled evidence pack, and
the balance-hold status.

**List.** Case · provider dispute id · tenant · member · amount · **deadline countdown** · stage ·
outcome · hold status. Sorted by deadline ascending — the nearest deadline is the work.

| Rule | Statement |
| :--- | :--- |
| **DS1** | The deadline renders as a **server-computed countdown in IST** with the absolute date beside it (`TM4`, `TM5`). Under 48 hours it escalates to the alert token with a glyph. A missed evidence deadline is an automatic loss and the screen must make that impossible to miss |
| **DS2** | **The hold is rendered on the case, on the tenant, and on the settlement batch.** `BR-REF-08` holds the disputed amount against the tenant balance from case opening; the same fact appears in three places and is read from one field, never asserted separately |
| **DS3** | The evidence pack is **pre-assembled** (`FR-RFND-09`) — order, invoice, payment record, attendance records, terms accepted, communication log — and each item renders with a completeness marker. Missing items are named, not silently absent |
| **DS4** | Submission is one action with a reason, idempotency-required, and irreversible. The confirmation states the deadline it satisfies and that the pack cannot be amended after submission |
| **DS5** | Outcome tracking renders the provider's resolution and its consequence: won → *"Hold released; the amount returns to the next settlement"* (`AC-RFND-02.3`); lost → the ledger effect and the settlement line |
| **DS6** | Manual intake exists as the compensating path when a webhook is lost. It requires the `provider_dispute_id`, which is uniquely indexed — the header is belt, the index is braces |

**States.** *Loading* — list skeleton; the countdown column renders last and never renders a
placeholder that could be mistaken for a real deadline. *Empty* — *"No open disputes. Dispute rate
0.18% against a ≤0.5% target (`KPI-21`)."* *Error* — per region; a failed evidence-pack fetch blocks
submission and says so. *Permission-denied* — `refunds.dispute.list`, Finance and Super Admin.

---

### 6.10 `SCR-ADM-010` — Finance: Reconciliation

| Field | Value |
| :--- | :--- |
| **Route** | `/finance/reconcile` |
| **Feature** | `src/features/finance/reconciliation/` |
| **Primary persona** | **Vikram**, every morning at 09:00 IST |
| **Permission** | `settlements.reconciliation.read` · resolve `settlements.reconciliation.resolve` — **`WRITE_OFF` is `SUPER_ADMIN` only** |

**Purpose.** The daily comparison of the gateway settlement report to the internal ledger.
**The target is zero variance every day — `KPI-26` is 100% with no tolerance band.**

#### 6.10.1 The day that went right

```text
illustrative — not committed code

┌ Reconciliation · 05 Aug 2026 · Razorpay ─────────────────────────────────┐
│                                                                           │
│           ✓  MATCHED                                                      │
│                                                                           │
│   1,247 transactions compared                                             │
│   Provider total   ₹1,84,92,000                                           │
│   Ledger total     ₹1,84,92,000                                           │
│   Variance                  ₹0                                            │
│                                                                           │
│   KPI-26  100%  MET                                                       │
│   Run 05 Aug 22:30 → 22:31 IST · 1 m 43 s                                 │
│                                                                           │
│   0 tenants blocked · all payouts eligible                                │
└───────────────────────────────────────────────────────────────────────────┘
```

This is the state the screen is designed around and it is **quiet on purpose**. A screen that looks
busy on a good day teaches an operator to skim it on a bad one.

#### 6.10.2 The day that did not

```text
illustrative — not committed code

┌ Reconciliation · 04 Aug 2026 · Razorpay ─────────────────────────────────┐
│ ▲ VARIANCE · 3 unresolved · 2 tenants blocked · ₹6,006 of payouts held    │
│   Provider ₹1,77,03,400   Ledger ₹1,77,03,871   Variance −₹4,710          │
│   KPI-26  99.75%  BREACHED — KPI-26 has no tolerance band. 99.75% is a    │
│                   breach, not a pass.                                     │
│   Detected 38 h ago · escalation at +72 h to Finance lead + Tech lead     │
├───────────────────────────────────────────────────────────────────────────┤
│ ▲ AMOUNT_MISMATCH                            Iron Temple Fitness · Pune   │
│   provider pay_QjR7mK4wYt8Ln2   ₹11,800                                   │
│   ledger   ORD-2026-PN-004077   ₹11,810                                   │
│   variance −₹10 · detected 04 Aug 22:30 IST · 38 h                        │
│   ▶ BLOCKS AUTO-PAYOUT for this tenant                                    │
│     batch 01933b41 is ON_HOLD · ₹41,287 held                              │
│                                              [ Resolve ]  [ Open order ]  │
├───────────────────────────────────────────────────────────────────────────┤
│ ▲ IN_PROVIDER_NOT_IN_LEDGER                Shakti Strength Studio · Jaipur │
│   provider pay_QkA2nD9xVr3Hs6   ₹2,950   ledger — none                    │
│   variance +₹2,950 · 38 h                                                 │
│   ▶ BLOCKS AUTO-PAYOUT · batch 01933b41 ON_HOLD · ₹18,774 held            │
│     Likely a dropped webhook whose replay has not run.                    │
│                                              [ Resolve ]                  │
├───────────────────────────────────────────────────────────────────────────┤
│ ▲ FEE_NOT_REPORTED                           Iron Temple Fitness · Pune   │
│   amounts agree (₹5,900); the gateway fee is absent from the report.      │
│   BR-FIN-06 holds the line out of settlement rather than estimating.      │
│   ▶ BLOCKS AUTO-PAYOUT · same batch · ₹41,287 held                        │
│                                              [ Resolve ]                  │
├───────────────────────────────────────────────────────────────────────────┤
│ VARIANCE TREND · last 30 days      ▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▂▁▁▁▁▁▃▁▁ 04 Aug ▃   │
│                                    27 of 30 days at zero                  │
└───────────────────────────────────────────────────────────────────────────┘
```

| Rule | Statement |
| :--- | :--- |
| **RN1** | **Every variance card states that it blocks auto-payout, names the batches on hold, and names the held amount.** The question arrives at support as *"why has this gym not been paid?"* and the answer must be on this screen, not inferred from `SCR-ADM-007` |
| **RN2** | `effect.auto_payout_blocked` is **read from the batch state**, not asserted by this screen. One fact, two readers, no possibility of the screen and the approval guard disagreeing |
| **RN3** | The block is **per tenant per day**. The header says *"2 tenants blocked"*, not *"payouts blocked"*. One gym's ₹40 does not stop 411 others being paid (`RC5`), and the screen must not imply otherwise |
| **RN4** | **There is no ignore, no dismiss, no snooze and no force-payout affordance anywhere on this screen.** `RC3`: a variance is closed by explanation, never by acknowledgement. The absence is the control |
| **RN5** | A ₹10 variance renders at the same visual weight as a ₹2,950 one. *"A ₹40 variance is not 'immaterial'; it is a signal that the pipeline that produced ₹1,84,92,000 of matched transactions has a defect somewhere, and the amount is not evidence of its size."* Sorting by absolute amount is available; **weighting by it is not** |
| **RN6** | The seven `variance_type` values each render a purpose-built card: `AMOUNT_MISMATCH` shows both amounts and the delta; `IN_PROVIDER_NOT_IN_LEDGER` shows the provider reference and names the dropped-webhook hypothesis; `IN_LEDGER_NOT_IN_PROVIDER` names the report cut-off; `FEE_NOT_REPORTED` states `BR-FIN-06`'s hold-rather-than-estimate rule; `CURRENCY_MISMATCH`, `DUPLICATE_IN_PROVIDER` and `REFUND_MISMATCH` likewise |
| **RN7** | The escalation ladder is rendered on the header: detection → Finance; **+24 h** repeat with the blocked total; **+72 h** Finance lead and Technical Lead, paged; **+7 days** recorded against `KPI-26`'s monthly figure. An analyst should see the clock they are on |
| **RN8** | The 30-day trend sparkline states **"27 of 30 days at zero"** in text beside it. A sparkline alone is not accessible and a target of zero is not a trend question (`AX9`) |

#### 6.10.5 Resolving a variance

| Rule | Statement |
| :--- | :--- |
| **RV1** | Five resolution types, each rendering its **ledger consequence and its unblocking effect before submit**: `TIMING` (no ledger effect; re-raised next run if it did not clear — and the dialog says so, because that safety net is what makes the type safe to use) · `FEE_NOT_YET_REPORTED` (no effect; **that line stays held**) · `PROVIDER_ERROR` (no effect; evidence reference required in practice) · `LEDGER_CORRECTION` (**one `ADJUSTMENT` entry**) · **`WRITE_OFF` (`SUPER_ADMIN` only; one `ADJUSTMENT` entry plus a marker)** |
| **RV2** | The reason floor here is **50 characters**, not 10, and the helper text says so (`RD4`) |
| **RV3** | `expected_variance_minor` is sent as an optimistic guard. On `422 CONFIG_VALIDATION_FAILED` with `rule: "variance_changed"` the console renders both figures and re-loads: the 04:00 job may have run again between reading and clicking |
| **RV4** | The dialog states that **a correction cannot edit the original entry**: *"This posts a new, attributed adjustment entry. The original stays on the statement. A statement showing ₹11,810 corrected to ₹11,800 tells a story; a statement that only ever said ₹11,800 conceals one."* |
| **RV5** | `WRITE_OFF` from a `FINANCE` principal renders `403 PERMISSION_DENIED` as *"A write-off is a Super Admin decision."* — and the option is rendered **disabled with that explanation**, not hidden, so a Finance analyst knows the path exists |
| **RV6** | The success response is rendered in full and honestly: **`auto_payout_blocked` may stay `true`** because one tenant can hold two variances and the block is per tenant. And **`kpi_26.status` stays `BREACHED`**, with the server's note: *"Resolving a variance does not retroactively make the day match. `KPI-26` measures matching WITHOUT manual adjustment."* The screen never renders a resolved day as met |

**States.** *Loading* — the summary block skeleton renders **without** a zero placeholder; a `₹0`
that turns out to be `−₹4,710` is the worst possible loading state. *Empty* — a matched day is
§6.10.1, which is a **success** state, not an empty one. A date before the first run is `404`:
*"No reconciliation ran for 12 Mar 2026. The first run was 01 Apr 2026."* *Error* — **a failed fetch
renders an explicit unknown state and says what it means:** *"Reconciliation status unavailable. Do
not approve payouts until this loads. [Retry]"* Silence here would read as zero. *Permission-denied*
— `settlements.reconciliation.read`, Finance and Super Admin.

**Acceptance checks.** Daily comparison with variance list and drill-down (`SCR-ADM-010` content) ·
resolution notes (`FR-SETL-09`) · historical variance trend with target zero (`KPI-26`) · a non-zero
variance visibly blocks auto-payout for the affected tenant (`BR-FIN-07`, `RC4`).

---

### 6.11 `SCR-ADM-011` — Configuration Screens

| Field | Value |
| :--- | :--- |
| **Routes** | `/config/commission` · `/config/subscription` · `/config/tax` · `/config/kyc` · `/config/taxonomy` · `/config/flags` · `/config/notifications` |
| **Feature** | `src/features/configuration/{commission,subscription,tax,kyc,taxonomy,flags,templates}/` |
| **Permission** | One `.read` and one `.update` per family (`Admin.md` §2.4). **Read-only is a distinct permission, never a runtime flag** |

**Purpose.** Seven configuration surfaces, **one guard**: every change requires a reason, shows a
preview of affected entities, and is audited (`SCR-ADM-011` guard, `FR-ADMN-03`…`FR-ADMN-08`).

**Every one of the seven uses the three-pane dry-run wizard of §5.3.** No exceptions, no
"small change" path, no inline toggle that skips the preview — including a feature flag.

| Family | What the editor edits | Versioning | Preview counts |
| :--- | :--- | :--- | :--- |
| Commission | Global standard and renewal rates in **bps**; per-tier deltas for Starter/Growth/Professional. **Enterprise is absent by design** — negotiated per tenant, expressed only as a tenant override | **Append-only** — supersede with a new `effective_from` | Tenants, tenants by tier, live plans, orders last 30 d, estimated monthly commission delta, per-tenant before/after sample with **source** |
| Subscription tiers | Limits, features, prices per tier | Append-only | Tenants on each tier, tenants whose limits would be breached by the new values |
| Tax profiles | India GST: rate, **CGST/SGST split as two separate invoice lines**, IGST, inclusive/exclusive, rounding, SAC code, `fy_start_month` | Append-only | Live plans, orders in the current period, invoices whose template changes |
| KYC checklists | Document types, mandatory flags, validity rules, per country and entity type | Append-only | **Applications in flight against the current version** — and the preview states that they keep their snapshotted version (`CL1`) |
| Taxonomy | Amenities, categories, cities and localities, and the five reason-code sets of `C4.8` | `ETag` | Gyms using an amenity being renamed or retired; **rejections already citing a reason code being retired** |
| Feature flags | Targeting by tenant, by role, by percentage rollout | `ETag` | Tenants and users entering and leaving the flag, at the exact percentage |
| Notification templates | Per key, per channel, per locale; versioned and previewable | `ETag` | Recipients on the next scheduled send |

| Rule | Statement |
| :--- | :--- |
| **CG1** | Rates are edited **in basis points** with a live percentage echo, never as a decimal field. A float here would eventually produce ₹1,180.0000000001 on a statement (`MN6`) |
| **CG2** | `422 COMMISSION_RATE_BELOW_FLOOR` renders the server's message naming **the tier and the delta that caused it** — *"Professional (−400 bps) against a 300 bps standard rate produces −100 bps. The floor is 0 bps."* — and highlights that tier's field |
| **CG3** | `effective_from` **must be in the future** (`BR-FIN-05`) and the picker enforces it; the helper text states why: *"Rates are frozen at the moment of sale. A past date would mean repricing sales that already happened."* |
| **CG4** | **Feature flags do not get a fast path.** A toggle at 100% rollout is a change with a blast radius and takes the same three panes, the same reason and the same name-typing confirmation (`DC3`) |
| **CG5** | Taxonomy retirement never deletes. A retired reason code stays resolvable for the rejections that cite it; the editor renders the citing count before allowing retirement |
| **CG6** | Templates preview **rendered, in `en-IN`, with sample data**, per channel (email, SMS, in-app) — `FR-NOTF-03` requires versioned, previewable, deploy-free editing |
| **CG7** | A `FINANCE` principal on `/config/commission` sees the full configuration and its history, and in place of Edit: *"Commission configuration is changed by a Super Admin. You can view it."* (`PD5`) |
| **CG8** | Every family renders its **change history** — actor, timestamp, reason, before and after — inline beneath the editor. The audit log is the record of truth; this is the convenient view of it, and it links to `SCR-ADM-015` filtered to the entity |

**States.** *Loading* — the editor renders disabled with the current values as skeletons; the history
list streams. *Empty* — a family with no history renders *"No changes recorded. Current values were
set at launch on 01 Apr 2026."* *Error* — the editor is **not** rendered on a failed read; a
configuration editor showing defaults instead of the current state is a way to overwrite production
by accident. *Permission-denied* — read-denied renders the §5.4 region; write-denied renders the
read-only screen per CG7.

---

### 6.12 `SCR-ADM-012` — Moderation Queues

| Field | Value |
| :--- | :--- |
| **Routes** | `/moderation/reviews` · `/moderation/content` · `/moderation/reports` — **three separate queues**, not one filtered list |
| **Feature** | `src/features/moderation/` |
| **Permission** | `reviews.moderation.list` / `.decide` · `admin.moderation_content.*` · `admin.moderation_report.*` — `MODERATOR` ●, `S.ADMIN` ● |

**Purpose.** Reviews pending or flagged, gym content flags, and user reports — each with the
triggering signal, the artefact, the context and the author's history (`FR-ADMN-12`, `RSK-02`).

**Review queue row.** The review text in full · rating and sub-ratings · the **triggering signal**
(screening category, `FR-REV-09` anomaly, gym report) · gym context (name, city, rating, review
volume, recent rating velocity) · **reviewer history** (account age, review count, publish/moderate
ratio, whether the check-in binding is present). Two-pane: queue left, artefact right, `j`/`k` to
move, decision keys on the right pane.

| Rule | Statement |
| :--- | :--- |
| **MD1** | The five actions map exactly to `C4.6`: **Publish** (`HELD`→`PUBLISHED`) · **Unpublish** (`PUBLISHED`→`UNPUBLISHED`, reversible, leaves the aggregate within 60 s) · **Republish** · **Request edit** (`HELD`→`HELD`, member notified, **the 7-day edit window restarts** — and the dialog says so) · **Remove** (terminal) |
| **MD2** | **`reason_code` is required on every action, including Publish.** *"Why did this get published"* is as much an audit question as *"why was it removed"* (`FR-ADMN-02` admits no exception). The nine `C4.8` moderation codes render with server-supplied labels; `OTHER` requires notes |
| **MD3** | **Remove states its permanence, every time:** *"`REMOVED` is terminal. There is no way back — reinstating would require the member to write a new review, which would be a different review."* Name-typing confirmation (`DC3`) |
| **MD4** | **The `BR-REV-07` sharp edge is surfaced before the decision.** At exactly three published reviews, removing one drops the gym to two and its **numeric rating disappears from every surface**. The dialog says: *"Iron Temple has 3 published reviews. Removing this one takes it to 2, and its rating (4.3) will no longer be shown anywhere. That is correct behaviour, not a bug."* |
| **MD5** | `PERSONAL_INFORMATION` and `THREAT` are the **only two** codes carrying immediate hide (`BR-REV-06`), and the queue marks such items as already hidden pending decision. The list is closed; a moderator cannot invent a third |
| **MD6** | An `FR-REV-09` anomaly hold renders **"excluded from the aggregate while held"** on the row. A burst of fakes must not inflate a rating for the hours before a human looks, and the moderator should know that protection is active |
| **MD7** | Bulk action is available for a **single reason code across selected rows** and requires one reason covering all of them, with the count in the consequence line. Bulk **Remove** is not offered |

**Gym content flags** — photos and descriptions, with the flagged artefact, the signal, the gym and
the actions publish / request-edit / remove-with-reason. **User reports** — the report, the reporter,
the subject entity, and a link to the subject's own screen.

**States.** *Loading* — queue skeleton; artefact pane renders after selection. *Empty* — *"Nothing
held for moderation. 11 decided today."* *Error* — pane-level. *Permission-denied* — per queue;
`reviews.moderation.list` named, Moderator and Super Admin.

---

### 6.13 `SCR-ADM-013` — Support Console

| Field | Value |
| :--- | :--- |
| **Route** | `/support/tickets` · `/support/tickets/:id` |
| **Feature** | `src/features/support/` |
| **Permission** | Platform-scope ticket permissions plus the `SUPPORT_AGENT` role. The `/support/tickets*` family serves member, tenant and agent — **the agent console is the same resource under a platform-scope permission, not a second endpoint family** |

**Purpose.** `FR-SUP-03`: queue with assignment, priority, internal notes, canned responses and full
customer context.

**Queue.** Ticket · requester (member or tenant) · category · priority · **SLA timer** ·
assignee · status (`OPEN`, `IN_PROGRESS`, `WAITING_ON_CUSTOMER`, `RESOLVED`, `CLOSED`) · last
activity. Sorted by SLA urgency. `KPI-25` (median first response ≤ 4 h) renders on the header.

| Rule | Statement |
| :--- | :--- |
| **SP1** | The detail pane carries the **full customer context** and the **linked entities** the ticket was raised from — order, membership, payment, check-in — each a live link to its screen. `FR-SUP-02` auto-attaches these at creation and the console must show them, not make the agent search |
| **SP2** | Internal notes are visually unmistakable from customer-visible replies: different background, a persistent `INTERNAL — not sent to the customer` label on the composer, and a confirmation if a note contains a greeting |
| **SP3** | Canned responses insert as editable text, never send directly |
| **SP4** | SLA timers per priority with breach marking (`FR-SUP-05`). A breached timer stays visible |
| **SP5** | **A member's state is never asserted by the agent.** There is no `PATCH /support/tickets/:id` for the requester and no agent control that edits a member's record. Where the agent needs to act as the member, the path is impersonation (§6.5.4), which is audited, capped and visible to the member |
| **SP6** | Escalation to a refund opens `POST /v1/admin/refunds` (§6.8) with the order pre-filled — `FR-RFND-01`'s third origination path — and requires the same reason and the same computation review |

**States.** *Loading* — queue skeleton; detail streams. *Empty* — *"No open tickets assigned to you.
4 unassigned in the queue."* *Error* — pane-level with retry. *Permission-denied* — §5.4 naming the
support permission and the Support Agent and Super Admin roles.

---

### 6.14 `SCR-ADM-014` — Platform Analytics

| Field | Value |
| :--- | :--- |
| **Route** | `/analytics` · `/analytics/:reportKey` |
| **Feature** | `src/features/analytics/` |
| **Permission** | `reporting.platform_report.read` — `S.ADMIN` ●, `FINANCE` ○ |

**Purpose.** The eleven-report platform catalogue of `B5.20`, with **city, tier and cohort
dimensions**.

| Report | Key figures |
| :--- | :--- |
| GMV and take rate | By period, city, tier — against `KPI-16`'s 8–12% band |
| Tenant funnel | Signups → submitted → approved → activated → transacting, with drop-off per step |
| Tenant cohort retention | By signup month, against `KPI-04`'s ≥95% |
| Marketplace funnel | Search → detail → checkout → paid, with `KPI-09`/`KPI-10`/`KPI-11` marked |
| City performance | Supply, demand, GMV, conversion by city |
| Payment health | Success rate against `KPI-19`, failure reasons, retry recovery |
| Refunds and disputes | Rate and value against `KPI-20`/`KPI-21`, reasons, by tenant |
| Reconciliation | Gateway vs ledger variance by day — `KPI-26` |
| Review integrity | Volume, moderation rate, anomaly flags |
| Support load | Tickets per tenant, per category, resolution time — `KPI-25` |
| Verification SLA | Queue depth, time to decision, rejection-reason distribution |

| Rule | Statement |
| :--- | :--- |
| **AN1** | Every report supports a **date range, on-screen rendering, CSV export and, where meaningful, a chart** (`FR-RPT-01`) |
| **AN2** | Data is **≤ 15 minutes stale and labelled with its as-of instant**; **financial reports read the ledger and are always current** and labelled as such (`FR-RPT-02`). The distinction is on the screen, not in a footnote |
| **AN3** | **Every figure is traceable: clicking a total reveals its constituent records** (`FR-RPT-05`), which on this surface means a filtered deep link into `SCR-ADM-006`, `007`, `008` or `010` |
| **AN4** | Exports over the size threshold are **asynchronous**, return `202`, and are delivered by notification with a time-limited link (`FR-RPT-03`). The UI says so rather than appearing to hang |
| **AN5** | Charts follow the `DesignSystem.md` chart tokens. Colour is never the sole encoder — series carry direct labels or distinct markers (`AX9`). Abbreviated money on a chart axis carries the full figure in the tooltip (`MN8`) |
| **AN6** | `422 REPORT_RANGE_TOO_LARGE` renders as an offer, not a refusal: *"That range is too large to render. [Export it instead]"* |

**States.** *Loading* — chart and table skeletons at final dimensions. *Empty* — a period with no
data names the period and the dimension. *Error* — per report. *Permission-denied* — §5.4;
`FINANCE` sees the financial reports and the §5.4 region on the rest.

---

### 6.15 `SCR-ADM-015` — Audit Log Explorer

| Field | Value |
| :--- | :--- |
| **Route** | `/audit` |
| **Feature** | `src/features/audit/` |
| **Permission** | `audit.audit_log.search` — `SUPPORT` ○, `VERIF` ○, `FINANCE` ○, `MODER` ○, `S.ADMIN` ● |

**Purpose.** `FR-ADMN-09` / `AC-ADMN-02.1`: given any entity id, see every change in chronological
order with actor, timestamp, IP, before-state and after-state.

#### 6.15.1 There is no edit and no delete affordance on this screen, and that absence is the feature

> `AC-ADMN-02.3`: *"Given I attempt to modify or delete an audit record through any interface, then
> **no such capability exists**."*

**Stated plainly, as a UI requirement:**

| Rule | Statement |
| :--- | :--- |
| **AU1** | **This screen renders no edit control, no delete control, no bulk-delete, no archive button, no "correct this entry" link, no inline editing, no row context menu with a mutating item, and no administrative override of any kind — at any permission level, including `SUPER_ADMIN`.** A row is read, filtered, diffed and exported. Nothing else |
| **AU2** | The absence is **not** implemented as a disabled control or a permission-gated control. There is nothing to gate. A disabled Delete button asserts that deletion is a capability someone could hold, and on this table nobody can |
| **AU3** | The absence is structural at four independent layers and the UI is the weakest of them, which is why it is stated here rather than relied upon: `L3-GRANT` — nobody holds `UPDATE` or `DELETE` on `audit_log`; the **route table** — no `PATCH`, `PUT` or `DELETE` operation exists on `/v1/admin/audit` or any path beneath it; `L12-CI` — a structural assertion over the generated OpenAPI document fails the build if a mutating method ever appears on that path; and the **registry** — there is deliberately **no `AUDIT_LOG_IMMUTABLE` error code**, because an error code implies a route that refuses, and the absence of the route is stronger |
| **AU4** | The screen states this to its reader, once, in the header: *"Audit records are append-only. They cannot be edited or deleted from this console or from any other interface."* An auditor should not have to infer immutability from a missing button |
| **AU5** | **Retention is not mutation and the screen distinguishes them.** Partitions beyond 24 months are detached to cold storage and are re-attachable; retention is **7 years**. A query reaching detached history renders *"This range is in cold storage. Results may take longer. [Continue]"*, never *"no records"* |

#### 6.15.2 Filters, results and the diff

```text
illustrative — not committed code

┌ Audit log ────────────────────────────────────────────────────────────────┐
│ Audit records are append-only. They cannot be edited or deleted from this  │
│ console or from any other interface.                                       │
├───────────────────────────────────────────────────────────────────────────┤
│ Actor [ Ananya Iyer ▾ ]  Entity type [ application ▾ ]                     │
│ Entity id [ 01932d10-4a02-7c11-9b33-5e2f7a1c4d80        ]                  │
│ Action [ APPROVE ✕ ] [ OVERRIDE ✕ ] [ + ]                                  │
│ Date 01 Aug 2026 → 06 Aug 2026 IST     ☑ Impersonated actions only         │
│ Tenant [ any ▾ ]   Correlation id [                    ]   [ Export CSV ]  │
├───────────────────────────────────────────────────────────────────────────┤
│ When (IST)        Actor            Action    Entity            Impers.     │
│ 06 Aug 15:11:07   Ananya Iyer      APPROVE   application 01932d10   —   ▸  │
│ 06 Aug 15:11:07   Ananya Iyer      OVERRIDE  application 01932d10   —   ▸  │
│ 06 Aug 15:10:41   Ananya Iyer      ELEVATE   KYC_DOCUMENT_ACCESS    —   ▸  │
│ 04 Aug 11:22:03   Priya Sharma     UPDATE    membership 01932d51   ⚠ Neha ▸│
├───────────────────────────────────────────────────────────────────────────┤
│ ▾ 06 Aug 15:11:07 · APPROVE · application 01932d10                         │
│   Actor  Ananya Iyer (PLATFORM_STAFF) · 203.0.113.24 · Chrome / Windows    │
│   Reason "Owner supplied the municipal survey plan; the postal address     │
│           geocodes to the society gate 940 m away…"                        │
│   Permission onboarding.application.approve · scope PLATFORM               │
│   Correlation 01J9Z7QK3M4N5P6R7S8T9V0W1X                        [ copy ]   │
│   BEFORE                              AFTER                                │
│   status      UNDER_REVIEW          → status      APPROVED                 │
│   decision    null                  → decision    APPROVED                 │
│   decided_by  null                  → decided_by  01932c99-7b21-…          │
│   decided_at  null                  → decided_at  2026-08-06T09:41:07Z     │
│   version     2                       version     2        (unchanged)     │
└────────────────────────────────────────────────────────────────────────────┘
```

| Filter | Behaviour |
| :--- | :--- |
| **Actor** | Staff or user picker; also accepts a raw id |
| **Entity type** | The audited entity types, from the server |
| **Entity id** | Free text, exact match. **The primary investigative entry point** — `AC-ADMN-02.1` is "given any entity id" |
| **Action** | Multi-select over the thirteen `audit_action_enum` values: `CREATE`, `UPDATE`, `DELETE`, `APPROVE`, `REJECT`, `SUSPEND`, `REINSTATE`, `OVERRIDE`, `DECIDE`, `ASSIGN`, `CONFIG_CHANGE`, `ELEVATE`, `EXPORT` |
| **Date range** | Business dates in IST, inclusive both ends |
| **Impersonation flag** | A checkbox mapping to `?impersonation=true`, filtering `impersonated_by IS NOT NULL`. `AC-ADMN-02.2`'s query as a first-class control rather than a saved search an auditor has to know to write |
| **Tenant**, **Correlation id** | Additional narrowing; correlation id joins a screenshot to a row without a text search (`CP6`) |

| Rule | Statement |
| :--- | :--- |
| **AU6** | Pagination is **offset** (`README.md` §7.5 exception 2), hard cap 100 pages, page numbers and jumping. Deep history is served by export, and the cap message says so |
| **AU7** | The diff renders **complete before and after objects**, field by field, unchanged fields included and marked — the audit row stores state, not a diff, *"because a diff is an interpretation and `AC-ADMN-02.1` asks for state"*. A **Changed only** toggle is a view filter and is off by default |
| **AU8** | `before` is `null` on a create and renders as **"(created — no prior state)"**, never as an empty panel |
| **AU9** | **An impersonated row renders two subjects, always:** `actor_id` (the user the action was taken as) **and** `impersonated_by` (the agent). One row, two people, and the row is marked in the list, not only in the detail (`IMP1`, `BR-DAT-02`) |
| **AU10** | Impersonation **sessions** render as a pair of `ELEVATE` rows — start and end — carrying the reason, the 30-minute cap and the computed duration, with the actions taken in between grouped under them (`IMP4`, `AC-ADMN-02.2`) |
| **AU11** | Export produces a CSV of the filtered set with every column including `before` and `after` as JSON strings, plus `correlation_id`, so an export joins to logs and traces. **The export itself writes an `EXPORT` audit row** — reading the audit log at scale is an auditable act |
| **AU12** | **Reads are not audited** (`BR-DAT-01` audits create, update and delete) — with one exception the screen surfaces: `GET /admin/applications/:id` **is** audited as `ELEVATE` / `KYC_DOCUMENT_ACCESS`, naming the documents whose signed URLs were minted, because `BR-DAT-07` requires every KYC access to be logged |
| **AU13** | A `SUPPORT_AGENT`, `VERIFICATION_OFFICER`, `FINANCE` or `MODERATOR` holds `○` on *View audit log* — **read only, and read only is all this screen has**. There is no write path to withhold from them |

**States.** *Loading* — filter bar interactive immediately; result skeleton at 32 px. *Empty* —
*"No audit records match. The most restrictive filter is **Action: SUSPEND**."* with one-tap
removal. **A genuinely empty result for a valid entity id is itself meaningful and the screen says
so:** *"No recorded changes for `01932d10`. If the entity exists, it has not been modified since
audit began on 01 Apr 2026."* *Error* — retry; a timeout on a wide range suggests narrowing or
exporting. *Permission-denied* — §5.4 naming `audit.audit_log.search` and the five roles that hold
it.

**Acceptance checks.** Every change in chronological order with actor, timestamp, **IP**,
before-state and after-state (`AC-ADMN-02.1`) · impersonation, its reason, its duration and every
action taken during it, marked as impersonated (`AC-ADMN-02.2`) · **no modify or delete capability
exists through this interface** (`AC-ADMN-02.3`).

---

## 7. Conformance

### 7.1 Accessibility — the floor and the target

`NFR-USE-01`: WCAG 2.1 **Level AA** on the customer website and the check-in desk; **Level A minimum
elsewhere, with AA as the target**. This surface is "elsewhere" — so **Level A is the merge gate and
AA is the standard the work is done to**. In practice everything below is written to AA and the
exceptions are recorded, not assumed.

| # | Requirement | How it is met here |
| :-: | :--- | :--- |
| A1 | Full keyboard operability (`NFR-USE-02`, `AX2`) | §4.2's model; every screen's Interactions block; `K1`–`K6`. No mouse-only action exists, including document rotation, taxonomy reordering and row selection |
| A2 | Touch target ≥ 44 × 44 px (`NFR-USE-03`, `AX3`) | §2.2 — coarse-pointer detection switches to the 44 px comfortable row automatically and locks the density toggle |
| A3 | Text ≥ 4.5:1, interactive ≥ 3:1 (`NFR-USE-04`, `AX4`) | Enforced by the token palette in `DesignSystem.md`, not by per-component choices. 14 px body is verified at 4.5:1 |
| A4 | Responsive 320–2560 px, no horizontal page scroll (`NFR-USE-07`, `AX5`) | §2.3 `D1`–`D6`, §2.4 |
| A5 | Colour never the sole carrier (`AX9`) | SLA chips carry glyphs; variance and hold states carry text; negative money carries a minus; charts carry direct labels |
| A6 | Live regions announce outcomes (`AX8`) | Decision confirmations, poll-staleness transitions, document changes in the viewer and step-up prompts are announced `polite`; a blocking guard refusal is announced `assertive` |
| A7 | axe-core in CI on every screen; a new violation fails the build (`AX7`, `A-06`) | Fifteen route-level tests plus per-dialog tests for the reason dialog, the override dialog and the dry-run wizard |
| A8 | Manual passes | Keyboard-only and screen-reader passes are mandatory on `SCR-ADM-003` (Anita's throughput depends on the keyboard path) and on `SCR-ADM-010` (a variance an operator cannot perceive is a variance nobody resolves) |
| A9 | Motion | No non-essential animation. Skeleton shimmer and the poll indicator respect `prefers-reduced-motion` |
| A10 | Zoom | Usable at 200% browser zoom at 1280 px without loss of function; tables scroll within their container (`D1`) |

### 7.2 Responsive matrix

| Screen | 2560 | 1440 | 1280 | 1024 | 768 | 320 |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| 001 Dashboard | 4-col tiles | 4-col | 3-col | 2-col | 1-col | 1-col |
| 002 Approval queue | Full table + context | Full table | Table, fewer columns | Table scrolls (`D1`) | Stacked records (`D5`) | Stacked |
| 003 Application review | Split + context | **Split** | Split, narrow checklist | Tabs | **Tabs, full-width viewer, checklist sheet** | Tabs, degraded |
| 004–009, 011–014 | Table + context | Table | Table | Table scrolls | Stacked | Stacked |
| 010 Reconciliation | Cards, 2-col | Cards, 1-col | 1-col | 1-col | 1-col | 1-col |
| 015 Audit log | Table + inline diff | Table + diff | Table, diff below | Table scrolls | Stacked | Stacked |

`SCR-ADM-002` and `SCR-ADM-003` are the two screens specified to be genuinely **workable at 768 px**,
because triage happens away from a desk. The rest are specified to be **survivable** — no horizontal
page scroll, no clipped content, no unreachable action — which is what `NFR-USE-07` requires.

### 7.3 Performance

| Budget | Value | Source |
| :--- | :--- | :--- |
| List views ≤ 50 rows | p95 ≤ 800 ms server-side | `NFR-PERF-04` |
| Rows rendered | ≤ 50 with virtualised scrolling | `FP5` |
| Code splitting | Route-level on all fifteen routes; the document viewer, the map component and the charting library are dynamically imported at the point of use | `FP3` |
| Polling | 10–15 s, one hook, paused when hidden | `LC3`, `LC4` |
| Bundle | No customer-site budget applies (`FP1` is `customer-web`), but route chunks are size-tracked and a regression is reported in CI | `A-29` |

### 7.4 Feature-folder map

Route files are `src/routes/<name>.route.tsx` exactly as `FolderStructure.md` §6 names them:
`platform-dashboard` (001) · `approvals` (002) · `application-review` (003) · `tenants` (004) ·
`users` (005) · `finance-orders` (006) · `finance-settlements` (007) · `finance-refunds` (008) ·
`finance-disputes` (009) · `finance-reconciliation` (010) · `configuration` (011) · `moderation`
(012) · `support-console` (013) · `platform-analytics` (014) · `audit-explorer` (015).

Feature folders: `features/platform-dashboard/` · `approvals/` (002, 003) · `tenants/` ·
`users/` + `platform-staff/` (005) · `finance/{orders,settlements,refunds,disputes,reconciliation}/`
(006–010) · `configuration/{commission,subscription,tax,kyc,taxonomy,flags,templates}/` (011) ·
`moderation/` · `support/` · `analytics/` · `audit/`.

Every folder carries the mandatory shape of `PROJECT_CONSTITUTION.md` §7.4 — `index.ts`, `api/`
(`*.queries.ts`, `*.mutations.ts`, `*.keys.ts`), `components/`, `hooks/`, `schemas/`, `types/`,
`README.md` naming the `SCR-` and `FR-` identifiers it serves. A pull request missing one is closed,
not commented on (§7.5).

### 7.5 Traceability

| Requirement | Where it is satisfied |
| :--- | :--- |
| `NFR-SEC-11` MFA mandatory · `AM1`–`AM4` | §3, every screen |
| `NFR-USE-01`…`09` | §7.1, §7.2, every screen's States block |
| `FR-NAV-03` filtered navigation · `FR-NAV-06` deep links | §4.1 `N1`–`N3`, `N6` |
| `FR-RBAC-02` client hiding is not a control | §1.3, §5.4 `PD3`, §6.5.4 `IM-U5` |
| `FR-ADMN-01` tenant administration · `AC-ADMN-01.1`…`01.4` | §6.4 |
| `FR-ADMN-02` reason on every action | §5.1, every write on every screen |
| `FR-ADMN-03`…`08` commission precedence and configuration | §6.4 `TN1`–`TN4`, §6.11 |
| `FR-ADMN-09` audit explorer · `AC-ADMN-02.1`…`02.3` | §6.15 |
| `FR-ADMN-10` platform staff · `FR-AUTH-12` impersonation | §6.5, §6.5.4 |
| `FR-ADMN-11` queue management · `FR-ADMN-12` moderation · `FR-ADMN-13` health | §6.2, §6.12, §6.1 region 7 |
| `FR-ONB-08`, `10`…`13` · `BR-GYM-02`…`05`, `08`, `09` · `AC-ONB-01.2`/`01.3`/`02.1`…`02.5` · **`OBJ-03`**, **`RSK-01`** | §6.3 in full, checks at §6.3.12 |
| `FR-RFND-03`, `04` · `AC-RFND-01.2` | §6.8 |
| `FR-RFND-08`…`10` · `AC-RFND-02.1`…`02.3` · `BR-REF-08` | §6.9 |
| `FR-SETL-01`…`08` · `AC-SETL-01.1`…`01.4` · `BR-FIN-03`, `BR-FIN-08` | §6.7 |
| `FR-SETL-09` · `BR-FIN-07` · **`KPI-26`** | §6.10 |
| `BR-REV-06`, `BR-REV-07`, `C4.6` · `AC-REV-02.2`, `02.3` | §6.12 |
| `BR-DAT-01`, `BR-DAT-02`, `BR-DAT-06`, `BR-DAT-07` | §6.5, §6.15, §6.3 `DV2` |

### 7.6 Open items

| # | Item | Blocking | Owner |
| :-: | :--- | :--- | :--- |
| **UI-ADM-1** | `commission_tax_minor` (GST on platform commission) is `PENDING_CLIENT_DECISION` (`LAUNCH_MARKET_INDIA.md` §11 conflict 2). The refund panel (§6.8 `RC-U5`) and the settlement statement (§6.7) render it as a visible open item. When it resolves, both gain a ninth figure | Sprint 11 | Finance + Product |
| **UI-ADM-2** | `KL-006` — whether tier deltas apply to the renewal rate. Rendered verbatim on §6.4 `TN3` and §6.11 until answered | Sprint 11 | Commercial |
| **UI-ADM-3** | `Admin.md` §15–§19 (moderation, audit, analytics, platform staff, tenant financial) are not yet written in the frozen contract set. §6.12–§6.15 above are specified against `MASTER_PRD.md` §B8, `Reviews.md` §9 and `Admin.md` §2.4/§2.8/§3, and must be re-checked against those sections when they land | Before Sprint 12 | API + this document |
| **UI-ADM-4** | The verification SLA target is **72 hours** at launch and is **configuration, not a constant** (`Admin.md` §5.1.1). The console reads it from the API and must never hard-code it | — | Engineering |
| **UI-ADM-5** | Density preference, column selection and row height persist **per user per screen**. The storage mechanism (server-side user preference vs. local) is unspecified; local storage is not persistence for anything the PRD requires to be resumable (`FM4`), and this is not one of those things — but a shared workstation makes it a question | Sprint 13 | Product |

---

*End of AdminDashboard.md.*
