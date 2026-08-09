/**
 * A listing's cover, with the disclosure attached to it.
 *
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * ONE COMPONENT, SO THE PHOTO AND THE MARKER CANNOT BE SEPARATED
 *
 * The fixtures' covers are Pexels stock and the `photoAlt` values say so - "barbell floor". Beside
 * a gym's name and a "Verified" badge that composite claims something false, and the page-level
 * sample banner does not travel with a screenshot of one card.
 *
 * So the marker is part of the image, not part of the page. Every surface that shows a cover gets
 * both or neither, because there is one component and it renders both.
 *
 * ┌─ THE `fill` TRAP, WHICH THIS FILE EXISTS PARTLY TO CONTAIN ─────────────────────────────────┐
 * │ `fill` is the natural prop for a photo in an aspect-ratio box and it is ENTIRELY an inline   │
 * │ style. `style-src` carries a nonce, and by CSP-3 §6.7.3.2 a nonce never applies to an        │
 * │ attribute - so the browser drops the positioning, keeps the markup, and the photo renders    │
 * │ clipped at its natural size instead of covering its box. It looks nearly right, which is why │
 * │ it shipped once.                                                                             │
 * │                                                                                             │
 * │ Intrinsic `width`/`height` plus `h-full w-full object-cover` is the same layout from the     │
 * │ stylesheet, and it behaves the same in Safari, which does not implement `style-src-attr`.    │
 * │ `shell.spec.ts` asserts this shape across every image on the site.                            │
 * └─────────────────────────────────────────────────────────────────────────────────────────────┘
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

import Image from 'next/image';

import { t } from '../../shared/i18n/index.ts';
import { artFor } from './gym-art.ts';

/**
 * The three fields a cover needs, not the whole listing.
 *
 * `SearchResult` is a narrower record than `GymDetail` - it carries no `plans`, no `gallery`, no
 * opening hours - and the results card renders one. Asking for `GymDetail` made this component
 * unusable on the surface it was written for; asking for what it reads works on both and says
 * what it actually depends on.
 */
export function GymPhoto({
  gym,
  sizes,
  className = '',
}: {
  readonly gym: { readonly id: string; readonly photo: string; readonly photoAlt: string };
  /** What the image really occupies, so Next does not serve a phone the desktop candidate. */
  readonly sizes: string;
  readonly className?: string;
}) {
  return (
    <span className={`gm-photo ${className}`}>
      {gym.photo === '' ? (
        // No cover at all: the drawn ground rather than an empty box.
        <span aria-hidden="true" className={`gm-photo-art ${artFor(gym)}`} />
      ) : (
        <>
          <Image
            src={gym.photo}
            alt={gym.photoAlt}
            width={1200}
            height={675}
            sizes={sizes}
            // `text-transparent` replaces the `color:transparent` Next sets inline, for the same
            // CSP reason as above: it stops alt text painting over the box while the bytes are in
            // flight, and it has to come from the stylesheet to survive the policy.
            className="h-full w-full object-cover text-transparent"
            // §9.4 — a gym owner comparing their own cover across themes must see the same photo.
            data-photo="true"
          />
          {/*
           * Not `aria-hidden`. A screen-reader user is told the photo is a sample for the same
           * reason a sighted one is, and the alt text alone ("barbell floor") does not say it.
           */}
          <span className="gm-photo-sample">{t('web.gym.samplePhoto')}</span>
        </>
      )}
    </span>
  );
}
