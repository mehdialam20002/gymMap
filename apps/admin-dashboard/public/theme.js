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
try {
  var t = localStorage.getItem('gm-theme');
  if (t === 'dark' || t === 'light') document.documentElement.setAttribute('data-theme', t);
} catch (e) {
  /* no preference readable; the @media default applies */
}
