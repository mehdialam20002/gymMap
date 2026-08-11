# Accessibility Specification and its Verification


> **NOT amended by `ADR-0037`, and deliberately so.** That ADR made the visual prescription in the
> other seven `docs/ui/` documents advisory at the owner's instruction. This document is untouched.
>
> Nothing here is a style rule. A contrast ratio below 4.5:1 is not a look somebody dislikes — it is
> a screen some people cannot read. An SLA chip that carries its state only in a tint says nothing to
> a red-green colour-blind officer triaging sixty applications a day. `AdminDashboard.md` §1.1 has
> Anita opening the approval queue 30–60 times a day, which makes the keyboard path her product
> rather than an accommodation.
>
> These rules also cost a design nothing. The palette is one file and every shipped pairing already
> measures above its floor; the glyph beside a coloured chip is four pixels. If the owner does want
> any of this lifted, it needs its own ADR saying which requirement is being dropped and who it
> excludes — not an omission from this one.

**Surfaces:** `customer-web` (18 `SCR-WEB-*`) · `gym-dashboard` (22 `SCR-DASH-*`) · `admin-console`
(15 `SCR-ADM-*`) · `packages/ui`
**Governs:** `NFR-USE-01` … `NFR-USE-09`, `PROJECT_CONSTITUTION.md` §16.7 (`AX1`–`AX9`), §16.8, §16.9
**Launch market:** India · single launch locale English · every string externalised (`NFR-USE-08`)

---

## 0. Document control

| Field | Value |
| :--- | :--- |
| **Status** | Specification. No component code exists yet. Every fenced block in this document is labelled `illustrative — not committed code` and is a specification of intent, not a snippet to paste |
| **Precedence** | `PROJECT_CONSTITUTION.md` › `MASTER_PRD.md` › `/docs/apis/**` › `/docs/ui/DesignSystem.md` › **this document** › `CustomerApp.md` / `GymDashboard.md` / `AdminDashboard.md` |
| **Relationship to `DesignSystem.md`** | That document **owns the values** — the palette, the measured contrast register (§3.6), the focus-ring definition (§3.7), the desk verdict palette (§4), the motion tokens (§6.6), the 44 px hit-area mechanism (§7.4). This document owns the **obligations, the behaviour and the proof**. Where a ratio is quoted here it is quoted *from* the register, never re-derived |
| **Relationship to the three surface documents** | Each surface document carries a per-screen accessibility row. This document is the **cross-cutting law** those rows conform to, plus the five screens specified in full depth, plus the verification programme |
| **Audience** | Every frontend engineer, every reviewer on a UI pull request, the QA lead running the manual passes, and the external auditor who will be handed this document plus the CI evidence |
| **What this document is not** | It is not a WCAG tutorial. It cites success criteria by number and states what *this* product must do to satisfy them |

### 0.1 The seven sentences this document exists to enforce

1. **AA on the customer website and the check-in desk is a merge gate**, not an aspiration (`AX1`).
2. **A keyboard trap at the check-in desk is an operational failure**, not an inconvenience.
3. **Colour is never the sole carrier of meaning** — icon plus text plus colour, in that order of
   priority (`AX9`).
4. **Every polled figure states when it was last updated**, and a failed poll looks different from a
   fresh one (`LC5`). Announcing a stale number as live is an accessibility defect as well as a
   correctness defect.
5. **Every error states what happened, why, and what to do next** — and it is *announced*, not only
   painted (`NFR-USE-05`).
6. **Client-side hiding is presentation, never security** (`FR-RBAC-02`). An accessible name that
   leaks a permission the user does not hold is still a leak.
7. **axe-core catches roughly a third of real WCAG failures.** Declaring AA on an automated pass
   alone is a false compliance claim (`TestingStrategy.md` §4.8).

---

## 1. The commitment

### 1.1 The conformance map, per surface

`NFR-USE-01`: *"WCAG 2.1 Level AA on the customer website and the check-in desk; Level A minimum
elsewhere, with AA as the target."*

| Surface | Screens | Conformance **contracted** | Conformance **targeted** | CI behaviour on a violation |
| :--- | :--- | :--- | :--- | :--- |
| `customer-web` | `SCR-WEB-001` … `SCR-WEB-018` | **WCAG 2.1 AA** | AA | **Build fails** on any AA violation |
| Check-in desk | `SCR-DASH-009` | **WCAG 2.1 AA** | AA | **Build fails** on any AA violation |
| `gym-dashboard`, other 21 | `SCR-DASH-001`…`008`, `010`…`022` | **WCAG 2.1 A** | AA | Build fails on any **A** violation; an AA violation opens an S3 defect and is listed in the release notes |
| `admin-console` | `SCR-ADM-001` … `SCR-ADM-015` | **WCAG 2.1 A** | AA | Same as above |
| `packages/ui` | Every primitive and pattern | **AA at the component level** | AA | Build fails. A primitive shipped below AA makes AA unreachable on the two surfaces that contract for it |

> **`packages/ui` is held to AA even though two of its three consumers contract for A.** `UI1` copies
> shadcn/ui (Radix) primitives *into* the repository specifically so the platform owns their
> accessibility behaviour. A `Dialog` that does not trap focus is one defect in one file, or it is
> fifty-five defects across three applications. The component library is the cheapest place in this
> product to be correct.

### 1.2 Why the check-in desk is held to the higher bar

`SCR-DASH-009` is an internal, staff-only, single-tenant operational tool. Every instinct in a
prioritisation meeting says Level A is enough for it. That instinct is wrong here, for five reasons
that are specific to this screen and not to internal tools in general.

| # | The argument | The evidence |
| :-: | :--- | :--- |
| **1** | **Frequency turns an annoyance into an injury.** Sameer works the desk 12:00–21:00 and clears a queue of ten in ninety seconds. A screen used two hundred times a day is not comparable to a settings page used twice a month | `B2.3`; `NFR-PERF-08` 500 check-ins/minute platform-wide |
| **2** | **A keyboard trap here is an outage.** On `SCR-ADM-011` a trap costs an administrator a page reload. At the desk, a trap with eight members queuing is an operational failure with a visible line of people in it. The recovery — reload, re-open camera, re-scan — is measured against `NFR-PERF-03`'s two seconds and blows it by two orders of magnitude | `NFR-PERF-03`, `AX2` |
| **3** | **The consequence of a misread verdict falls on a member, not on staff.** `DENIED` misread as `ALLOWED` admits someone who has not paid; `ALLOWED` misread as `DENIED` turns away a paying member at the door in front of a queue. `B2.3`: Sameer needs *"to not be blamed for a discrepancy"*. Both failures land on him | `SCR-DASH-009` denial state; `BR-CHK-10` |
| **4** | **The operating environment is hostile in exactly the ways AA addresses.** Bright ambient light, a fingerprinted tablet screen at arm's length, a noisy room, a device held one-handed. These are the *permanent* versions of the *situational* impairments AA's contrast, target-size and non-colour-dependence criteria exist for | `NFR-USE-09`; `DesignSystem.md` §4.1 |
| **5** | **Staff are not a population we get to assume anything about.** Roughly 1 in 12 men has a red-green colour vision deficiency. A platform whose Year-1 capacity is 2,000 tenants and 5,000 branches will employ thousands of receptionists. Designing the deny state so that a deuteranopic receptionist reads it *at the same speed* as everyone else is not charity; it is the only way the two-second budget holds for the whole workforce | `NFR-SCAL-01`; `DesignSystem.md` §4.2 measured **1.05:1** for the naive palette |

**The one-line justification, for the person who has to defend the extra work in sprint planning:**
the check-in desk is the only screen in this product where an accessibility failure has a cost
measured in seconds per occurrence, hundreds of occurrences per day, and a member wrongly turned
away at the door.

### 1.3 What "Level A minimum with AA as the target" means operationally

The phrase is a licence to ship, not a licence to ignore. It is made concrete so that "target" does
not decay into "someday".

| Rule | Statement |
| :--- | :--- |
| **CM1** | A **Level A** violation on any surface fails CI job 18. There is no surface in this product where a Level A failure is acceptable |
| **CM2** | A **Level AA** violation on `gym-dashboard` (excluding `SCR-DASH-009`) or `admin-console` does **not** fail CI. It is reported by the job, opens an **S3** defect against the owning feature, and appears in the release notes. It is never silently dropped |
| **CM3** | The AA violation backlog has a **ceiling of twenty open S3 accessibility defects across both dashboards**. At twenty-one, job 18 starts failing the build for those surfaces too. A target with no ratchet is a wish |
| **CM4** | Any **new** screen added after Phase 1 ships at AA on all three surfaces. The A floor is a concession to the twenty-two and fifteen screens specified before this document existed, not a standing policy |
| **CM5** | Four criteria are held at **AA on every surface regardless of the floor**, because their failure mode is severe and their cost is near zero once tokens exist: **1.4.3** contrast, **1.4.11** non-text contrast, **2.4.7** focus visible, **4.1.3** status messages |

### 1.4 What is explicitly out of scope for Phase 1

Recorded so that an auditor is told rather than discovers.

| Item | Status | Rationale |
| :--- | :--- | :--- |
| WCAG 2.1 **AAA** | Out of scope everywhere | Not contracted. Two AAA criteria are met incidentally — the desk's verdict contrast exceeds 7:1 (`DesignSystem.md` §4.3) and the focus ring exceeds the AAA thickness — and neither is claimed as conformance |
| WCAG **2.2** | Out of scope, tracked | `NFR-USE-01` names 2.1. The four new 2.2 A/AA criteria most relevant here — 2.4.11 Focus Not Obscured, 2.5.7 Dragging Movements, 2.5.8 Target Size (Minimum), 3.3.7 Redundant Entry — are **already satisfied** by rules in this document (§3.10, §3.1 `KB3`, §7.1, §8.6). Recorded so the eventual 2.2 uplift is a re-audit, not a rebuild |
| Native mobile applications | Not in Phase 1 scope | `A4.2`. The customer site is responsive from 320 px; there is no app to audit |
| The map's pin-level keyboard operation | Deliberately not required | The map is a **redundant view**. `AC-SRCH-02.3` establishes the list as the complete rendering; §3.2 specifies the text alternative that makes this defensible |
| Hindi and other Indian-language UI | Deferred (`A4.2`) | **Externalisation is not deferred** (`NFR-USE-08`, §11) |
| Screen-magnifier-specific testing beyond 400% reflow | Out of scope | 400% reflow at 1280 px is tested (§12.4) and covers the 1.4.10 obligation |

---

## 2. POUR, mapped to concrete obligations in this product

The four principles are not restated as theory. Each row names a **specific screen, token, endpoint
or rule** in this product, so that a reviewer can check it rather than agree with it.

### 2.1 Perceivable

| WCAG | Obligation in this product | Where it bites |
| :--- | :--- | :--- |
| **1.1.1** Non-text content | Every gym photograph renders the server's `media.items[].alt` string. Decorative chrome carries `alt=""`. Star glyphs carry `aria-hidden="true"` with the numeric rating in text | `SCR-WEB-002` cards, `SCR-WEB-003` gallery, §10 |
| **1.2.x** Time-based media | **No audio or video content ships in Phase 1.** The desk's optional check-in tone (`DesignSystem.md` §4.4) is a non-speech notification, off by default, and never the sole carrier — so 1.2.1 does not apply. If a marketing video is later added to `SCR-WEB-018`, captions become a launch blocker | `SCR-WEB-018` |
| **1.3.1** Info and relationships | The settlement statement is a `<table>` with `<caption>`, `<th scope>` and a `<tfoot>` total (§4.6). The check-in result panel is a `<dl>`, not a visual grid (`GymDashboard.md` §11.14). The price breakdown is a `<dl>` whose terms are labels and whose definitions are amounts | `SCR-DASH-014`, `SCR-DASH-009`, `SCR-WEB-005` |
| **1.3.2** Meaningful sequence | DOM order is visual order on every screen. `FR6` forbids `tabindex > 0` anywhere in `apps/**`. The `SCR-WEB-002` three-pane layout puts filters before results before map in the DOM, matching the visual left-to-right | `SCR-WEB-002`, §3.2 |
| **1.3.3** Sensory characteristics | No instruction says "the button on the right" or "the green panel". The desk says *"present a QR code or start typing"*; the search empty state names the **filter**, not its position | `SCR-DASH-009`, `SCR-WEB-002` |
| **1.3.4** Orientation | No screen locks orientation. The desk is designed for tablet **portrait** (`NFR-USE-09`) and must remain fully usable in landscape | `SCR-DASH-009` |
| **1.3.5** Identify input purpose | `autocomplete` is set on every field with a WCAG-defined purpose: `tel` on the phone field, `email`, `name`, `postal-code` on PIN, `one-time-code` on OTP entry | `SCR-WEB-016`, `SCR-WEB-005`, `SCR-WEB-014` |
| **1.4.1** Use of colour | `AX9`. Enumerated exhaustively in §6.4 — every place this product currently encodes meaning in colour, and the redundant carrier each one ships | Everywhere; §5, §6.4 |
| **1.4.3** Contrast (minimum) | The measured register in `DesignSystem.md` §3.6. Four pairings are **forbidden by name** in that document's §3.8 and asserted as negative cases | §6 |
| **1.4.4** Resize text | No `px` font sizes in `apps/**`; the type scale is `rem`-based. 200% zoom loses no content on any screen | §12.4 |
| **1.4.5** Images of text | No image of text ships. Prices, plan names and the desk verdict are live text. The QR code is not text | `SCR-WEB-009` |
| **1.4.10** Reflow | 320 px → 2560 px, **no horizontal page scroll** (`NFR-USE-07`, `BP2`). Wide content scrolls inside its own container with the identifying column pinned | §7.4, `SCR-DASH-014`, `SCR-ADM-015` |
| **1.4.11** Non-text contrast | Control boundaries use `border-input` `#64748B` at **4.76:1**; the focus ring measures **6.29:1** on `surface-default` and **5.74:1** on a zebra row | `DesignSystem.md` §3.6.2 |
| **1.4.12** Text spacing | No fixed-height single-line container anywhere (`DV2`). A user stylesheet raising line-height, letter-spacing and word-spacing clips nothing | §11.3 |
| **1.4.13** Content on hover or focus | Every tooltip and popover is dismissible with `Esc`, hoverable, and persists until dismissed. The `SCR-DASH-007` at-risk badge shows both frequencies **on hover *and* on focus** | `SCR-DASH-007`, `SCR-DASH-005` |

### 2.2 Operable

| WCAG | Obligation in this product | Where it bites |
| :--- | :--- | :--- |
| **2.1.1** Keyboard | Full keyboard operability on dashboard and admin (`NFR-USE-02`, `AX2`). Every drag interaction has a **primary**, not fallback, keyboard equivalent: photo reorder, plan reorder, taxonomy reorder, map-pin placement | §3, `K5` |
| **2.1.2** No keyboard trap | Four candidates, each named and defused: full-screen-plus-dialog at the desk, the camera viewfinder, the document viewer, the rich-text editor | §3.9 |
| **2.1.4** Character key shortcuts | The desk's single-letter map (`F`, `O`, `M`, `R`, `?`) and admin's `j`/`k`/`x`/`g`-chords are **suppressed while focus is in a text input** (`K1`), and every one has a visible focusable control | §3.4, §3.5 |
| **2.2.1** Timing adjustable | Three timed things exist. The QR refreshes every 60 s **and re-issues automatically** — no user action expires (§9.4). The `ALLOWED` panel auto-clears on a **tenant-configured** interval and offers *"Keep on screen"* (§5.6). The checkout order expiry offers a new order rather than losing the basket (`SCR-WEB-005`) | §9.4, §5.6 |
| **2.2.2** Pause, stop, hide | Nothing auto-updates in a way that moves content. Polled figures **cross-fade in place** over `motion-duration-fast` and never reflow (`MO3`). The skeleton shimmer stops the instant data arrives (`MO6`) | §9 |
| **2.3.1** Three flashes | No flashing content exists. The desk verdict cross-fades once over `deliberate` (`MO5`); it does not flash | §9.3 |
| **2.4.1** Bypass blocks | Skip links on all three surfaces, enumerated per surface | §3.8 |
| **2.4.2** Page titled | Every route sets a unique, front-loaded `<title>`. Next.js metadata on `customer-web`; an explicit title effect on the two SPAs, because a client-side route change does not set a title by itself | §4.4 |
| **2.4.3** Focus order | Specified in full for the five hardest screens in §3.2–§3.6 | §3 |
| **2.4.4** Link purpose | No "click here", no bare "View". A gym card's link accessible name is the gym name; an invoice link is *"Download invoice INV-2026-000148"* | `SCR-WEB-011` |
| **2.4.5** Multiple ways | The customer site provides search, category landings, city landings and a footer sitemap. The two dashboards provide navigation plus admin's `Ctrl/⌘ + K` command palette | `B4.1`, `AdminDashboard.md` §4.2 |
| **2.4.6** Headings and labels | One `<h1>` per screen naming the screen. No visually-hidden-only label where a visible one is possible | §4.2 |
| **2.4.7** Focus visible | One ring definition, no exceptions (`FR1`–`FR6`). `outline: none` without an equally visible replacement fails lint | §3.10 |
| **2.5.1** Pointer gestures | No multi-point or path-based gesture is required anywhere. Map pinch-zoom has `+`/`−` buttons; the gallery swipe has previous/next buttons | `SCR-WEB-003` |
| **2.5.2** Pointer cancellation | Every destructive action is confirmed in a dialog (`NFR-USE-06`), so no destructive outcome fires on `pointerdown` | §8.7 |
| **2.5.3** Label in name | The visible label is the first substring of the accessible name. *"Save Iron Works Gym"* contains *"Save"*; a voice-control user saying "Save" reaches it | `CustomerApp.md` §7.9 |
| **2.5.4** Motion actuation | No device-motion input exists | — |
| **2.5.5** Target size | 44 × 44 px minimum (`NFR-USE-03`) via the expanded hit-area mechanism, kept at compact density | §7 |

### 2.3 Understandable

| WCAG | Obligation in this product | Where it bites |
| :--- | :--- | :--- |
| **3.1.1** Language of page | `<html lang="en-IN">` from the first commit. `en-IN`, not `en-US`, because the number and date formatting, the currency and the screen-reader pronunciation of `₹` all follow the locale tag | Every surface |
| **3.1.2** Language of parts | `DV8`: any element whose content differs in language carries `lang`. A Devanagari gym name inside an English page gets `lang="hi"` — this is a **day-one** case in India, not a Phase-2 one | §11.2 |
| **3.2.1** On focus | No focus change triggers navigation, submission or a context change. The desk's *"focus the search field on any printable keypress"* moves focus **to** a field; it does not act | §3.4 |
| **3.2.2** On input | No `<select>` auto-submits. Filter changes on `SCR-WEB-002` update the result list — an **announced, non-context-changing** update (§4.5), with the URL as the record | `SCR-WEB-002` |
| **3.2.3 / 3.2.4** Consistent navigation and identification | One shell per surface; one `packages/ui` component per concept. *"Archive"* means the same thing and looks the same on `SCR-DASH-005` and `SCR-ADM-011` | All surfaces |
| **3.3.1** Error identification | `aria-invalid` plus `aria-describedby` on the field, plus the error summary of §8.4, plus announcement | §8.3, §8.4 |
| **3.3.2** Labels or instructions | Every input has a persistent visible `<label>`. **Placeholder-as-label is forbidden** (§8.1). Format hints are persistent, not placeholder-only: *"10 digits, starting 6–9"* under the phone field | §8.1 |
| **3.3.3** Error suggestion | `NFR-USE-05`'s third clause. *"Coupon MONSOON20 expired on 31 Jul 2026. Try a different code or continue without one."* — never *"Invalid coupon"* | §8.5 |
| **3.3.4** Error prevention | Every financial and destructive action is reversible, checked or confirmed: `NFR-USE-06` confirmations with server-computed counts, the checkout price-change blocking modal, the settlement dual-control above threshold | §8.7 |

### 2.4 Robust

| WCAG | Obligation in this product | Where it bites |
| :--- | :--- | :--- |
| **4.1.2** Name, role, value | Radix primitives copied into `packages/ui` supply role and state. Every custom composite — the desk verdict panel, the comparison matrix, the checklist on `SCR-ADM-003` — declares its pattern in the component's README and is tested against it | `packages/ui` |
| **4.1.3** Status messages | The one criterion this product has the most of. Every polled counter, every check-in verdict, every toast, every filter-count update, every error summary and every "last updated" transition is a status message with a defined politeness | §4.5 |

> **4.1.1 Parsing** was removed in WCAG 2.2 and is not asserted. Duplicate `id` attributes are still
> a lint error, because `aria-labelledby` and `aria-describedby` resolve by `id` and a duplicate
> silently binds the wrong text.

---

## 3. Keyboard operability

`NFR-USE-02`: *"Full keyboard operability on all dashboard and admin surfaces."* `AX2` extends the
obligation to every primary action on the check-in desk. The customer site inherits it through AA
(2.1.1). In practice this product has **no surface where a mouse is required**.

### 3.1 The eight rules that govern keyboard behaviour on every screen

| # | Rule | Consequence if broken |
| :-: | :--- | :--- |
| **KB1** | **DOM order is visual order.** `tabindex` greater than `0` anywhere in `apps/**` is a review rejection (`FR6`) | A "logical" tab order maintained by hand drifts on the first layout change |
| **KB2** | **One tab stop per composite.** A result card, a table row, a toolbar and a radio group are each **one** stop; movement inside them is by arrow keys | 47 gym cards × 4 controls = 188 stops to reach the pagination |
| **KB3** | **Every drag has a keyboard equivalent that is the primary mechanism, not a fallback** (`K5`). Photo reorder, plan reorder, taxonomy reorder, map-pin placement | Drag-only reordering is unreachable and also fails 2.5.7 in WCAG 2.2 |
| **KB4** | **Nothing is reachable by hover alone.** Every hover disclosure is also a focus disclosure, and 1.4.13-dismissible | The `SCR-DASH-007` at-risk badge's second frequency is invisible to a keyboard user |
| **KB5** | **`Esc` closes the topmost layer and only the topmost layer.** With a dialog open over a sheet, one `Esc` closes the dialog | Two layers close and the user loses form state |
| **KB6** | **Focus is never lost to `<body>`.** Every removal, close, delete and route change names its next focus target explicitly (§3.7) | The next `Tab` starts from the top of the document — the single most common real-world keyboard defect |
| **KB7** | **Single-character shortcuts are suppressed while focus is in a text input, textarea or contenteditable** (`K1`), and every one has a visible focusable control | Typing "just" into admin's search navigates to the audit log |
| **KB8** | **Disabled controls that carry an explanation stay focusable.** `aria-disabled="true"` plus an inert handler, never `disabled` plus `pointer-events: none` (`DesignSystem.md` §3.5) | A keyboard user cannot discover *why* "Publish" is unavailable |

### 3.2 `SCR-WEB-002` — Search Results with map

The hardest customer screen: three panes, a live-updating result count, a redundant map view, and a
selection bar that appears mid-page. **AA is contracted.**

`illustrative — not committed code`

```text
 ≥1280 px — tab stops in DOM order, which is visual order left → right

 ┌─ [1] Skip to results ── [2] Skip to filters ── (visible on focus) ───────────────┐
 │ HEADER  [3] Logo→home  [4] Location field  [5] Query field  [6] Search  [7] Acct │
 ├──────────────────┬────────────────────────────────────┬─────────────────────────┤
 │ FILTER RAIL      │ RESULT LIST                        │ MAP  (role=application) │
 │ role="search"    │ <main id="results">                │ <section aria-label=…>  │
 │                  │                                    │                         │
 │ [8]  Clear all   │ [17] "47 gyms" ↑live region        │ [22] "Skip map"         │
 │ [9]  Distance ⟷  │ [18] Sort ▾                        │ [23] Search this area   │
 │ [10] Price ⟷     │                                    │ [24] Zoom in            │
 │ [11] Rating ▾    │ [19] ┌ CARD 1 ─────────────────┐   │ [25] Zoom out           │
 │ [12] Amenities   │      │ a[gym name]  (the stop) │   │ [26] Recentre           │
 │      ↳ combobox  │      │  ↳ → ♥ Save · ☐ Compare │   │                         │
 │ [13] Open now    │      └─────────────────────────┘   │ pins are NOT tab stops  │
 │ [14] 24-hour     │ [20] CARD 2 …                      │ — see the note below    │
 │ [15] Gender ▾    │      …                             │                         │
 │ [16] Parking     │ [21] Pagination                    │                         │
 └──────────────────┴────────────────────────────────────┴─────────────────────────┘
 [27] SELECTION BAR — appears at ≥2 compared; focus is NOT stolen, an alert announces it
 [28] FOOTER
```

| Stop | Element | Role / pattern | Accessible name | Notes |
| :-: | :--- | :--- | :--- | :--- |
| 1–2 | Skip links | `<a href="#results">`, `<a href="#filters">` | *"Skip to results"*, *"Skip to filters"* | Visible on focus (§3.8). Two, not one, because the rail sits before `<main>` |
| 4 | Location combobox | `combobox` + `listbox` | *"Location"* | Arrow keys move through suggestions; `Enter` selects; `Esc` reverts to the typed value |
| 8 | Clear all filters | `button` | *"Clear all filters (6 applied)"* | The count is in the name, not only the badge |
| 9–10 | Distance, price | Two-thumb `slider` | *"Minimum distance"*, *"Maximum distance"* | Each thumb is a **separate** stop with its own `aria-valuetext` (*"3 kilometres"*, *"₹1,500"*). Arrow = 1 step, `PageUp/Dn` = 10, `Home/End` = bounds. **Money in `aria-valuetext` is formatted by the shared formatter** — ₹1,50,000, never ₹150,000 |
| 12 | Amenities | Searchable multi-select `combobox` with `aria-multiselectable` | *"Amenities, 3 selected"* | One stop. Arrow keys move the active option; `Space` toggles; the option's name **includes its live count**: *"Parking, 23 results"* (`CustomerApp.md` §7.9) |
| 13–14, 16 | Toggle filters | `switch` | *"Open now, 12 results"* | `Space` toggles. Not checkboxes — they are independent, not a group |
| 17 | Result count | **Not a tab stop.** `role="status"`, polite | — | *"47 gyms found"*, **debounced to one announcement per settled search**, never per keystroke |
| 19–20 | Result cards | **One stop per card.** The `<a>` is the stop | *"Iron Works Gym, Andheri West, 4.6 stars, 128 reviews, 1.2 km, from ₹2,499 per month, Verified"* | `→`/`←` move to the card's inner controls (Save, Compare) without leaving the card. This is the `KB2` composite pattern and it is what keeps the list navigable |
| 22 | Skip map | `<a href="#footer">` | *"Skip map controls"* | The map's own controls are five stops; a keyboard user scanning results should not have to pass them |
| — | Map pins | **Not tab stops** | — | The map is a **redundant view** (`AC-SRCH-02.3`). The region carries a text alternative naming the count and stating that every pin appears in the list. `aria-hidden` is **not** used — the region is reachable, its content is described, and the list is authoritative |
| 27 | Selection bar | `role="region"` + a polite announcement | *"2 gyms selected for comparison"* | **Focus is not moved.** A bar that steals focus when the second checkbox is ticked makes ticking a third impossible without a `Shift+Tab` |

**The three things this screen gets wrong if nobody specifies them:**

1. **Filter changes must not move focus.** Applying a filter refetches the list; focus stays on the
   filter control. The new count is announced (stop 17); the list is not focused.
2. **The list must not be re-announced wholesale.** `role="status"` on the count, **not** on the
   list container. A live region wrapping 47 cards announces 47 cards on every keystroke.
3. **`Esc` inside the amenities combobox closes the listbox, not the sheet.** `KB5`, and on mobile
   the combobox lives inside the filter sheet, so getting this wrong closes the whole sheet and
   discards the user's filter work.

### 3.3 `SCR-WEB-005` — Checkout

The screen where an accessibility failure costs a sale and a fairness failure costs a refund
dispute. **AA is contracted.** Seven regions per `B6`.

| Stop | Element | Pattern | Announcement / naming rule |
| :-: | :--- | :--- | :--- |
| 1 | Skip to checkout form | Skip link | Bypasses the header |
| 2 | Order summary — change plan | `<a>` | *"Change plan — currently 3 Month Unlimited at Iron Works Gym"* |
| 3 | **Start date** | `<input type="date">` with a custom calendar button as a **second** stop | Native input first, calendar button second. The native input is typed as `DD MMM YYYY`; the calendar is a `grid` with arrow navigation, `PageUp/Dn` for months, `Esc` to close returning focus to the button |
| 4 | Add-ons | Checkbox group in a `<fieldset>` with `<legend>` | Each name carries its price: *"Locker, ₹500"* |
| 5 | **Coupon field** | `<input>` + `<button>` | The button is a separate stop. `Enter` in the field applies; it does **not** submit the order |
| 6 | Coupon result | **Not a stop.** `role="status"` (applied) / `role="alert"` (rejected) | Rejected: *"Coupon MONSOON20 expired on 31 Jul 2026. Try a different code or continue without one."* — what, why, next (`NFR-USE-05`) |
| 7 | **Price breakdown** | **Not a stop.** `<dl>`, and a `role="status"` wrapper around the **total only** | When a coupon lands, the total changes. Announcing the whole breakdown is noise; announcing *"New total ₹4,720"* is the information |
| 8–12 | Member details | Standard inputs with visible labels and `autocomplete` | Phone is `type="tel"`, `inputmode="numeric"`, `autocomplete="tel-national"`, hint *"10 digits, starting 6–9"* |
| 13 | **Refund policy disclosure** | A scrollable region with `tabindex="0"` and `role="region"` + `aria-label` | `B6` requires *the gym's stated policy, in full, not a link*. A scrollable region **must** be focusable or a keyboard user cannot scroll it. This is the one legitimate `tabindex="0"` on a non-interactive element in this product |
| 14 | Terms acceptance | `checkbox`, `aria-describedby` → the terms links | The links inside the label are stops 15–16 |
| 17 | **Proceed to payment** | `button[type=submit]` | Disabled while the mutation is in flight (`FM6`), with `aria-disabled` and a `role="status"` reading *"Creating your order…"* |

**The blocking price-change modal** (`AC-PLAN-02.2`) is the accessibility-critical moment on this
screen:

| Requirement | Specification |
| :--- | :--- |
| Trigger | The server refuses with `PLAN_PRICE_CHANGED` and `details` carrying `previous` and `current` |
| Role | `alertdialog`, `aria-modal="true"`, labelled by its heading, described by the old/new sentence |
| Focus | Moves to the **dialog heading** (`tabindex="-1"`), not to a button. The user must read before acting |
| Default action | Focus order inside is Cancel then Confirm; **neither is autofocused** |
| Announcement | The `alertdialog` role announces the description automatically. The old and new amounts are read as formatted money: *"was ₹5,000, now ₹5,500"* |
| Dismissal | `Esc` cancels and returns to checkout with the **new** price rendered — never silently re-applying the old one |
| On close | Focus returns to *"Proceed to payment"*, which is now labelled *"Proceed to payment — ₹5,500"* |

### 3.4 `SCR-DASH-009` — Check-in Desk

**AA is contracted. The desk must be completely operable without a mouse**, because a mouse at a
counter with a queue is a slower input device than a keyboard and because a camera failure must
degrade to typing, not to helplessness.

The desk inverts the usual model: **the search field is the resting place of focus**, and every
other control is reached from it.

`illustrative — not committed code`

```text
 Tablet portrait 768×1024 — the ergonomic target (NFR-USE-09)

 ┌──────────────────────────────────────────────────┐
 │ [1] Branch · station   ● Online   [2] Full screen│
 ├──────────────────────────────────────────────────┤
 │  CAMERA VIEWFINDER            [3] Switch camera  │
 │  aria-hidden="true" — no tab stop, no announce   │
 │  (the scan RESULT is announced, the video is not)│
 ├──────────────────────────────────────────────────┤
 │  RESULT PANEL                                    │
 │  role=status (ALLOWED) / role=alert (DENIED)     │
 │  [5] Keep on screen   [6] Renew now  [7] Override│
 │      ↑ present only in the state that offers it  │
 ├──────────────────────────────────────────────────┤
 │  [4] 🔍 SEARCH — focus rests here, always        │
 │      ↓/↑ move results · Enter confirms           │
 ├──────────────────────────────────────────────────┤
 │  RECENT CHECK-INS   role=log, polite             │
 │  Updated 6 seconds ago ●    [8] Refresh now      │
 └──────────────────────────────────────────────────┘
```

| # | Behaviour | Rationale |
| :-: | :--- | :--- |
| **DK-A1** | **Focus rests in the search field.** On load, after a verdict clears, after a dialog closes, after an override completes — focus returns to search, emptied and ready (`GymDashboard.md` §11.14, 2.4.3) | The next member is always the next action. A screen that leaves focus on a dismissed panel costs one `Tab` per member, which is 200 keystrokes a day |
| **DK-A2** | **Any printable character focuses search and inserts that character** — from anywhere on the screen, unless focus is already in a text input | Sameer types a phone number without reaching for anything. This is an *implicit* focus move, so it must never also *act*: 3.2.1 is satisfied because focusing a field is not a context change |
| **DK-A3** | **The viewfinder is `aria-hidden="true"` and is not a tab stop** | A live camera feed has no accessible content. Announcing it is noise; making it focusable is a stop that does nothing. **The scan outcome is announced; the video is not** |
| **DK-A4** | **The result panel is never focused automatically.** It is announced instead — `role="status"` for `ALLOWED`, `role="alert"` for `DENIED` | Moving focus to the result would take focus *away* from search and break DK-A1. Announcement gives the information without costing the position |
| **DK-A5** | **`Esc` clears the result and the search field and returns to ready.** It never closes full-screen mode | One key, one meaning, the most-used key on the screen |
| **DK-A6** | Search results are a `listbox` beneath the field: `↓`/`↑` move, `Enter` confirms the active option, `Esc` closes the list without clearing the query | The combobox pattern, unmodified |
| **DK-A7** | `F` full screen · `O` override (only when a denial is shown **and** the user holds `attendance.checkin.override`) · `M` manual mode · `R` retry last scan · `?` shortcut sheet. All suppressed inside a text input except `Esc` and `Enter`; all have visible focusable controls | `KB7`. The keyboard is a fast path, never the only path |
| **DK-A8** | **`O` is not "override".** It opens the override dialog. No single keypress performs a discretionary staff act that lands in the audit log | `K6`, `BR-CHK-08` |
| **DK-A9** | The override dialog traps focus, is labelled by its heading, focuses the **reason select** first, returns focus to search on close, and requires a reason from the seven-value override taxonomy (`§C4.8`) before its submit enables | `FR-CHK-07` |
| **DK-A10** | **The recent-check-ins strip is `role="log"`, polite, and never interrupts a verdict.** A poll landing mid-announcement queues behind it | `LC5`, `AX8`. An assertive strip would talk over the answer Sameer is waiting for |

> **The keyboard trap that would end the queue.** The camera stream, the full-screen API and a
> modal dialog interact badly if each is written independently: entering full screen re-parents the
> document, a dialog opened afterwards can end up outside the focus scope, and `Esc` is consumed by
> the browser leaving the dialog open and unfocusable. §3.9 specifies the defusal. This is the
> single highest-value keyboard test in the product.

### 3.5 `SCR-ADM-003` — Application Review

Anita reviews 30–60 applications a day at three minutes each (`B2.4`). **Level A is contracted, AA
is targeted, and keyboard operability is throughput, not compliance.** The screen is a split view:
documents left, checklist right, actions in a fixed footer.

| Stop group | Contents | Pattern |
| :--- | :--- | :--- |
| **A. Header** | Back to queue · Reassign · SLA badge (**not** a stop; `role="status"` when it crosses a threshold) | Two stops |
| **B. Pre-checks** | The disclosure for failed checks is **expanded by default**; passes are a single collapsed `<details>` summary reading *"4 passed"* | Two stops. `SCR-ADM-003`'s guard — approving over a failed pre-check — is enforced at the confirmation, not here |
| **C. Document viewer** | Zoom out · zoom in · rotate left · rotate right · page previous · page next · the document surface itself | Seven stops. The surface has `tabindex="0"` and `role="img"` with `aria-label` naming the document and page: *"Shop and Establishment certificate, page 1 of 3"* |
| **D. Document list** | One stop per document; `↑`/`↓` move within it; `Enter` loads into the viewer; `[` / `]` are the fast path | Composite (`KB2`) |
| **E. Application data** | Read-only definition list. **Not a stop**, except the *"diff v1→v2"* toggle | `<dl>`, `1.3.1` |
| **F. Checklist** | Nine items; each is a `radiogroup` of pass / fail / needs-info plus a note field | One stop per item's radiogroup (arrow keys select), one stop per note field. `1`…`9` jump to item *n* |
| **G. Internal notes** | Textarea + Add note | Two stops |
| **H. History and diff** | Expandable prior submissions | One stop per submission |
| **I. Action footer** | Reassign · Add internal note · Request information · Reject · **Approve** | Five stops, always last in DOM order, always reachable, never obscured by a sticky element (2.4.11 in WCAG 2.2, satisfied early) |

| # | Rule | Why |
| :-: | :--- | :--- |
| **AR-A1** | **`Alt+A` / `Alt+R` / `Alt+I` open the confirmation; they never perform the act** (`K6`). Approving a gym is `OBJ-03` and `RSK-01` — the highest-scoring risk in the register at 20 | A single accelerator that lists a fake gym is not a shortcut, it is a hazard |
| **AR-A2** | `[` and `]` move between documents **without leaving the checklist context**. Focus stays where it was; the viewer's `aria-label` change is announced politely | Anita reads a document while filling a checklist item. Stealing focus to the viewer would force a `Shift+Tab` per document |
| **AR-A3** | The reject dialog's reason list is a **checkbox group in a `<fieldset>` with a `<legend>`**, minimum one selected, sourced from the sixteen-value `§C4.8` application-rejection taxonomy. Submit stays `aria-disabled` with a `role="status"` explaining *"Select at least one reason"* until satisfied | `FR-ADMN-02`; a disabled button with no explanation is `KB8`'s failure mode |
| **AR-A4** | The step-up authentication prompt (`AM2`, 900-second window) that can appear on Approve is a modal that **preserves the pending action**. On success the confirmation reopens with its state intact; focus returns to the confirmation's heading | Losing nine checklist notes to a re-authentication prompt is a data-loss defect wearing a security costume |
| **AR-A5** | **Nothing on this screen is drag-only.** There is no drag interaction here at all; recorded because the taxonomy screen (`SCR-ADM-011`) does have one and shares the shell | `KB3` |

### 3.6 `SCR-DASH-006` — Plan Editor

Seven field groups, a sticky live preview, an immutable field, two confirmation dialogs and a money
input. **Level A contracted, AA targeted.** The interesting keyboard problems here are the preview
pane, the immutable `plan_type`, and the archive confirmation.

| Stop group | Contents | Pattern and rule |
| :-: | :--- | :--- |
| **1. Form landmark** | `<form>` with `aria-labelledby` → the `<h1>` *"Edit plan — Annual Unlimited"* | One `<h1>` per screen (§4.2) |
| **2. Basics** | Name · **plan type (immutable)** · duration value · duration unit · description | `plan_type` renders as a **focusable** `aria-disabled` control with `aria-describedby` → *"The plan type cannot be changed after a plan is created. Create a new plan to sell sessions instead of a duration."* `KB8` |
| **3. Pricing** | Price · joining fee | `type="text"`, `inputmode="decimal"`, `₹` as a **visually rendered prefix that is part of the `<label>`**, not a placeholder. Grouping applies on blur, not per keystroke — regrouping while typing moves the caret and is a 3.2.2 hazard |
| **4. Promotion** | Promo price · from · to · label | Two date fields, each with the calendar-button pattern of §3.3 |
| **5. Eligibility** | Min age · gender eligibility | `<fieldset>` + `<legend>` |
| **6. Access** | Branches radio (All / Specific) · branch checkboxes · access windows list with *Add window* | Each window row is one composite stop with `→` reaching its remove button |
| **7. Policies** | Freeze allowed + max days · transfer · stackable | `freeze_max_days` is `aria-disabled` and **focusable** while freeze is off, describing why |
| **8. Visibility** | Public / Staff only radios | The `STAFF_ONLY` option's `aria-describedby` states the consequence: *"No marketplace card exists for a staff-only plan"* |
| **9. Preview** | `<aside role="complementary" aria-label="Marketplace preview">` | **Not a tab stop and not a live region.** It updates on save, and the save announcement covers it |
| **10. Footer** | Archive · Discard · **Save** | Archive is `danger`; it opens a confirmation |

| # | Rule | Why |
| :-: | :--- | :--- |
| **PE-A1** | The preview is `complementary`, **never** `aria-live`. It re-renders on save and would otherwise announce a whole card | A live region on a preview is the classic "announce everything twice" defect |
| **PE-A2** | The **archive confirmation** states the specific consequence with a server-computed count and is an `alertdialog`: *"Archive Annual Unlimited? This plan is held by **34 active members**. They keep their membership until it ends. The plan disappears from the marketplace immediately and cannot be bought again."* Focus defaults to **Cancel** | `NFR-USE-06`, `UM4`, `FM7`. The count comes from the server inside the transaction — a confirmation whose number is stale is worse than one with no number |
| **PE-A3** | The **price-change confirmation** is likewise an `alertdialog` with focus on Cancel, and its first clause names the protection, not the risk: *"the 412 members who already bought this plan keep their purchased price"* | `FR-PLAN-08`, `BR-PLN-02` |
| **PE-A4** | On a failed save, focus moves to the **error summary** (§8.4), the summary lists each invalid field as a link, and the accordion group containing an invalid field **expands automatically**. A validation error inside a collapsed group is unreachable and unannounced | `FM5`, 3.3.1 |
| **PE-A5** | `422 PROMOTION_OVERLAPS_EXISTING` renders the **named** conflicting promotion with its dates in the field's `aria-describedby`, not a toast | `NFR-USE-05` |
| **PE-A6** | Plan reordering on `SCR-DASH-005` exposes *Move up* / *Move down* per row as the **primary** mechanism and announces the new position politely: *"Annual Unlimited moved to position 2 of 7"* | `KB3`, `FR-PLAN-04` |

### 3.7 Focus management — modals, sheets and route changes

`KB6` says focus is never lost to `<body>`. That is a promise, and a promise needs a table of every
case that could break it.

| Event | Focus goes to | On reverse | Announced |
| :--- | :--- | :--- | :--- |
| **Dialog opens** | The dialog's first focusable element, **except** an `alertdialog`, where it goes to the heading (`tabindex="-1"`) so the consequence is read before an action is available | The invoking element | The dialog's accessible name and description, by role |
| **Destructive confirmation opens** | **Cancel** — always, on every surface (`GymDashboard.md` §2.8) | The invoking element | `alertdialog` name + description containing the server-computed consequence |
| **Sheet opens** (mobile filters, mobile map, detail drawers) | The sheet's heading | The trigger | Same as dialog. Sheets are Radix dialogs with `aria-modal` |
| **Dialog closes because the invoker no longer exists** — e.g. Archive removes the row that opened it | The **container** the row lived in, with a polite announcement naming what happened | — | *"Annual Unlimited archived. 6 plans remain."* |
| **Route change, `customer-web`** | A visually hidden `<h1>`-adjacent target at the top of `<main>`, focused programmatically | Browser back restores scroll and focuses the same target | The new page `<title>` is announced by the screen reader on document title change; the SPA-style soft navigation additionally announces *"Search results, page 2"* politely |
| **Route change, the two SPAs** | Same pattern, and it is **mandatory** because a client-side route change fires no document load. Both SPAs set `document.title` explicitly in a route effect | — | Polite region announces the new screen name |
| **Toast appears** | **Nowhere.** Toasts never take focus | — | `role="status"` polite; `role="alert"` only for failures |
| **Inline expansion** (accordion, `<details>`, table row drawer) | Stays on the trigger; `aria-expanded` flips | — | State change is conveyed by `aria-expanded`, not by an announcement |
| **Item deleted from a list** | The **next** item's stop; if it was last, the **previous**; if the list is now empty, the list container with `tabindex="-1"` and the empty-state text | — | Polite: what was removed and how many remain |
| **A polled figure updates** | **Focus never moves.** `LC4`/`LC5` (`GymDashboard.md` §3.10: *"the poll itself never moves focus"*) | — | Only the "last updated" indicator and only when it transitions to stale (§4.5) |
| **The auth gate interrupts checkout** | After returning, focus lands on the control that triggered the gate, with the restored state intact (`FR-NAV-02`, `NX6`) | — | Polite: *"Signed in. Continuing your order."* |
| **Impersonation banner appears** (`FR-AUTH-12`) | Focus unchanged; the banner is the **first** element in the DOM and is a `role="region"` with an assertive announcement once | — | *"You are viewing this account as a support agent. Actions are audited."* |

**The one rule that catches the rest:** if a component removes, replaces or navigates away from the
element that currently has focus, it names its next focus target explicitly in its own code. A
component that does not is failing review, whether or not a test catches it.

### 3.8 Skip links

| Surface | Links, in order | Target | Visibility |
| :--- | :--- | :--- | :--- |
| `customer-web` | *Skip to main content* · *Skip to filters* (`SCR-WEB-002` only) · *Skip to plans* (`SCR-WEB-003` only) · *Skip to footer* | `#main`, `#filters`, `#plans`, `#footer` | Visually hidden until focused, then rendered as a solid pill at the top-left over `surface-inverse`, at `z-skip-link` above everything |
| `gym-dashboard` | *Skip to main content* · *Skip to navigation* | `#main`, `#nav` | Same |
| `admin-console` | *Skip to main content* · *Skip to navigation* · *Skip to actions* (`SCR-ADM-003` only, jumping to the footer action bar) | `#main`, `#nav`, `#actions` | Same |
| `SCR-DASH-009` | **None.** The desk has three regions and focus rests in the search field | — | A skip link on a screen with four tab stops is noise |

| Rule | Statement |
| :--- | :--- |
| **SL1** | The skip link is the **first** focusable element in the DOM on every screen that has one |
| **SL2** | Its target has `tabindex="-1"` so that focus actually lands there. A bare `id` anchor moves the scroll position and not the focus in several browsers, which is the reason most skip links in the wild do nothing |
| **SL3** | Skip links are **visible on focus**, not permanently hidden. `.sr-only`-forever is a failed 2.4.1 in practice because a sighted keyboard user cannot see where they went |
| **SL4** | `SCR-WEB-002`'s *"Skip map controls"* (stop 22) is a skip link inside the content, not in the header. Its target is the footer |

### 3.9 Keyboard traps — the four real candidates and how each is defused

2.1.2 is a **Level A** criterion, so it fails the build on every surface. Four constructs in this
product can create a trap. Each is named, each has a defusal, each has a test.

| # | Construct | How it traps | Defusal | Test |
| :-: | :--- | :--- | :--- | :--- |
| **T1** | **Full-screen mode + dialog at `SCR-DASH-009`** | `requestFullscreen` on a subtree makes elements outside it inert. A dialog portalled to `document.body` renders **outside** the full-screen element: invisible, unfocusable, and it has already trapped focus | The desk's full-screen target is the **application root**, not the desk panel, and every overlay portals into a container **inside** that root. `Esc` is handled by the dialog first and only exits full screen when no overlay is open | `E2E`: enter full screen → open override → `Esc` closes the dialog → `Esc` exits full screen → `Tab` reaches the search field |
| **T2** | **The camera viewfinder** | A `<video>` with `controls` is focusable and its internal controls form their own tab scope in some browsers | The viewfinder has **no `controls` attribute**, `aria-hidden="true"`, and is not focusable. The only camera control is the *Switch camera* button beside it | axe rule `aria-hidden-focus`, plus the manual pass |
| **T3** | **The document viewer at `SCR-ADM-003`** | An embedded PDF or a third-party viewer iframe swallows `Tab` and never returns it | The viewer renders **page images**, not an embedded plugin, with our own zoom/rotate/page controls. If a future viewer needs an iframe, the iframe carries a `title`, and a *"Leave document viewer"* button is the last stop inside it | Manual keyboard pass; `[`/`]` and `Tab`-out asserted in the E2E keyboard spec |
| **T4** | **The rich-text description editor** (`SCR-DASH-003`, `SCR-DASH-006`) | A contenteditable that inserts a tab character instead of moving focus | `Tab` **moves focus**; indentation is a toolbar action. The toolbar is a `toolbar` composite with arrow-key navigation and one tab stop. The editor documents this in its `aria-describedby` | Component test asserts `Tab` from the editor reaches the next field |

> **A fifth, which is not a trap but is mistaken for one:** the desk's *"any printable character
> focuses search"* behaviour. It moves focus **into** a text input, from which `Tab` and
> `Shift+Tab` both work normally. It is not a trap; it is an attractor. The distinction matters
> because a reviewer will flag it, and the answer is written down here.

### 3.10 The focus ring, restated as behaviour

`DesignSystem.md` §3.7 owns the values. This is what a reviewer checks.

| Check | Requirement |
| :--- | :--- |
| Visible on every focusable element | `2px` solid `border-focus` `#4F46E5`, `2px` offset, drawn **outside** the control so it never reduces the painted contrast (`FR2`) |
| Measured | **6.29:1** on `surface-default`, **5.74:1** on `surface-sunken`. Floor is 3:1 (1.4.11) |
| On a solid fill | Inverts to `content-inverse` `#F8FAFC` (`FR5`) so it is never indigo on indigo |
| At the desk | **3px**, because oversized density is what a receptionist reads at arm's length (`FR3`, `DK6`) |
| `:focus-visible`, not `:focus` | A mouse click paints no ring; a `Tab` does (`FR4`) |
| Never obscured | No sticky header, footer or floating bar may overlap a focused control. Scroll-into-view uses `scroll-margin` sized to the sticky chrome |
| `outline: none` | A lint failure unless an equally visible replacement is present in the same rule (`FR1`) |

---

## 4. Screen reader support

### 4.1 Landmark structure

One structure per surface, defined once in the shell, so that fifty-five screens do not each invent
a document outline.

`illustrative — not committed code`

```text
customer-web                    gym-dashboard / admin-console
────────────────────────────    ─────────────────────────────────────
<header role=banner>            <header role=banner>
  <nav aria-label="Primary">      tenant/branch switcher · account · impersonation banner
  <nav aria-label="Account">    <nav aria-label="Primary" id=nav>
<main id=main>                    ← filtered by effective permission (FR-NAV-03)
  <h1> …                        <main id=main>
  <search> or <section>           <h1> …
  <aside aria-label="Map…">       <section aria-labelledby=…> per region
<footer role=contentinfo>       <aside aria-label="Preview"> where a screen has one
  <nav aria-label="Footer">     <footer> only where a screen has an action bar
```

| Rule | Statement |
| :--- | :--- |
| **LM1** | Exactly **one** `<main>` per screen, carrying `id="main"` for the skip link |
| **LM2** | Every `<nav>`, every `<aside>` and every repeated `<section>` carries an accessible name. Two unnamed `<nav>` landmarks are indistinguishable in a screen reader's landmark list, which is the only reason the landmark list exists |
| **LM3** | The `SCR-WEB-002` filter rail is `<search>` (`role="search"`), not a `<nav>`. It filters; it does not navigate |
| **LM4** | The `SCR-DASH-009` result panel is `<section aria-labelledby="verdict-heading">` and is **inside `<main>`**, not an `aside`. It is the primary content of that screen |
| **LM5** | The impersonation banner (`FR-AUTH-12`) is the **first child of `<header>`** and is `role="region"` with `aria-label`. A support agent must be told, in every modality, that they are acting as someone else |
| **LM6** | Content outside a landmark is a defect. Screen-reader users navigate by landmark; an orphaned region is content they will not find |

### 4.2 Heading hierarchy

| Rule | Statement | Example |
| :--- | :--- | :--- |
| **HD1** | **Exactly one `<h1>` per screen**, and it names the screen, not the brand | `SCR-DASH-014`: *"Settlements"*. `SCR-WEB-003`: the gym name |
| **HD2** | No level is skipped. An `<h3>` never follows an `<h1>` | — |
| **HD3** | Every `B6`/`B7`/`B8` **region** is a `<section>` with a heading, even where the design shows no visible heading. Where the design shows none, the heading is visually hidden — **never omitted** | `SCR-DASH-001`'s five regions: Alerts, Today, Action lists, Trend, Activity |
| **HD4** | A dialog's heading is an `<h2>` inside the dialog and is the target of `aria-labelledby`. It does not participate in the page outline | Every `alertdialog` in §3 |
| **HD5** | Card titles inside a list are **not** headings unless the card is a landmark-scale region. 47 `<h3>`s on `SCR-WEB-002` make the heading list useless; the cards are list items whose link text is the name | `SCR-WEB-002`, `SCR-DASH-007` |
| **HD6** | On `SCR-WEB-003`, the twelve `B6` regions are `<h2>`s and the individual plan cards are `<h3>`s, because a member navigating by heading is looking for *"Plans"* and then for *"3 Month Unlimited"* | `SCR-WEB-003` |

**The heading outline of the three hardest screens**, written out because "sensible headings" is not
a specification:

```text
SCR-WEB-002                     SCR-DASH-009                    SCR-ADM-003
h1 Gyms in Andheri West         h1 Check-in — Bandra West       h1 Iron Temple Fitness Pvt Ltd
 h2 Filters (visually hidden)    h2 Scanner (visually hidden)    h2 Pre-checks
 h2 47 results                   h2 Result                       h2 Documents
 h2 Map of results               h2 Recent check-ins             h2 Application data
 h2 Nearby cities (empty state)                                  h2 Checklist
                                                                 h2 Internal notes
                                                                 h2 History
                                                                 h2 Decision
```

### 4.3 Accessible names — four rules that prevent the common failures

| # | Rule | The failure it prevents |
| :-: | :--- | :--- |
| **AN1** | **The visible label is the start of the accessible name** (2.5.3). *"Save Iron Works Gym"*, not *"Add to favourites: Iron Works Gym"* where the button reads "Save" | A voice-control user says the visible word and nothing happens |
| **AN2** | **Icon-only buttons carry a name that says the action and its object.** Not *"Delete"* but *"Remove photo 3 of 7"*; not *"Edit"* but *"Edit plan Annual Unlimited"* | Twelve buttons named "Edit" in one table |
| **AN3** | **Never build a name from the visual context.** A table row's action names include the row's identifying value, sourced from the data, not inferred from the DOM | *"Approve"* × 40 rows in the approvals queue |
| **AN4** | **An accessible name must not disclose what the user may not know.** `PermissionGate` in `hide` mode removes the element from the DOM entirely — it does not render an `aria-label` describing a capability the user lacks. Hiding is presentation (`BL6`, `FR-RBAC-02`), but a leaked name is still a leak | *"Approve payout (requires FINANCE)"* rendered to a support agent |

### 4.4 Page titles and route changes

| Rule | Statement |
| :--- | :--- |
| **PT1** | Every route sets a unique `<title>` with the **specific** part first: *"Settlements · Iron Temple · GYM MAP"*, not *"GYM MAP · Dashboard · Settlements"*. Screen readers and browser tabs both truncate from the right |
| **PT2** | On the two Vite SPAs, `document.title` is set by an explicit route effect. A client-side navigation fires no document load and therefore no automatic title announcement — this is the single most-missed screen-reader defect in an SPA |
| **PT3** | Alongside the title change, a polite live region in the shell announces the new screen name once. Title change alone is inconsistently announced across screen readers |
| **PT4** | A screen in an error or permission-denied state says so in the title: *"Access denied · Settlements · GYM MAP"* |
| **PT5** | `customer-web` titles are also the SEO titles (`FR-NAV-05`, `NX2`). One string, two purposes, no divergence |

---

## 5. The check-in desk — the hardest accessibility problem in the product

`SCR-DASH-009` is held to **AA** despite being an internal tool (§1). This section explains what that
costs and why it is worth paying.

### 5.1 The operating conditions

| Condition | Consequence |
| :--- | :--- |
| A queue of ten people at 06:15 | Sameer looks at the **member**, not the screen. He needs peripheral confirmation |
| Bright morning light through a glass frontage | Contrast that passes on a monitor fails on a tablet at 40% brightness |
| Tablet at arm's length, mounted or handheld | Text and state indicators must read at ~60 cm, not 40 cm |
| Two hundred repetitions a day | Anything requiring precision becomes an injury and an error source |
| Sameer may be colour-blind | ~8% of men have a colour-vision deficiency. Deuteranopia makes red and green **the same colour** |

### 5.2 Allow and deny must never rely on colour

> **`A11Y-CD1`.** The `ALLOWED` and `DENIED` states are conveyed by **three redundant channels**:
> colour, icon **shape**, and text. Any one alone must be sufficient.

| | `ALLOWED` | `DENIED` |
| :--- | :--- | :--- |
| Colour | Green surface | Red surface |
| **Icon shape** | ✔ Circle with a tick | ✘ Octagon with a cross |
| **Text** | "ALLOWED" + member name | "DENIED" + the specific reason |
| Position | Identical | Identical |

The icons differ in **outline shape**, not merely glyph — a circle and an octagon are distinguishable
in peripheral vision and in greyscale. A tick and a cross inside identical circles would not be.

**The greyscale test is a CI gate**, not a review opinion: the two states are screenshotted,
desaturated, and asserted to differ by a perceptual-difference threshold. A change that makes them
distinguishable only by hue fails the build.

### 5.3 Announcement

The result panel is `role="status"` with `aria-live="polite"`, so the outcome is announced without
stealing focus from the scanner — which must stay ready for the next person.

```html
<!-- illustrative — not committed code -->
<div role="status" aria-live="polite" aria-atomic="true">
  <p>Allowed. Priya Sharma. 3 Month Unlimited. 118 days remaining.</p>
</div>
```

Denials announce the reason and the suggested action: *"Denied. Membership expired on 31 July.
Renew now available."* — `NFR-USE-05`'s what/why/what-next applied to speech.

`aria-atomic="true"` matters: without it, a screen reader announces only the changed node, and a
member name arriving before the verdict is read out of order.

### 5.4 Reading distance and target size

| Element | Minimum | Rationale |
| :--- | ---: | :--- |
| Verdict text | 32 px | Legible at 60 cm |
| Member name | 24 px | |
| Days/sessions remaining | 20 px | |
| Denial reason | 20 px | Never smaller than the name — the reason is why the screen exists |
| Primary actions (Renew, Override) | **64 × 64 px** | Well above the 44 px floor. Hit at speed, one-handed |
| Manual-search field | 56 px tall | |

### 5.5 Keyboard is the primary input, not a fallback

Sameer types phone numbers far more than he taps. `NFR-USE-02` requires full keyboard operability
here in the strongest sense:

| Key | Action |
| :--- | :--- |
| Any printable character | Focuses the manual-search field and inserts the character — **no click required** |
| `Enter` on a result | Selects the member |
| `Enter` on the result panel | Confirms the check-in |
| `O` | Opens the override reason list (when a denial is showing) |
| `Esc` | Clears the panel, returns to scanning |
| `F` | Toggles full-screen |

**Focus never leaves the desk.** No modal on this screen may trap focus in a way that requires a
pointer to escape. The override dialog is keyboard-first: reason list arrow-navigable, `Enter`
confirms, `Esc` cancels.

---

## 6. Colour and contrast

### 6.1 The requirement

`NFR-USE-04`: text **≥ 4.5:1**, interactive elements **≥ 3:1**. WCAG 2.1 AA also requires 3:1 for
large text (≥ 24 px, or ≥ 19 px bold).

### 6.2 Measured, not asserted

`DesignSystem.md` §3 carries the token palette with a **measured ratio for every pairing that
ships**. This document owns the verification rule:

> **`A11Y-C1`.** A colour pairing enters the design system only with its measured contrast ratio
> recorded. A pairing without a recorded ratio fails review. *"Looks fine"* is not a measurement.

### 6.3 The pairings most likely to fail

| Pairing | Where | Risk |
| :--- | :--- | :--- |
| Muted body text on tinted surface | `SCR-WEB-003` amenity chips | Muted-on-tinted is the classic 3.8:1 near-miss |
| Placeholder text in inputs | Everywhere | Placeholders are habitually set too light. **They are not labels** and must not carry required information |
| Disabled controls | Everywhere | Exempt from contrast minimums by WCAG — but a disabled control nobody can read is still a usability defect |
| White on brand for CTAs | `SCR-WEB-005` "Proceed to payment" | A mid-tone brand colour fails against white. Darken the button, not the text |
| Rating stars | `SCR-WEB-002/003` | Amber on white is typically ~2:1. The **star shape** carries the meaning; the numeric value is text |
| Success/danger tints | Toasts, banners | Tinted backgrounds shift text ratios; measure the composite, not the base |
| Chart series | `SCR-DASH-020` | Adjacent series must differ in **lightness**, not only hue |

### 6.4 Colour is never the only channel

> **`A11Y-C2`.** No information is conveyed by colour alone, anywhere.

| Where colour is used | The redundant channel |
| :--- | :--- |
| Check-in allow/deny | Icon shape + text (§5.2) |
| Membership status pill | Text label inside the pill |
| Required form field | Asterisk + `aria-required` |
| Field error | Icon + message text below the field |
| Chart series | Direct labels or distinct dash patterns — never a colour-only legend |
| Featured search result | The word **"Promoted"** (`FR-SRCH-11` requires textual labelling regardless) |
| Reconciliation variance | The variance figure and the word, not a red row alone |

### 6.5 Dark mode

Every pairing is measured in **both** themes. Dark mode fails contrast in the opposite direction —
mid-tones that pass on white often fail on near-black. The check-in allow/deny colours **keep their
semantic mapping** across themes; a green that becomes ambiguous in dark mode is a safety issue, not
a styling one.

---

## 7. Touch targets

`NFR-USE-03`: minimum **44 × 44 px** on all touch surfaces.

### 7.1 The rule and its measurement

The target is the **hit area**, not the visible ink. A 24 px icon button with 10 px padding on all
sides is a 44 px target and is compliant. Spacing between adjacent targets must be ≥ 8 px, or
adjacent compliant targets still produce mis-taps.

### 7.2 Where this is genuinely tight

| Screen | Pressure | Resolution |
| :--- | :--- | :--- |
| `SCR-WEB-002` filter rail | Ten filter groups, each with a control and a count | Filter rows are full-width, 48 px tall. Counts are text within the row, not separate targets |
| `SCR-WEB-002` map pin clusters | Pins overlap in dense localities | Minimum 44 px tap area per pin; clusters expand on zoom rather than shrinking pins (§9.4 of `ResponsiveBehavior.md`) |
| `SCR-WEB-004` comparison remove buttons | One per column, four columns at 320 px | 44 px targets; columns scroll rather than compress |
| `SCR-WEB-016` OTP entry | Six boxes across 320 px | 44 × 48 px each with 4 px gaps = 292 px. Fits with margin |
| `SCR-DASH-006` plan editor | Dense form on a tablet | 48 px rows; the access-window time pickers are the tightest and use a stepped control, not a slider |
| `SCR-DASH-009` check-in desk | §5.4 | 64 px, well above the floor |
| `SCR-DASH-007` member list rows | Compact density, 50 rows per page | The **row** is the target at 44 px minimum. Per-row action icons appear on focus/hover, not permanently — a 32 px icon in a 40 px row would fail |

### 7.3 The compact-density exception, and its limit

`DesignSystem.md` §7 defines a compact density for dashboard tables. **Compact reduces padding, never
below the 44 px hit area.** If a row cannot be 44 px, it does not become 36 px — the action moves out
of the row into a menu whose trigger is 44 px.

Enforced by a custom axe rule in CI, run at the two smallest viewport classes.

---

## 8. Forms

### 8.1 The label contract

| Rule | |
| :--- | :--- |
| **`A11Y-F1`** | Every input has a **visible** `<label>` with `htmlFor`. Placeholder-as-label is forbidden — it vanishes on focus, exactly when the user needs it |
| **`A11Y-F2`** | Required fields carry a visible marker **and** `aria-required="true"`. Marking only optional fields is permitted if consistent within a form, but never mixed |
| **`A11Y-F3`** | Help text is associated by `aria-describedby`, not placed as an unlinked sibling |
| **`A11Y-F4`** | Grouped inputs (`sub_ratings`, notification preferences, gender policy) use `<fieldset>` with a `<legend>` |

### 8.2 Validation timing

Validation on **blur**, never on keystroke. Validating an email while it is being typed reports an
error on every character until the last one — hostile to everyone, and for a screen-reader user it
produces continuous announcements.

| Moment | Behaviour |
| :--- | :--- |
| Typing | Nothing |
| Blur | Validate that field; show the error below it |
| Re-focus a field in error | Error remains until the value changes and blurs clean |
| Submit with errors | **Focus moves to the first invalid field.** A summary appears at the top, linked to each field |
| Server-side 400 with `details` | Mapped back onto fields by name; the summary announces via `role="alert"` |

### 8.3 The error message contract

`NFR-USE-05` requires **what happened, why, and what to do next**.

| ✗ | ✔ |
| :--- | :--- |
| "Invalid" | "Enter a 10-digit mobile number starting with 6, 7, 8 or 9." |
| "Error 422" | "This coupon expired on 31 July. Remove it to continue." |
| "Required" | "Enter the member's name — it appears on their invoice." |
| "Failed" | "We couldn't reach the payment provider. Your card was not charged. Try again in a moment." |

Errors are announced through `role="alert"` on appearance. The field carries
`aria-invalid="true"` and `aria-describedby` pointing at the message.

### 8.4 The wizard

`SCR-DASH-002` is six steps. Progress is `<nav>` with `aria-current="step"`. Each step is an
`<h1>`-headed region; advancing moves focus to the new heading. **Data survives back-navigation**
(`FR-ONB-01` persistence), so a keyboard user reviewing step 2 loses nothing.

---

## 9. Motion

| Rule | |
| :--- | :--- |
| **`A11Y-M1`** | `prefers-reduced-motion: reduce` removes all non-essential animation. Transitions become instant; nothing is lost |
| **`A11Y-M2`** | No animation longer than 5 seconds runs automatically without a pause control |
| **`A11Y-M3`** | Nothing flashes more than three times per second |
| **`A11Y-M4`** | Motion never carries meaning on its own |

### 9.1 The QR countdown is the interesting case

`SCR-WEB-009` shows a 60-second countdown ring. Under reduced motion:

- The **ring stops animating** and becomes a stepped indicator updating each second.
- The **numeric countdown remains** — it was always the accessible channel.
- Auto-refresh at zero is **unaffected**. It is functional behaviour, not decoration, and disabling
  it would break the door.

That distinction is the general rule: reduced motion suppresses *animation*, never *function*.

### 9.2 The check-in confirmation

The green confirmation does not animate in under reduced motion; it appears. The auto-clear timer is
functional and continues. A user who needs more time can disable auto-clear in `SCR-DASH-022` —
configurable, per the PRD's *"held on screen for a configurable duration"*.

---

## 10. Images and media

| Case | Alt text |
| :--- | :--- |
| Gym cover photo, search result | `alt="{Gym name}, {locality}"` — the card already names the gym, so the image adds location context |
| Gallery images, `SCR-WEB-003` | `alt="{Gym name} — photo {n} of {total}"`. The gym cannot be trusted to write per-image alt text and forcing it would produce keyword spam |
| Member profile photo, check-in | `alt=""` **decorative** — the name is adjacent text, and *"photo of Priya Sharma"* announced before *"Priya Sharma"* is noise at 06:15 |
| Member-uploaded review photo | `alt="Photo attached to a review of {Gym name}"`. We cannot know its contents and must not invent a description |
| QR code | `alt="Your check-in code"` plus adjacent text explaining what to do with it |
| Icons with a text label | `aria-hidden="true"` — the label is the accessible name |
| Icon-only buttons | `aria-label` describing the **action**, not the icon: `aria-label="Remove from comparison"`, never `"X icon"` |
| Charts | `role="img"` with an `aria-label` summarising the finding, plus the underlying data reachable as a table |

**EXIF is stripped on upload** (`FR-GYM-02`). That is a privacy requirement rather than an
accessibility one, but it lands here because photo handling is specified once: a member's review
photo carrying GPS coordinates would be a `BR-DAT-06` breach of exactly the kind `Search.md` §11.4
raises.

---

## 11. Internationalisation as an accessibility concern

`NFR-USE-08`: **all user-facing strings externalised from the first commit**, even though the launch
locale is English only (`ASM-07`).

### 11.1 Why this is an accessibility section

A layout that breaks under longer text breaks for **everyone** who increases their font size, not
only for a future Hindi reader. The two failure modes are the same failure.

| Risk | Mitigation |
| :--- | :--- |
| Hindi and Devanagari run ~20–30% longer | No fixed-width buttons. No text truncation on primary actions. Test at 130% string length |
| Devanagari has taller ascenders and matras | Line-height set from the font's metrics, not a fixed pixel value. Fixed line-height clips matras |
| User zooms to 200% (a WCAG AA requirement) | Layout reflows; no horizontal scroll. Same guarantee as `NFR-USE-07` |
| User sets a minimum font size | `rem`-based sizing throughout; **no `px` font sizes** |
| Number formatting | `Intl` with locale, not string concatenation. Lakh-crore grouping is a locale property, not a hard-coded rule |
| Date formatting | `Intl.DateTimeFormat`, never a template string |

### 11.2 The 200% zoom test

WCAG 2.1 AA requires content to be usable at 200% zoom without horizontal scrolling. On the customer
site this is equivalent to testing at half the viewport width — so a 1280 px desktop at 200% behaves
like 640 px, which the responsive matrix already covers. **The dashboards are where this bites**,
because a 1366 px laptop at 200% is 683 px, below the 768 px floor of `ResponsiveBehavior.md` §11.2.

Resolution: the dashboards reflow to their tablet layout at that effective width rather than showing
the below-minimum notice. A zoomed user is not an unsupported device.

---

## 12. Testing

### 12.1 Automated

| Check | Tool | When | Gate |
| :--- | :--- | :--- | :--- |
| axe-core rule set | Playwright + `@axe-core/playwright` | Every PR, every screen | **Blocking on serious/critical** |
| Contrast of every shipped token pairing | Custom, against `DesignSystem.md` §3 | Every PR | **Blocking** |
| Touch targets ≥ 44 px at the two smallest viewports | Custom axe rule | Every PR | **Blocking** |
| Greyscale distinguishability of check-in states | Screenshot + perceptual diff | Every PR | **Blocking** (§5.2) |
| Every image has `alt` (empty counts) | ESLint `jsx-a11y` | Pre-commit | Blocking |
| Every form control has a label | ESLint `jsx-a11y` | Pre-commit | Blocking |
| No positive `tabIndex` | ESLint `jsx-a11y` | Pre-commit | Blocking |
| Heading hierarchy has no skipped level | axe-core | Every PR | Warning |
| 200% zoom, no horizontal overflow | Playwright | Every PR | Blocking |

### 12.2 Manual, per release

| Pass | Tool | Scope |
| :--- | :--- | :--- |
| Keyboard-only | None — unplug the mouse | The five complex screens of §3 |
| Screen reader, Windows | NVDA + Chrome | Customer purchase journey, check-in desk |
| Screen reader, macOS/iOS | VoiceOver + Safari | Customer purchase journey |
| Screen reader, Android | TalkBack + Chrome | `SCR-WEB-009` QR, `SCR-WEB-005` checkout |
| Colour-vision simulation | Deuteranopia, protanopia, tritanopia | Check-in desk, charts, status pills |
| Zoom to 200% | Browser | All three surfaces |
| Real check-in desk | Physical tablet, at a counter, one-handed | `SCR-DASH-009` (`NFR-USE-09`) |

### 12.3 What automation cannot catch

Stated plainly, because axe passing invites the belief that the product is accessible.

Automated tooling catches roughly **30–40%** of WCAG issues. It cannot judge:

- Whether alt text is *meaningful* — only whether it exists. `alt="image"` passes every automated check.
- Whether focus order is **logical**, only that focus is reachable.
- Whether an error message actually tells you what to do.
- Whether a live region announces at a **useful moment** rather than constantly.
- Whether the check-in desk is usable at 06:15 with ten people waiting.

The manual passes are not optional and their sign-off is a release gate.

---

## 13. Per-screen risk register

The five screens most likely to fail an external audit, and why.

| Rank | Screen | Risk | Mitigation | Owner |
| :-: | :--- | :--- | :--- | :--- |
| **1** | `SCR-WEB-002` Search Results | The most complex interaction in the product: a filter rail, a virtualised list and a map with bidirectional hover sync. **Map-list sync has no keyboard or screen-reader equivalent by default.** Result counts updating live can flood a live region | Map is `aria-hidden` with the list as the accessible equivalent; a "view on map" action per result rather than hover; result-count announcements debounced to one per 1,000 ms and phrased as a total, not a delta | Frontend |
| **2** | `SCR-DASH-009` Check-in Desk | Held to AA; colour-critical; used at speed; a live camera feed is inherently inaccessible | §5 in full — three redundant channels, greyscale CI gate, keyboard-primary input, manual search as a complete alternative to the camera | Frontend |
| **3** | `SCR-ADM-003` Application Review | Split view, inline document viewer with zoom and rotate, a structured checklist with tri-state controls. **Document viewers are among the worst offenders for keyboard traps.** Anita does this 60 times a day, so a trap is a daily injury | Viewer keyboard contract specified in §3; approve/reject reachable without entering the viewer; `Esc` always exits the viewer | Frontend |
| **4** | `SCR-WEB-005` Checkout | Money, a blocking price-change modal, and a legally significant refund-policy disclosure. **A modal appearing mid-flow must not lose focus context**, and the refund policy must be readable, not a scroll-trapped box | Modal focus trap with return-to-trigger; policy in a landmark region with a heading, not an overflow div; the price-change modal announces old and new values via `role="alertdialog"` | Frontend |
| **5** | `SCR-DASH-014` Settlements | A wide financial table with eight numeric columns that must sum visibly to the payout. **Table semantics are routinely lost to `div` grids**, and a screen-reader user then cannot associate a figure with its column | Real `<table>` with `<caption>`, `<th scope>`, and a row-level summary. Tabular numerals. The arithmetic identity stated as text, not implied by layout | Frontend |

### 13.1 The one that will be argued about

`SCR-DASH-009` is internal, used by three people per gym, on a device the gym owns. There will be
pressure to drop it to Level A.

**The counter-argument, recorded so it does not have to be reconstructed later:** Sameer performs
this action 200 times a day. An accessibility failure here is not an edge case a rare user
encounters once — it is a defect a specific person hits every four minutes for their entire shift.
And `ASM-01` assumes only *"a smartphone or tablet with a camera"*; it assumes nothing about the
person holding it.

---

## 14. Traceability

| Requirement | Section |
| :--- | :--- |
| `NFR-USE-01` WCAG 2.1 AA on `web` and check-in desk | §1, §5 |
| `NFR-USE-02` full keyboard operability | §3, §5.5 |
| `NFR-USE-03` 44 px touch targets | §7 |
| `NFR-USE-04` contrast ratios | §6 |
| `NFR-USE-05` error message contract | §8.3 |
| `NFR-USE-06` destructive-action confirmation | `Components.md` DestructiveConfirmDialog |
| `NFR-USE-07` responsive, no horizontal scroll | §11.2, `ResponsiveBehavior.md` |
| `NFR-USE-08` string externalisation | §11 |
| `NFR-USE-09` check-in desk one-handed at arm's length | §5.4, §12.2 |
| `FR-GYM-02` EXIF stripping | §10 |
| `FR-SRCH-11` featured results textually labelled | §6.4 |
| `FR-ONB-01` wizard persistence | §8.4 |
| `BR-DAT-06` no PII in metadata | §10 |
| `SCR-WEB-002`, `-005`, `-009` · `SCR-DASH-006`, `-009`, `-014` · `SCR-ADM-003` | §3, §5, §7.2, §13 |

## 15. Open items

| # | Item | Owner |
| :-: | :--- | :--- |
| **OI-AC1** | The greyscale perceptual-difference threshold (§5.2) has no agreed value. Too loose passes an ambiguous pair; too tight fails legitimate designs | Design + Engineering |
| **OI-AC2** | No screen-reader user has reviewed any of this. Every claim here is a specification, not a validated outcome. **Budget a paid accessibility audit before launch** — `NFR-SEC-04` funds a penetration test and there is no equivalent line for accessibility | Product |
| **OI-AC3** | §11.2's dashboard-reflow-at-200%-zoom rule conflicts with `ResponsiveBehavior.md` §11.2's 768 px floor notice. The reflow must win; the two documents need reconciling in one edit | Frontend |
| **OI-AC4** | The check-in desk's camera feed has no accessible alternative *for the scanning act itself* — manual search is the alternative for the whole task. Whether that satisfies an auditor is untested | Design |
| **OI-AC5** | Devanagari line-height metrics (§11.1) are specified as a principle with no tested value, because the launch locale is English. It will be discovered late unless tested now | Design |

---

*End of Accessibility.md.*
