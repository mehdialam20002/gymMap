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
 * │ The dark ground is applied by `:root[data-theme='dark']`, so anything that is NOT that      │
 * │ attribute is painted light - including the absent attribute, which is the state of every    │
 * │ first visit. `light` is therefore the only correct fallback.                                 │
 * │                                                                                             │
 * │ Reading `prefers-color-scheme` here would be the intuitive version and it would be a bug:   │
 * │ a reader on a dark-mode laptop would get a MOON on a page that is painted light, offering   │
 * │ to switch them to the theme they are already looking at. The control has to agree with the  │
 * │ stylesheet, and the stylesheet does not consult the OS.                                      │
 * └─────────────────────────────────────────────────────────────────────────────────────────────┘
 */
function currentTheme(): Theme {
  return document.documentElement.dataset['theme'] === 'dark' ? 'dark' : 'light';
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
     * `border-strong`, matching the location pill beside it, and not `border-subtle`. The pill
     * both of these sit on is dark in BOTH themes, so their boundary is an on-media pairing
     * rather than a page one - `border-subtle` is tuned to the page ground and disappeared into
     * the glass. Two adjacent controls with two different outlines is also how a bar stops
     * looking designed.
     *
     * 32px painted, 44px pointer target via `gm-hit-target` (`AX3` / `NFR-USE-03`).
     */
    <button
      type="button"
      onClick={choose}
      aria-label={label}
      title={label}
      data-on-media="true"
      className="gm-hit-target gm-lift inline-flex h-[2rem] w-[2rem] items-center justify-center rounded-full border border-strong text-content-on-media transition-colors duration-fast ease-standard hover:border-brand"
    >
      <Glyph aria-hidden="true" className="h-[1rem] w-[1rem]" />
    </button>
  );
}
