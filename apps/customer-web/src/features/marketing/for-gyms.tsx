/**
 * `SCR-WEB-030` — the owner-facing marketing page and its application form.
 *
 * ┌─ THE COMMISSION RATE IS NOT ON THIS PAGE, AND THAT IS DELIBERATE ───────────────────────────┐
 * │ `LAUNCH_MARKET_INDIA.md` records the launch commission, so the number exists and could be   │
 * │ typed here. Publishing a price is the owner's decision, not a page author's — and a rate     │
 * │ printed on a marketing page becomes a rate every negotiation starts from.                    │
 * │                                                                                             │
 * │ What IS stated is the shape of the charge, which is the part an owner actually needs before │
 * │ they apply: commission per sale and nothing else FOR THE LISTING, and `BR-FIN-05` — the rate │
 * │ on the day of a sale is the rate that sale keeps, so a later change never rewrites an old    │
 * │ settlement. That last sentence is a real guarantee, enforced in the ledger, and it is worth  │
 * │ more to an owner than a headline percentage.                                                  │
 * │                                                                                             │
 * │ "For the listing" is load-bearing and was added after `KL-112`. The sentence used to make an │
 * │ absolute claim — "no monthly charge" — while §A6.1 lists a monthly SaaS subscription as      │
 * │ Phase 1 revenue. Owner's ruling, recorded in `DECISION_LOG.md`: the two charges buy two      │
 * │ different products. Commission is what this marketplace charges for sending a gym members;   │
 * │ the subscription is what the MANAGEMENT SOFTWARE costs, and that is not what this page sells.│
 * └─────────────────────────────────────────────────────────────────────────────────────────────┘
 */

import Link from 'next/link';

import type { MessageKey } from '../../shared/i18n/index.ts';
import { t } from '../../shared/i18n/index.ts';
import { icon } from '../../shared/icons/index.tsx';
import { CITIES } from '../discovery/fixtures/catalogue.ts';

const VALUE = [
  {
    title: 'web.forGyms.value.reach.title',
    body: 'web.forGyms.value.reach.body',
    glyph: 'search',
  },
  { title: 'web.forGyms.value.sell.title', body: 'web.forGyms.value.sell.body', glyph: 'pricing' },
  {
    title: 'web.forGyms.value.checkin.title',
    body: 'web.forGyms.value.checkin.body',
    glyph: 'verified',
  },
  { title: 'web.forGyms.value.money.title', body: 'web.forGyms.value.money.body', glyph: 'secure' },
] as const satisfies readonly { title: MessageKey; body: MessageKey; glyph: keyof typeof icon }[];

const RULES = [
  {
    title: 'web.forGyms.rules.verified.title',
    body: 'web.forGyms.rules.verified.body',
    glyph: 'verified',
  },
  {
    title: 'web.forGyms.rules.price.title',
    body: 'web.forGyms.rules.price.body',
    glyph: 'pricing',
  },
  {
    title: 'web.forGyms.rules.reviews.title',
    body: 'web.forGyms.rules.reviews.body',
    glyph: 'reviews',
  },
  { title: 'web.forGyms.rules.money.title', body: 'web.forGyms.rules.money.body', glyph: 'secure' },
] as const satisfies readonly { title: MessageKey; body: MessageKey; glyph: keyof typeof icon }[];

const STEPS = [
  { title: 'web.forGyms.steps.apply.title', body: 'web.forGyms.steps.apply.body' },
  { title: 'web.forGyms.steps.verify.title', body: 'web.forGyms.steps.verify.body' },
  { title: 'web.forGyms.steps.live.title', body: 'web.forGyms.steps.live.body' },
  { title: 'web.forGyms.steps.paid.title', body: 'web.forGyms.steps.paid.body' },
] as const satisfies readonly { title: MessageKey; body: MessageKey }[];

const DASH_KPIS = [
  'web.forGyms.preview.kpi.sales',
  'web.forGyms.preview.kpi.visits',
  'web.forGyms.preview.kpi.settle',
] as const satisfies readonly MessageKey[];

const MONEY = [
  {
    title: 'web.forGyms.money.breakdown.title',
    body: 'web.forGyms.money.breakdown.body',
  },
  { title: 'web.forGyms.money.rate.title', body: 'web.forGyms.money.rate.body' },
  { title: 'web.forGyms.money.cycle.title', body: 'web.forGyms.money.cycle.body' },
] as const satisfies readonly { title: MessageKey; body: MessageKey }[];

const FAQ = [
  { q: 'web.forGyms.faq.control.q', a: 'web.forGyms.faq.control.a' },
  { q: 'web.forGyms.faq.reviews.q', a: 'web.forGyms.faq.reviews.a' },
  { q: 'web.forGyms.faq.data.q', a: 'web.forGyms.faq.data.a' },
  { q: 'web.forGyms.faq.exclusive.q', a: 'web.forGyms.faq.exclusive.a' },
  { q: 'web.forGyms.faq.live.q', a: 'web.forGyms.faq.live.a' },
  { q: 'web.forGyms.faq.software.q', a: 'web.forGyms.faq.software.a' },
  { q: 'web.forGyms.faq.rate.q', a: 'web.forGyms.faq.rate.a' },
  { q: 'web.forGyms.faq.cancel.q', a: 'web.forGyms.faq.cancel.a' },
] as const satisfies readonly { q: MessageKey; a: MessageKey }[];

export function ForGymsPage() {
  return (
    <>
      {/*
       * The owner band's colours, on the surface that band was advertising. `surface-media` is
       * theme-invariant and opaque, so the pairing is one `contrast.proof.ts` can measure.
       */}
      {/*
       * ┌─ THE SIGN-IN CARD IS A GRID COLUMN, NOT AN ABSOLUTE PANEL ─────────────────────────────┐
       * │ It used to be `lg:absolute lg:inset-y-0 lg:right-0 lg:w-[26rem]`, and NOTHING reserved  │
       * │ the 26rem it took. The h1 and the lede were bounded by `max-w-prose` inside a           │
       * │ full-width `gm-wrap`, so they ran straight under an opaque `gm-card` and were painted   │
       * │ over. Range-measured on the built page, glyph runs against the card's rect:             │
       * │                                                                                        │
       * │   1024 -> 130px of the h1 covered plus 215px of the lede · 1100 -> 108 + 90             │
       * │   1180 -> 86 + 10 · 1280 -> 64 · 1366 -> 21 · clean only at 1440                        │
       * │                                                                                        │
       * │ `elementFromPoint` at the h1's right edge returned the CARD's body copy at 1024. The    │
       * │ headline on screen read "LIST YOUR GYM ON GYM".                                          │
       * │                                                                                        │
       * │ The measure could not have saved it: `max-w-prose` is 68ch, and 68ch of the h1's 58px   │
       * │ display face measures 2618px, so the cap never bound at any width the page is used at.  │
       * │ A max-width that only avoids a collision at the widths where it happens to be smaller   │
       * │ than the gap is not a layout, it is a coincidence. A grid TRACK cannot overlap its      │
       * │ sibling at ANY width, which is the entire reason to use one here.                        │
       * │                                                                                        │
       * │ 22rem from `lg`, the card's intended 26rem from `xl` where there is room for it. The    │
       * │ text column then measures 566px at 1024 and 776px at 1279; a 26rem track from `lg` up   │
       * │ would leave 502px there for a headline set at 47px, which trades this defect for a      │
       * │ worse one. Same idiom and same gap token as `checkout.tsx` and `gym-detail.tsx`, the    │
       * │ other two sidebar layouts on this surface.                                              │
       * └────────────────────────────────────────────────────────────────────────────────────────┘
       */}
      <section className="border-b border-subtle bg-surface-media">
        <div className="gm-wrap gm-sec gm-sec-tight lg:grid lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-center lg:gap-inline-xl xl:grid-cols-[minmax(0,1fr)_26rem]">
          <div>
            {/*
             * `content-on-media`, not the accent.
             *
             * Measured two ways on the rendered page - by compositing the cascade and by reading
             * the screenshot's pixels - the amber came to 3.94:1 and 3.98:1 on `surface-media`,
             * against `SC 1.4.3`'s 4.5 for 12px at weight 500. Two independent methods agreeing
             * within 0.04 is what made this one worth acting on while the rest of the light-theme
             * list stayed unsettled: the others sit on gradients and pseudo-element scrims that
             * neither method can read honestly.
             *
             * The accent is for emphasis at a size that can carry it. This is an eyebrow.
             */}
            <p className="text-xs font-medium uppercase tracking-wide text-content-on-media">
              {t('web.forGyms.hero.eyebrow')}
            </p>
            {/*
             * No `max-w-prose` on the headline. It measured 2618px against a 1152px container, so
             * it never capped anything and only made the h1 LOOK bounded while the grid column is
             * what actually bounds it now. The lede keeps its measure because at 18px the same
             * 68ch resolves to 815px, which does bind below `lg` where there is no second column.
             */}
            <h1 className="mt-stack-sm gm-h2">{t('web.forGyms.title')}</h1>
            <p className="mt-stack-md max-w-prose text-lg text-content-on-media">
              {t('web.forGyms.hero.body')}
            </p>

            <div className="mt-stack-xl flex flex-wrap gap-inline-md">
              <Link
                href="/for-gyms/signup"
                data-on-solid="true"
                className="gm-hit-target inline-block rounded-control bg-brand-solid px-inset-xl py-inset-sm text-base font-semibold text-content-on-brand transition-colors duration-fast ease-standard hover:bg-brand-solid-hover"
              >
                {t('web.forGyms.hero.cta')}
              </Link>
              {/*
               * `data-on-media` and not `data-on-solid`: the focus ring resolves to
               * `content-inverse` under `on-solid`, which goes near-black in dark theme and all
               * but vanishes on this band. See `focus.css`.
               */}
              <a
                href="#how"
                data-on-media="true"
                className="gm-hit-target inline-block rounded-control border border-strong px-inset-xl py-inset-sm text-base font-semibold text-content-on-media"
              >
                {t('web.forGyms.hero.secondary')}
              </a>
            </div>
          </div>

          {/*
           * ┌─ THE DOOR FOR AN OWNER WHO ALREADY JOINED ───────────────────────────────────────────┐
           * │ The reference page carries a sign-in panel in the hero, and it is the single biggest  │
           * │ thing this page was missing: every route on it pointed at APPLYING. An owner who had  │
           * │ already applied, or who came back a week later, had nowhere to go - the only mention  │
           * │ of the dashboard anywhere on the site is an unlinked word in the footer.               │
           * │                                                                                      │
           * │ It is not a login, because there is nothing to log into: `apps/gym-dashboard` holds   │
           * │ one file. A form that took a password and did nothing with it would be worse than the │
           * │ gap it fills - and would be the first thing an owner tried. So it states where the    │
           * │ dashboard is in the plan, and which email will open it, which is what somebody        │
           * │ returning to this page actually needs to know.                                        │
           * └──────────────────────────────────────────────────────────────────────────────────────┘
           *
           * It is a grid child now, so it drops its own `gm-wrap` - it sits inside the shared one,
           * and a second copy would apply the gutter twice - and `pb-region-sm`, because the band's
           * `gm-sec-tight` padding now closes the section below the card. `mt-stack-xl` is the
           * stacked-order gap the hero's bottom padding used to provide, and it goes away at `lg`
           * where the column gap takes over.
           */}
          <aside aria-label={t('web.forGyms.signin.title')} className="mt-stack-xl lg:mt-0">
            <div className="gm-card rounded-card border-strong p-inset-lg">
              <h2 className="text-lg font-semibold text-content">
                {t('web.forGyms.signin.title')}
              </h2>
              <p className="mt-stack-xs text-base text-content-secondary">
                {t('web.forGyms.signin.body')}
              </p>
              <p className="mt-stack-md flex flex-wrap items-center gap-inline-xs">
                <span className="gm-card-add opacity-60">{t('web.forGyms.signin.cta')}</span>
                <span className="gm-tag text-xs">{t('web.chrome.nav.soon')}</span>
              </p>
            </div>
          </aside>
        </div>
      </section>

      {/*
       * Where the reference prints its traffic, because a marketplace with no listings that
       * prints a traffic number is the first lie an owner catches. These are the four rules the
       * product enforces in code, which is the thing a gym is actually buying: a page that cannot
       * show a member something untrue about it.
       */}
      <section className="gm-sec gm-sec-paper">
        <div className="gm-wrap">
          <h2 className="gm-h2">{t('web.forGyms.rules.title')}</h2>
          <p className="gm-lede">{t('web.forGyms.rules.body')}</p>

          <ul className="mt-stack-xl grid gap-stack-md sm:grid-cols-2">
            {RULES.map((rule) => {
              const Glyph = icon[rule.glyph];
              return (
                <li key={rule.title} className="gm-card gm-lift rounded-card p-inset-lg">
                  <span className="flex h-[2.75rem] w-[2.75rem] items-center justify-center rounded-full gm-glyph-ring">
                    <Glyph
                      aria-hidden="true"
                      className="h-[1.375rem] w-[1.375rem] text-content-on-media-accent"
                    />
                  </span>
                  <h3 className="mt-stack-md text-base font-semibold text-content">
                    {t(rule.title)}
                  </h3>
                  <p className="mt-stack-2xs text-base text-content-secondary">{t(rule.body)}</p>
                </li>
              );
            })}
          </ul>
        </div>
      </section>

      <section className="gm-wrap gm-sec gm-sec-tight">
        <h2 className="gm-h2">{t('web.forGyms.value.title')}</h2>
        <ul className="mt-stack-xl grid gap-stack-lg sm:grid-cols-2">
          {VALUE.map((item) => {
            const Glyph = icon[item.glyph];
            return (
              <li key={item.title} className="gm-card gm-card-interactive rounded-card p-inset-lg">
                <span className="flex h-[2.75rem] w-[2.75rem] items-center justify-center rounded-full gm-glyph-ring">
                  <Glyph
                    aria-hidden="true"
                    className="h-[1.5rem] w-[1.5rem] text-content-on-media-accent"
                  />
                </span>
                <h3 className="mt-stack-md text-lg font-semibold text-content">{t(item.title)}</h3>
                <p className="mt-stack-xs text-base text-content-secondary">{t(item.body)}</p>
              </li>
            );
          })}
        </ul>
      </section>

      <section id="how" className="border-y border-subtle bg-surface-subtle">
        <div className="gm-wrap gm-sec gm-sec-tight">
          <h2 className="gm-h2">{t('web.forGyms.steps.title')}</h2>
          <ol className="mt-stack-xl grid gap-stack-lg sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((step, index) => (
              <li key={step.title} className="border-t border-strong pt-stack-md">
                <span
                  aria-hidden="true"
                  className="block text-sm font-semibold tabular-nums text-content-on-media-accent"
                >
                  {String(index + 1).padStart(2, '0')}
                </span>
                <h3 className="mt-stack-xs text-lg font-semibold text-content">{t(step.title)}</h3>
                <p className="mt-stack-2xs text-sm text-content-secondary">{t(step.body)}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/*
       * ┌─ THE DASHBOARD, DRAWN, AND SAID TO BE DRAWN ───────────────────────────────────────────┐
       * │ The reference shows a phone with its real product on it. Ours does not exist yet -      │
       * │ `apps/gym-dashboard` holds a single file - so this is an illustration and the caption   │
       * │ says so, in the same words the home page's preview uses.                                 │
       * │                                                                                        │
       * │ `A-08` is the rule that matters here: a figure presented as current must be current.    │
       * │ Every number below is a shape rather than a claim - no counts, no currency, no dates -  │
       * │ because a drawn "₹48,200 this week" would be exactly the fake-perfect number this whole │
       * │ page is built to avoid, and the one an owner would remember.                             │
       * └────────────────────────────────────────────────────────────────────────────────────────┘
       */}
      <section className="gm-sec gm-sec-tight">
        <div className="gm-wrap grid items-center gap-inline-xl lg:grid-cols-2">
          <div>
            <h2 className="gm-h2">{t('web.forGyms.preview.title')}</h2>
            <p className="gm-lede">{t('web.forGyms.preview.body')}</p>
          </div>

          <figure className="m-0">
            <div aria-hidden="true" className="gm-dash">
              <div className="gm-dash-bar">
                <span className="gm-dash-dot" />
                <span className="gm-dash-dot" />
                <span className="gm-dash-dot" />
              </div>
              <div className="gm-dash-body">
                <div className="gm-dash-kpi">
                  {DASH_KPIS.map((kpi) => (
                    <p key={kpi} className="m-0">
                      <span>{t(kpi)}</span>
                      {/* `gm-dash-slot`, which already exists for the home page's preview and is
                          documented there as "the figure's SLOT, never a figure". A drawn number
                          on a marketing page is the fake-perfect number `ai-tells.md` bans, and
                          `A-08` forbids presenting one as current. */}
                      <span className="gm-dash-slot" />
                    </p>
                  ))}
                </div>
                <div className="gm-dash-table">
                  <p className="gm-dash-head">
                    <span>{t('web.forGyms.preview.row.plan')}</span>
                    <span>{t('web.forGyms.preview.row.member')}</span>
                    <span>{t('web.forGyms.preview.row.status')}</span>
                  </p>
                  {[0, 1, 2, 3].map((row) => (
                    <p key={row} className="gm-dash-row">
                      <span />
                      <span />
                      <span />
                    </p>
                  ))}
                </div>
              </div>
            </div>
            <figcaption className="mt-stack-sm text-sm text-content-muted">
              {t('web.forGyms.preview.caption')}
            </figcaption>
          </figure>
        </div>
      </section>

      {/*
       * The money, in the detail an owner asks for. Every line here is enforced somewhere: the
       * breakdown by `MASTER_PRD.md` §A6.3, the rate guarantee by `BR-FIN-05`, and the ledger by
       * invariant 2. No settlement cycle LENGTH is printed - `OQ-04` is open, and a number stated
       * here would become the number an owner holds us to.
       */}
      <section className="gm-sec gm-sec-paper">
        <div className="gm-wrap">
          <h2 className="gm-h2">{t('web.forGyms.money.title')}</h2>
          <p className="gm-lede">{t('web.forGyms.money.body')}</p>

          <ul className="mt-stack-xl grid gap-stack-md md:grid-cols-3">
            {MONEY.map((item) => (
              <li key={item.title} className="gm-card gm-lift rounded-card p-inset-lg">
                <h3 className="text-base font-semibold text-content">{t(item.title)}</h3>
                <p className="mt-stack-2xs text-base text-content-secondary">{t(item.body)}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="gm-wrap gm-sec gm-sec-tight">
        {/*
         * ┌─ THE MEASURE HAS TO SIT ON THE ELEMENT THAT SETS THE SIZE ────────────────────────────┐
         * │ `ch` is the advance of "0" in the font of the element CARRYING the max-width, not of   │
         * │ the text inside it. This wrapper inherited 16px while every paragraph in it is         │
         * │ `text-base`, which is 14px on this scale, so `max-w-prose` resolved to 724.6px -       │
         * │ 68 characters of a font nothing here is set in. Measured on the built page at 1440,    │
         * │ the longest line of the commission body ran 117 characters, against the 68 the token   │
         * │ names.                                                                                 │
         * │                                                                                       │
         * │ `text-base` on the wrapper is the whole fix: the carrier now sets the size it is       │
         * │ measuring, 68ch resolves at 14px (9.324px per ch, so 634.0px), and the children keep   │
         * │ their own explicit sizes - `gm-h2` and `text-lg` are unaffected because they declare   │
         * │ theirs. No new measure was invented; the system has three and this is still one.       │
         * └───────────────────────────────────────────────────────────────────────────────────────┘
         */}
        <div className="max-w-prose text-base">
          <h2 className="gm-h2">{t('web.forGyms.commission.title')}</h2>
          <p className="mt-stack-md text-base text-content-secondary">
            {t('web.forGyms.commission.body')}
          </p>

          {/*
           * Directly under the price, because that is where the question forms.
           *
           * An owner reads "nothing until you make a sale", looks back up at a list that includes
           * a check-in desk and a settlement statement, and concludes the software is free. It is
           * not, and `ADR-0046` says so - but the page was only fixed on the money side, which
           * left the promise standing. This is the other half.
           */}
          <h3 className="mt-stack-lg text-lg font-semibold text-content">
            {t('web.forGyms.scope.title')}
          </h3>
          <p className="mt-stack-2xs text-base text-content-secondary">
            {t('web.forGyms.scope.body')}
          </p>
        </div>

        {/*
         * ┌─ WHERE THE TESTIMONIAL GOES, AND WHY IT IS NOT ONE ─────────────────────────────────┐
         * │ The reference has a partner's photograph, name, hotel and a quote about growth. It   │
         * │ is the most persuasive block on that page and it is the one thing here that would    │
         * │ have to be invented: no gym has partnered yet, so no owner has said anything.        │
         * │                                                                                     │
         * │ `ai-tells.md` bans invented testimonials and generic names outright. More to the     │
         * │ point, `BR-REV-01` already applies exactly this rule to members - a review needs a   │
         * │ recorded check-in - and an owner testimonial is a review by another name. A product  │
         * │ that refuses to fake a member's five stars and then fakes an owner's quote has not   │
         * │ got a rule, it has got a marketing exception.                                       │
         * │                                                                                     │
         * │ So the slot says why it is empty, in the same voice the site uses for an unrated     │
         * │ gym. It is a weaker sell than a quote and a stronger argument than one, and it is    │
         * │ the only version that is still true tomorrow.                                       │
         * └─────────────────────────────────────────────────────────────────────────────────────┘
         */}
        <section className="mt-region-sm">
          {/* Same `ch` correction as the block above, and the card is the tighter case: it carries
              `p-inset-xl`, so its 724.6px cap left a 659px line that measured 102 characters. With
              the carrier set to 14px the cap is 634px and the text inside it 568px, which is under
              the measure rather than over it - the padding is inside the cap, and erring short is
              the only direction that cannot hurt reading. */}
          <div className="gm-card max-w-prose rounded-card border-strong p-inset-xl text-base">
            <h2 className="gm-h3">{t('web.forGyms.partners.title')}</h2>
            <p className="mt-stack-sm text-base text-content-secondary">
              {t('web.forGyms.partners.body')}
            </p>
            <p className="gm-eyebrow-k mt-stack-lg">{t('web.forGyms.partners.note')}</p>
          </div>
        </section>

        <h2 className="mt-region-sm gm-h2">{t('web.forGyms.faq.title')}</h2>
        {/*
         * `<details>` and not a JavaScript accordion. It opens before hydration, it is keyboard
         * operable and announced correctly with no work, and a search engine reads the answers
         * whether or not it expands them.
         */}
        {/* `text-base` on the list for the `ch` reason above: the answers are 14px, and at the
            inherited 16px this cap ran the longest answer line to 108 characters. It also pulls
            the `border-b` rules in with the text, so the dividers still end where the answers do. */}
        <ul className="mt-stack-lg max-w-prose text-base">
          {FAQ.map((item) => (
            <li key={item.q}>
              <details className="border-b border-subtle py-inset-md">
                <summary className="gm-hit-target cursor-pointer text-base font-medium text-content">
                  {t(item.q)}
                </summary>
                <p className="mt-stack-sm text-base text-content-secondary">{t(item.a)}</p>
              </details>
            </li>
          ))}
        </ul>
      </section>

      <section className="border-t border-subtle bg-surface-subtle">
        <div className="gm-wrap gm-sec gm-sec-tight text-center">
          <h2 className="mx-auto max-w-prose gm-h2">{t('web.forGyms.signup.title')}</h2>
          <Link
            href="/for-gyms/signup"
            data-on-solid="true"
            className="gm-hit-target mt-stack-lg inline-block rounded-control bg-brand-solid px-inset-xl py-inset-sm text-base font-semibold text-content-on-brand transition-colors duration-fast ease-standard hover:bg-brand-solid-hover"
          >
            {t('web.forGyms.hero.cta')}
          </Link>
        </div>
      </section>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// The application form
// ─────────────────────────────────────────────────────────────────────────────

/**
 * ┌─ THE FORM IS COMPLETE AND ITS ENDPOINT IS NOT, AND IT SAYS SO ABOVE THE FIELDS ─────────────┐
 * │ Gym onboarding (`FR-ONB-*`) has no endpoint yet. The choice was between omitting the page,   │
 * │ shipping a form that silently discards an owner's details, or shipping the real fields with  │
 * │ the truth stated where it cannot be missed.                                                   │
 * │                                                                                              │
 * │ The notice sits ABOVE the fields, not beside the button: a gym owner who reads it after       │
 * │ typing their address and phone number has already been wasted. `aria-describedby` ties it to │
 * │ the form so a screen reader hears it as part of the form rather than as passing prose, and    │
 * │ the submit is disabled so nothing can be sent nowhere.                                        │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 */
export function ForGymsSignup() {
  const fields = [
    {
      id: 'gym',
      label: 'web.forGyms.signup.field.gym',
      type: 'text',
      autoComplete: 'organization',
    },
    {
      id: 'contact',
      label: 'web.forGyms.signup.field.contact',
      type: 'text',
      autoComplete: 'name',
    },
    { id: 'email', label: 'web.forGyms.signup.field.email', type: 'email', autoComplete: 'email' },
    { id: 'phone', label: 'web.forGyms.signup.field.phone', type: 'tel', autoComplete: 'tel' },
  ] as const satisfies readonly {
    id: string;
    label: MessageKey;
    type: string;
    autoComplete: string;
  }[];

  return (
    <div className="gm-wrap gm-sec gm-sec-tight">
      <h1 className="text-3xl font-bold tracking-tight text-content">
        {t('web.forGyms.signup.title')}
      </h1>
      <p className="mt-stack-sm max-w-prose text-base text-content-secondary">
        {t('web.forGyms.signup.intro')}
      </p>

      <p
        id="signup-notice"
        role="status"
        className="mt-stack-lg max-w-form rounded-card border border-warning bg-surface-warning-subtle px-inset-md py-inset-sm text-base text-content-warning"
      >
        {t('web.forGyms.signup.notice')}
      </p>

      <form aria-describedby="signup-notice" className="mt-stack-lg max-w-form">
        <div className="flex flex-col gap-stack-md">
          {fields.map((field) => (
            <div key={field.id}>
              {/* A real `<label for>`, never a placeholder standing in for one — a placeholder
                  disappears the moment somebody types and takes the question with it. */}
              <label htmlFor={field.id} className="block text-sm font-medium text-content">
                {t(field.label)}
              </label>
              {/*
               * ┌─ `text-md`, AND IT IS THE `TS2` FLOOR RATHER THAN A SIZE PREFERENCE ───────────┐
               * │ `text-base` is 14px on this scale - the DASHBOARD body step - and all six      │
               * │ controls on this form measured 14px at every width, including under            │
               * │ `hasTouch` + `isMobile`, so the coarse-pointer promotion never reached them.   │
               * │ `INPUT_FONT_FLOOR_PX` fixes 16px as a FLOOR on every form input on every       │
               * │ surface: below 16px iOS Safari zooms the viewport on focus and does not zoom   │
               * │ back, which is the horizontal scroll `NFR-USE-07` forbids.                     │
               * │                                                                               │
               * │ It reads as harmless today only because every control here carries `disabled`  │
               * │ and Safari will not focus a disabled control. That is a stay of execution, not │
               * │ a defence: the day `FR-ONB-*` has an endpoint and `disabled` comes off, the    │
               * │ zoom lands with it. Fixed now, while the fix is one token.                     │
               * └───────────────────────────────────────────────────────────────────────────────┘
               */}
              <input
                id={field.id}
                name={field.id}
                type={field.type}
                autoComplete={field.autoComplete}
                disabled
                className="mt-stack-2xs w-full rounded-control border border-input bg-surface-disabled px-inset-md py-inset-sm text-md text-content-disabled"
              />
            </div>
          ))}

          <div>
            <label htmlFor="city" className="block text-sm font-medium text-content">
              {t('web.forGyms.signup.field.city')}
            </label>
            {/* `text-md` for the same `TS2` reason as the inputs above: a `<select>` is a form
                control, and Safari zooms on its focus at 14px exactly as it does on a text field. */}
            <select
              id="city"
              name="city"
              disabled
              className="mt-stack-2xs w-full rounded-control border border-input bg-surface-disabled px-inset-md py-inset-sm text-md text-content-disabled"
            >
              {CITIES.map((city) => (
                <option key={city.slug} value={city.slug}>
                  {city.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="about" className="block text-sm font-medium text-content">
              {t('web.forGyms.signup.field.about')}
            </label>
            {/* `text-md`, `TS2` again. A textarea is the one an owner types the most into, so it
                is the one where a viewport that zoomed in and stayed there costs the most. */}
            <textarea
              id="about"
              name="about"
              rows={4}
              disabled
              className="mt-stack-2xs w-full rounded-control border border-input bg-surface-disabled px-inset-md py-inset-sm text-md text-content-disabled"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled
          aria-disabled="true"
          className="gm-hit-target mt-stack-xl w-full rounded-control bg-surface-disabled px-inset-lg py-inset-sm text-md font-semibold text-content-disabled"
        >
          {t('web.forGyms.signup.submit')}
        </button>
      </form>

      <p className="mt-stack-lg max-w-prose text-sm text-content-muted">
        {t('web.forGyms.signup.verifyNote')}
      </p>
    </div>
  );
}
