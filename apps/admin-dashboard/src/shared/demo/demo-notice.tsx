/**
 * The demo banner. Rendered by the ROOT LAYOUT, so no page can exist without it.
 *
 * ┌─ THIS IS THE ONE THING THAT MAKES DEMO MODE HONEST ──────────────────────────────────────────┐
 * │ `demo-figures.ts` states the rule about its own numbers: *"That banner is not decoration and  │
 * │ must not be removed for a screenshot: it is the entire reason inventing these numbers is      │
 * │ honest rather than misleading."*                                                              │
 * │                                                                                              │
 * │ In demo mode nothing on screen is real — not the counts, not the queue, not the operator's    │
 * │ own name. So the same rule applies to the whole console, and it is mounted the same way       │
 * │ `ImpersonationBanner` is: from the root layout, per `FolderStructure.md` §6's reasoning that   │
 * │ a per-page banner is one forgotten import away from being absent.                             │
 * │                                                                                              │
 * │ Anyone reading this before deleting it for a cleaner screenshot: the screenshot is the reason  │
 * │ it exists.                                                                                     │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 *
 * ┌─ WARNING, NOT DANGER — AND THE SAME REASONING AS THE IMPERSONATION BANNER ───────────────────┐
 * │ A demonstration is not a failure. `danger` tokens here would make every screen look broken     │
 * │ and teach a viewer to ignore red, which costs when something actually is wrong (§3.10).        │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 *
 * No motion. `MOTION_INTENSITY` for this surface is 1-3 and the gate in the taste skill is *what
 * does this communicate?* — a banner that animates in communicates nothing except that somebody
 * enjoyed animating it, and a persistent condition that slides is a persistent condition that
 * draws the eye away from the work every time a route changes.
 */

import { t } from '../i18n/index.ts';
import { isDemoMode } from './demo-mode.ts';

export function DemoNotice() {
  if (!isDemoMode) return null;

  return (
    // `role="status"` with `aria-live="polite"`, matching `ImpersonationBanner`: this is a
    // persistent CONDITION, not an event, so it is announced when the user pauses rather than
    // interrupting a screen reader mid-sentence. `AX8` — the state carries a word, not a colour.
    <div
      role="status"
      aria-live="polite"
      aria-label={t('adm.demo.label')}
      className="sticky top-0 z-app-chrome border-b border-warning bg-warning-solid px-inset-md py-inset-sm text-content-on-warning"
      data-on-solid="true"
    >
      <div className="mx-auto flex max-w-container flex-wrap items-baseline gap-inline-md">
        <span className="text-base font-semibold">{t('adm.demo.title')}</span>
        <span className="text-sm">{t('adm.demo.body')}</span>
      </div>
    </div>
  );
}
