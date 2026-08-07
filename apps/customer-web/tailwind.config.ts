/**
 * `DesignSystem.md` §2.4 `TK2` — `presets` and `content`, and NOTHING else.
 *
 * An app that adds a `theme` key fails review: tokens are defined once (`UI2`). There is no
 * `extend` here and there must never be one — the moment an app can extend the theme, three
 * surfaces have three palettes and the contrast register in `packages/ui` stops describing what
 * ships.
 */
import type { Config } from 'tailwindcss';
import preset from '@gymmap/config/tailwind/preset';

export default {
  presets: [preset],
  // packages/ui is compiled from source (transpilePackages below), so its class names must be
  // scanned here too — otherwise every utility a shared component uses is purged from the build.
  content: ['./app/**/*.{ts,tsx}', './src/**/*.{ts,tsx}', '../../packages/ui/src/**/*.{ts,tsx}'],
} satisfies Config;
