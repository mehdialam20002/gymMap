/**
 * `SCR-WEB-003`'s photo mosaic — `FR-DETL-02`.
 *
 * ┌─ NO LIGHTBOX, AND THAT IS A DECISION ──────────────────────────────────────────────────────┐
 * │ Every marketplace gallery opens full-screen on click. Doing it properly means a focus trap, │
 * │ Escape, arrow-key paging, a restored scroll position and an announced position in the set — │
 * │ and doing it improperly means a keyboard user who can open it and cannot get out.           │
 * │                                                                                             │
 * │ It is also client JavaScript on the page whose LCP is a photograph. Until there is a reason │
 * │ beyond "other sites have one", the mosaic renders every photo at a size worth looking at    │
 * │ and no photo is hidden behind an interaction. Nothing here is lost — there is no "+12 more" │
 * │ overlay, because there are four photos and all four are on the page.                         │
 * └─────────────────────────────────────────────────────────────────────────────────────────────┘
 *
 * ┌─ `priority` ON THE LEAD IMAGE ONLY ────────────────────────────────────────────────────────┐
 * │ It is the LCP element on this route, so it is preloaded and never lazy. The other three are │
 * │ below or beside it and stay lazy — marking all four `priority` is the usual over-correction │
 * │ and it makes the page slower by making the browser fetch four large images at once,          │
 * │ competing with the one that actually decides the score (`NFR-PERF-02`).                      │
 * └─────────────────────────────────────────────────────────────────────────────────────────────┘
 */

import Image from 'next/image';

import { t } from '../../shared/i18n/index.ts';
import type { GymDetail } from '../discovery/fixtures/catalogue.ts';

export function Gallery({ gym }: { readonly gym: GymDetail }) {
  // The cover leads; the gallery follows it. `GymDetail.gallery` excludes the cover by contract,
  // so this cannot render the same photograph twice.
  const rest = gym.gallery.slice(0, 4);

  return (
    <figure aria-label={t('web.gym.gallery.label')} className="mt-stack-lg">
      {/*
       * ┌─ THE ASPECT RATIO IS ON THE GRID, NOT ON THE TILES ────────────────────────────────────┐
       * │ Four columns of track (`2fr 1fr 1fr`) and two rows, with the LEAD spanning both rows.   │
       * │ Give the grid `3 / 1` and every tile falls out at 3:2 on its own: the lead is twice as  │
       * │ wide and twice as tall as a thumbnail, so one ratio on the container produces five      │
       * │ matching crops at every viewport width.                                                 │
       * │                                                                                        │
       * │ The first version put the ratio on the LEAD and let the thumbnail column stretch to     │
       * │ match. It did not: a `1fr` row inside an auto-height container sizes to its content, so │
       * │ three 1600px-wide photos made a 2,113px column beside a 586px photo and the page ran to │
       * │ 4,182px. A definite height on the container is what makes `1fr` mean "a share of it".   │
       * └────────────────────────────────────────────────────────────────────────────────────────┘
       *
       * ┌─ AND `minmax(0, …)` ON EVERY TRACK ────────────────────────────────────────────────────┐
       * │ A track written `2fr` is really `minmax(auto, 2fr)`, and `auto` as a MINIMUM means      │
       * │ min-content — which, for a track holding a 1600px-wide image, is 1600px. That is the    │
       * │ other half of how the grid came out 2,571px wide inside a 1,408px page. `minmax(0, …)`  │
       * │ lets the track go under its content's intrinsic width, which is what lets `object-cover`│
       * │ crop instead of letting the image push.                                                  │
       * └────────────────────────────────────────────────────────────────────────────────────────┘
       */}
      <div className="grid gap-inline-2xs overflow-hidden rounded-card sm:aspect-[3/1] sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)] sm:grid-rows-2">
        <div className="relative aspect-[4/3] min-h-0 min-w-0 bg-surface-sunken sm:col-span-1 sm:row-span-2 sm:aspect-auto">
          <Image
            src={gym.photo}
            alt={gym.photoAlt}
            width={1600}
            height={1067}
            // Sized for what it really occupies: half the container at `sm` and up, the full width
            // below it. Without this Next serves the largest candidate to a phone — `NFR-PERF-02`'s
            // budget spent on pixels nobody sees.
            // The wrap caps at 1150px, so past that the box stops growing and a `vw` unit does not.
            // `620px` is half the capped wrap; below it the viewport is still the constraint.
            sizes="(min-width: 1280px) 620px, (min-width: 640px) 50vw, 100vw"
            priority
            className="h-full w-full object-cover text-transparent"
            data-photo="true"
          />
        </div>

        {/*
         * Below `sm` the four thumbnails are a scrolling row rather than a 2×2 of stamps (`BP2`).
         * At `sm` the list becomes a nested 2×2 occupying the two narrow tracks.
         *
         * `display: contents` would have dissolved the list into the parent grid and saved a
         * nesting level. It is not used, because `display: contents` on a `<ul>` has a history of
         * dropping the list out of the accessibility tree — the tiles would stop being announced
         * as a list of four. A nested grid costs one element and raises no such question.
         */}
        <ul className="gm-scroll-row flex min-h-0 min-w-0 gap-inline-2xs overflow-x-auto sm:col-span-2 sm:row-span-2 sm:grid sm:grid-cols-2 sm:grid-rows-2 sm:overflow-visible">
          {rest.map((photo) => (
            <li
              key={photo.src}
              className="relative aspect-[4/3] w-[45%] shrink-0 bg-surface-sunken sm:aspect-auto sm:min-h-0 sm:min-w-0 sm:w-auto"
            >
              <Image
                src={photo.src}
                alt={photo.alt}
                width={1600}
                height={1067}
                sizes="(min-width: 1280px) 25vw, (min-width: 640px) 25vw, 45vw"
                className="h-full w-full object-cover text-transparent"
                data-photo="true"
              />
            </li>
          ))}
        </ul>
      </div>

      <figcaption className="mt-stack-2xs text-sm text-content-muted">
        {t('web.gym.gallery.provenance')}
      </figcaption>
    </figure>
  );
}
