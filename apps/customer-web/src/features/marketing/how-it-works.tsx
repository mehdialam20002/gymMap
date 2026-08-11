/**
 * `SCR-WEB-020` — how it works, for a member. `FR-SRCH-13`.
 *
 * ┌─ EACH STEP CARRIES THE RULE BEHIND IT ─────────────────────────────────────────────────────┐
 * │ A four-step "how it works" is the most skippable page a marketplace ships, because every    │
 * │ marketplace's four steps are the same four steps. What is not the same is WHY each one can  │
 * │ be trusted: a human approves the listing, the total is revalidated server-side, the         │
 * │ membership activates on a webhook, a review needs a check-in.                                │
 * │                                                                                             │
 * │ Those four rules are the product. Putting them next to the steps they govern is the only    │
 * │ thing that makes this page worth the scroll — and each one is a business rule the code       │
 * │ elsewhere in this app enforces, stated in a member's words rather than invented for copy.   │
 * └─────────────────────────────────────────────────────────────────────────────────────────────┘
 *
 * ┌─ AND EVERY EXPLANATION NOW ENDS SOMEWHERE ──────────────────────────────────────────────────┐
 * │ Measured on the built page before this change: the first interactive control anywhere       │
 * │ inside `<main>` sat at document y = 2,295px, on a document 3,575px tall. That is 4.04        │
 * │ viewports at 320x568, 3.45 at 360x640 and 2.55 at 390x844, and it was the page's ONLY        │
 * │ `Link`. A reader who arrived from the announcement strip to find out how this works read     │
 * │ four explanations end to end and had nowhere to go from any of them except back up.          │
 * │                                                                                             │
 * │ Hoisting that one button would have fixed the measurement and none of the problem. The       │
 * │ reader who has just finished COMPARE does not want the step-four button; they want to        │
 * │ compare something. So each step ends at the surface it has just described, and the four      │
 * │ destinations are four different pages because the four steps are four different wants:       │
 * │                                                                                             │
 * │   discover -> /search              the step is literally "search gyms near you"              │
 * │   compare  -> /compare             the step is literally "side by side"                      │
 * │   choose   -> /explore             the weakest of the four, and stated as such: there is no  │
 * │                                    plans surface a member can reach without a gym, and       │
 * │                                    explore-by-activity is where narrowing to one starts      │
 * │   join     -> /checkout/confirmation   `SCR-WEB-007` is the long form of this step's own     │
 * │                                    rule, so the link is the rest of the sentence             │
 * │                                                                                             │
 * │ The single brand-solid call to action stays at the bottom where it was. These are ghost      │
 * │ buttons: they are exits, not the page's commitment point, and four solid reds down a         │
 * │ column would make the page an advertisement instead of an explanation.                       │
 * │                                                                                             │
 * │ Result, same measurement, same widths: y = 727 (1.28 viewports at 320x568), 683 (1.07 at     │
 * │ 360x640), 683 (0.81 at 390x844) - and 504 at 768x1024, 516 at 1280x800, down from 1,528      │
 * │ and 1,540. The document grows 242px at 320 and 240px everywhere else, which is the price of  │
 * │ four exits and is paid entirely below the first one.                                          │
 * │                                                                                             │
 * │ Sizes measured on the rendered controls: 140x44, 170x44, 190x44 and 234x46 at 320, 254x44    │
 * │ for the fourth from 360 up, so every one clears 44x44 in BOTH dimensions with real box       │
 * │ height rather than a `gm-hit-target` pseudo-element an ancestor could clip. The 46px is the  │
 * │ fourth label wrapping to two lines inside the pill at 320 - it is the only label long enough │
 * │ to do that. That label now has a key of its own and reads "After you pay", so the fourth      │
 * │ pill is one line at every width.                                                              │
 * │                                                                                             │
 * │ `scrollWidth` stays 320 against a 320 `clientWidth`, so nothing here reintroduces the        │
 * │ horizontal scroll `NFR-USE-07` forbids.                                                       │
 * └─────────────────────────────────────────────────────────────────────────────────────────────┘
 */

import Link from 'next/link';

import type { MessageKey } from '../../shared/i18n/index.ts';
import { t } from '../../shared/i18n/index.ts';
import { icon } from '../../shared/icons/index.tsx';

/*
 * A plain string constant, not a template literal, and `.gm-btn` rather than `.gm-btn-sm`: the
 * small variant is 36px painted and only reaches 44px under `(pointer: coarse)`, so a keyboard or
 * mouse reader gets a 36px target from it. `.gm-btn` declares `min-height: 44px` unconditionally
 * and its 22px inline padding puts every one of these four labels well past 44px wide, which is
 * the real control `AX3` asks for rather than a pseudo-element an ancestor can clip.
 */
const STEP_LINK = 'gm-btn gm-btn-ghost mt-stack-md';

const STEPS = [
  {
    title: 'web.home.how.discover.title',
    body: 'web.home.how.discover.body',
    rule: 'web.howItWorks.discover.rule',
    glyph: 'search',
    /*
     * Every `label` below names its DESTINATION rather than repeating that page's own title.
     * They were borrowed keys first, which is how a link ends up called "What happens after you
     * pay" - 26 characters, and the only one long enough to wrap to two lines inside the pill at
     * 320. A link's name is read out of context, so it has to say where it goes.
     */
    next: { href: '/search', label: 'web.howItWorks.discover.link' },
  },
  {
    title: 'web.home.how.compare.title',
    body: 'web.home.how.compare.body',
    rule: 'web.howItWorks.compare.rule',
    glyph: 'pricing',
    // `/compare` with nothing selected is not a dead end: it renders `web.compare.empty.*`, which
    // explains what a comparison is and how to start one. Checked before linking here.
    next: { href: '/compare', label: 'web.howItWorks.compare.link' },
  },
  {
    title: 'web.home.how.choose.title',
    body: 'web.home.how.choose.body',
    rule: 'web.howItWorks.choose.rule',
    glyph: 'secure',
    next: { href: '/explore', label: 'web.howItWorks.choose.link' },
  },
  {
    title: 'web.home.how.join.title',
    body: 'web.home.how.join.body',
    rule: 'web.howItWorks.join.rule',
    glyph: 'verified',
    // `robots: index:false` on the destination, deliberately, and it does not matter here: this is
    // a route for a reader, and the page it reaches is a standalone explanation of `BR-PAY-02`
    // rather than a receipt, so it reads correctly to somebody who has bought nothing.
    next: { href: '/checkout/confirmation', label: 'web.howItWorks.join.link' },
  },
] as const satisfies readonly {
  title: MessageKey;
  body: MessageKey;
  rule: MessageKey;
  glyph: keyof typeof icon;
  next: { href: string; label: MessageKey };
}[];

export function HowItWorksPage() {
  return (
    <div className="gm-wrap gm-sec gm-sec-tight">
      <h1 className="gm-h2 sm:text-5xl">{t('web.howItWorks.title')}</h1>
      <p className="mt-stack-sm max-w-prose text-lg text-content-secondary">
        {t('web.howItWorks.intro')}
      </p>

      {/* An `<ol>`: this is a real sequence a member moves through in order, so the ordinal
          carries information and a screen reader should hear it. */}
      <ol className="mt-stack-xl flex flex-col gap-stack-lg">
        {STEPS.map((step, index) => {
          const Glyph = icon[step.glyph];
          return (
            <li
              key={step.title}
              className="gm-card grid gap-inline-lg rounded-card p-inset-lg sm:grid-cols-[auto_minmax(0,1fr)]"
            >
              <span className="flex h-[3rem] w-[3rem] shrink-0 items-center justify-center rounded-full gm-glyph-ring">
                <Glyph
                  aria-hidden="true"
                  className="h-[1.5rem] w-[1.5rem] text-content-on-media-accent"
                />
              </span>

              <div className="min-w-0">
                <span
                  aria-hidden="true"
                  className="block text-sm font-semibold tabular-nums text-content-on-media-accent"
                >
                  {String(index + 1).padStart(2, '0')}
                </span>
                <h2 className="mt-stack-2xs text-xl font-semibold text-content">{t(step.title)}</h2>
                <p className="mt-stack-xs max-w-prose text-base text-content-secondary">
                  {t(step.body)}
                </p>

                <div className="mt-stack-md rounded-card bg-surface-sunken p-inset-md">
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-content-muted">
                    {t('web.howItWorks.rule')}
                  </h3>
                  <p className="mt-stack-2xs max-w-prose text-base text-content">{t(step.rule)}</p>
                </div>

                {/* After the rule, not before it: the rule is the payoff of the step, and an exit
                    offered above it invites the reader to leave before reading the one thing this
                    page exists to say. The arrow is the same `<i aria-hidden>` idiom every other
                    `.gm-btn` on the site uses, so `.gm-btn:hover i` nudges it here too. */}
                <Link href={step.next.href} className={STEP_LINK}>
                  {t(step.next.label)} <i aria-hidden="true">→</i>
                </Link>
              </div>
            </li>
          );
        })}
      </ol>

      <section className="mt-region-sm max-w-prose border-t border-subtle pt-stack-xl">
        <h2 className="text-2xl font-semibold text-content">{t('web.howItWorks.reviews.title')}</h2>
        <p className="mt-stack-sm text-base text-content-secondary">
          {t('web.howItWorks.reviews.body')}
        </p>
      </section>

      <p className="mt-stack-xl">
        <Link
          href="/search"
          data-on-solid="true"
          className="gm-hit-target inline-block rounded-control bg-brand-solid px-inset-xl py-inset-sm text-base font-semibold text-content-on-brand transition-colors duration-fast ease-standard hover:bg-brand-solid-hover"
        >
          {t('web.howItWorks.cta')}
        </Link>
      </p>
    </div>
  );
}
