/**
 * The shell's contract — `NFR-SEC-12`, `NFR-USE-02`, `NFR-USE-08`, `DesignSystem.md` §9.2.
 *
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * THESE ARE THE ASSERTIONS THAT SURVIVE A REFACTOR
 *
 * A page renders correctly today because somebody looked at it. What is asserted here is the set
 * of properties that are invisible when correct and catastrophic when quietly removed: a CSP
 * directive deleted to make a third-party script work, a skip link dropped in a layout tidy-up,
 * a hard-coded string added because the key lookup felt like ceremony.
 *
 * Every one of those is a one-line change that no reviewer flags and no screenshot reveals.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { code, source, tsxFiles } from './helpers.ts';
import { en } from '../src/shared/i18n/messages/en.ts';
import { t, DEFAULT_LOCALE, LOCALES } from '../src/shared/i18n/index.ts';
import { themeScript, THEME_STORAGE_KEY } from '../src/shared/theme/theme-script.ts';
import {
  STATIC_SECURITY_HEADERS,
  buildContentSecurityPolicy,
  generateNonce,
  NEXT_IMAGE_STYLE_HASH,
  type CspHosts,
} from '../src/shared/security/csp.ts';


// ═══════════════════════════════════════════════════════════════════════════
// NFR-SEC-12 · the CSP. Security.md §11.3.
//
// Asserted against the EMITTED string, not the source file. The first version of these tests
// read middleware.ts as text and matched `'unsafe-inline'` inside the comment explaining why
// `'unsafe-inline'` is forbidden — a test that fails on its own documentation. Building the
// policy as a pure function made it data, which is both simpler to check and strictly stronger.
// ═══════════════════════════════════════════════════════════════════════════

const NONCE = 'dGVzdC1ub25jZS0xMjM0NQ==';
/**
 * What `style-src` must be, in both builds. Written once so the two tests below cannot drift into
 * asserting different policies — which is how one of them ends up passing while the shipped header
 * is the other one.
 */
const EXPECTED_STYLE_SRC = `'self' 'nonce-${NONCE}' 'unsafe-hashes' '${NEXT_IMAGE_STYLE_HASH}'`;
const policy = (hosts: CspHosts = {}) => buildContentSecurityPolicy(NONCE, hosts);

/** One directive's source list, or `undefined` if the directive is absent. */
function directive(csp: string, name: string): string | undefined {
  const found = csp.split('; ').find((d) => d === name || d.startsWith(`${name} `));
  return found?.slice(name.length).trim();
}

test('the CSP denies by default and grants each capability explicitly', () => {
  const csp = policy();
  // `default-src 'self'` is the tempting version and it silently permits every fetch type nobody
  // thought about. Deny-by-default is what makes the rest of the policy meaningful.
  assert.equal(directive(csp, 'default-src'), "'none'");
  assert.equal(directive(csp, 'base-uri'), "'none'");
  assert.equal(directive(csp, 'form-action'), "'self'");
  assert.equal(directive(csp, 'frame-ancestors'), "'none'");
  assert.equal(directive(csp, 'object-src'), "'none'");
  assert.equal(directive(csp, 'manifest-src'), "'self'");
  assert.equal(directive(csp, 'upgrade-insecure-requests'), '');
});

test('media-src admits our own origin and NOTHING synthesised', () => {
  // This directive was `'none'` until SCR-WEB-001 gained a hero loop, and widening it is the
  // change worth pinning: the next person who needs a video will reach for `media-src *` or
  // `blob:` because it makes the error go away.
  //
  // `data:` and `blob:` are the ones that matter. Either would let an injected script mint a
  // media element from bytes it controls, which is a working exfiltration and rendering channel
  // that no host allowlist constrains. The hero needs a FILE from our origin.
  assert.equal(directive(policy(), 'media-src'), "'self'");
  assert.equal(
    directive(policy({ media: 'https://cdn.example.test' }), 'media-src'),
    "'self' https://cdn.example.test",
  );
  const csp = policy({ media: 'https://cdn.example.test' });
  assert.ok(!directive(csp, 'media-src')!.includes('data:'), 'media-src admits data:');
  assert.ok(!directive(csp, 'media-src')!.includes('blob:'), 'media-src admits blob:');
});

test('script-src takes the nonce and NEVER unsafe-inline', () => {
  const csp = policy();
  assert.equal(directive(csp, 'script-src'), `'self' 'nonce-${NONCE}' 'strict-dynamic'`);
  // The single most likely regression: somebody adds a third-party tag, it is blocked, and
  // unsafe-inline makes the error go away — along with the entire control.
  assert.ok(!csp.includes('unsafe-inline'), `the emitted CSP contains unsafe-inline: ${csp}`);
  assert.ok(!csp.includes('unsafe-eval'), 'the emitted CSP contains unsafe-eval');
});

test('unsafe-eval is a DEVELOPMENT concession and never reaches production', () => {
  // Next's dev server compiles with `eval` and serves HMR chunks with no nonce, so the production
  // policy blocks the entire client bundle. The page still renders — server-rendered markup looks
  // perfect — and nothing hydrates. It presents as "the button does nothing", not as a CSP error,
  // which is why it needs a test rather than a comment.
  const dev = buildContentSecurityPolicy(NONCE, {}, true);
  assert.ok(dev.includes("'unsafe-eval'"), 'dev cannot run without it');
  assert.ok(!dev.includes('unsafe-inline'), 'dev still refuses unsafe-inline');

  // The half that matters. Default and explicit-false must both be clean.
  assert.ok(!buildContentSecurityPolicy(NONCE, {}).includes('unsafe-eval'));
  assert.ok(!buildContentSecurityPolicy(NONCE, {}, false).includes('unsafe-eval'));

  // And the concession is scoped to scripts — it must not leak into any other directive.
  assert.equal(directive(dev, 'style-src'), EXPECTED_STYLE_SRC);
  assert.equal(directive(dev, 'default-src'), "'none'");
});

test('style-src takes the nonce, because Tailwind compiles to a static stylesheet', () => {
  // unsafe-inline on styles is the cargo-culted default. A-03 makes it unnecessary here, and
  // that is a real property of the Tailwind choice worth keeping.
  assert.equal(directive(policy(), 'style-src'), EXPECTED_STYLE_SRC);
});

test('the one style-attribute hash is `color:transparent` and nothing else', () => {
  // ┌─ THIS TEST IS THE REASON THE CONCESSION IS SAFE ──────────────────────────────────────────┐
  // │ `'unsafe-hashes'` is the only CSP mechanism that can allow a style ATTRIBUTE, and on its   │
  // │ own it would allow EVERY attribute whose hash is listed. The listed hash is therefore the  │
  // │ whole boundary, so it is recomputed here from the literal string rather than copied from   │
  // │ the source — copying it from `csp.ts` would assert that a constant equals itself.          │
  // └───────────────────────────────────────────────────────────────────────────────────────────┘
  const digest = createHash('sha256').update('color:transparent', 'utf8').digest('base64');
  assert.equal(NEXT_IMAGE_STYLE_HASH, `sha256-${digest}`);

  // And it is not the spaced variant. `next/image` emits no space; if a future version does, the
  // style is blocked again and the console says so — the failure is loud, not silent.
  const spaced = createHash('sha256').update('color: transparent', 'utf8').digest('base64');
  assert.notEqual(NEXT_IMAGE_STYLE_HASH, `sha256-${spaced}`);
});

test('unsafe-hashes NEVER becomes unsafe-inline, in either build', () => {
  // The failure mode this guards is a maintainer meeting a new blocked-style violation and
  // "extending the existing exception" — `'unsafe-inline'` beside `'unsafe-hashes'` looks like more
  // of the same thing and is categorically different: it permits every inline style and, per spec,
  // makes the browser IGNORE the nonce and hash allowlists entirely.
  for (const csp of [policy(), buildContentSecurityPolicy(NONCE, {}, true)]) {
    const styleSrc = directive(csp, 'style-src');
    // Asserted rather than defaulted to `''`: a missing style-src would make the two checks below
    // pass vacuously, and "the directive is absent" is a bigger failure than either of them.
    assert.ok(styleSrc, `style-src is missing entirely: ${csp}`);
    assert.ok(!styleSrc.includes("'unsafe-inline'"), `style-src admits unsafe-inline: ${styleSrc}`);
    // Exactly one hash. A growing list of style hashes means inline styling is being written by
    // hand somewhere, which Tailwind (A-03) is supposed to make unnecessary.
    assert.equal(
      styleSrc.match(/'sha256-/g)?.length,
      1,
      `style-src should carry exactly one hash: ${styleSrc}`,
    );
  }
});

test('every response gets a DIFFERENT nonce', () => {
  // A constant nonce is unsafe-inline with extra steps. Proved by generating, not inferred by
  // reading the source for a `crypto` call.
  const nonces = new Set(Array.from({ length: 64 }, () => generateNonce()));
  assert.equal(nonces.size, 64, 'generateNonce() repeated a value');
  for (const n of nonces) {
    assert.match(n, /^[A-Za-z0-9+/]{22}==$/, `"${n}" is not 128 bits of base64`);
  }
});

test('configured hosts land in the right directives, and nowhere else', () => {
  const csp = policy({
    api: 'https://api.example.test',
    media: 'https://cdn.example.test',
    tiles: 'https://tiles.example.test',
    ingest: 'https://ingest.example.test',
  });
  // The tile host is legitimately in BOTH: the map fetches tiles (connect) and renders them
  // (img). The CDN is in img only, and the ingest host in connect only.
  assert.equal(
    directive(csp, 'img-src'),
    "'self' data: https://cdn.example.test https://tiles.example.test",
  );
  assert.equal(
    directive(csp, 'connect-src'),
    "'self' https://api.example.test https://tiles.example.test https://ingest.example.test",
  );
  assert.ok(
    !directive(csp, 'script-src')!.includes('example.test'),
    'a host leaked into script-src',
  );
  assert.ok(!directive(csp, 'font-src')!.includes('example.test'));
});

test('an unconfigured host produces no empty source and no wildcard', () => {
  const csp = policy();
  // The failure mode of naive concatenation: `connect-src 'self' ` with a trailing space, or
  // worse, `connect-src 'self' undefined`.
  assert.equal(directive(csp, 'connect-src'), "'self'");
  assert.equal(directive(csp, 'img-src'), "'self' data:");
  assert.ok(!csp.includes('undefined'), `the CSP contains "undefined": ${csp}`);
  assert.ok(!/\s\*(\s|;|$)/.test(csp), 'a directive contains a bare wildcard');
  // A `https:` scheme wildcard in connect-src would make the exfiltration control decorative.
  assert.ok(!/-src[^;]*\shttps:(?!\/\/)/.test(csp), 'a directive contains a scheme wildcard');
});

test('frame-src is none under the redirect model and the host under the iframe model', () => {
  // Either way PCI-1 holds: we inject no script into it (§8.4).
  assert.equal(directive(policy(), 'frame-src'), "'none'");
  assert.equal(
    directive(policy({ payment: 'https://pay.example.test' }), 'frame-src'),
    'https://pay.example.test',
  );
});

test('the customer surface grants geolocation and REFUSES camera', () => {
  const pp = STATIC_SECURITY_HEADERS['Permissions-Policy']!;
  // "Near me" needs geolocation. The camera grant belongs to gym-dashboard alone — the QR is
  // DISPLAYED here, never scanned, and a permission nobody uses is one somebody eventually
  // exploits.
  assert.ok(pp.includes('geolocation=(self)'));
  assert.ok(pp.includes('camera=()'));
  assert.ok(pp.includes('microphone=()'));
  assert.ok(pp.includes('payment=()'));
});

test('autoplay is granted to self ONLY, and never to a third party', () => {
  const pp = STATIC_SECURITY_HEADERS['Permissions-Policy']!;
  // The hero loop needs it. A wildcard would hand the same capability to any frame we ever
  // embed — including the payment provider's — and the whole point of the directive is that
  // "our own decorative video may play" and "anything on this page may play" are different
  // grants. What actually protects the visitor from sound is the `muted` attribute, asserted
  // in hero.spec.ts.
  assert.ok(pp.includes('autoplay=(self)'), `autoplay is not self-scoped: ${pp}`);
  assert.ok(!pp.includes('autoplay=*'), 'autoplay is granted to every origin');
});

test('Referrer-Policy is origin-level here, unlike the dashboards', () => {
  // Asymmetry on purpose: the customer site needs origin-level referrer for outbound analytics
  // and partner links; a dashboard URL can contain identifiers and must never leak.
  assert.equal(STATIC_SECURITY_HEADERS['Referrer-Policy'], 'strict-origin-when-cross-origin');
  assert.equal(STATIC_SECURITY_HEADERS['X-Content-Type-Options'], 'nosniff');
});

test('HSTS is NOT emitted by the application', () => {
  // §11.1 assigns it to the edge, because it must cover responses the application never sees. A
  // two-year preload directive escaping from a dev server on plain-HTTP localhost is a foot-gun
  // with a very long memory.
  assert.ok(!('Strict-Transport-Security' in STATIC_SECURITY_HEADERS));
  assert.ok(!code('next.config.mjs').includes('Strict-Transport-Security'));
});

test('COEP stays absent, deliberately', () => {
  // It would break the map tile embed (DEP-02) for no benefit at Phase-1 scope. Asserted so it
  // is not "fixed" later by somebody completing a header checklist.
  assert.ok(!('Cross-Origin-Embedder-Policy' in STATIC_SECURITY_HEADERS));
});

test('the middleware attaches the policy and every static header', () => {
  // The tests above prove the policy is right; this proves it is actually attached. A perfect
  // CSP that no response carries is the failure neither half catches alone.
  const mw = code('middleware.ts');
  // Whitespace-tolerant: the call gained a third argument and prettier split it across lines, and
  // a single-line regex would fail on a reformat that changed no behaviour.
  assert.match(mw, /buildContentSecurityPolicy\(\s*nonce,\s*cspHostsFromEnv\(process\.env\)/);
  // The dev concession must be DERIVED, never hard-coded to true.
  assert.match(mw, /process\.env\.NODE_ENV !== 'production'/);
  assert.match(mw, /Object\.entries\(STATIC_SECURITY_HEADERS\)/);
  assert.match(mw, /requestHeaders\.set\('x-nonce', nonce\)/);
});

// ═══════════════════════════════════════════════════════════════════════════
// The CONSEQUENCE of the policy above: no inline style may exist anywhere.
//
// ┌─ THIS IS THE RULE THAT COST A CORRECT-LOOKING SCREENSHOT ───────────────────────────────────┐
// │ A nonce in `style-src` blocks EVERY inline style, not just `<style>` elements — CSP-3        │
// │ §6.7.3.2 makes `'unsafe-inline'` inert as soon as a nonce or hash is present, and a nonce    │
// │ cannot be attached to a `style` attribute in the first place.                                 │
// │                                                                                              │
// │ So a `style={{ … }}` prop renders into the markup, the browser drops it, and the element     │
// │ falls back to whatever the stylesheet says. That is silent. It was found on the gym card,     │
// │ where `next/image`'s `fill` mode is nothing but an inline style: the photo kept rendering,    │
// │ clipped by `overflow-hidden` at its natural size rather than covering the box, and the        │
// │ screenshot looked plausible. `getComputedStyle(img).position === 'static'` was the only tell.  │
// │                                                                                              │
// │ Keeping the policy strict is worth more than any single inline style, and A-03 means there    │
// │ is always a class for it. These assertions are how that stays true.                           │
// └──────────────────────────────────────────────────────────────────────────────────────────────┘
// ═══════════════════════════════════════════════════════════════════════════

test('no arbitrary utility hides inside an interpolated template literal', () => {
  // ┌─ THE THIRD MEMBER OF THE SAME FAMILY ────────────────────────────────────────────────────┐
  // │ `className={`w-full max-w-[1.25rem] … ${height}`}` produced no `max-w-[1.25rem]` rule at   │
  // │ all: Tailwind finds candidates by scanning source TEXT, and does not reliably see them in a │
  // │ template that also carries an interpolation. Grepping the built stylesheet is what proved   │
  // │ it — the selector was absent while `h-[62%]` from a plain-string array was present.         │
  // │                                                                                          │
  // │ The fix is a plain string constant, concatenated at the call site. Extraction happens at   │
  // │ build time and never runs the code, so the concatenation costs nothing.                    │
  // │                                                                                          │
  // │ Scoped to ARBITRARY values on purpose. A named utility that fails to generate is caught by │
  // │ every other test in the suite the moment it changes layout; an arbitrary one is a length     │
  // │ nothing else references, so its absence is invisible.                                       │
  // └──────────────────────────────────────────────────────────────────────────────────────────┘
  const offenders: string[] = [];
  for (const file of [...tsxFiles('app'), ...tsxFiles('src')]) {
    for (const match of code(file).matchAll(/className=\{`([^`]*)`\}/g)) {
      const body = match[1] ?? '';
      if (body.includes('${') && /[a-z-]\[[^\]]+\]/.test(body)) {
        offenders.push(`${file}: ${body.replace(/\s+/g, ' ').slice(0, 70)}`);
      }
    }
  }
  assert.deepEqual(
    offenders,
    [],
    'an arbitrary utility sits in a template literal with an interpolation, where Tailwind may ' +
      'not extract it. Move the static classes into a plain string constant:\n  ' +
      offenders.join('\n  '),
  );
});

test('no className contains a backslash, because the class would then match nothing', () => {
  // ┌─ A REAL BUG THIS CAUGHT NOTHING ELSE COULD ──────────────────────────────────────────────┐
  // │ A city tile's scrim shipped as `bg-[linear-gradient(…)]\` — one trailing backslash from an │
  // │ editing slip. JSX does not process escapes in attribute values, so the backslash became    │
  // │ part of the class NAME. Tailwind still generated the rule (it scans source text), the      │
  // │ element still carried a class, and the DOM token matched no selector: the scrim was         │
  // │ `background-image: none` and the city name sat on a bare photograph.                       │
  // │                                                                                          │
  // │ Nothing else in the toolchain has an opinion about a class that matches nothing. Types are │
  // │ satisfied by any string, lint sees a valid literal, the build succeeds, and the page looks │
  // │ plausible until the one photograph that is pale where the label sits.                      │
  // └──────────────────────────────────────────────────────────────────────────────────────────┘
  const offenders: string[] = [];
  for (const file of [...tsxFiles('app'), ...tsxFiles('src')]) {
    for (const match of code(file).matchAll(/className="([^"]*)"/g)) {
      if (match[1]?.includes('\\')) offenders.push(`${file}: ${match[1].slice(0, 60)}`);
    }
  }
  assert.deepEqual(
    offenders,
    [],
    'a className contains a backslash. It is part of the class name, so the utility silently ' +
      'applies to nothing:\n  ' + offenders.join('\n  '),
  );
});

test('no component sets an inline style, because the CSP would silently drop it', () => {
  const offenders: string[] = [];
  for (const file of [...tsxFiles('app'), ...tsxFiles('src')]) {
    if (/\bstyle=\{/.test(code(file))) offenders.push(file);
  }
  assert.deepEqual(
    offenders,
    [],
    'an inline style prop was found. It will render into the HTML and be discarded by the ' +
      'browser, which looks like a layout bug rather than a security one. Use a utility class:\n  ' +
      offenders.join('\n  '),
  );
});

test('the gym card sizes its photo with classes, not with next/image `fill`', () => {
  // `fill` is ENTIRELY an inline style. Intrinsic width/height plus `h-full w-full object-cover`
  // is the same layout from the stylesheet, and it behaves identically in Safari, which does not
  // implement the `style-src-attr` escape hatch the alternative would have needed.
  const card = code('src/features/discovery/gym-card.tsx');
  assert.ok(card.includes('<Image'), 'the card no longer renders next/image at all');
  assert.ok(!/^\s*fill$/m.test(card), 'next/image `fill` is back — its positioning is inline');
  assert.match(card, /width=\{1200\}/);
  assert.match(card, /height=\{675\}/);
  assert.match(card, /h-full w-full object-cover/);
  // `sizes` is what stops Next serving the largest candidate to a phone (NFR-PERF-02).
  assert.match(card, /sizes="/);
});

test('no token colour carries an opacity modifier, because Tailwind emits nothing for it', () => {
  // The preset maps every colour to a finished token value rather than to the channel triplet
  // `/95` needs, so `bg-surface/95` is not a class Tailwind can generate — it silently emits no
  // rule at all and the element ends up with `rgba(0, 0, 0, 0)`. The sticky header shipped that
  // way: fully transparent, nav labels over whatever photo was scrolling underneath.
  //
  // Two failures in one, which is why it is asserted rather than remembered: a class that looks
  // applied and is not, and a contrast pairing that cannot be proved because it has no ground.
  const modifier =
    /\b(?:bg|text|border|ring|from|via|to|divide|outline)-(?:surface|content|border|brand|accent)[a-z-]*\/\d+/;
  const offenders: string[] = [];
  for (const file of [...tsxFiles('app'), ...tsxFiles('src')]) {
    const match = modifier.exec(code(file));
    if (match) offenders.push(`${file}: ${match[0]}`);
  }
  assert.deepEqual(
    offenders,
    [],
    `an opacity modifier on a token colour:\n  ${offenders.join('\n  ')}`,
  );
});

test('the scroll reveal is CSS-driven, guarded by @supports AND by a motion preference', () => {
  const css = source('src/styles/globals.css');
  assert.match(css, /animation-timeline: view\(\)/);
  // Both guards, and both for the same reason: content must never be left invisible waiting for
  // an animation that will not run. Firefox and Safari do not implement scroll-driven animations,
  // and a visitor who asked for less motion has asked not to have this at all.
  assert.match(css, /@supports \(animation-timeline: view\(\)\)/);
  assert.match(css, /@media \(prefers-reduced-motion: no-preference\)/);
  // `cover` never completes for the last section on the page — it would sit permanently faded.
  assert.match(css, /animation-range: entry [\d]+% entry [\d]+%/);
  assert.ok(!/animation-range:[^;]*cover/.test(css), 'a cover-relative range crept back in');
});

test("Next's route announcer is hidden from the stylesheet, not by its own inline style", () => {
  // Blocked, its inline recipe stops applying and the announced page title paints as visible
  // text above the header on every client-side navigation. AX2 needs the live region to exist;
  // nobody needs to read it.
  const css = source('src/styles/globals.css');
  assert.match(css, /#__next-route-announcer__\s*\{/);
  assert.match(css, /clip: rect\(0 0 0 0\)/);
});

// ═══════════════════════════════════════════════════════════════════════════
// NFR-USE-08 / I18N1 · no user-facing literal in a component.
// ═══════════════════════════════════════════════════════════════════════════

/** Prose is two or more words with a space. A className or a token name never is. */
const PROSE_IN_JSX = />\s*([A-Z][a-z]+(?: [a-z]+){1,})\s*</g;

test('I18N1 — every user-facing string comes from the catalogue', () => {
  const offenders: string[] = [];
  for (const file of [...tsxFiles('app'), ...tsxFiles('src')]) {
    for (const match of code(file).matchAll(PROSE_IN_JSX)) {
      offenders.push(`${file}: "${match[1]}"`);
    }
  }
  assert.deepEqual(
    offenders,
    [],
    'hard-coded user-facing text found. NFR-USE-08 does not defer externalisation even though ' +
      'A4.2 defers multi-language UI — adding a language later is a translation job, but ' +
      'retrofitting externalisation is an edit to every component in fifty-five screens:\n  ' +
      offenders.join('\n  '),
  );
});

test('CONTROL — the literal scan actually detects a literal', () => {
  // Without this, the test above passes on an empty file list, on a broken regex, and on a typo
  // in the directory name — three ways to be green while checking nothing.
  const found = [...'<p>Find a gym near you</p>'.matchAll(PROSE_IN_JSX)];
  assert.equal(found.length, 1);
  assert.equal(found[0]![1], 'Find a gym near you');
});

test('CONTROL — the scan is looking at real files', () => {
  const files = [...tsxFiles('app'), ...tsxFiles('src')];
  assert.ok(files.length >= 4, `only ${files.length} tsx files found — the walk is wrong`);
  assert.ok(files.includes('app/layout.tsx'));
});

test('every catalogue key resolves, and t() falls back visibly', () => {
  for (const key of Object.keys(en) as (keyof typeof en)[]) {
    assert.ok(t(key).length > 0, `${key} resolves to an empty string`);
  }
  assert.equal(LOCALES.length, 1);
  assert.equal(DEFAULT_LOCALE, 'en');
});

test('the catalogue states the three product promises in the user’s words', () => {
  // Not decoration. BR-GYM-01, BR-PLN-03 and BR-REV-01 are the differentiators, and a home page
  // that implies them rather than stating them is one that gets rewritten by somebody who does
  // not know they are load-bearing.
  assert.match(en['web.home.value.verified.body'], /approved/i);
  assert.match(en['web.home.hero.subtitle'], /price you see is the price you pay/i);
  assert.match(en['web.home.value.reviews.body'], /check-in/i);
});

// ═══════════════════════════════════════════════════════════════════════════
// DesignSystem.md §9.2 · the theme bootstrap.
// ═══════════════════════════════════════════════════════════════════════════

test('DM1 — the stored preference wins in BOTH directions', () => {
  // The half usually missed: a user who chose LIGHT on a dark-mode OS. A script that sets the
  // attribute only for 'dark' strands them, because the @media block then wins.
  assert.match(themeScript, /t==='dark'\|\|t==='light'/);
  assert.match(themeScript, /setAttribute\('data-theme',t\)/);
});

test('DM2 — the theme script depends on no bundle and cannot throw', () => {
  assert.ok(!themeScript.includes('import'), 'the pre-paint script imports something');
  assert.ok(!themeScript.includes('require'));
  // localStorage throws in Safari private mode and inside a sandboxed iframe. An exception here
  // would abort the rest of the inline script: a wrong theme for one paint is survivable, a
  // broken <head> is not.
  assert.match(themeScript, /try\{/);
  assert.match(themeScript, /catch\(e\)\{\}/);
  assert.equal(THEME_STORAGE_KEY, 'gm-theme');
});

test('the theme script is nonce-stamped, or the CSP would silently drop it', () => {
  const layout = code('app/layout.tsx');
  assert.match(layout, /nonce=\{nonce\}/);
  assert.match(layout, /headers\(\)\.get\('x-nonce'\)/);
  // Required, and not a workaround: the script deliberately mutates the element the server
  // rendered, so React WILL see a mismatch and it is the correct one.
  assert.match(layout, /suppressHydrationWarning/);
});

// ═══════════════════════════════════════════════════════════════════════════
// NFR-USE-02 / AX2 · the skip link, and the zoom obligation.
// ═══════════════════════════════════════════════════════════════════════════

test('AX2 — the skip link is first in the document and targets a focusable main', () => {
  const layout = code('app/layout.tsx');
  const skipAt = layout.indexOf('gm-skip-link');
  const headerAt = layout.indexOf('<SiteHeader');
  assert.ok(skipAt > 0 && skipAt < headerAt, 'the skip link is not before the header');
  assert.match(layout, /href="#main"/);
  // Without tabIndex={-1} the browser scrolls to the anchor but leaves focus at the top of the
  // document, so the next Tab starts over from the header — the link looks like it worked and
  // did not.
  // Whitespace-tolerant: prettier splits a multi-attribute JSX tag across lines, and a
  // single-line regex here would fail on a reformat that changed no behaviour at all.
  assert.match(layout, /<main[^>]*id="main"[^>]*tabIndex=\{-1\}/);
});

test('WCAG 1.4.4 — zoom is not disabled', () => {
  const layout = code('app/layout.tsx');
  assert.ok(!layout.includes('userScalable: false'), 'pinch-zoom is disabled');
  assert.ok(!/maximumScale:\s*1\b/.test(layout), 'maximum-scale=1 prevents zoom');
  // TS2 keeps inputs at 16px, which removes the iOS zoom-on-focus problem those settings are
  // usually reached for.
  assert.match(layout, /maximumScale:\s*5/);
});

test('TK2 — the app declares no theme of its own', () => {
  const config = code('tailwind.config.ts');
  assert.match(config, /presets:\s*\[preset\]/);
  // Tokens are defined once (UI2). The moment an app can extend the theme, three surfaces have
  // three palettes and the contrast register in packages/ui stops describing what ships.
  assert.ok(!/^\s*theme:/m.test(config), 'the app declares a theme key');
  assert.ok(!/extend:/.test(config), 'the app extends the theme');
});
