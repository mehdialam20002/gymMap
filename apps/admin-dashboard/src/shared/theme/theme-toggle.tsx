/**
 * The theme toggle — `DesignSystem.md` §9.2, `DM1`, `DM2`.
 *
 * ┌─ THREE STATES, NOT TWO ─────────────────────────────────────────────────────────────────────┐
 * │ `system` is a real state and it is the default. A two-state toggle silently converts every  │
 * │ visitor into an explicit choice on first click, and they can never get back to "follow my   │
 * │ OS" without clearing site data.                                                              │
 * │                                                                                              │
 * │ `DM1` is the rule the pre-paint script already implements: an explicit preference wins in    │
 * │ BOTH directions. The half usually missed is a user who chose LIGHT on a dark-mode OS — a     │
 * │ toggle that only ever writes `dark` strands them behind the `@media` query.                  │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 *
 * The attribute is written by `public/theme.js` before first paint so there is no flash; this
 * component writes the SAME attribute and the SAME key at runtime. Two writers, one contract —
 * the key lives in one place below so they cannot drift.
 */

import { useEffect, useState } from 'react';

import { t } from '../i18n/index.ts';

/** Must match `public/theme.js`. */
const STORAGE_KEY = 'gm-theme';

export type ThemeChoice = 'light' | 'dark' | 'system';

function read(): ThemeChoice {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === 'dark' || stored === 'light' ? stored : 'system';
  } catch {
    // Throws in Safari private mode and inside a sandboxed iframe. Following the OS is the
    // correct fallback, and it is what the pre-paint script already did.
    return 'system';
  }
}

function apply(choice: ThemeChoice): void {
  const root = document.documentElement;

  // The ATTRIBUTE is removed for `system` and set otherwise. Any `data-theme` at all overrides
  // the media query, so writing `data-theme="system"` would pin the page instead of freeing it.
  if (choice === 'system') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', choice);

  try {
    // The KEY is WRITTEN for `system`, not removed — and that asymmetry is load-bearing.
    //
    // This surface defaults to dark (see `public/theme.js`). If choosing Auto deleted the key,
    // the next page load would be indistinguishable from a first visit and the bootstrap would
    // put dark back. Storing the word is what lets "I never chose" and "I chose to follow my OS"
    // be different states.
    localStorage.setItem(STORAGE_KEY, choice);
  } catch {
    // Safari private mode, or a sandboxed iframe. The attribute above still governs this page;
    // only persistence across reloads is lost.
  }
}

/**
 * The cycle, and it is deliberately in this order.
 *
 * +- WHY A SINGLE CYCLING BUTTON REPLACED A THREE-SEGMENT CONTROL -----------------------------+
 * | The old control put the words "Auto Light Dark" in the topbar - three tap targets and       |
 * | eleven characters, permanently, for something a person changes about twice. It also read as  |
 * | a filter, because that is what a segmented control means everywhere else in this console.    |
 * |                                                                                          |
 * | One round icon button now cycles system -> light -> dark -> system. It shows the CURRENT     |
 * | state's glyph, because a button that previews the next state is unreadable when you arrive   |
 * | at the page cold: you cannot tell whether the moon means "it is dark" or "make it dark".     |
 * |                                                                                          |
 * | Three states still, not two. `system` is the default and a two-state toggle converts every   |
 * | visitor into an explicit choice on first click with no way back to "follow my OS".           |
 * +-------------------------------------------------------------------------------------------+
 */
const NEXT: Record<ThemeChoice, ThemeChoice> = {
  system: 'light',
  light: 'dark',
  dark: 'system',
};

const LABEL: Record<ThemeChoice, Parameters<typeof t>[0]> = {
  system: 'adm.theme.system',
  light: 'adm.theme.light',
  dark: 'adm.theme.dark',
};

export function ThemeToggle() {
  const [choice, setChoice] = useState<ThemeChoice>('system');

  // Read AFTER mount. Reading during render would differ from what the pre-paint script already
  // put on the element, and the first paint would disagree with the control describing it.
  useEffect(() => {
    setChoice(read());
  }, []);

  const next = NEXT[choice];

  return (
    <button
      type="button"
      onClick={() => {
        apply(next);
        setChoice(next);
      }}
      /*
       * The accessible name carries BOTH states, which is the whole reason an icon-only control is
       * acceptable here: "Theme: dark. Switch to auto." A bare "Toggle theme" would tell a screen
       * reader user what the button does and never what the theme currently IS - and with three
       * states they cannot infer it from one press.
       */
      aria-label={`${t('adm.theme.label')}: ${t(LABEL[choice])}. ${t('adm.theme.switchTo')} ${t(
        LABEL[next],
      )}.`}
      title={`${t(LABEL[choice])} \u2192 ${t(LABEL[next])}`}
      className="gm-hit-target grid h-[2.25rem] w-[2.25rem] shrink-0 place-items-center rounded-full border border-subtle bg-surface text-content-secondary transition-colors duration-fast ease-standard hover:border-strong hover:text-content"
    >
      <ThemeGlyph choice={choice} />
    </button>
  );
}

/**
 * A moon for dark, a sun for light, and a half-filled circle for auto.
 *
 * Inline SVG rather than a Phosphor import: these three are the only glyphs in the app that need
 * to be legible at 16px inside a 36px circle, and the `auto` state has no Phosphor equivalent that
 * reads as "follow the system" rather than as "half brightness".
 */
function ThemeGlyph({ choice }: { readonly choice: ThemeChoice }) {
  if (choice === 'dark') {
    return (
      <svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true" fill="currentColor">
        <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" />
      </svg>
    );
  }

  if (choice === 'light') {
    return (
      <svg
        viewBox="0 0 24 24"
        width="17"
        height="17"
        aria-hidden="true"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      >
        <circle cx="12" cy="12" r="4" fill="currentColor" stroke="none" />
        <path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5 19 19M19 5l-1.5 1.5M6.5 17.5 5 19" />
      </svg>
    );
  }

  // `system` — a circle split down the middle. Half light, half dark, which is the state.
  return (
    <svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true">
      <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="2" />
      <path d="M12 3a9 9 0 0 0 0 18Z" fill="currentColor" />
    </svg>
  );
}
