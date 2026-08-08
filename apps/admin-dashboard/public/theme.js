/*
 * The no-flash theme bootstrap — DesignSystem.md §9.2 DM1, DM2.
 *
 * A STATIC FILE, not an inline <script>, and that is the whole reason it exists separately.
 *
 * Security.md §11.5 gives the admin surface `script-src 'self'` with NO nonce and NO
 * unsafe-inline, because a Vite production build emits only external hashed files. The asymmetry
 * is deliberate: the surface with more authority gets the tighter policy. An inline script in
 * index.html would have forced either a nonce (which a static SPA build cannot generate per
 * response) or unsafe-inline (which would hand every XSS a script tag).
 *
 * Served from public/ at /theme.js, so it is same-origin and blocking — it runs before first
 * paint, which a `type="module"` script would not.
 *
 * DM1 — the OS preference is the DEFAULT and an explicit choice is the OVERRIDE, and the override
 * wins in BOTH directions. Setting the attribute only for 'dark' would strand a user who chose
 * light on a dark-mode OS, which is the half of this bug that is usually missed.
 *
 * try/catch because localStorage throws in Safari private mode and inside a sandboxed iframe. A
 * wrong theme for one paint is survivable; an exception that aborts the head is not.
 */
/*
 * THIS SURFACE DEFAULTS TO DARK, which is a deliberate departure from DM1's "follow the OS".
 *
 * §6.C permits it: "Respect prefers-color-scheme. Default to system preference UNLESS the brand
 * insists on one mode." The admin console is the brand's own tool, used for hours at a time by a
 * handful of trained operators, and it is the surface the product owner specified in dark.
 * customer-web is unchanged and still follows the OS, because a member arriving from a search
 * result has made no choice about this product at all.
 *
 * The OVERRIDE still wins in both directions, which is the half of DM1 that actually matters: an
 * operator who picks Light gets Light on a dark-mode OS, and one who picks Auto gets their OS
 * back. Only the no-preference case changed.
 */
try {
  var t = localStorage.getItem('gm-theme');
  if (t === 'dark' || t === 'light') {
    document.documentElement.setAttribute('data-theme', t);
  } else if (t === 'system') {
    /* An explicit "follow my OS". The attribute stays off so the @media query decides. */
  } else {
    document.documentElement.setAttribute('data-theme', 'dark');
  }
} catch (e) {
  /* Unreadable preference. Still dark, so the surface looks the same as it does for everyone. */
  document.documentElement.setAttribute('data-theme', 'dark');
}
