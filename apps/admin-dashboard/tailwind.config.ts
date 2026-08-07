/**
 * `DesignSystem.md` §2.4 `TK2` — `presets` and `content`, and NOTHING else.
 *
 * An app that adds a `theme` key fails review: tokens are defined once (`UI2`). Identical to
 * customer-web's, and that identity is the point — three surfaces, one theme.
 */
import type { Config } from 'tailwindcss';
import preset from '@gymmap/config/tailwind/preset';

export default {
  presets: [preset],
  // packages/ui is compiled from source, so its class names must be scanned here too — otherwise
  // every utility a shared component uses is purged from the build.
  content: ['./index.html', './src/**/*.{ts,tsx}', '../../packages/ui/src/**/*.{ts,tsx}'],
} satisfies Config;
