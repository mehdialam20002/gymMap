/**
 * `M-030` · One physical address, one canonical string — `BR-GYM-09`, `E2.9`, `AC-4`, `AC-5`.
 *
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * THIS FUNCTION DECIDES WHETHER TWO GYMS ARE THE SAME PLACE
 *
 * `BR-GYM-09`: *"A single physical address may host only one `APPROVED` gym at a time."* A partial
 * unique index enforces it, and the index is built over whatever this function returns — so the
 * rule is exactly as good as the normalisation, and no better.
 *
 * Both directions of error are real and they are not symmetrical:
 *
 *   too LOOSE   two genuinely different premises collapse to one string, and the second — a real
 *               gym with real members — is refused at the database with a message about a duplicate
 *   too TIGHT   the same address typed twice differently produces two strings, the duplicate is
 *               never caught, and `RSK-01` walks through
 *
 * The milestone's own notes say which to fear: *"a false duplicate-address positive blocks a
 * legitimate gym"*. So where a variant is ambiguous this errs TIGHT — it keeps the distinction and
 * lets the `ST_DWithin` radius probe FLAG it for a human, which is recoverable, rather than fusing
 * two addresses in an index, which is not.
 *
 * ┌─ WHY A GENERIC FORMATTER WOULD NOT DO ───────────────────────────────────────────────────────┐
 * │ Indian addresses carry unit, floor and wing components that Western formatters have no notion │
 * │ of, and they are exactly the components that distinguish two gyms in one building:             │
 * │                                                                                              │
 * │     Shop 4, Ground Floor, A Wing, Sai Darshan, Andheri West                                   │
 * │     Unit 4, Grd Flr, Wing-A, Sai Darshan CHS, Andheri (W)                                     │
 * │                                                                                              │
 * │ Those are one address. `Shop 4` and `Shop 5` in the same building are two, and a normaliser   │
 * │ that drops the unit number to "tidy" the string merges two paying tenants.                     │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

/**
 * Ordered. Longer forms first, because `flr` is a suffix of nothing but `grd flr` contains `flr`
 * and a shorter rule applied first would leave a fragment behind.
 */
const SYNONYMS: readonly (readonly [RegExp, string])[] = [
  // ── unit ──────────────────────────────────────────────────────────────────────────────────
  [/\b(?:shop|unit|office|gala|premises|flat|door)\s*(?:no\.?|number|#)?\s*/g, 'unit '],

  /*
   * Word ordinals to digits, FIRST, so the numeric floor rules below see one form.
   *
   * "First Floor" and "1st Flr" are the same storey and were producing different tokens — again
   * found by probing rather than by reading. Only ordinals that precede a floor word are rewritten:
   * a building genuinely called "Second Home" must keep its name.
   */
  [/\bfirst(?=\s*(?:floor|flr)\b)/g, '1'],
  [/\bsecond(?=\s*(?:floor|flr)\b)/g, '2'],
  [/\bthird(?=\s*(?:floor|flr)\b)/g, '3'],
  [/\bfourth(?=\s*(?:floor|flr)\b)/g, '4'],
  [/\bfifth(?=\s*(?:floor|flr)\b)/g, '5'],
  [/\bsixth(?=\s*(?:floor|flr)\b)/g, '6'],
  [/\bseventh(?=\s*(?:floor|flr)\b)/g, '7'],
  [/\beighth(?=\s*(?:floor|flr)\b)/g, '8'],
  [/\bninth(?=\s*(?:floor|flr)\b)/g, '9'],
  [/\btenth(?=\s*(?:floor|flr)\b)/g, '10'],

  // ── floor. `grd`/`gr` before the generic `flr`, and the ordinal forms people type ─────────
  [/\bground\s*(?:floor|flr)\b/g, 'floor g'],
  [/\b(?:grd|gr)\.?\s*(?:floor|flr)\b/g, 'floor g'],
  [/\bbasement\b/g, 'floor b'],
  [/\b(\d+)\s*(?:st|nd|rd|th)?\s*(?:floor|flr)\b/g, 'floor $1'],
  [/\b(?:floor|flr)\.?\s*(?:no\.?)?\s*(\d+)\b/g, 'floor $1'],

  // ── wing / block ──────────────────────────────────────────────────────────────────────────
  [/\b(?:wing|block|bldg|building)\s*[-–]?\s*([a-z0-9]{1,2})\b/g, 'wing $1'],
  [/\b([a-z])\s*[-–]?\s*(?:wing|block)\b/g, 'wing $1'],

  // ── society / complex suffixes, which carry no distinguishing information ─────────────────
  [
    /\b(?:chs(?:l)?|co[-\s]?op(?:erative)?\s*(?:hsg|housing)?\s*(?:soc(?:iety)?)?|society|apartments?|apts?|complex|towers?|plaza)\b/g,
    '',
  ],
  /*
   * The incorporation suffix. `CHS Ltd` and `CHS` are one society, and `Pvt Ltd` in an ADDRESS
   * field is the registered form of the building's owner rather than anything that locates it.
   * Separate from the rule above because it follows those words rather than being one of them —
   * `chs(?:l)?` matched `chsl` and left the space-separated `Ltd` behind.
   */
  [/\b(?:pvt|private|ltd|limited|llp|inc)\b/g, ''],

  // ── direction, in the several ways Mumbai and Delhi write it ──────────────────────────────
  [/\(\s*w\s*\)|\bwest\b/g, 'w'],
  [/\(\s*e\s*\)|\beast\b/g, 'e'],
  [/\(\s*n\s*\)|\bnorth\b/g, 'n'],
  [/\(\s*s\s*\)|\bsouth\b/g, 's'],

  // ── road / street / lane ──────────────────────────────────────────────────────────────────
  [/\b(?:road|rd|marg|street|st|lane|ln|gali|path)\b/g, 'rd'],
  [/\b(?:cross|crs)\s*(?:rd)?\b/g, 'cross'],
  [/\b(?:main)\b/g, 'main'],
  [/\b(?:sector|sec)\.?\s*(\d+)\b/g, 'sector $1'],
  [/\b(?:phase|ph)\.?\s*(\d+)\b/g, 'phase $1'],
];

/**
 * Landmarks — "near Big Bazaar", "opp. the petrol pump" — which are directions to a human rather
 * than part of the address, and which two people never write identically.
 *
 * ┌─ THIS RUNS BEFORE PUNCTUATION IS FLATTENED, AND IT HAS TO ────────────────────────────────────┐
 * │ The phrase is delimited by the COMMA that ends it, so the pattern reads to the next comma.    │
 * │ Applied after punctuation became spaces, `[^,]*` finds no comma and swallows the rest of the  │
 * │ string: "Plot 3, Near Big Bazaar, Kothrud" normalised to `3 plot` and lost the locality.       │
 * │                                                                                              │
 * │ That is the LOOSE direction of error — two different premises collapsing to one string — and  │
 * │ the loose direction is the one that refuses a legitimate gym at a unique index. Found by       │
 * │ probing the normaliser against real variants, not by reading it.                                │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 */
const LANDMARK = /\b(?:near|nr\.?|opp\.?|opposite|behind|beside|next\s+to|above|below)\b[^,]*/g;

/** Removed entirely — they carry no information and vary freely between two typings. */
const NOISE = /\b(?:the|a|an|at|in|on|of|and|no|nr)\b/g;

/**
 * The canonical form of an address.
 *
 * Deterministic and pure: the same input always produces the same output, because the value is
 * written into a UNIQUE INDEX and a normaliser that drifted between two releases would make the
 * index stop matching rows it previously matched — silently, with no error anywhere.
 */
export function normaliseAddress(raw: string): string {
  let s = raw.toLowerCase();

  // Unicode first: a typed address routinely carries curly quotes, en-dashes and non-breaking
  // spaces pasted from a document, and each one would otherwise survive into the index.
  s = s
    .normalize('NFKD')
    .replace(/[‘’“”]/g, '')
    .replace(/[–—]/g, '-');

  // Landmarks first, while the commas that delimit them still exist. See LANDMARK.
  s = s.replace(LANDMARK, ',');

  // Punctuation to spaces BEFORE the synonym pass, so `wing-a` and `wing a` reach the same rule.
  s = s.replace(/[.,;:/\\|]+/g, ' ');

  for (const [pattern, replacement] of SYNONYMS) s = s.replace(pattern, replacement);

  s = s.replace(NOISE, ' ');

  // Hyphens survive the synonym pass inside `wing-a`; strip what is left and collapse.
  s = s
    .replace(/[-–—]+/g, ' ')
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  /*
   * ┌─ INITIALISMS: `M G Road` AND `MG Road` ARE ONE ROAD ──────────────────────────────────────┐
   * │ Found by probing the normaliser against real variants rather than by reasoning about it:  │
   * │ "12, 2nd Floor, MG Road" and "No. 12, Floor 2, M G Marg" are the same premises and were   │
   * │ producing different strings, because one had the token `mg` and the other `m` and `g`.     │
   * │ Sorting cannot fix that — the token counts differ.                                         │
   * │                                                                                            │
   * │ So runs of two or more adjacent SINGLE letters are joined. It has to run before the sort,  │
   * │ because adjacency is exactly what the sort destroys. Safe for the components that matter:  │
   * │ `floor g` and `wing a` each have a single letter next to a WORD, never to another letter.  │
   * └────────────────────────────────────────────────────────────────────────────────────────────┘
   */
  s = s.replace(/\b([a-z])(?:\s+([a-z])\b)+/g, (run) => run.replace(/\s+/g, ''));

  /*
   * ┌─ THE TOKENS ARE SORTED, AND THIS IS THE DECISION MOST WORTH ARGUING WITH ─────────────────┐
   * │ "Sai Darshan, Andheri West" and "Andheri West, Sai Darshan" are the same premises written  │
   * │ by two people. Comparing them in order makes them different addresses and the duplicate is │
   * │ missed — which is the failure `BR-GYM-09` exists to prevent.                                │
   * │                                                                                            │
   * │ The cost is that word order stops distinguishing anything, and two addresses made of the   │
   * │ same words in different orders collapse. In practice those are the same place: an address  │
   * │ is a set of locators, not a sentence. The unit number, the floor and the wing all survive   │
   * │ as their own tokens, so the case that actually matters — `unit 4` versus `unit 5` in one    │
   * │ building — stays distinct, which is what stops two paying tenants merging.                  │
   * └────────────────────────────────────────────────────────────────────────────────────────────┘
   */
  return [...new Set(s.split(' '))]
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b))
    .join(' ');
}

/** Whether two typed addresses normalise to the same premises. */
export function isSameAddress(a: string, b: string): boolean {
  return normaliseAddress(a) === normaliseAddress(b);
}
