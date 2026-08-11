/**
 * The mark — a map pin with a barbell in it.
 *
 * ┌─ IT LIVES HERE BECAUSE THREE SURFACES WEAR IT AND ONE OF THEM WAS WEARING LETTERS ───────────┐
 * │ `customer-web` has carried this artwork since `SCR-WEB-001`, in                               │
 * │ `shared/chrome/brand-mark.tsx`, whose header states the rule this file inherits: *"Two things │
 * │ claiming to be identical is a promise a file cannot keep."*                                    │
 * │                                                                                              │
 * │ `admin-dashboard` was wearing **`GM`** — two letters in brand ink, which is the placeholder    │
 * │ every console starts with and the one nobody notices is still there. So the mark moves to      │
 * │ `packages/ui`, which `FolderStructure.md` §1.2 makes the only home for something several apps  │
 * │ render.                                                                                        │
 * │                                                                                              │
 * │ **`customer-web`'s copy is NOT yet pointed at this one, and that is a real duplicate.** Left   │
 * │ alone deliberately: a second session is editing that app right now, and a refactor of its      │
 * │ chrome to satisfy a logo change is how two sessions produce a conflict in a file neither       │
 * │ needed to touch. Recorded rather than done — the next change to `customer-web`'s header should  │
 * │ delete that file and import this.                                                              │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 *
 * ┌─ THREE LITERAL COLOURS, AND THEY ARE CORRECT HERE ──────────────────────────────────────────┐
 * │ Everywhere else a colour is a token, because the surface under it flips with the theme. A     │
 * │ logo does not flip: it is the same artwork on a light tab strip, a dark page, a printed page   │
 * │ and somebody else's slide, and a mark that read the theme would be a different mark in each.   │
 * │ Same reasoning that makes the mask stencils in `globals.css` legitimate rather than an         │
 * │ oversight.                                                                                     │
 * │                                                                                              │
 * │ Which is also why this component is exempt from the *"no hand-rolled SVG"* tell: that rule is  │
 * │ about icon SETS, where a hand-drawn glyph beside a library's glyph is visibly homemade. A      │
 * │ brand mark has nothing to be inconsistent with.                                                │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 *
 * `aria-hidden` is not a prop. Every call site renders the wordmark beside it, so the accessible
 * name is already there in text, and a screen reader announcing the brand twice is worse than not
 * announcing a picture at all. Making it optional would only create the chance to get it wrong.
 */

export function BrandMark({ className }: { readonly className: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 100 100" className={className}>
      <path
        d="M50 10 C33.4 10 20 23.4 20 40 C20 62.5 50 90 50 90 C50 90 80 62.5 80 40 C80 23.4 66.6 10 50 10 Z"
        fill="#10b981"
      />
      <circle cx="50" cy="40" r="18" fill="#0f172a" />
      <rect x="38" y="38" width="24" height="4" fill="#ffffff" />
      <rect x="34" y="33" width="6" height="14" rx="1" fill="#ffffff" />
      <rect x="60" y="33" width="6" height="14" rx="1" fill="#ffffff" />
    </svg>
  );
}
