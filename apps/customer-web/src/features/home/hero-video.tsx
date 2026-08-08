'use client';

/**
 * `SCR-WEB-001` — the hero's background loop, and the control that stops it.
 *
 * ┌─ THE ONLY CLIENT ISLAND ON THE HOME PAGE, AND IT EARNS IT ──────────────────────────────────┐
 * │ `FR-SRCH-13` needs this page server-rendered for the crawler, so `page.tsx` stays a Server  │
 * │ Component and this file is the one thing that opts in. It has to: WCAG 2.2.2 requires a     │
 * │ mechanism to stop motion that runs longer than five seconds, and a control needs state.     │
 * │                                                                                              │
 * │ The headline, the subtitle and the search form all render on the server. A crawler with no  │
 * │ JavaScript sees the entire hero minus the decoration, which is the correct split.           │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 *
 * ┌─ TWO COMPONENTS, AND THE VIDEO ELEMENT IS THE STATE THEY SHARE ─────────────────────────────┐
 * │ They cannot be one. The video must be `absolute` against the SECTION, and the control must  │
 * │ sit in the content column — inside the opaque band, because a control whose own contrast    │
 * │ depends on the frame behind it has the problem this surface exists to avoid. A single       │
 * │ component renders both in one place, and a React context would drag `'use client'` up onto  │
 * │ the section and cost the server rendering.                                                   │
 * │                                                                                              │
 * │ So the toggle reads the element and subscribes to its `play` / `pause` events. That is not   │
 * │ a workaround: the media element already IS the authority on whether it is playing, and a    │
 * │ mirrored `useState` in a parent would be a second copy that can disagree with it — which it │
 * │ would, the first time the browser paused the video on tab blur.                              │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 *
 * The video is DECORATION: `aria-hidden`, no caption track, and a visitor who never sees it has
 * lost nothing. `muted` is not a courtesy — it is the reason autoplay is permissible at all.
 * `preload="metadata"`, so 2.5 MB does not compete with the LCP text on 4G (`NFR-PERF-02`).
 */

import { useCallback, useEffect, useState } from 'react';

import { t } from '../../shared/i18n/index.ts';

const VIDEO_ID = 'gm-hero-loop';

/** `navigator.connection` is not in the DOM lib. Narrowed rather than casting the navigator. */
interface DataSaverNavigator extends Navigator {
  readonly connection?: { readonly saveData?: boolean };
}

function prefersLessData(): boolean {
  if (typeof navigator === 'undefined') return false;
  return (navigator as DataSaverNavigator).connection?.saveData === true;
}

function prefersLessMotion(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * `.play()` rejects when the browser declines, and the rejection must be handled EXPLICITLY or it
 * reaches Sentry (`A-15`) as an unhandled rejection from every iPhone in low-power mode. Being
 * declined is a supported outcome here, not an error.
 */
function attemptPlay(el: HTMLVideoElement): void {
  void el.play().catch(() => undefined);
}

// ─────────────────────────────────────────────────────────────────────────────
// The layer
// ─────────────────────────────────────────────────────────────────────────────

export function HeroVideo() {
  /** Separate from playback: the fade must not start until there is a frame to fade in. */
  const [ready, setReady] = useState(false);

  const onLoaded = useCallback((el: HTMLVideoElement | null) => {
    if (!el) return;
    /*
     * `RM1`'s duration collapse cannot help here. The motion rules are explicit that anything
     * looping goes STATIC under reduced motion rather than fast — a 1 ms infinite loop is still
     * an infinite loop. So the question is whether to start at all, not how quickly.
     *
     * Data-saver joins it for a different reason and the same answer: a visitor who asked their
     * browser to spend less data meant exactly this kind of megabyte.
     */
    if (prefersLessMotion() || prefersLessData()) return;
    attemptPlay(el);
  }, []);

  return (
    <video
      id={VIDEO_ID}
      ref={onLoaded}
      // Decoration. A screen reader that announces "video" here has nothing to offer next.
      aria-hidden="true"
      // Without this the element is focusable in some browsers, putting a Tab stop that does
      // nothing between the skip link and the search box.
      tabIndex={-1}
      muted
      loop
      // Required on iOS, or the video takes over the screen the moment it plays.
      playsInline
      preload="metadata"
      disablePictureInPicture
      onCanPlay={() => setReady(true)}
      data-ready={ready ? 'true' : 'false'}
      className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-0 transition-opacity duration-deliberate ease-enter data-[ready=true]:opacity-100 motion-reduce:transition-none"
    >
      <source src="/herosection.mp4" type="video/mp4" />
    </video>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// The control — WCAG 2.2.2
// ─────────────────────────────────────────────────────────────────────────────

export function HeroMotionToggle() {
  const [playing, setPlaying] = useState(false);
  /** Until hydration the control would lie about the state, so it renders nothing. */
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const el = document.getElementById(VIDEO_ID);
    if (!(el instanceof HTMLVideoElement)) return;

    const sync = () => setPlaying(!el.paused);
    sync();
    el.addEventListener('play', sync);
    el.addEventListener('pause', sync);
    return () => {
      el.removeEventListener('play', sync);
      el.removeEventListener('pause', sync);
    };
  }, []);

  const toggle = useCallback(() => {
    const el = document.getElementById(VIDEO_ID);
    if (!(el instanceof HTMLVideoElement)) return;
    if (el.paused) attemptPlay(el);
    else el.pause();
  }, []);

  /*
   * Nothing before hydration, and nothing when the video never started. A pause button beside a
   * still frame is a control that does not describe what the visitor is looking at — and under
   * reduced motion there is no motion to stop, so 2.2.2 asks for nothing.
   */
  if (!mounted) return null;

  return (
    <button
      type="button"
      onClick={toggle}
      // `data-on-media` inverts the focus ring to `content-on-media`. `data-on-solid` looks like
      // the right attribute and is not: it resolves to `content-inverse`, which goes near-black
      // in dark theme and vanishes against this band.
      data-on-media="true"
      // No opacity modifier. It would read as "secondary" and would also put a pairing on screen
      // that the §3.6 register does not contain; size and weight carry the hierarchy instead.
      className="gm-hit-target inline-flex items-center gap-inline-xs rounded-control px-inset-sm py-inset-2xs text-xs font-medium text-content-on-media"
    >
      <span aria-hidden="true" className="text-sm leading-none">
        {playing ? '❚❚' : '▶'}
      </span>
      {playing ? t('web.home.hero.motionPause') : t('web.home.hero.motionPlay')}
    </button>
  );
}
