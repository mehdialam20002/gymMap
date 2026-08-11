/**
 * The build-time environment this app reads. One declaration, so a typo is a compile error.
 *
 * ┌─ THE DECLARATION IS WHAT MAKES DOT ACCESS SAFE, AND DOT ACCESS IS WHAT MAKES IT A CONSTANT ──┐
 * │ Vite replaces `import.meta.env.VITE_X` **textually**, at build time, with the literal value.  │
 * │ It cannot replace `import.meta.env['VITE_X']` — the bracket form is a runtime lookup, so the   │
 * │ expression survives into the bundle and every branch behind it survives with it.               │
 * │                                                                                              │
 * │ `demo-mode.ts` was written with brackets and its own comment claimed *"the bundler eliminates  │
 * │ every branch behind it — the fixtures do not ship"*. Measured: `grep "Ananya Raghavan"` found  │
 * │ the fixture in a build made WITHOUT `VITE_DEMO_MODE`, so the claim was false and every demo    │
 * │ gym, operator name and figure was shipping in production. Not a security hole — none of it is  │
 * │ reachable with the flag off — but 20 kB of fiction in a real bundle, and a comment that said   │
 * │ otherwise.                                                                                     │
 * │                                                                                              │
 * │ Declaring the key here is what lets the dot form be written without reaching through an index  │
 * │ signature, which is the whole reason the bracket form was chosen in the first place.            │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 */

interface ImportMetaEnv {
  /**
   * `'true'` enables demo mode: fixtures instead of the API, a pre-signed-in operator, and a
   * permanent banner saying none of it is real. Anything else, including absent, disables it.
   *
   * A STRING, because every Vite env value is. `demo-mode.ts` compares against `'true'` for that
   * reason: `VITE_DEMO_MODE=false` is a truthy string and would enable the mode it names.
   */
  readonly VITE_DEMO_MODE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
