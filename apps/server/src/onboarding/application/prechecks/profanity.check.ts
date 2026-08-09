/**
 * `M-030` · Prohibited content in free text — `FR-ONB-12`, `BR-GYM-07` adjacency.
 *
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * THE INTERESTING HALF IS NOT PROFANITY
 *
 * The milestone asks for *"prohibited-content screening on free text, **including embedded contact
 * details and URLs**"*, and that second clause is the one that earns the check its place.
 *
 * A gym that writes "call 98765 43210 for a better price" in its description has moved the
 * transaction off the platform. That is not rudeness — it is `BR-PLN-03` ("the price displayed is
 * the price charged") being routed around, the commission with it, and the member losing every
 * protection the platform provides: no order, no invoice, no refund policy, no earned review. A
 * profanity list catches none of that.
 *
 * ┌─ FIRST-PARTY, AND FOR THE USUAL REASON ──────────────────────────────────────────────────────┐
 * │ `STACK_ADDITIONS.md` has no moderation or profanity row of any status, and CLAUDE.md §5 makes │
 * │ an unapproved dependency a review blocker. The same call as the byte inspector and RFC 6238   │
 * │ TOTP before it.                                                                                │
 * │                                                                                              │
 * │ It also suits the problem: the contact-detail patterns are Indian-specific (a ten-digit       │
 * │ mobile beginning 6–9, `+91`, digits spaced or hyphenated to dodge a naive matcher) and no     │
 * │ general-purpose list carries them.                                                             │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 *
 * ┌─ IT FLAGS. IT DOES NOT SANITISE, AND IT DOES NOT REJECT ─────────────────────────────────────┐
 * │ Stripping the text would destroy the evidence a reviewer needs and leave the applicant       │
 * │ looking at a description they did not write. `PrecheckOutcome` has no rejecting member, so    │
 * │ the strongest thing this file can do is say where it looked and what it found.                 │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

import { precheck, type PrecheckResult } from '../../domain/precheck-result.vo.js';

/**
 * An Indian mobile number, in the shapes people actually type to get past a matcher.
 *
 * Ten digits beginning 6–9, optionally `+91`/`0` prefixed, with spaces or hyphens permitted between
 * any of them. `\D{0,2}` between digits is what catches `98765 43210` and `9-8-7-6-5-4-3-2-1-0`
 * while staying tight enough not to swallow "open 6 to 10" — a bare pair of small numbers cannot
 * reach ten digits.
 */
const MOBILE = /(?:\+?91[\s-]?|\b0)?[6-9](?:[\s-]?\d){9}\b/;

/** `something@somewhere.tld`, deliberately loose — a near-miss is still an attempt. */
const EMAIL = /[\w.+-]+\s?(?:@|\[at\]|\(at\))\s?[\w-]+(?:\s?\.\s?[\w-]{2,})+/i;

/** A URL, including the bare-domain form people use when they know links are unwelcome. */
const URL = /\b(?:https?:\/\/|www\.)\S+|\b[\w-]+\.(?:com|in|co\.in|net|org|io|me|link)\b/i;

/** Messaging handles, the third route off-platform. */
const HANDLE = /\b(?:whatsapp|telegram|insta(?:gram)?|dm\s+me|wa\.me)\b/i;

/**
 * Terms that have no place in a public gym listing.
 *
 * Deliberately short and non-exhaustive. A long list is a maintenance burden with a false sense of
 * completeness, and this check FLAGS for a human rather than deciding — so a term it misses costs a
 * reviewer nothing they were not already doing, while a term it wrongly matches costs an applicant
 * a delay. Erring small is the right direction here.
 */
const PROHIBITED = [
  'steroid',
  'anabolic',
  'guaranteed weight loss',
  'miracle',
  'cure',
  'no questions asked',
];

export interface ProfanityFinding {
  readonly field: string;
  readonly kind: 'CONTACT_NUMBER' | 'EMAIL' | 'URL' | 'MESSAGING_HANDLE' | 'PROHIBITED_TERM';
  /** For a term, the term. For contact details, NEVER the value — see below. */
  readonly detail: string;
}

/**
 * @param fields  field name → the free text in it. The NAME is reported, the value never is for a
 *                contact detail: `BR-DAT-06` keeps a phone number out of logs and analytics, and
 *                this result is persisted and rendered. A reviewer opening the application sees
 *                the text anyway; the pre-check row only has to tell them where to look.
 */
export function runProfanityCheck(
  fields: Readonly<Record<string, string>>,
  ranAt: Date,
): PrecheckResult {
  const findings: ProfanityFinding[] = [];

  for (const [field, raw] of Object.entries(fields)) {
    if (typeof raw !== 'string' || raw.trim().length === 0) continue;
    const text = raw.toLowerCase();

    if (MOBILE.test(raw)) {
      findings.push({
        field,
        kind: 'CONTACT_NUMBER',
        detail: 'a phone number appears in this field',
      });
    }
    if (EMAIL.test(raw)) {
      findings.push({ field, kind: 'EMAIL', detail: 'an email address appears in this field' });
    }
    if (URL.test(raw)) {
      findings.push({ field, kind: 'URL', detail: 'a link appears in this field' });
    }
    if (HANDLE.test(raw)) {
      findings.push({ field, kind: 'MESSAGING_HANDLE', detail: 'an off-platform contact route' });
    }
    for (const term of PROHIBITED) {
      // The TERM is safe to name — it is not personal data, and a reviewer needs to know which
      // word matched or the flag is unactionable.
      if (text.includes(term)) {
        findings.push({ field, kind: 'PROHIBITED_TERM', detail: term });
      }
    }
  }

  return precheck(
    'PROFANITY',
    findings.length === 0 ? 'PASS' : 'FLAG',
    { findings, fieldsScreened: Object.keys(fields).length },
    ranAt,
  );
}
