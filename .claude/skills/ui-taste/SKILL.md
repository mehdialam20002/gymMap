---
name: ui-taste
description: Design and animate GYM MAP UI without producing generic AI-looking output. Use when building or restyling any screen in customer-web, gym-dashboard or admin-dashboard, when adding motion or transitions, when a design "looks AI-generated" or needs taste, or when redesigning an existing surface. Adapted from leonxlnx/taste-skill and constrained by this repository's locked stack and design-token law.
---

# ui-taste

Adapted from **[leonxlnx/taste-skill](https://github.com/leonxlnx/taste-skill)** (MIT), an anti-slop
frontend framework for AI agents. Its diagnosis is correct and unusually well-observed: LLM UI is bad
in _specific, repeatable ways_, and naming those ways is most of the cure.

**It is not installed verbatim, and must not be.** Four of its core mechanisms contradict binding
specification in this repository. Section 1 states each conflict and how this skill resolves it. If
you have read the upstream document and something here disagrees with it, **this file wins** — not
because it is better, but because `PROJECT_CONSTITUTION.md` outranks a third-party skill.

---

## 0. Before anything: read the room, then say what you read

Upstream's best idea. Most LLM design output is bad because the model jumps to a default aesthetic
instead of reading the brief.

Before writing a line of UI, state one sentence:

> **"Reading this as: `<surface>` for `<persona>`, `<density mode>`, motion `<level>`, because `<the
signal in the brief>`."**

Example: _"Reading this as: admin-dashboard for Anita (30-60 approvals a day), compact density,
motion at feedback-only, because the brief is an approvals queue and `DesignSystem.md` §1.1 fixes
the density for this surface."_

If you cannot name the persona, you have not read `docs/ui/DesignSystem.md` §1.1. Go and read it.

---

## 1. The four conflicts with upstream, and how they resolve

Do not resolve these differently. Each one is a documented law in this repository, and
`CLAUDE.md` §9.3 is explicit: a conflict halts work, it is never reconciled in code.

### 1.1 Dependencies — upstream mandates two that are unapproved here

Upstream requires **Motion** (`motion/react`, formerly framer-motion) and **GSAP + ScrollTrigger**,
and ships canonical GSAP skeletons.

Neither has an `A-NN` row in `docs/engineering/STACK_ADDITIONS.md`. The standing rule
(`CLAUDE.md` §5) is unambiguous:

> Any technology not in Part 1 (locked) or Part 2 (approved) is **unapproved** and may not appear in
> code, in a `package.json`, or in an infrastructure definition. A dependency present without a
> corresponding approved `A-NN` row is a **review blocker**.

**Resolution.** Every animation in this repository is **CSS or Tailwind, driven by the motion
tokens**. See §4. If a brief genuinely needs choreography CSS cannot express, you do not install
anything — you **propose an `A-NN` row, state what it buys and what it costs, and wait for the
owner**. `ci:deps-approved` fails the build otherwise, so this is enforced, not advisory.

### 1.2 Styling — upstream picks colours and fonts, this repo forbids that

Upstream's Section 2 maps briefs to design systems and tells the agent to choose a palette, a
typeface and a radius scale.

`FolderStructure.md` §1.2:

> `packages/ui/src/tokens/` is the only place a colour, space, radius, type-scale or motion value is
> defined. **No app defines one.**

**Resolution.** You never write a hex, a `px` radius, a font stack or a raw duration in an app. You
use a token class (`bg-surface`, `text-content-secondary`, `rounded-card`, `duration-fast`). If the
design needs a value that does not exist, you **add the token in `packages/ui` first**, with its
contrast proof, and then use it. shadcn/ui is `A-04` and is copied into `packages/ui` — upstream's
"never ship shadcn in its default state" applies and is satisfied by the token layer.

### 1.3 Density — upstream offers a dial, this repo fixes it per surface

Upstream's `VISUAL_DENSITY: 1-10` is a free choice per page. Here it is decided already, by persona,
and `DesignSystem.md` §7 is pointed about it:

> A density mode that reaches for a different red has stopped being a density mode and is a second
> design system.

**Resolution.** Density is a lookup, not a dial:

| Surface                      | Persona                                           | Density                                                | Why                                           |
| :--------------------------- | :------------------------------------------------ | :----------------------------------------------------- | :-------------------------------------------- |
| `customer-web`               | Priya, deciding                                   | comfortable                                            | She is being persuaded, and she is on a phone |
| `gym-dashboard`              | Rohan, "what do I do today"                       | **compact**, 14px body, tabular numerals               | He opens it several times a day for years     |
| `admin-dashboard`            | Anita 30-60 approvals/day, Vikram tracing figures | **compact**, dense split views, keyboard-first (`AX2`) | Volume of work per screen                     |
| Check-in desk `SCR-DASH-009` | Sameer, ≤2s p95 under pressure                    | **oversized**, 96px verdict                            | One hand, a tablet, a queue behind him        |

### 1.4 Scope — upstream excludes dashboards, which are two of three surfaces

Upstream Section 13 says plainly it is **not** for dashboards, dense product UI, admin panels or data
tables.

**Resolution.** Upstream's landing/marketing craft applies to **`customer-web` only**. For the two
dashboards, take upstream's _diagnostic_ half (the AI tells, the motion discipline, the pre-flight
habit) and drop its _compositional_ half (asymmetric grids, scroll choreography, hero rules). A
dashboard's job is to be read fast and be unambiguous about which figure is authoritative.

---

## 2. The dials, as they survive here

Two of upstream's three dials survive; density does not (§1.3).

- **`DESIGN_VARIANCE` 1-10** — layout asymmetry. Applies to `customer-web` only. Dashboards sit at
  1-3 by definition: an operator scanning a queue does not want a masonry grid.
- **`MOTION_INTENSITY` 1-10** — see §4, where this repository's ceiling is much lower than
  upstream's.

| Surface / brief                         | VARIANCE | MOTION                     |
| :-------------------------------------- | :------- | :------------------------- |
| `customer-web` marketing and landing    | 7-8      | 4-6                        |
| `customer-web` account, checkout, forms | 4-5      | 3-4                        |
| `gym-dashboard`, `admin-dashboard`      | 1-3      | 2-3                        |
| Check-in desk                           | 1        | 1, cross-fade only (`MO5`) |

State the values you chose and why. Silently using a baseline is the failure upstream is written
against.

---

## 3. Trust invariants that outrank any aesthetic choice

These four are the product. A design decision that weakens one of them is wrong however good it
looks, and three of them are things a designer would not think to ask about.

| Rule                                           | What it forbids on screen                                                                                                                                                         |
| :--------------------------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **`BR-REV-01`** reviews are earned             | An unrated gym shows **"New listing"**, never `0.0` or empty stars. Zero is a claim that members rated it badly. Rating sorts put unrated **above** nothing, never below one-star |
| **`BR-GYM-01`** verification before visibility | The Verified badge means a human approved it. Never decorate an unverified thing with it                                                                                          |
| **`BR-PLN-03`** price shown = price charged    | No UI-computed discount, pro-rata or "save 20%". A number the page invents is one checkout will refuse to honour. All money is **integer paise**, formatted in exactly one place  |
| **`A-08` / `LC5`** stale is a defect           | Every polled figure carries a `LastUpdatedIndicator`. Never label something "Real-time" that is 10-15s polling                                                                    |

And the rule that governs every empty state on a dashboard:

> **A number is bound to a live endpoint, or there is no number.** A `0` meaning "not built" and a
> `0` meaning "nothing to approve today" look identical, and only one of them needs an operator.
> Unbuilt tiles name their milestone and show nothing.

---

## 4. Motion

Upstream is right that motion must be motivated and wrong about how much of it this product wants.

### 4.1 The gate

Before adding any animation, answer in one sentence: **what does this communicate?** Valid:
hierarchy, feedback, state transition, origin. Invalid: "it looked cool". If you cannot say it in one
sentence, drop the animation.

### 4.2 The repository's own motion law — `DesignSystem.md` §6.6

These are binding and several are counter-intuitive:

- **`MO1`** Motion communicates origin and direction, never delight. A sheet slides from the edge it
  belongs to; a dropdown scales from its trigger.
- **`MO2`** Exit is faster than enter. `fast` out where `base` came in. Someone dismissing something
  has already decided.
- **`MO3`** **Nothing on a data path animates.** A number that changes because a poll landed
  **cross-fades over `fast`** — it never counts up. _A counting animation makes a stale figure look
  live, which `LC5` calls a defect._ This bans the animated-counter pattern that appears in almost
  every dashboard mockup on the internet.
- **`MO4`** `transform` and `opacity` only. Never `width`, `height`, `top`, `margin`.
- **`MO5`** The check-in verdict does not slide, bounce or scale. It cross-fades over `deliberate`.
  Movement at the moment of a verdict costs recognition time against `NFR-PERF-03`.
- **`MO6`** Skeletons shimmer at `linear` 1400ms and stop the instant real content arrives. A
  shimmer that outlives its data is a lie about progress.

### 4.3 The tokens are the only durations

```
duration:  instant 0ms · fast 120ms · base 180ms · slow 260ms · deliberate 400ms
ease:      standard cubic-bezier(0.2,0,0,1) · enter (0,0,0,1) · exit (0.3,0,1,1) · linear
```

Use `duration-fast`, `ease-standard`. Never a literal `300ms` or a hand-rolled bezier.

### 4.4 Reduced motion is already solved — do not re-solve it

`RM1`: the duration tokens collapse to `1ms` in one place in `tokens.css` under
`prefers-reduced-motion: reduce`. **Because you animated with tokens, you get this for free.** Do
not add per-component media queries; that is a second implementation of one rule.

The exception upstream is right about: infinite loops, parallax and anything scroll-driven must
collapse to _static_, not to _fast_. A 1ms infinite loop is still an infinite loop.

### 4.5 Never

`window.addEventListener('scroll')` — hard ban. Use IntersectionObserver or CSS scroll-driven
animation. And no scroll-hijack anywhere: it breaks `AX2` keyboard navigation and it is the single
most-hated pattern on a marketing page.

---

## 5. AI tells

The most valuable part of upstream, and it transfers almost unchanged. The full list is in
[`reference/ai-tells.md`](reference/ai-tells.md) — **read it before shipping any new screen.**

The ones that bite hardest here:

- **No div-based fake product UI.** The #1 tell. Never build a fake dashboard out of styled divs to
  simulate a screenshot.
- **No fake-perfect numbers.** `99.99%`, `50%`, `1,234,567`. Real data is messy. And on a dashboard,
  see §3: bind it or omit it.
- **No generic names or brands.** "John Doe", "Acme", "Nexus". Use realistic, locale-appropriate
  Indian names and gym names — the fixture catalogue in
  `apps/customer-web/src/features/discovery/fixtures/catalogue.ts` is the reference for tone.
- **No three identical horizontal feature cards.**
- **No pure black.** Off-black. The dark tokens already handle this.
- **No decorative status dots.** Only for real semantic state — `/readyz` is real, a dot next to a
  nav item is not.
- **No filler verbs.** "Elevate", "Seamless", "Unleash", "Next-Gen".
- **No hand-rolled SVG icons.** No icon library is approved yet, so an icon set needs an `A-NN` row
  before it lands (§1.1).

### 5.1 The em-dash ban — adopted for rendered UI text only

Upstream bans `—` and `–` outright as the LLM's signature tell, and is right about rendered pages.

**Here it applies to user-visible strings only** — that is, the message catalogues
(`src/shared/i18n/messages/en.ts` in each app) and anything else a member or operator reads. Use
`-`, a comma, a colon, or two sentences.

It does **not** apply to source comments, commit messages or `docs/`. Those are written for
maintainers, this repository's prose uses em-dashes throughout, and a sweep of ~139k lines of
specification to remove a punctuation mark is a cost with no reader.

> **Known inconsistency, stated rather than hidden:** several strings already in `en.ts` contain
> em-dashes. They were written before this rule. Fix them when you touch that string for another
> reason; do not open a change that only removes dashes.

---

## 6. Copy is not decoration — `NFR-USE-08` / `I18N1`

Every user-facing string lives in the message catalogue. The `I18N1` gate in each app's
`shell.spec.ts` scans JSX for prose literals and **fails the build** — it has already caught three.

This constrains design more than it looks. A layout that needs a clever inline string still needs
that string in `en.ts` with a key, so write keys that survive translation and do not encode grammar
in the layout.

---

## 7. Accessibility is a gate, not a polish pass

The repository's bar is higher than upstream's.

- **`AX2`** keyboard-first. Skip link is the first focusable element. Every interactive control
  reachable and visibly focused. `admin-dashboard` operators use shortcuts.
- **`AX3`** minimum touch target 44x44 via `gm-hit-target`. Compact density expands the _hit_ area
  without expanding the _painted_ control.
- **Contrast** every colour pair ships a proof — `packages/ui/src/tokens/contrast.proof.ts`. Muted
  text on a tinted surface is where this fails. If you add a token, add its proof.
- **Never colour alone.** Every status carries icon **and** word **and** colour. `AX8`: a denial at
  the check-in desk is announced in a live region, not only painted red.
- **`aria-current`** on active filters and nav, not just a background tint.

---

## 8. Pre-flight

Upstream's discipline, cut to what applies here. Every box, honestly, before you say a screen is
done.

- [ ] Design read stated (§0), with surface, persona, density and motion level
- [ ] Zero hexes, raw radii, font stacks or literal durations in the app — tokens only (§1.2)
- [ ] No new dependency, or an `A-NN` proposal is on the table and unanswered (§1.1)
- [ ] Every animation justified in one sentence, and none on a data path (`MO3`)
- [ ] Motion uses duration and ease tokens, so `RM1` covers reduced motion (§4.4)
- [ ] Every polled figure has a `LastUpdatedIndicator`; nothing claims "real-time" (`A-08`)
- [ ] Every number bound to a live endpoint, or absent — no placeholder zeros (§3)
- [ ] Unrated things show "New listing", never `0.0` (`BR-REV-01`)
- [ ] Money is integer paise, formatted in exactly one place (`BR-PLN-03`)
- [ ] Every user-facing string in the catalogue; `I18N1` passes (§6)
- [ ] No em-dash in any rendered string (§5.1)
- [ ] Contrast proven for every pair; status never colour-only (§7)
- [ ] Keyboard path walked end to end, focus visible throughout (`AX2`)
- [ ] Both light and dark checked — the theme toggle is real
- [ ] Read [`reference/ai-tells.md`](reference/ai-tells.md) and none of it is present
- [ ] `pnpm typecheck && pnpm lint && pnpm test:unit` green

If one box cannot be ticked honestly, the screen is not done.

---

## 9. When the brief and the specification disagree

Say so and stop. `CLAUDE.md` §9.3: a conflict halts work and is never reconciled in code. Name both
documents, state the conflict in a sentence, and let the owner record the decision in
`DECISION_LOG.md`.

This applies to taste too. If someone asks for an animated counter on the revenue tile, the answer
is not "no" — it is _"`MO3` bans animation on a data path because a counting animation makes a stale
figure look live. I can cross-fade it over `fast` instead, which reads as an update without
implying it is live."_
