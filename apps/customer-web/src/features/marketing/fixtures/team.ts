/**
 * An ILLUSTRATIVE team — `SCR-WEB-021`. Four people who do not exist.
 *
 * ┌─ THIS FILE IS THE ONE THING ON THE SITE THAT INVENTS A PERSON ──────────────────────────────┐
 * │ `/for-gyms` refuses to invent a partner quote, and its comment gives the reason: `BR-REV-01` │
 * │ says a review needs a recorded check-in, an owner testimonial is a review by another name,   │
 * │ and a product that fakes one after refusing the other has a marketing exception rather than  │
 * │ a rule. That reasoning has not changed and it still governs testimonials.                    │
 * │                                                                                             │
 * │ This is a different thing, and the difference is who is being spoken FOR. A fabricated       │
 * │ testimonial puts words in a customer's mouth about a product they never used - it borrows    │
 * │ someone else's credibility. A placeholder team says who is building the thing, on a site     │
 * │ that already says in three places that it is a sample. The owner asked for it explicitly,    │
 * │ for a demo, and that decision is recorded rather than assumed.                                │
 * │                                                                                             │
 * │ What is NOT allowed to slip in with it: no photographs of faces, no invented quotes, no      │
 * │ claimed years of experience, no former employers, no LinkedIn. Initials, a role and a line   │
 * │ about what that role owns. Nothing here is a claim that could be checked and found false,    │
 * │ because the moment it is checkable it is a lie rather than a placeholder.                     │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 *
 * ┌─ THE MARKER TRAVELS WITH THE CARD, NOT ONLY WITH THE PAGE ──────────────────────────────────┐
 * │ `gym-art.ts` settled this for the stock covers and the argument is identical here: "a        │
 * │ screenshot of one card outlives the banner it was captured under". So every person card      │
 * │ carries its own `Sample` marker, exactly as every stock cover does, and the page notice is   │
 * │ the second line of defence rather than the only one.                                          │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 *
 * Names follow the same rule as the catalogue: realistic and locale-appropriate, never "John Doe"
 * or "Acme" (`ai-tells.md` §5). They are deliberately NOT the design system's personas - Priya,
 * Rohan, Anita, Vikram and Sameer are the people this product is FOR, and putting them on the
 * team page would say the customers built it.
 *
 * Replacing this is a change to ONE module: hand `TEAM` the real people and delete the notice key
 * from the page. Nothing else on the route knows the difference.
 */

import type { MessageKey } from '../../../shared/i18n/index.ts';

export interface TeamMember {
  readonly id: string;
  /** Rendered as written. Never case-shifted: `DV4` under `ADR-0052` protects a person's name. */
  readonly name: string;
  readonly role: MessageKey;
  /** What this role OWNS, in one line. Not a biography, and never an achievement. */
  readonly owns: MessageKey;
  /** Founders are marked so the page can group them; it is not a rank. */
  readonly founder: boolean;
}

export const TEAM: readonly TeamMember[] = [
  {
    id: 't-001',
    name: 'Aarav Menon',
    role: 'web.about.team.role.product',
    owns: 'web.about.team.owns.product',
    founder: true,
  },
  {
    id: 't-002',
    name: 'Ishita Rao',
    role: 'web.about.team.role.engineering',
    owns: 'web.about.team.owns.engineering',
    founder: true,
  },
  {
    id: 't-003',
    name: 'Nandini Iyer',
    role: 'web.about.team.role.verification',
    owns: 'web.about.team.owns.verification',
    founder: false,
  },
  {
    id: 't-004',
    name: 'Kabir Sheikh',
    role: 'web.about.team.role.partnerships',
    owns: 'web.about.team.owns.partnerships',
    founder: false,
  },
];

/**
 * The initials a card shows instead of a face.
 *
 * No photographs, and that is a decision rather than a missing asset. A generated portrait of a
 * person who does not exist is the one thing on this page that a reader cannot tell from a real
 * one, and `ai-tells.md` bans exactly that class of filler. Initials are honest at any size, need
 * no pipeline, and survive a name in any script.
 *
 * Takes the first letter of the first and last word, so a single-word name gives one letter rather
 * than throwing, and a three-word name does not give three.
 */
export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? '';
  const last = parts.length > 1 ? (parts.at(-1)?.[0] ?? '') : '';
  return `${first}${last}`.toUpperCase();
}
