'use client';

/**
 * The theme control — `DesignSystem.md` §9.2 `DM1`-`DM4`.
 *
 * ┌─ THREE STATES, BECAUSE TWO OF THEM WERE A ONE-WAY DOOR ─────────────────────────────────────┐
 * │ This was `type Theme = 'light' | 'dark'` and a button that flipped between them. One tap     │
 * │ wrote `localStorage.gm-theme` and from that moment the two explicit themes were the only     │
 * │ states reachable: a member who tapped once to look had opted out of their own device         │
 * │ permanently, including its automatic evening switch. There was no way back.                   │
 * │                                                                                              │
 * │ So the state is now a MODE, and `system` is the third: light, dark, or whatever the device   │
 * │ says right now and keeps saying as the day goes on.                                          │
 * │                                                                                              │
 * │ `system` does NOT mean "no stored preference". That distinction is the whole of the          │
 * │ correctness here and it is spelled out at `applyMode` below.                                  │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 *
 * ┌─ IT IS A DISCLOSURE NOW, NOT A BUTTON THAT FLIPS, AND THAT COST A DOCTRINE ─────────────────┐
 * │ The note that used to sit here argued for a plain button whose accessible name is the        │
 * │ DESTINATION - "switch to the light theme" - against `role="switch"`, which announces a state │
 * │ and leaves the reader to infer the action. That argument is still right and it stops         │
 * │ applying at three states, because there is no longer A destination: a control cycling        │
 * │ light → dark → system names one third of what it does and hides the rest, and a member       │
 * │ cannot see from the outside which of the three they are in.                                   │
 * │                                                                                              │
 * │ A trigger that opens a group of three named radios says both halves at once: the checked     │
 * │ option IS the state, and choosing one IS the action. `aria-expanded` tells a screen-reader    │
 * │ user the trigger opens something rather than performing something, which is what keeps the    │
 * │ name "Switch theme, Dark" from reading as "switch theme to dark".                             │
 * │                                                                                              │
 * │ The glyph follows: it shows the theme the page is CURRENTLY painting, not a destination.      │
 * │ `icons/index.tsx` still carries a comment saying the theme control names its destination -    │
 * │ that comment is now stale and belongs to whoever owns that file.                              │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 *
 * ┌─ WHY A PANEL AND NOT THREE SEGMENTS IN THE BAR - MEASURED, NOT PREFERRED ───────────────────┐
 * │ A segmented control is the obvious shape for three states and it does not fit. `AX3` wants   │
 * │ 44px in EACH dimension per target, so three of them is 132px against the 44px this control    │
 * │ occupies today, and the header has nowhere near 88px to give. Measured on the shipped build,  │
 * │ as free space between the brand and the right-hand cluster below `lg`, and as the slack       │
 * │ above the nav list's own intrinsic width at and above it:                                     │
 * │                                                                                              │
 * │     320   85px       768   427px      1280   328px                                            │
 * │     390  155px      1024    88px      1536   328px                                            │
 * │                                                                                              │
 * │ 1024 is the binding case at 88px, and 320 is 85px. A third and fourth 44px target spends all  │
 * │ of it and the nav wraps to its own line - the sticky header gets taller on the two widths      │
 * │ with the least room. So the trigger keeps the exact geometry it had, to the class, and the     │
 * │ three states live in a panel that costs the bar nothing.                                       │
 * │                                                                                              │
 * │ What that trades away is stated rather than hidden: with the panel closed, a sighted member   │
 * │ sees the theme the page is in but not whether it was CHOSEN or is being FOLLOWED. One tap     │
 * │ shows it, and the accessible name carries it at all times.                                     │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 *
 * ┌─ WHY THIS IS A CLIENT ISLAND WHEN ALMOST NOTHING ELSE HERE IS ──────────────────────────────┐
 * │ `FR-SRCH-13` keeps the marketing surface server-rendered, and the rule has teeth: the hero,  │
 * │ the sections and the results are all server components. This one cannot be. The preference   │
 * │ lives in `localStorage` and on the DOM element, both of which exist only in a browser, and   │
 * │ the control has to reflect the value the pre-paint script already applied.                    │
 * │                                                                                              │
 * │ It is kept to exactly that: no context, no provider, no store. The state of record is the    │
 * │ `data-theme` attribute on `<html>`, which the inline script in `layout.tsx` sets before the  │
 * │ first paint. This component READS that attribute on mount and writes it on click. Two other  │
 * │ implementations of the same fact would be two chances to disagree with each other.            │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 *
 * Motion is deliberately absent from the panel, for the reason `mobile-nav.tsx` gives about the
 * drawer: a preference surface a returning visitor opens repeatedly is one they would wait for
 * every time. The rows take `duration-fast` on colour only, which is hover feedback (`MO1`).
 */

import { useEffect, useId, useRef, useState } from 'react';

import { t, type MessageKey } from '../i18n/index.ts';
import { icon } from '../icons/index.tsx';
import { THEME_MODE_STORAGE_KEY, THEME_STORAGE_KEY } from './theme-script.ts';

/** What the page can PAINT. Two, and only two, because the stylesheet has two palettes. */
type Theme = 'light' | 'dark';
/** What the member can CHOOSE. Three: the two themes, or "whatever the device is saying". */
type Mode = Theme | 'system';

/**
 * The second key, and the reason there are two.
 *
 * ┌─ `gm-theme` IS A PRE-PAINT CACHE, NOT THE PREFERENCE - `theme-script.ts` SAYS SO ───────────┐
 * │ `DM4` in that file: "localStorage is the pre-paint cache, not the record." That is exactly   │
 * │ what makes this work. `gm-theme` keeps holding `light` or `dark` - the palette to paint      │
 * │ next time - because that is the only vocabulary the inline bootstrap understands, and the    │
 * │ bootstrap is not this component's to change. The MODE goes in its own key beside it.          │
 * │                                                                                              │
 * │ Storing `system` in `gm-theme` instead would have been one key and one bug: the bootstrap    │
 * │ matches `t==='dark'||t==='light'`, so `system` sets no attribute, the page paints the        │
 * │ default DARK, and a member following a light device would get a full-page flash to light on  │
 * │ every single load. With the resolved theme cached, the bootstrap paints correctly with no    │
 * │ change to it at all.                                                                          │
 * │                                                                                              │
 │ The narrow case that was left - the device flips while the member is away, so the cached     │
 * │ palette is a load out of date and the correction lands after hydration - is closed now. The  │
 * │ pre-paint script resolves `system` itself, so this constant lives beside `THEME_STORAGE_KEY` │
 * │ in `theme-script.ts` and both halves read the same name.                                      │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 */

/**
 * Consulted ONLY once a member has explicitly asked to follow the device.
 *
 * ┌─ THIS DOES NOT CONTRADICT THE OWNER INSTRUCTION IN `globals.css` ───────────────────────────┐
 * │ That instruction governs the DEFAULT: `:root:not([data-theme='light'])` deliberately ignores │
 * │ `prefers-color-scheme` because "the default is a product decision, not a guess about the     │
 * │ reader, and the toggle is how they say otherwise". The un-stamped first visit still never    │
 * │ asks the device anything - nothing below runs until a member has picked `system`, which is   │
 * │ the toggle being used to say otherwise. `DM1`'s "an explicit choice wins" is the same rule.   │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 */
const DEVICE_DARK_QUERY = '(prefers-color-scheme: dark)';

/**
 * The three states, in the order they are offered. `name` is what the option IS; `action` is what
 * choosing it will do, and rides on `title` so a pointer user gets the sentence without the row
 * having to carry it at `AX3` width.
 */
const MODES = [
  { mode: 'light', name: 'web.chrome.theme.light', action: 'web.chrome.theme.toLight' },
  { mode: 'dark', name: 'web.chrome.theme.dark', action: 'web.chrome.theme.toDark' },
  { mode: 'system', name: 'web.chrome.theme.system', action: 'web.chrome.theme.toSystem' },
] as const satisfies readonly { mode: Mode; name: MessageKey; action: MessageKey }[];

/*
 * Plain string constants, concatenated at the call site — `shell.spec.ts` fails the build on an
 * arbitrary utility inside a template literal that also carries an interpolation, because
 * Tailwind's extractor does not reliably see it there and the rule is then silently absent.
 * `min-h-[2.75rem]` is exactly such a value, and it is the one carrying `AX3`.
 */
const TRIGGER =
  'gm-lift inline-flex h-[2.75rem] w-[2.75rem] items-center justify-center rounded-full border border-strong text-content transition-colors duration-fast ease-standard hover:border-brand';

const PANEL =
  'absolute right-0 top-full z-popover mt-inset-2xs w-[10rem] rounded-card border border-strong bg-surface p-inset-2xs shadow-lg';

/*
 * 44px of REAL height on each row, not `gm-hit-target`. That class reaches 44 by growing an
 * absolutely positioned `::after`, and any ancestor that is not `overflow: visible` clips the
 * growth away while the class still reports itself satisfied — the trap this stylesheet has now
 * been caught by six times. The rows are the panel's full width (160px less its 4px padding), so
 * the other dimension is not close.
 */
const OPTION =
  'flex min-h-[2.75rem] w-full items-center rounded-control px-inset-sm text-sm text-content transition-colors duration-fast ease-standard';
/*
 * Weight AND tint, never tint alone — `AX8`. Same pair the drawer's current row uses in
 * `mobile-nav.tsx`, so "this is the one you are on" looks the same in both places, and
 * `aria-checked` carries it for anyone who sees neither.
 */
const OPTION_IDLE = OPTION + ' font-medium hover:bg-surface-sunken';
const OPTION_ON = OPTION + ' bg-surface-sunken font-semibold';

/**
 * Both axes, because a radio group's orientation is a layout fact and a keyboard reader should not
 * have to know which one this is. The list is vertical, so Down and Right both mean "the next one".
 */
const ARROW_STEP: Record<string, number> = {
  ArrowDown: 1,
  ArrowRight: 1,
  ArrowUp: -1,
  ArrowLeft: -1,
};

/** What the device is asking for at this instant. */
function deviceTheme(): Theme {
  return window.matchMedia(DEVICE_DARK_QUERY).matches ? 'dark' : 'light';
}

/**
 * What the page is showing right now, read from the element the bootstrap script writes.
 *
 * ┌─ THE FALLBACK HAS TO MIRROR THE STYLESHEET'S SELECTOR, NOT THE OS ─────────────────────────┐
 * │ The customer site's dark palette is applied by `:root:not([data-theme='light'])`, which     │
 * │ matches an element with NO attribute - so the absent case, which is every first visit, is   │
 * │ DARK. `light` is therefore only correct when the attribute says so.                          │
 * │                                                                                             │
 * │ This read `=== 'dark' ? 'dark' : 'light'` while the stylesheet said the opposite, and the   │
 * │ two disagreed on exactly one state: the first visit. The header showed a moon and announced │
 * │ "switch to the dark theme" on a page that was already dark, and the click set               │
 * │ `data-theme="dark"` - which the palette block was already matching, so nothing changed. The │
 * │ control appeared broken, and only the second click reached light.                            │
 * │                                                                                             │
 * │ Reading `prefers-color-scheme` here would be the intuitive version and would be a different │
 * │ bug: the stylesheet does not consult the OS, so the control must not either. `deviceTheme`  │
 * │ above is not that - it runs only for a member who has asked for it by name.                  │
 * └─────────────────────────────────────────────────────────────────────────────────────────────┘
 */
function currentTheme(): Theme {
  return document.documentElement.dataset['theme'] === 'light' ? 'light' : 'dark';
}

/**
 * The mode of record.
 *
 * The fallback is `currentTheme()` rather than a constant, and that covers the two populations
 * this change inherits: a member who chose light or dark before the third state existed has a
 * `gm-theme` and no mode, and reads back as exactly the theme they are looking at; a first visit
 * has neither and reads back `dark`, which is what the stylesheet is painting. Either way the
 * control reports the state the page is actually in and never a guess.
 */
function storedMode(): Mode {
  try {
    const stored = localStorage.getItem(THEME_MODE_STORAGE_KEY);
    if (stored === 'light' || stored === 'dark' || stored === 'system') return stored;
  } catch {
    // `DM4` — Safari private mode and sandboxed iframes throw on read as well as on write.
  }
  return currentTheme();
}

/**
 * Paints a mode and remembers it. Returns the theme that ended up on screen, which is the only
 * thing the caller cannot work out for itself when the mode is `system`.
 *
 * Both keys are written together, always. `gm-theme` is what the next pre-paint reads and must
 * therefore be a palette name; `gm-theme-mode` is what THIS control reads and must be the choice.
 * Splitting the two writes is how they drift.
 */
function applyMode(mode: Mode): Theme {
  const theme = mode === 'system' ? deviceTheme() : mode;
  document.documentElement.dataset['theme'] = theme;
  try {
    localStorage.setItem(THEME_MODE_STORAGE_KEY, mode);
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // `DM4` - Safari private mode and sandboxed iframes throw here. The theme still changed for
    // this page; only the memory of it is lost, and that is not worth breaking the click over.
  }
  return theme;
}

export function ThemeToggle() {
  /*
   * `null` until mounted, and the button renders its markup either way.
   *
   * The server cannot know the theme, so any initial guess is wrong half the time and React would
   * swap the icon on hydration - a visible flicker in the chrome on every page load. Rendering the
   * control with no icon and no name until the effect runs would be worse: the button would be
   * briefly unlabelled for a screen reader. So the markup is stable and only the attributes that
   * depend on the theme wait, which is one paint and no layout shift.
   */
  const [mode, setMode] = useState<Mode | null>(null);
  const [theme, setTheme] = useState<Theme | null>(null);
  const [open, setOpen] = useState(false);

  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const groupRef = useRef<HTMLDivElement>(null);
  const panelId = useId();

  useEffect(() => {
    const stored = storedMode();
    setMode(stored);
    /*
     * `system` is re-applied on mount and the other two are not, and the asymmetry is the point:
     * an explicit theme is already on the element and re-writing it would be a no-op, whereas a
     * followed theme may be a load out of date if the device flipped while the member was away.
     * Re-resolving is the correction. It is also the only case that can repaint after hydration,
     * which is what the `theme-script.ts` diff in the report removes.
     */
    setTheme(stored === 'system' ? applyMode('system') : currentTheme());
  }, []);

  /*
   * The evening switch, which is most of what `system` is FOR. Without this the mode would resolve
   * once per page load and a member reading through sunset would sit on the morning's theme until
   * they navigated.
   */
  useEffect(() => {
    if (mode !== 'system') return;
    const device = window.matchMedia(DEVICE_DARK_QUERY);
    const follow = () => {
      setTheme(applyMode('system'));
    };
    device.addEventListener('change', follow);
    return () => {
      device.removeEventListener('change', follow);
    };
  }, [mode]);

  /*
   * Escape and a pointer outside, both on the document and both in the CAPTURE phase so a handler
   * further down that stops propagation cannot leave the panel stuck open. Escape returns focus to
   * the trigger; a click elsewhere does not, because the pointer has already chosen where to go
   * and moving focus behind it would be a second, unasked-for jump.
   */
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      const root = rootRef.current;
      if (root?.contains(event.target as Node)) return;
      /*
       * Only when focus is actually inside the panel that is about to be hidden. Hiding the
       * element that holds focus drops it on `<body>`, and the next Tab then restarts at the top
       * of the document - which reads as the page having jumped. Moving it to the trigger first
       * costs nothing in the ordinary case, where the pointer is on its way to something else that
       * will take focus a moment later anyway.
       */
      if (root?.contains(document.activeElement)) triggerRef.current?.focus();
      setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setOpen(false);
      triggerRef.current?.focus();
    };
    document.addEventListener('pointerdown', onPointerDown, true);
    document.addEventListener('keydown', onKeyDown, true);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true);
      document.removeEventListener('keydown', onKeyDown, true);
    };
  }, [open]);

  /*
   * Opening puts focus on the CHECKED option, not the first one. That is the radio-group contract
   * (`AX2`): the group is entered where the reader already is, so the first arrow key moves one
   * step rather than jumping them somewhere they did not ask to be.
   */
  useEffect(() => {
    if (!open) return;
    groupRef.current?.querySelector<HTMLElement>('[aria-checked="true"]')?.focus();
  }, [open]);

  function choose(next: Mode, dismiss: boolean) {
    setTheme(applyMode(next));
    setMode(next);
    if (!dismiss) return;
    setOpen(false);
    triggerRef.current?.focus();
  }

  /**
   * Arrow keys move and select in one step, which is what a radio group does everywhere else.
   * Selecting as you move means the page changes theme under the cursor, and here that is the
   * feature rather than a side effect: the reader is choosing a look and can see all three.
   *
   * Returns whether the key was ours, so the caller knows whether to take it off the page — the
   * arrows are the document's scroll keys and swallowing them unconditionally would be worse than
   * not handling them at all.
   */
  function moveSelection(key: string): boolean {
    const step = ARROW_STEP[key] ?? 0;
    if (step === 0) return false;
    const at = MODES.findIndex((option) => option.mode === mode);
    if (at < 0) return false;
    const to = (at + step + MODES.length) % MODES.length;
    const next = MODES[to];
    if (!next) return false;
    choose(next.mode, false);
    /*
     * Focus is moved on the DOM node rather than through state. The node already exists and its
     * `tabIndex` is about to become 0 in the same commit; waiting for React to re-render before
     * focusing would put the two a frame apart and the keyboard reader hears the old row.
     */
    groupRef.current?.querySelectorAll<HTMLButtonElement>('[role="radio"]')[to]?.focus();
    return true;
  }

  /*
   * The glyph is the theme the page is PAINTING, so `null` and `dark` render the same moon - which
   * is the same reasoning as `currentTheme()`'s fallback, and for the same reason: the un-stamped
   * element is dark, so the pre-mount paint and the mounted one agree on every visit except one
   * where a member has stored `light`, and that one is a single glyph swap with no layout in it.
   */
  const Glyph = theme === 'light' ? icon.themeLight : icon.themeDark;
  const stateName = MODES.find((option) => option.mode === mode)?.name;

  return (
    /*
     * `relative` anchors the panel and `flex` keeps this wrapper exactly the button's box: a block
     * wrapper around an `inline-flex` child inherits the line box's leading and would have made
     * this element a few pixels taller than the 44px control inside it, which on a sticky bar
     * measured to `--gm-chrome-height` is a change nobody would look for.
     */
    <div
      ref={rootRef}
      className="relative flex items-center"
      onBlur={(event) => {
        // Tab out of the last row, which neither the pointer nor Escape handler can see.
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false);
      }}
    >
      {/*
       * `text-content`, NOT `text-content-on-media`.
       *
       * ┌─ THE ROLE WAS RIGHT UNTIL THE PANEL UNDER IT LEARNED TO FLIP ──────────────────────────┐
       * │ `content-on-media` is pinned near-white in BOTH themes, because it is the ink for       │
       * │ things that sit on a photograph. This control sits on `.gm-chrome-glass`, which tints   │
       * │ with `surface-default` - so in the light theme the pill is white and the glyph was      │
       * │ `#f4f5f2` on it: 1.05:1, measured, which is not "hard to see" but gone. The button was  │
       * │ still there, still 44px, still focusable and still announced; only the picture of it    │
       * │ was missing, which is why nothing failed.                                               │
       * │                                                                                        │
       * │ `content-primary` is what the pane itself sets as its `color`, so the control takes its │
       * │ ink from the same place as the ground it prints on and cannot drift from it again.      │
       * │                                                                                        │
       * │ `data-on-media` went with it: that attribute paints the FOCUS RING in the same pinned   │
       * │ near-white, so keyboard focus was invisible on the light pill for the same reason.      │
       * └────────────────────────────────────────────────────────────────────────────────────────┘
       *
       * The accessible name is built from two hidden spans rather than an `aria-label`, so it can
       * carry the control AND the state without a composed string the catalogue does not have and
       * without a separator literal, which `I18N1` would be right to flag. Before mount only the
       * first exists: the server cannot know the mode, and a control that announces the wrong one
       * for a paint is worse than one that announces less.
       */}
      <button
        ref={triggerRef}
        type="button"
        onClick={() => {
          setOpen((was) => !was);
        }}
        aria-expanded={open}
        aria-controls={panelId}
        title={t('web.chrome.theme.toggle')}
        className={TRIGGER}
      >
        <Glyph aria-hidden="true" className="h-[1rem] w-[1rem]" />
        <span className="gm-visually-hidden">{t('web.chrome.theme.toggle')}</span>
        {stateName ? <span className="gm-visually-hidden">{t(stateName)}</span> : null}
      </button>

      {/*
       * Rendered always and hidden with the attribute, so `aria-controls` points at an element
       * that exists in both states. Pointing it at nothing while collapsed is the common shortcut
       * and it is a dangling IDREF, which is the one thing a validator will not forgive.
       */}
      <div
        id={panelId}
        ref={groupRef}
        role="radiogroup"
        aria-label={t('web.chrome.theme.toggle')}
        hidden={!open}
        className={PANEL}
      >
        {MODES.map((option) => (
          <button
            key={option.mode}
            type="button"
            role="radio"
            aria-checked={option.mode === mode}
            /*
             * Roving tab stop. Exactly one radio is in the tab order and the arrows move between
             * them, so Tab enters the group once and leaves it once rather than costing three
             * stops on the way past a control most readers are not using.
             */
            tabIndex={option.mode === mode ? 0 : -1}
            title={t(option.action)}
            onClick={() => {
              choose(option.mode, true);
            }}
            /*
             * On the radio, not on the group. A `<button>` is focusable and an arrow key only
             * reaches a handler on the element that HAS focus, so the group-level version needed
             * `tabIndex` on a container that must never be a tab stop to satisfy the same rule.
             */
            onKeyDown={(event) => {
              if (moveSelection(event.key)) event.preventDefault();
            }}
            className={option.mode === mode ? OPTION_ON : OPTION_IDLE}
          >
            {t(option.name)}
          </button>
        ))}
      </div>
    </div>
  );
}
