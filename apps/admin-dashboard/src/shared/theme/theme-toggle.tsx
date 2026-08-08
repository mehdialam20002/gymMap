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
  try {
    if (choice === 'system') {
      localStorage.removeItem(STORAGE_KEY);
      // REMOVED, not set to a value. Any `data-theme` at all overrides the media query, so
      // writing `data-theme="system"` would leave the page stuck on the light defaults.
      root.removeAttribute('data-theme');
      return;
    }
    localStorage.setItem(STORAGE_KEY, choice);
    root.setAttribute('data-theme', choice);
  } catch {
    // The attribute still applies for this page even when the preference cannot be persisted.
    if (choice === 'system') root.removeAttribute('data-theme');
    else root.setAttribute('data-theme', choice);
  }
}

const ORDER: readonly ThemeChoice[] = ['system', 'light', 'dark'];

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

  return (
    <div
      role="group"
      aria-label={t('adm.theme.label')}
      className="flex items-center gap-inline-2xs rounded-control border border-subtle p-inset-2xs"
    >
      {ORDER.map((option) => (
        <button
          key={option}
          type="button"
          onClick={() => {
            apply(option);
            setChoice(option);
          }}
          // `aria-pressed`, not colour alone (AX2). A toggle whose only "on" signal is a tint is
          // invisible to a screen reader and to anyone who cannot separate the two shades.
          aria-pressed={choice === option}
          className={`gm-hit-target rounded-control px-inset-2xs text-xs transition-colors duration-fast ease-standard ${
            choice === option
              ? 'bg-surface-brand-subtle font-semibold text-content-brand'
              : 'text-content-muted hover:text-content'
          }`}
        >
          {t(LABEL[option])}
        </button>
      ))}
    </div>
  );
}
