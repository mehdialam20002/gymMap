/**
 * `no-surface-currency-format` — `FolderStructure.md` §12 rules 12 and 14, `LAUNCH_MARKET_INDIA.md` §2.
 *
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * ONE FORMATTER, OR THE SAME AMOUNT APPEARS TWO WAYS
 *
 * §12 rule 14 already calls hand-rolled Indian grouping in a surface "a review rejection", and
 * point 12 of the same section states the mechanical form of it: no file outside
 * `packages/utils/src/money/` calls `toLocaleString` with a currency option. Both name a lint
 * rule as the enforcement. This is that rule.
 *
 * It was written after the gap it closes was found the expensive way. The admin console's figures
 * module built its own `Intl.NumberFormat({ style: 'currency' })` and it was correct — for the
 * `en-IN` locale, on the machine it was written on. That is precisely the failure mode: a second
 * formatter agrees with the first until a locale, an option, or a rounding mode diverges, and then
 * a gym owner sees `₹250,000` on the dashboard where the invoice says `₹2,50,000` and stops
 * trusting BOTH numbers (`LAUNCH_MARKET_INDIA.md` §2 calls this a trust defect, not a bug).
 *
 * WHAT IT FLAGS
 *
 *   x.toLocaleString('en-IN', { style: 'currency', … })   BANNED — a second currency formatter
 *   new Intl.NumberFormat('en-IN', { currency: 'INR' })   BANNED — the same thing, spelled out
 *   Intl.NumberFormat(locale, { style: 'currency' })      BANNED — without `new`, identically
 *
 *   x.toLocaleString()                                    FINE — a date, a plain count
 *   new Intl.NumberFormat('en-IN')                        FINE — grouping a count, not money
 *   new Intl.NumberFormat('en-IN', { style: 'percent' })  FINE — not money
 *
 * The trigger is the currency INTENT — `style: 'currency'` or a `currency:` key — not the mere
 * presence of a formatter. A rule that banned every `toLocaleString` would be turned off within
 * a week, because formatting a row count is not the problem and never was.
 *
 * WHAT IT CANNOT SEE
 *
 * Options passed as a variable (`toLocaleString(locale, opts)`) are invisible to a syntactic rule.
 * That is an accepted limit rather than a hidden one: the pattern this exists to stop is the
 * inline literal a developer writes when they need a rupee string in a hurry, and indirection
 * through a variable is already a deliberate act that review will see.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

'use strict';

const MESSAGE =
  'FolderStructure.md §12 rule 14: currency formatting belongs in ' +
  'packages/utils/src/money/format-indian-grouping.ts and nowhere else. Import ' +
  '`formatIndianRupees` (or `indianAmountParts` if you need the pieces) from `@gymmap/utils`. A ' +
  'second formatter agrees with the first until it does not, and a gym owner who sees ₹250,000 ' +
  'on one screen and ₹2,50,000 on the invoice stops trusting both figures.';

/**
 * Does this options argument express a currency intent?
 *
 * Reads `style: 'currency'` and any `currency:` key. Spread elements are ignored — the contents
 * are not knowable here, and see "what it cannot see" above.
 */
function declaresCurrency(argument) {
  if (argument === undefined || argument.type !== 'ObjectExpression') return false;

  return argument.properties.some((property) => {
    if (property.type !== 'Property') return false;

    const key =
      property.key.type === 'Identifier'
        ? property.key.name
        : property.key.type === 'Literal'
          ? String(property.key.value)
          : null;

    if (key === 'currency') return true;
    if (key !== 'style') return false;
    return property.value.type === 'Literal' && property.value.value === 'currency';
  });
}

/** `Intl.NumberFormat`, with or without `new`. */
function isIntlNumberFormat(callee) {
  return (
    callee.type === 'MemberExpression' &&
    callee.object.type === 'Identifier' &&
    callee.object.name === 'Intl' &&
    callee.property.type === 'Identifier' &&
    callee.property.name === 'NumberFormat'
  );
}

/** @type {import('eslint').Rule.RuleModule} */
module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Bans currency formatting outside packages/utils/src/money/. One formatter, consumed by ' +
        'every surface and by the PDF renderer, is the only arrangement in which they cannot ' +
        'disagree about the same amount.',
    },
    schema: [],
    messages: { surfaceFormat: MESSAGE },
  },

  create(context) {
    const check = (node, optionsArgument) => {
      if (!declaresCurrency(optionsArgument)) return;
      context.report({ node, messageId: 'surfaceFormat' });
    };

    return {
      NewExpression(node) {
        if (!isIntlNumberFormat(node.callee)) return;
        check(node, node.arguments[1]);
      },

      CallExpression(node) {
        const { callee } = node;

        if (isIntlNumberFormat(callee)) {
          check(node, node.arguments[1]);
          return;
        }

        // `<anything>.toLocaleString(locale, { style: 'currency' })`. The receiver is not checked:
        // a number, a bigint and a Date all have the method, and only the options matter.
        if (
          callee.type === 'MemberExpression' &&
          callee.property.type === 'Identifier' &&
          callee.property.name === 'toLocaleString'
        ) {
          check(node, node.arguments[1]);
        }
      },
    };
  },
};
