/**
 * String resolution — `NFR-USE-08`, `I18N1`.
 *
 * Structurally identical to `customer-web`'s, and separate on purpose. The CATALOGUES must not be
 * shared (the two surfaces address different people in different registers), and a shared
 * RESOLVER would be twelve lines in `packages/ui` that `R3` forbids anyway — it is not
 * presentation, and `packages/ui` may hold no logic.
 *
 * When `A4.2`'s multi-language UI arrives, this is the file that grows a locale negotiator. Until
 * then it is a lookup, and a full i18n runtime would be an unapproved dependency solving a
 * problem nobody has yet.
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
 * visible as `adm.gate.mfa.title`, not as an empty element that looks like a layout bug and gets
 * "fixed" with a hard-coded literal.
 */
export function t(key: MessageKey, locale: Locale = DEFAULT_LOCALE): string {
  return catalogues[locale][key] ?? key;
}

export type { MessageKey };
