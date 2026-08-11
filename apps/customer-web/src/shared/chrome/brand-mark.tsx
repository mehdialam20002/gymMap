/**
 * The mark — a map pin with a barbell in it.
 *
 * ┌─ WHY THIS IS A COMPONENT AND WHY THERE IS STILL ONE COPY OF IT ─────────────────────────────┐
 * │ The header and the footer both wear it, and they used to wear it as a letter in a filled     │
 * │ circle, written out twice with a comment on each saying "the two are deliberately identical".│
 * │ Two things claiming to be identical is a promise a file cannot keep; this is the same         │
 * │ promise kept by construction.                                                                │
 * │                                                                                              │
 * │ `app/icon.svg` is the exception and cannot be fixed. It is served as a STATIC ASSET - Next   │
 * │ reads the file and emits the `<link rel="icon">` itself - so it cannot import anything. The  │
 * │ artwork is duplicated there, and the comment in that file says so, because a favicon that     │
 * │ silently disagrees with the logo is the kind of thing nobody notices for a year.              │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 *
 * ┌─ THREE LITERAL COLOURS, AND THEY ARE CORRECT HERE ──────────────────────────────────────────┐
 * │ Everywhere else in this app a colour is a token, because the surface under it flips with the │
 * │ theme. A logo does not flip: it is the same artwork on a light tab strip, a dark page, a      │
 * │ printed page and somebody else's slide, and a mark that read the theme would be a different  │
 * │ mark in each of them. Same reasoning that makes the four `#000` mask stencils in             │
 * │ `globals.css` legitimate rather than an oversight.                                            │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 *
 * `aria-hidden` is not a prop. Both call sites render the wordmark beside it, so the accessible
 * name is already there in text — and a screen reader announcing the brand twice is worse than
 * not announcing a picture at all. Making it optional would only create the chance to get it wrong.
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
