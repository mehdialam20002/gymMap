/**
 * The no-flash theme bootstrap — `DesignSystem.md` §9.2 `DM1`, `DM2`.
 *
 * ┌─ THIS RUNS BEFORE FIRST PAINT AND MUST NOT DEPEND ON ANY REACT BUNDLE ──────────────────────┐
 * │ `DM2`. If the theme were applied by a `useEffect`, the browser would paint the default       │
 * │ theme, hydrate, and then repaint — the flash of the wrong theme that every dark-mode site    │
 * │ gets wrong at least once. On a server-rendered page it is worse, because the server has no   │
 * │ way to know the preference and the flash is guaranteed rather than occasional.               │
 * │                                                                                              │
 * │ So this is a string, injected into <head> as an inline script that runs synchronously. It    │
 * │ carries the CSP nonce (§11.3) — `script-src` admits `'nonce-…' 'strict-dynamic'` and no      │
 * │ `'unsafe-inline'`, so an un-nonced inline script simply does not execute.                     │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 *
 * `DM1` — the OS preference is the DEFAULT and an explicit choice is the OVERRIDE, and the
 * override wins in both directions. Setting `data-theme` only when the stored value is 'dark'
 * would strand a user who chose light on a dark-mode OS, which is the more common half of the
 * bug and the half usually missed.
 *
 * `DM4` — `localStorage` is the pre-paint cache, not the record. The preference is persisted
 * server-side alongside the user's other settings (`SCR-WEB-014`) so it survives a device change;
 * this only avoids the flash before that value has loaded.
 */

/** The key this and the server-side preference sync agree on. */
export const THEME_STORAGE_KEY = 'gm-theme';

/**
 * Minified by hand rather than by a build step: it is inlined into the document head, so every
 * byte is render-blocking, and a build step that could fail would take the theme with it.
 *
 * Wrapped in try/catch because `localStorage` throws in Safari private mode and inside a
 * sandboxed iframe. An exception here would abort the rest of the inline script; a wrong theme
 * for one paint is survivable, a broken head is not.
 */
export const themeScript = `
try{var t=localStorage.getItem('${THEME_STORAGE_KEY}');
if(t==='dark'||t==='light'){document.documentElement.setAttribute('data-theme',t)}}catch(e){}
`.trim();
