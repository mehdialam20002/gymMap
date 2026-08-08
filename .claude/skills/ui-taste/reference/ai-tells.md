# AI tells

Condensed from [leonxlnx/taste-skill](https://github.com/leonxlnx/taste-skill) §9 (MIT), with the
items that do not apply to this repository removed and a few added from our own review history.

These are the signatures a model produces when it tries to "look designed". They are banned by
default. Each can be overridden by an explicit brief, but the override has to be explicit.

---

## Visual and CSS

- **No neon or outer glows.** Inner borders or subtle tinted shadows instead.
- **No pure black `#000000`.** Off-black. The dark tokens already handle this.
- **No oversaturated accents.** Desaturate so they sit with the neutrals.
- **No gradient text on large headings.**
- **No custom mouse cursors.** Outdated, accessibility-hostile, slow.
- **One accent colour** used identically across every section.
- **One corner-radius system.** Not `rounded-xl` here and `rounded-sm` there.
- **One theme per page.** No section flipping to inverted mode mid-page.

## Typography

- **Avoid Inter as a default choice.** It is the house font of AI output.
- **No oversized H1 that just shouts.** Control hierarchy with weight and colour, not raw scale.
- **Serif for editorial and luxury only.** Never on a dashboard.
- **Italic descender clearance.** Any italic word containing `y g j p q` needs leading and bottom
  padding reserved, or the tails clip.

## Layout and spacing

- **No three identical horizontal feature cards.** The generic three-up feature row. Use a two-column
  zig-zag, an asymmetric grid, or a horizontal scroller.
- **No `border-t` and `border-b` on every row** of a long list. Pick one, use it sparingly.
- **No crosshair or hairline grid lines as decoration.** Only when they organise real content.
- **No floating top-right sub-text** in a section heading. Either under the headline, or a clean
  two-column header.
- **No vertical rotated text.** Agency-portfolio cliché.
- **Mathematically consistent padding.** No floating elements with awkward gaps.
- **Cards omitted in favour of spacing** where spacing will do the job.

## Content and data — the "Jane Doe" effect

- **No generic names.** "John Doe", "Sarah Chan". Use realistic, locale-appropriate names. In this
  product that means Indian names, cities and localities.
- **No generic avatars.** No SVG egg, no user-icon placeholder.
- **No fake-perfect numbers.** `99.99%`, `50%`, `1234567`. Real numbers are uneven.
- **No startup-slop brand names.** "Acme", "Nexus", "SmartFlow", "Cloudly".
- **No filler verbs.** "Elevate", "Seamless", "Unleash", "Next-Gen", "Revolutionize".
- **No div-based fake screenshots.** Never build a fake product UI out of styled divs. This is the
  single most recognisable tell.
- **No fake version stamps.** `v0.6.2-rc.1`, `Build 0048`, `last sync 4s ago`.

> **In this repository this rule is stronger than upstream's.** On any dashboard, a number is bound
> to a live endpoint or it is absent. A `0` meaning "not built" and a `0` meaning "nothing to do
> today" look identical, and only one of them needs an operator. Fixture data is permitted only
> where it is labelled on screen, as the customer-web gym catalogue is.

## Labels, eyebrows and micro-copy

- **No section-number eyebrows.** `00 / INDEX`, `001 · Capabilities`, `06 · how it works`.
- **No generic step labels.** "Stage 1 / Stage 2", "Phase 01 / Phase 02". The step content is the
  label.
- **No version labels in a hero.** `V0.6`, `BETA`, `EARLY ACCESS` — unless the brief is a launch.
- **No micro-meta-sentences** under an eyebrow. Eyebrow, headline, body is enough.
- **Eyebrow budget.** At most one uppercase micro-label per three sections.
- **The middle dot `·` is rationed.** One per line at most. Not the default separator for everything.
- **No poetic section labels.** "From the field", "Field notes", "On our desks".
- **No "Quietly trusted by"** social proof. Say "Trusted by", or let the logos speak.

## Decoration

- **Zero decorative status dots.** A coloured dot before every nav item or list row is a tell. Only
  for real semantic state, and then sparingly.

  > Live dependency status from `/readyz` is real state and qualifies. A dot for something with no
  > probe behind it is worse than a tell: it is a green light nobody is checking.

- **No scroll cues.** `Scroll`, `↓ scroll`, animated mouse-wheel icons. If they have not scrolled
  yet, they are looking at the hero.
- **No locale, time or weather strips.** `Bengaluru 14:23 · 28°C`.
- **No decoration text strip at the hero bottom.** `BRAND. MOTION. SPATIAL.`
- **No pills or tags overlaid on images.** Caption below the image, outside it, or nothing.
- **No photo-credit captions as decoration.** Only credit a real photographer for a real photo.
- **No progress bars with filled background tracks** used as comparison visuals.

## Punctuation

- **No em-dash `—` or en-dash `–` in rendered UI text.** Upstream calls this the single
  most-violated tell and bans it outright. Here it applies to the message catalogues and anything a
  member or operator reads. Use `-`, a comma, a colon, or two sentences.
- Source comments, commit messages and `docs/` are exempt. See `SKILL.md` §5.1 for why.

## Motion

- **No animation without a one-sentence reason.** Hierarchy, feedback, state transition, origin.
- **No animation on a data path** (`MO3`). No counting-up numbers, ever. A counting animation makes
  a stale figure look live.
- **No scroll-hijack.** Breaks keyboard navigation, and it is the most disliked pattern on the web.
- **No `window.addEventListener('scroll')`.** IntersectionObserver or CSS scroll-driven animation.
- **No marquee.** If one is truly justified, one per page maximum.
- **Nothing animated except `transform` and `opacity`** (`MO4`).

## Icons and images

- **No hand-rolled SVG icon paths.** Upstream recommends Phosphor, Radix or Tabler. **None is
  approved in `STACK_ADDITIONS.md` yet**, so adopting one needs an `A-NN` row and the owner's
  approval first.
- **No hand-rolled decorative SVG** as a default flourish.
- **No broken image links.** Use a real asset, or a seeded placeholder.

## Hero and navigation — `customer-web` only

- Headline at most two lines. Sub-text at most 20 words and four lines. CTA visible without
  scrolling.
- At most four text elements in the hero.
- Navigation on one line at desktop, at most 80px tall.
- No two CTAs with the same intent. "Get in touch" plus "Let's talk" is a fail.
- A logo wall sits under the hero, not inside it, and carries logos only — no category labels.

## Structure

- **No two adjacent sections sharing a layout family.** Across eight sections, at least four
  different families.
- **No three consecutive image-plus-text splits** in the same direction.
- **Bento grids** need real visual variation in two or three cells, and exactly as many cells as
  items — no empty trailing cell.
- **Viewport stability.** `min-h-[100dvh]`, never `h-screen`.
- **Empty, loading and error states** exist for every data-backed view.
