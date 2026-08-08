/**
 * The icon vocabulary — `A-40`, `DesignSystem.md` §8.
 *
 * ┌─ PER-ICON IMPORTS, NEVER THE BARREL ────────────────────────────────────────────────────────┐
 * │ `import { House } from '@phosphor-icons/react'` pulls the barrel, and the barrel is every    │
 * │ glyph Phosphor ships — over a megabyte before tree-shaking gets a chance, and tree-shaking   │
 * │ across a barrel that large is exactly where bundlers give up. `/dist/ssr/House` is the one   │
 * │ icon.                                                                                        │
 * │                                                                                              │
 * │ This is the sort of thing that is invisible until `size-limit` (A-29) fails, at which point  │
 * │ the diff that caused it is six commits back.                                                 │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 *
 * ┌─ ONE MAP, SO A GLYPH IS A DECISION RATHER THAN A HABIT ─────────────────────────────────────┐
 * │ Components name a CONCEPT (`approvals`, `settlements`), not a glyph. Two screens that both  │
 * │ mean "settlement" then cannot drift to two different icons, and changing the vocabulary is  │
 * │ an edit here instead of a search across the app.                                             │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 *
 * Every icon is `aria-hidden`. They sit beside a text label in all three places they are used —
 * nav, tiles, alerts — so announcing them would read the same word twice, and an icon that is
 * the ONLY label is a bug this file cannot prevent but should not encourage.
 */

import { ArrowsClockwise } from '@phosphor-icons/react/dist/ssr/ArrowsClockwise';
import { Bank } from '@phosphor-icons/react/dist/ssr/Bank';
import { Barbell } from '@phosphor-icons/react/dist/ssr/Barbell';
import { ChartLine } from '@phosphor-icons/react/dist/ssr/ChartLine';
import { CheckCircle } from '@phosphor-icons/react/dist/ssr/CheckCircle';
import { ClipboardText } from '@phosphor-icons/react/dist/ssr/ClipboardText';
import { Devices } from '@phosphor-icons/react/dist/ssr/Devices';
import { FileText } from '@phosphor-icons/react/dist/ssr/FileText';
import { Flag } from '@phosphor-icons/react/dist/ssr/Flag';
import { Gauge } from '@phosphor-icons/react/dist/ssr/Gauge';
import { Info } from '@phosphor-icons/react/dist/ssr/Info';
import { Lifebuoy } from '@phosphor-icons/react/dist/ssr/Lifebuoy';
import { Receipt } from '@phosphor-icons/react/dist/ssr/Receipt';
import { ScrollIcon } from '@phosphor-icons/react/dist/ssr/Scroll';
import { Scales } from '@phosphor-icons/react/dist/ssr/Scales';
import { Tag } from '@phosphor-icons/react/dist/ssr/Tag';
import { Users } from '@phosphor-icons/react/dist/ssr/Users';
import { Warning } from '@phosphor-icons/react/dist/ssr/Warning';
import { Percent } from '@phosphor-icons/react/dist/ssr/Percent';
import { CreditCard } from '@phosphor-icons/react/dist/ssr/CreditCard';
import { Invoice } from '@phosphor-icons/react/dist/ssr/Invoice';
import { IdentificationCard } from '@phosphor-icons/react/dist/ssr/IdentificationCard';
import { ToggleLeft } from '@phosphor-icons/react/dist/ssr/ToggleLeft';
import { BellSimple } from '@phosphor-icons/react/dist/ssr/BellSimple';
import { GearSix } from '@phosphor-icons/react/dist/ssr/GearSix';
import { MagnifyingGlass } from '@phosphor-icons/react/dist/ssr/MagnifyingGlass';
import type { Icon } from '@phosphor-icons/react';

import type { NavIcon } from '../../routes/nav.ts';

/**
 * Phosphor's OWN component type, not a hand-written prop interface.
 *
 * The first draft declared `ComponentType<{size, weight, className}>` and every glyph failed to
 * assign to it — the real type carries more, and a narrower local copy would have drifted the
 * first time Phosphor added a prop. Importing `Icon` costs a type-only import and nothing at
 * runtime.
 */
type Glyph = Icon;

const NAV_GLYPH: Record<NavIcon, Glyph> = {
  dashboard: Gauge,
  approvals: CheckCircle,
  application: FileText,
  gyms: Barbell,
  categories: Tag,
  accounts: Users,
  devices: Devices,
  orders: Receipt,
  settlements: Bank,
  refunds: ArrowsClockwise,
  disputes: Scales,
  reconciliation: ClipboardText,
  moderation: Flag,
  support: Lifebuoy,
  analytics: ChartLine,
  audit: ScrollIcon,
  commission: Percent,
  subscriptions: CreditCard,
  tax: Invoice,
  kyc: IdentificationCard,
  flags: ToggleLeft,
  notifications: BellSimple,
  settings: GearSix,
};

export function NavGlyph({
  icon,
  className,
}: {
  readonly icon: NavIcon;
  readonly className?: string;
}) {
  const Component = NAV_GLYPH[icon];
  return <Component size={18} weight="regular" aria-hidden className={className} />;
}

/** The topbar's two icon buttons. Separate from `NAV_GLYPH` because neither is a destination. */
const CHROME_GLYPH = {
  notifications: BellSimple,
  help: Lifebuoy,
  search: MagnifyingGlass,
} as const;

export function ChromeGlyph({
  icon,
  className,
}: {
  readonly icon: keyof typeof CHROME_GLYPH;
  readonly className?: string;
}) {
  const Component: Glyph = CHROME_GLYPH[icon];
  return <Component size={18} weight="regular" aria-hidden className={className} />;
}

/** Severity glyphs for the alert rail. Icon AND colour AND the word — never colour alone (`AX8`). */
const SEVERITY_GLYPH = {
  critical: Warning,
  serious: Warning,
  info: Info,
  good: CheckCircle,
} as const;

export function SeverityGlyph({
  severity,
  className,
}: {
  readonly severity: keyof typeof SEVERITY_GLYPH;
  readonly className?: string;
}) {
  const Component: Glyph = SEVERITY_GLYPH[severity];
  return <Component size={16} weight="fill" aria-hidden className={className} />;
}

/** Tile accents. `fill` weight, because a tile badge is a solid mark rather than a line drawing. */
const TILE_GLYPH = {
  approvals: CheckCircle,
  gyms: Barbell,
  accounts: Users,
  devices: Devices,
  revenue: Receipt,
  commission: Scales,
  memberships: Users,
  support: Lifebuoy,
  refunds: ArrowsClockwise,
} as const;

export type TileIcon = keyof typeof TILE_GLYPH;

export function TileGlyph({
  icon,
  className,
}: {
  readonly icon: TileIcon;
  readonly className?: string;
}) {
  const Component: Glyph = TILE_GLYPH[icon];
  return <Component size={18} weight="fill" aria-hidden className={className} />;
}
