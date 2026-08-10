'use client';

/**
 * The theme switch — `DesignSystem.md` §9.2 `DM1`-`DM4`.
 *
 * ┌─ IT IS A BUTTON, NOT A SWITCH, AND IT SAYS WHAT IT WILL DO ─────────────────────────────────┐
 * │ The obvious build is `role="switch"` with `aria-checked`. It is wrong here. A switch         │
 * │ announces a STATE - "dark mode, on" - and leaves the reader to work out that turning it off  │
 * │ means light. A button announces an ACTION, and the action is the only thing anyone wants:    │
 * │ "switch to the light theme". `aria-pressed` has the same problem as `aria-checked`.          │
 * │                                                                                              │
 * │ So: a plain button whose accessible name is the destination, and whose icon matches. The     │
 * │ name changes when the theme changes, which is exactly the announcement a screen-reader user  │
 * │ needs and which a static "toggle theme" label never gives them.                               │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 *
 * ┌─ WHY THIS IS A CLIENT ISLAND WHEN ALMOST NOTHING ELSE HERE IS ──────────────────────────────┐
 * │ `FR-SRCH-13` keeps the marketing surface server-rendered, and the rule has teeth: the hero,  │
 * │ the sections and the results are all server components. This one cannot be. The preference   │
 * │ lives in `localStorage` and on the DOM element, both of which exist only in a browser, and   │
 * │ the control has to reflect the value the pre-paint script already applied.                    │
 * │                                                                                              │
 * │ It is kept to exactly that: no context, no provider, no store. The state of record is the    │
 * │ `data-theme` attribute on `<html>`, which the inline script in `layout.tsx` sets before the  │
 * │ first paint. This component READS that attribute on mount and writes it on click. Two other  │
 * │ implementations of the same fact would be two chances to disagree with each other.            │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 */

import { useEffect, useState } from 'react';

import { t } from '../i18n/index.ts';
import { icon } from '../icons/index.tsx';
import { THEME_STORAGE_KEY } from './theme-script.ts';

type Theme = 'light' | 'dark';

/**
 * What the page is showing right now, read from the element the bootstrap script writes.
 *
 * ┌─ THE FALLBACK HAS TO MIRROR THE STYLESHEET'S SELECTOR, NOT THE OS ─────────────────────────┐
 * │ The customer site's dark palette is applied by `:root:not([data-theme='light'])`, which     │
 * │ matches an element with NO attribute - so the absent case, which is every first visit, is   │
 * │ DARK. `light` is therefore only correct when the attribute says so.                          │
 * │                                                                                             │
 * │ This read `=== 'dark' ? 'dark' : 'light'` while the stylesheet said the opposite, and the   │
 * │ two disagreed on exactly one state: the first visit. The header showed a moon and announced │
 * │ "switch to the dark theme" on a page that was already dark, and the click set               │
 * │ `data-theme="dark"` - which the palette block was already matching, so nothing changed. The │
 * │ control appeared broken, and only the second click reached light.                            │
 * │                                                                                             │
 * │ Reading `prefers-color-scheme` here would be the intuitive version and would be a different │
 * │ bug: the stylesheet does not consult the OS, so the control must not either.                 │
 * └─────────────────────────────────────────────────────────────────────────────────────────────┘
 */
function currentTheme(): Theme {
  return document.documentElement.dataset['theme'] === 'light' ? 'light' : 'dark';
}

export function ThemeToggle() {
  /*
   * `null` until mounted, and the button renders its markup either way.
   *
   * The server cannot know the theme, so any initial guess is wrong half the time and React would
   * swap the icon on hydration - a visible flicker in the chrome on every page load. Rendering the
   * control with no icon and no name until the effect runs would be worse: the button would be
   * briefly unlabelled for a screen reader. So the markup is stable and only the two attributes
   * that depend on the theme wait, which is one paint and no layout shift.
   */
  const [theme, setTheme] = useState<Theme | null>(null);

  useEffect(() => {
    setTheme(currentTheme());
  }, []);

  function choose() {
    const next: Theme = currentTheme() === 'light' ? 'dark' : 'light';
    document.documentElement.dataset['theme'] = next;
    setTheme(next);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // `DM4` - Safari private mode and sandboxed iframes throw here. The theme still changed for
      // this page; only the memory of it is lost, and that is not worth breaking the click over.
    }
  }

  /*
   * Before mount the destination is unknown, so the label names the CONTROL. After mount it names
   * where the click goes, which is the only thing a reader wants announced - and it changes when
   * the theme changes, which is the announcement a static "toggle theme" never gives them.
   */
  const label =
    theme === null
      ? t('web.chrome.theme.toggle')
      : t(theme === 'light' ? 'web.chrome.theme.toDark' : 'web.chrome.theme.toLight');

  // The glyph shows the DESTINATION too, so it agrees with the label rather than contradicting it.
  const Glyph = theme === 'light' ? icon.themeDark : icon.themeLight;

  return (
    /*
     * `border-strong`, matching the location pill beside it and not `border-subtle`, which is
     * tuned to the page ground and disappears into the glass. Two adjacent controls wearing two
     * different outlines is also how a bar stops looking designed.
     *
     * The note that used to sit here said the pill was "dark in BOTH themes". That was true of
     * the old chrome and is the premise the bug below rests on - it is not true of
     * `.gm-chrome-glass`, which tints with `surface-default`.
     *
     * 32px painted, 44px pointer target via `gm-hit-target` (`AX3` / `NFR-USE-03`).
     */
    /*
     * `text-content`, NOT `text-content-on-media`.
     *
     * ┌─ THE ROLE WAS RIGHT UNTIL THE PANEL UNDER IT LEARNED TO FLIP ──────────────────────────┐
     * │ `content-on-media` is pinned near-white in BOTH themes, because it is the ink for       │
     * │ things that sit on a photograph. This control sits on `.gm-chrome-glass`, which tints   │
     * │ with `surface-default` - so in the light theme the pill is white and the glyph was      │
     * │ `#f4f5f2` on it: 1.05:1, measured, which is not "hard to see" but gone. The button was  │
     * │ still there, still 32px, still focusable and still announced; only the picture of it    │
     * │ was missing, which is why nothing failed.                                               │
     * │                                                                                        │
     * │ `content-primary` is what the pane itself sets as its `color`, so the control now takes │
     * │ its ink from the same place as the ground it prints on and cannot drift from it again.  │
     * │                                                                                        │
     * │ `data-on-media` went with it: that attribute paints the FOCUS RING in the same pinned   │
     * │ near-white, so keyboard focus was invisible on the light pill for the same reason.      │
     * └────────────────────────────────────────────────────────────────────────────────────────┘
     */
    <button
      type="button"
      onClick={choose}
      aria-label={label}
      title={label}
      className="gm-lift inline-flex h-[2.75rem] w-[2.75rem] items-center justify-center rounded-full border border-strong text-content transition-colors duration-fast ease-standard hover:border-brand"
    >
      <Glyph aria-hidden="true" className="h-[1rem] w-[1rem]" />
    </button>
  );
}
