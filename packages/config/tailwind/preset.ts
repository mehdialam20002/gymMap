/**
 * The single import every app uses — `DesignSystem.md` §2.4.
 *
 * A re-export so an app's `tailwind.config.ts` names ONE thing. Without it each app imports
 * `@gymmap/ui/tailwind-preset` directly, and the day the preset moves or gains a second half
 * (a plugin, a content glob) three configs have to change in step — which is the shape of change
 * where one gets missed.
 *
 * `TK2` — an app declares `presets: [preset]` and `content`, and nothing else. An app that adds a
 * `theme` key fails review: tokens are defined once (`UI2`).
 */

export { preset as default, preset } from '@gymmap/ui/tailwind-preset';
