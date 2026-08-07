# `@gymmap/ui`

The shared presentation layer. `FolderStructure.md` §10 · constitution §7.1.1 **R3** · A-03, A-04.

`§C1.1`'s rationale is the whole point: a shared library _"prevents three divergent
interpretations of the same design"_. Divergence does not begin with three different blues — it
begins with three different answers to _what is this surface for_.

---

## What is here now

Tokens only. No components yet — they arrive with the milestones that need them, and a primitive
built before its first consumer is a guess about an API.

```text
src/tokens/
├── primitive/        Tier 1 · raw values, no meaning. Never named by apps/**
│   ├── palette.ts    6 families × 12 steps
│   └── scale.ts      space · type · radii · sizes · motion · breakpoints
├── semantic/         Tier 2 · intent. THE default tier for application code
│   ├── colour.light.ts · colour.dark.ts    same keys, different references
│   ├── space.ts      inset-* · stack-* · inline-*
│   └── misc.ts       radius · elevation · motion · typography · layers
├── component/        Tier 3 · one component's contract, plus the check-in desk
├── density/          comfortable · compact · oversized — size only
├── contrast.proof.ts the §3.6 register AS DATA. The a11y suite asserts every row
└── tokens.css        GENERATED. 530 declarations
```

---

## The three tiers, and why not two

| Tier          | May reference | May an app use it? |
| :------------ | :------------ | :----------------- |
| **Primitive** | nothing       | **Never** — `UI3`  |
| **Semantic**  | Tier 1        | **Yes** — default  |
| **Component** | Tier 2        | Yes, by its owner  |

Two tiers is the common shortcut and it breaks at exactly the point this product reaches: the
third surface. With semantic tokens alone, _"the dashboard table row is denser than the customer
card"_ becomes a per-component override, and after four sprints there are eleven row heights.
Component tokens make density a **remap**, not an override.

The reverse failure is quieter and worse. `text-indigo-600` in a feature file compiles, renders
correctly, and silently opts that one element out of dark mode, out of the contrast proof, and out
of any future palette change. The Tailwind preset never emits primitive class names, so that class
**does not exist** — which is stronger than forbidding it.

---

## Working on tokens

```bash
pnpm --filter @gymmap/ui tokens:build    # regenerate tokens.css from the TypeScript sources
pnpm --filter @gymmap/ui tokens:check    # fail if the committed CSS has drifted
pnpm --filter @gymmap/ui test:a11y       # assert all 60 contrast pairings
```

Every token exists twice — once as TypeScript so the Tailwind preset, the density remap and the
contrast proof can read it, and once as CSS so the browser can. `tokens.css` is **generated**;
a hand-edit is drift, and `tokens:check` is what turns that drift into a CI failure rather than a
component mysteriously keeping its old colour.

---

## What may not be added

| Rule                                | Consequence                                                                                                                                                                                                                                                |
| :---------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| No API call, no TanStack Query hook | A component that fetches cannot be reused across three surfaces with different auth models.                                                                                                                                                                |
| No domain component                 | `<MembershipCard/>`, `<SettlementStatement/>` and `<CheckInDeskScanner/>` live in the consuming app's feature folder (constitution §3.5.2).                                                                                                                |
| No formatting logic                 | `MoneyDisplay` receives `"₹2,50,000"`. The Indian grouping is computed by `@gymmap/utils`. A second implementation here would diverge from the PDF renderer, which is not React — and `LAUNCH_MARKET_INDIA.md` §2 names divergent grouping a trust defect. |
| No import of `@gymmap/utils`        | **R3**, enforced by `no-ui-to-utils` in dependency-cruiser.                                                                                                                                                                                                |
| Tokens are values, not decisions    | A component never hard-codes `#0F766E`. `size-limit` and the a11y suite both assume tokens are the only palette.                                                                                                                                           |

---

## Three things worth knowing before you change a colour

**The brand is indigo, and that is a safety decision.** `SCR-DASH-009` puts a green ALLOWED and a
red DENIED in front of a receptionist a few hundred times a day. A green brand would put every
primary button and focus ring in the same perceptual neighbourhood as _"this member may enter"_ —
a neighbourhood that already contains red under deuteranopia.

**`emerald-600` is not in the interactive set.** White on `#059669` is 3.77:1, below the text
floor. `bg-emerald-600 text-white` looks correct and is not; `success-solid` maps to `700`.

**`content-muted` on `surface-sunken` is forbidden.** 4.34:1. `surface-sunken` is the dashboard
table's zebra stripe, which is exactly where a designer reaches for muted secondary text. Use
`content-tertiary` → 6.92:1. Both facts are asserted, not documented.
