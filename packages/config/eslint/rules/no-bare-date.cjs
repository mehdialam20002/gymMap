/**
 * M-016 · `no-bare-date` — `AC-FND-13.3`, `TR-21`.
 *
 * Bans `new Date()` and `Date.now()` in domain code. The `Clock` port is injected instead.
 *
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * THE PARENTHESES ARE THE WHOLE RULE
 *
 *   new Date()                    BANNED — reads the ambient clock
 *   Date.now()                    BANNED — the same, in one fewer character
 *   new Date(instant)             FINE   — parses or copies a value it was GIVEN
 *   new Date(2026, 0, 1)          FINE   — constructs a specific instant
 *
 * A rule that banned every `new Date` would be unusable: parsing an ISO string from the database
 * and copying a `Date` to avoid handing out a mutable reference are both `new Date(x)`, and both
 * are correct. The argument list is what distinguishes "read the clock" from "convert a value".
 *
 * What the ban buys: a membership that expires "in 30 days" becomes testable without waiting
 * thirty days or monkey-patching a global — and the monkey-patch is the real cost, because it
 * leaks between tests and makes one suite's result depend on which other suite ran first.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

'use strict';

const NEW_DATE_MESSAGE =
  'AC-FND-13.3: `new Date()` reads the ambient clock, which makes this code untestable and ' +
  'non-deterministic. Inject the `Clock` port and call `clock.now()`. `new Date(value)` — ' +
  'parsing or copying an instant you were given — is fine and is not what this flags.';

const DATE_NOW_MESSAGE =
  'AC-FND-13.3: `Date.now()` reads the ambient clock. Inject the `Clock` port and call ' +
  '`clock.now().getTime()`. The one legitimate caller is `system-clock.adapter.ts`, which is ' +
  'exempt by path.';

/** @type {import('eslint').Rule.RuleModule} */
module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Bans reading the ambient clock. Domain code injects the Clock port so time is an ' +
        'argument rather than an environment.',
    },
    schema: [],
    messages: { newDate: NEW_DATE_MESSAGE, dateNow: DATE_NOW_MESSAGE },
  },

  create(context) {
    return {
      NewExpression(node) {
        if (node.callee.type !== 'Identifier' || node.callee.name !== 'Date') return;
        // ONLY the zero-argument form. `new Date(isoString)` converts a value it was given.
        if (node.arguments.length > 0) return;
        context.report({ node, messageId: 'newDate' });
      },

      CallExpression(node) {
        const { callee } = node;
        if (callee.type !== 'MemberExpression') return;
        if (callee.computed) return;
        if (callee.object.type !== 'Identifier' || callee.object.name !== 'Date') return;
        if (callee.property.type !== 'Identifier' || callee.property.name !== 'now') return;
        context.report({ node, messageId: 'dateNow' });
      },
    };
  },
};
