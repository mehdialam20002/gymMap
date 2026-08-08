/**
 * The overlay family's contract — `Components.md` §2, `AX2`, `AX8`, `RM1`.
 *
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * WHY THIS SUITE READS SOURCE INSTEAD OF RENDERING
 *
 * There is no jsdom and no React Testing Library in this repository, and neither has an approved
 * `A-NN` row — so a rendering test is not available to write and proposing one is a dependency
 * request, not a test.
 *
 * That is a real limit and it shapes what can be asserted here: these are STRUCTURAL properties
 * read out of the source, the same technique `apps/admin-dashboard/test/shell.spec.ts` uses. It
 * cannot prove that Tab actually cycles in a browser. It can prove that every overlay routes
 * through the one hook that implements cycling, that the hook handles both directions, and that
 * focus restoration exists — which are the three things that rot, because none of them looks
 * wrong when it is missing.
 *
 * Recorded in `KNOWN_LIMITATIONS.md` rather than left as an unstated gap.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SRC = join(dirname(fileURLToPath(import.meta.url)), '..', 'src');

/**
 * The file with comments blanked, newlines kept.
 *
 * The same discipline as the admin shell's spec, for the same reason: three tests in this
 * repository have now failed on their own documentation, because a scan for a code pattern matched
 * the doc comment explaining that pattern. A test that asserts something about CODE must not read
 * PROSE.
 */
function code(rel: string): string {
  const text = readFileSync(join(SRC, rel), 'utf8');
  let out = '';
  let i = 0;
  const blank = (s: string) => s.replace(/[^\n]/g, ' ');

  while (i < text.length) {
    const two = text.slice(i, i + 2);
    if (two === '//') {
      const end = text.indexOf('\n', i);
      const stop = end === -1 ? text.length : end;
      out += blank(text.slice(i, stop));
      i = stop;
    } else if (two === '/*') {
      const end = text.indexOf('*/', i + 2);
      const stop = end === -1 ? text.length : end + 2;
      out += blank(text.slice(i, stop));
      i = stop;
    } else if (two === '{/') {
      const end = text.indexOf('*/}', i);
      const stop = end === -1 ? text.length : end + 3;
      out += blank(text.slice(i, stop));
      i = stop;
    } else {
      out += text[i];
      i += 1;
    }
  }
  return out;
}

const OVERLAY = code('patterns/overlay.tsx');

/** The body of one exported function, from its signature to the next top-level `}`. */
function body(name: string): string {
  const start = OVERLAY.indexOf(`export function ${name}(`);
  assert.notEqual(start, -1, `${name} is not exported from patterns/overlay.tsx`);
  const next = OVERLAY.indexOf('\nexport function ', start + 1);
  return OVERLAY.slice(start, next === -1 ? OVERLAY.length : next);
}

// ═══════════════════════════════════════════════════════════════════════════
// One trap, used by all of them.
// ═══════════════════════════════════════════════════════════════════════════

test('every overlay routes through useOverlay rather than trapping focus itself', () => {
  // Six components each implementing the trap is six chances to forget one of its four parts, and
  // the part that gets forgotten is always focus restoration — because nothing LOOKS wrong.
  for (const component of ['Modal', 'Drawer', 'Dropdown']) {
    assert.match(
      body(component),
      /useOverlay\(/,
      `${component} does not call useOverlay, so it has its own focus handling to get wrong`,
    );
  }

  // ConfirmDialog composes Modal rather than repeating it, so it must NOT have its own trap.
  const confirm = body('ConfirmDialog');
  assert.match(confirm, /<Modal/, 'ConfirmDialog no longer composes Modal');
  assert.ok(
    !/useOverlay\(/.test(confirm),
    'ConfirmDialog has grown its own focus trap on top of the one Modal already provides',
  );
});

test('useOverlay restores focus in a cleanup function, not on a close handler', () => {
  const hook = body('useOverlay');

  // On the EFFECT's cleanup, so it fires however the overlay goes away — Escape, a scrim click, a
  // route change, or the parent simply unmounting. A restore that only runs inside `onClose` is
  // skipped by every path that does not call it, which is most of them.
  assert.match(hook, /restoreTo\.current\s*=\s*document\.activeElement/);
  assert.match(hook, /return\s*\(\)\s*=>\s*\{\s*restoreTo\.current\?\.focus\(\);?\s*\}/);
});

test('the Tab trap wraps in BOTH directions', () => {
  const hook = body('useOverlay');

  // A forward-only trap passes a casual test and leaks focus backwards out of the dialog, which is
  // worse than no trap because nobody re-checks it.
  assert.match(hook, /event\.shiftKey && document\.activeElement === firstItem/);
  assert.match(hook, /!event\.shiftKey && document\.activeElement === lastItem/);
});

test('Escape closes, and the handler runs before anything else in the overlay', () => {
  const hook = body('useOverlay');
  const escapeAt = hook.indexOf("event.key === 'Escape'");
  const tabAt = hook.indexOf("event.key !== 'Tab'");

  assert.ok(escapeAt > 0, 'useOverlay does not handle Escape');
  assert.ok(escapeAt < tabAt, 'the Tab guard returns before Escape is considered');
});

test('the focusable selector excludes tabindex="-1"', () => {
  // `[tabindex]` alone would include the scrim and the dialog container itself, both of which are
  // `-1` precisely so they are not tab stops. Including them makes the cycle land on an invisible
  // button and look like focus was lost.
  assert.match(OVERLAY, /\[tabindex\]:not\(\[tabindex="-1"\]\)/);
});

// ═══════════════════════════════════════════════════════════════════════════
// Naming and announcement.
// ═══════════════════════════════════════════════════════════════════════════

test('every dialog is modal and carries an accessible name', () => {
  for (const component of ['Modal', 'Drawer']) {
    const source = body(component);
    assert.match(source, /role="dialog"/, `${component} is not a dialog`);
    assert.match(source, /aria-modal="true"/, `${component} is not aria-modal`);
    // Without a name a dialog announces as "dialog" and tells a screen-reader user nothing about
    // what has just taken over their screen.
    assert.match(source, /aria-label=\{title\}/, `${component} has no accessible name`);
  }
});

test('title is a required prop on both dialogs, so a nameless one cannot compile', () => {
  for (const component of ['Modal', 'Drawer']) {
    const source = body(component);
    assert.match(
      source,
      /readonly title: string;/,
      `${component}.title is optional — a nameless dialog is representable`,
    );
  }
});

test('aria-hidden appears only on the scrim and on decorative glyphs', () => {
  // Never on the app root. Hiding the rest of the page needs a reference a component library does
  // not have, and getting it wrong hides the dialog itself.
  const occurrences = [...OVERLAY.matchAll(/aria-hidden="true"/g)];
  assert.ok(occurrences.length > 0, 'the scan is wrong, not the file');

  for (const match of occurrences) {
    // Look BACKWARDS to the tag this attribute belongs to. That is the question the test is really
    // asking - what kind of element is being hidden - and it does not depend on how long the
    // className happens to be. An earlier version looked forward for a class name and failed on
    // the scrim itself when the window was too short.
    const before = OVERLAY.slice(Math.max(0, match.index - 400), match.index);
    const tag = before.slice(before.lastIndexOf('<') + 1).split(/[\s>]/)[0] ?? '';
    const window = OVERLAY.slice(Math.max(0, match.index - 400), match.index + 420);

    // A `span` is an inline decorative glyph - an arrow, a warning sign, an ellipsis. Those carry
    // no focusable content and their meaning is always ALSO in adjacent text or an aria-label.
    if (tag === 'span') continue;

    // The only two non-span cases: the scrim, and the dropdown's outside-click layer. Both are
    // `tabIndex={-1}` buttons that exist to catch a click.
    const clickCatcher =
      /bg-surface-scrim/.test(window) || /fixed inset-0 z-sticky cursor-default/.test(window);
    assert.ok(
      clickCatcher,
      `aria-hidden was added to a <${tag}> that is neither a decorative span nor a click ` +
        `catcher. Hiding anything larger risks hiding focusable content from a screen reader ` +
        `while leaving it in the tab order:
${window.slice(300, 520)}`,
    );
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// ConfirmDialog — the reason is part of the confirmation.
// ═══════════════════════════════════════════════════════════════════════════

test('the confirm button is disabled until the reason clears its floor', () => {
  const confirm = body('ConfirmDialog');

  // Computed from the TRIMMED length, so twenty spaces is not a reason.
  assert.match(confirm, /reason\.minLength - text\.trim\(\)\.length/);
  assert.match(confirm, /disabled=\{!ready\}/);
  // A submit that fails validation after the click teaches the operator nothing, and on an audited
  // mutation it also means a round trip that was always going to be refused.
  assert.match(confirm, /const ready = short === 0/);
});

test('the reason is passed to onConfirm trimmed, and only the trimmed value', () => {
  const confirm = body('ConfirmDialog');
  assert.match(confirm, /onConfirm\(text\.trim\(\)\)/);
});

test('the reason box is cleared on OPEN, not on close', () => {
  const confirm = body('ConfirmDialog');

  // Cleared on open, so a reason typed against one gym cannot be submitted against the next one
  // after a mis-click. Clearing on close leaves the text alive for the window between two opens.
  assert.match(confirm, /if \(open\) setText\(''\);/);
});

test('a present reason prop means the reason is mandatory, not merely offered', () => {
  const confirm = body('ConfirmDialog');
  // Optional prop, non-optional contents: there is no `required` flag to forget to set, because the
  // presence of the object IS the requirement.
  assert.match(confirm, /readonly reason\?: \{[^}]*minLength: number \}/s);
  assert.ok(
    !/readonly required\??:/.test(confirm),
    'a `required` flag has appeared — presence of `reason` is meant to be the requirement',
  );
});

// ═══════════════════════════════════════════════════════════════════════════
// Toasts — a failure does not expire.
// ═══════════════════════════════════════════════════════════════════════════

test('only non-failure toasts get a timer', () => {
  const hook = body('useToasts');

  // A success that vanishes is fine: the screen behind it already shows the new state. A FAILURE
  // that vanishes is a bug report the operator cannot read twice — they looked away, the gym was
  // not suspended, and nothing on screen says so.
  const guardAt = hook.indexOf("if (tone !== 'danger')");
  const timerAt = hook.indexOf('setTimeout(');
  assert.ok(guardAt > 0, 'useToasts no longer guards the expiry timer on tone');
  assert.ok(guardAt < timerAt, 'the timer is set before the tone is checked, so failures expire');
});

test('the toast region is polite, never assertive', () => {
  const stack = body('ToastStack');

  // `alert`/assertive interrupts whatever a screen reader is mid-sentence on. For a "saved"
  // confirmation that is rude; for three queued toasts it is unusable.
  assert.match(stack, /aria-live="polite"/);
  assert.ok(!/role="alert"/.test(stack), 'the toast region became assertive');
});

test('every toast is dismissible, so a danger toast is never a dead end', () => {
  const stack = body('ToastStack');
  assert.match(stack, /onDismiss\(message\.id\)/);
  assert.match(stack, /aria-label=\{dismissLabel\}/);
});

// ═══════════════════════════════════════════════════════════════════════════
// Tooltip — never the only copy of anything.
// ═══════════════════════════════════════════════════════════════════════════

test('the tooltip text stays in the accessibility tree when visually hidden', () => {
  const tooltip = body('Tooltip');

  // `gm-visually-hidden`, not `hidden` and not conditional rendering. A tooltip is unreachable on
  // a touch screen and invisible to anyone navigating by the accessible tree without hovering, so
  // its text must be readable without a hover event they can never produce.
  assert.match(tooltip, /gm-visually-hidden/);
  assert.ok(
    !/\{shown && /.test(tooltip),
    'the tooltip is now conditionally rendered, so its text leaves the tree when not hovered',
  );
  assert.match(tooltip, /aria-describedby=\{id\}/);
});

test('the tooltip opens on focus as well as hover', () => {
  const tooltip = body('Tooltip');
  // `AX2` makes this console keyboard-first. A hint only a mouse can reach is a hint half the
  // operators never see.
  assert.match(tooltip, /onFocus=/);
  assert.match(tooltip, /onBlur=/);
  assert.match(tooltip, /onMouseEnter=/);
});

// ═══════════════════════════════════════════════════════════════════════════
// Dropdown — a disabled item still says why.
// ═══════════════════════════════════════════════════════════════════════════

test('a menu item can be disabled and still carry its reason', () => {
  const dropdown = body('Dropdown');

  // Hiding an action an operator cannot take yet makes the menu look complete when it is not, and
  // the operator concludes the feature does not exist.
  assert.match(dropdown, /disabled=\{item\.disabled === true\}/);
  assert.match(dropdown, /title=\{item\.hint\}/);
});

test('the menu closes via an overlay layer, not a document mousedown listener', () => {
  const dropdown = body('Dropdown');

  // A `document` mousedown listener also fires for the click that OPENED the menu unless the
  // handler compares the event target against the trigger — the bug every hand-rolled dropdown
  // ships with once.
  assert.ok(
    !/addEventListener\('mousedown'/.test(dropdown),
    'a document mousedown listener has appeared; see the note on Dropdown',
  );
  assert.match(dropdown, /fixed inset-0 z-sticky cursor-default/);
});

test('the trigger declares that it opens a menu, and whether it is open', () => {
  const dropdown = body('Dropdown');
  assert.match(dropdown, /aria-haspopup="menu"/);
  assert.match(dropdown, /aria-expanded=\{open\}/);
  assert.match(dropdown, /role="menu"/);
  assert.match(dropdown, /role="menuitem"/);
});

// ═══════════════════════════════════════════════════════════════════════════
// Motion and tokens.
// ═══════════════════════════════════════════════════════════════════════════

test('every transition uses the duration and easing tokens, never a literal', () => {
  // `RM1` collapses every token duration to 1ms under `prefers-reduced-motion` in ONE place. A
  // literal `duration-200` escapes that, so an accessibility preference silently stops applying to
  // whichever component hard-coded it.
  const literals = [...OVERLAY.matchAll(/duration-\[?\d/g)];
  assert.deepEqual(
    literals.map((m) => m[0]),
    [],
    'a literal transition duration bypasses RM1 — use duration-fast / duration-base',
  );

  for (const match of OVERLAY.matchAll(/transition-[a-z]+/g)) {
    const window = OVERLAY.slice(match.index, match.index + 200);
    assert.match(
      window,
      /duration-(fast|base|slow)/,
      `a transition with no token duration at: ${window.slice(0, 80)}`,
    );
  }
});

test('no overlay names a raw colour or a numeric Tailwind spacing step', () => {
  // `theme.spacing` REPLACES Tailwind's numeric scale in this design system, so `p-4` and `mt-2`
  // emit NOTHING and the element renders with no spacing at all — silently.
  const numericSpacing = [...OVERLAY.matchAll(/\b(?:[pm][xytrbl]?|gap|space-[xy])-\d+\b/g)];
  assert.deepEqual(numericSpacing.map((m) => m[0]), []);

  // HTML entity references go first. `&#215;` is the close glyph and `&#8943;` the overflow
  // ellipsis, and `#215` inside one is not a colour — the first run of this test reported three of
  // them as palette violations, which was the scanner being wrong rather than the file.
  const withoutEntities = OVERLAY.replace(/&#\d+;/g, '');
  const rawColour = [...withoutEntities.matchAll(/#[0-9a-fA-F]{3,8}\b/g)];
  assert.deepEqual(
    rawColour.map((m) => m[0]),
    [],
    'a hex colour appeared outside the token tiers',
  );
});

// ═══════════════════════════════════════════════════════════════════════════
// DC5 / DC6 — the reversibility line is required and always in the same place.
// ═══════════════════════════════════════════════════════════════════════════

test('reversibility is a REQUIRED prop, so a dialog that omits it cannot compile', () => {
  const confirm = body('ConfirmDialog');

  // `DC5`/`DC6` require the direction to be stated "in the same position, every time". An optional
  // prop would be omitted on the one dialog where it mattered, and the omission reads as
  // "reversible" because nothing says otherwise.
  assert.match(confirm, /readonly reversibility:/);
  assert.ok(
    !/readonly reversibility\?:/.test(confirm),
    'reversibility became optional — DC6 is then forgettable exactly where it matters',
  );
  // A discriminated union, so "permanent" cannot be expressed as an empty string.
  assert.match(confirm, /kind: 'REVERSIBLE'/);
  assert.match(confirm, /kind: 'PERMANENT'/);
});

test('the reversibility line renders above the reason box, not below it', () => {
  const confirm = body('ConfirmDialog');
  const lineAt = confirm.indexOf('reversibility.text');
  const reasonAt = confirm.indexOf('<textarea');

  // The consequence should change what the operator writes in the box, which it cannot do if they
  // read it afterwards.
  assert.ok(lineAt > 0 && reasonAt > 0);
  assert.ok(lineAt < reasonAt, 'the reversibility line moved below the reason field');
});

test('permanence is signalled by a glyph and a word, not only by a tint', () => {
  const confirm = body('ConfirmDialog');
  // AX8. "Permanent" is the most consequential word in this dialog; a red background is not a word.
  assert.match(confirm, /aria-hidden="true">\{reversibility\.kind === 'PERMANENT'/);
});
