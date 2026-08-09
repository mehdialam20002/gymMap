/**
 * `M-027` `AC-5` · Normalising a business registration identifier — `BR-GYM-08`.
 *
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * THIS EXISTS SO `M-030`'s DUPLICATE CHECK COMPARES LIKE WITH LIKE
 *
 * `BR-GYM-08` refuses a second application for a business already registered. That check is a
 * string comparison, and a string comparison against what a human typed catches almost nothing:
 *
 *     U74999KA2015PTC082988
 *     u74999ka2015ptc082988
 *     U-74999-KA-2015-PTC-082988
 *     U74999KA2015PTC082988␣
 *
 * Four submissions, one company, and a duplicate check on the raw values approves all four. The
 * failure is not cosmetic — it is the same gym listed four times, each with its own reviews and its
 * own payout account.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 *
 * ┌─ BOTH FORMS ARE STORED, AND THE ORIGINAL IS THE ONE SHOWN ──────────────────────────────────┐
 * │ `AC-5`: "stored AS ENTERED and AS NORMALISED". Only keeping the normalised value would show   │
 * │ an owner a version of their own CIN they did not type, on a legal document trail — and would  │
 * │ make a normaliser bug unfixable, because the input it mangled is gone.                        │
 * │                                                                                              │
 * │ The normalised form exists ONLY for comparison. Nothing renders it.                            │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 */

/**
 * Uppercase, with every separator and space removed.
 *
 * ┌─ WHY SEPARATORS GO ENTIRELY RATHER THAN BEING CANONICALISED ────────────────────────────────┐
 * │ The alternative is "collapse runs of separators to a single hyphen", which preserves a        │
 * │ distinction that carries no information: `U-74999` and `U74999` are the same registration,    │
 * │ and no registry anywhere treats the hyphen as significant. Keeping it means the duplicate      │
 * │ check still misses the pair, which is the entire failure this function exists to prevent.     │
 * │                                                                                              │
 * │ Unicode dashes are included deliberately — a value pasted out of a PDF or a Word document      │
 * │ carries en dashes and non-breaking hyphens that look identical to an ASCII one on screen.      │
 * │ Missing them would mean the check works for typed input and silently fails for pasted input,  │
 * │ which is the more common way a registration number arrives.                                    │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 */
export function normaliseRegistrationNumber(entered: string): string {
  return (
    entered
      // Compatibility normalisation FIRST: it folds full-width Latin characters — which an IME
      // produces — onto their ASCII forms, so `Ｕ７４９９９` and `U74999` compare equal. Doing it
      // after stripping would leave those characters in place, because they are neither ASCII
      // alphanumerics nor recognised separators.
      .normalize('NFKC')
      .toUpperCase()
      /*
       * ESCAPE SEQUENCES, never the characters themselves.
       *
       * The first version embedded a literal non-breaking space and three literal dashes, and
       * `no-irregular-whitespace` failed the build. The rule is right twice over: an invisible
       * character cannot be reviewed, and the next editor to reformat this file would delete one
       * without noticing. Written out, each one is legible and survives a copy-paste.
       *
       *   \s              every space, including U+00A0, under the `u` flag
       *   \u200B          zero-width space, which `\s` does NOT cover
       *   \u002D          the ASCII hyphen
       *   \u2010-\u2015   non-breaking hyphen, figure dash, en dash, em dash, horizontal bar
       *   \u2212          the minus sign a spreadsheet produces
       */
      .replace(/[\s\u200B\u002D\u2010-\u2015\u2212/._]+/gu, '')
  );
}

/**
 * Whether two entered values denote the same registration.
 *
 * A function rather than leaving callers to compare normalised strings themselves: the comparison
 * is the whole point, and a caller who normalises one side and not the other has written the bug
 * this module exists to prevent.
 */
export function isSameRegistration(left: string, right: string): boolean {
  const a = normaliseRegistrationNumber(left);
  const b = normaliseRegistrationNumber(right);

  // Two empty values are not "the same registration". An absent identifier matching another absent
  // one would make every unregistered sole proprietor a duplicate of every other.
  if (a === '' || b === '') return false;

  return a === b;
}
