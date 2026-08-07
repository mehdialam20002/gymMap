/**
 * String resolution — `NFR-USE-08`, `I18N1`.
 *
 * Deliberately the smallest thing that satisfies the requirement. A full i18n runtime
 * (`next-intl`, `i18next`) is an unapproved dependency and would be premature: `A4.2` defers
 * multi-language UI, and what `NFR-USE-08` actually requires now is that no component contains a
 * user-facing literal. That is a lookup, not a library.
 *
 * The seam is real, though — `t()` is the only way a string reaches a component, so introducing
 * a locale later changes this file and nothing else. That is the difference between a stub and a
 * placeholder.
 */

import { en, type MessageKey } from './messages/en.ts';

/** `ASM-07` — one launch language. The list exists so adding a second is an edit, not a rewrite. */
export const LOCALES = ['en'] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = 'en';

const catalogues: Record<Locale, Record<MessageKey, string>> = { en };

/**
 * Resolves a key.
 *
 * The key type is the union of what exists, so a typo is a compile error rather than a key
 * rendered on screen. The runtime fallback still returns the key — a missing string must be
 * visible in the UI as `web.home.hero.title`, not as an empty element that looks like a layout
 * bug and gets "fixed" with a hard-coded literal.
 */
export function t(key: MessageKey, locale: Locale = DEFAULT_LOCALE): string {
  return catalogues[locale][key] ?? key;
}

export type { MessageKey };
