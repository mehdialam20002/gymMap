/**
 * M-002 · `no-float-money` — constitution §10.3, BR-PAY-01, NFR-DQ-02.
 *
 * Money is an integer count of minor units plus an explicit ISO-4217 currency. A floating-point
 * amount anywhere in this system is a build failure, because 0.1 + 0.2 !== 0.3 and a settlement
 * statement that is off by one paise is a statement Finance cannot reconcile (KPI-26 demands 100%).
 *
 * THE TRAP this rule exists to avoid — recorded in the M-002 notes:
 *
 *   A name-only check is exactly backwards. `const total = 1.5` in a local variable would fail
 *   while `amount_minor: number` on an interface would pass. So the rule keys on the DECLARED
 *   TYPE of a property, not on the identifier alone, and only flags declarations — properties,
 *   parameters and class fields — never locals.
 *
 * Correct:   priceMinor: bigint     (with an adjacent currency: CurrencyCode)
 * Rejected:  price: number
 */

'use strict';

/** A property whose name suggests it carries money. */
const MONEY_NAME =
  /(amount|price|fee|total|minor|balance|payable|commission|discount|tax|gross|net|reserve|payout)/i;

/**
 * Names that match MONEY_NAME but are demonstrably not money — `commissionRateBps` is a rate in
 * basis points, not an amount.
 *
 * The suffix must sit on a WORD BOUNDARY: either the whole name, or after an underscore, or
 * starting with a capital in camelCase. A naive suffix match silently swallows `discount`,
 * which ends in the letters "count" and is very much money. That bug shipped for one test run
 * and is the reason this comment exists.
 */
const NOT_MONEY =
  /(?:^|_)(count|rate|bps|pct|percent|ratio|days?|version|index|priority)$|[a-z0-9](Count|Rate|Bps|Pct|Percent|Ratio|Days?|Version|Index|Priority)$/;

/** Types that may legitimately carry a monetary quantity. */
const ALLOWED_TYPES = new Set(['bigint', 'Money', 'MoneyMinor', 'AmountMinor']);

const MESSAGE =
  "Constitution §10.3 / BR-PAY-01: '{{name}}' looks like money but is typed '{{type}}'. " +
  'Money is an integer count of minor units — use bigint (with an adjacent currency field) or the ' +
  'Money value object. Floating-point money is a build failure, not a style preference.';

/** Render a TS type annotation node to a comparable string. */
function typeName(annotation) {
  if (!annotation) return null;
  const node = annotation.typeAnnotation ?? annotation;
  switch (node.type) {
    case 'TSNumberKeyword':
      return 'number';
    case 'TSBigIntKeyword':
      return 'bigint';
    case 'TSTypeReference':
      return node.typeName?.name ?? node.typeName?.right?.name ?? null;
    case 'TSUnionType':
      // number | null is still number for our purposes.
      return node.types.map((t) => typeName(t)).find((t) => t === 'number') ?? null;
    default:
      return null;
  }
}

function check(context, node, nameNode, annotation) {
  const name = nameNode?.name ?? nameNode?.value;
  if (typeof name !== 'string') return;
  if (!MONEY_NAME.test(name)) return;
  if (NOT_MONEY.test(name)) return;

  const type = typeName(annotation);
  if (type === null) return; // untyped — other rules own that
  if (ALLOWED_TYPES.has(type)) return;
  if (type !== 'number') return;

  context.report({ node, messageId: 'floatMoney', data: { name, type } });
}

module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Monetary values must be integer minor units (bigint) with an explicit currency, never number.',
    },
    schema: [],
    messages: { floatMoney: MESSAGE },
  },
  create(context) {
    return {
      // interface Foo { price: number }  ·  type Foo = { price: number }
      TSPropertySignature(node) {
        check(context, node, node.key, node.typeAnnotation);
      },
      // class Foo { price: number }
      PropertyDefinition(node) {
        check(context, node, node.key, node.typeAnnotation);
      },
      // function f(price: number) {}  ·  constructor(private price: number) {}
      Identifier(node) {
        const p = node.parent;
        const isParam =
          p &&
          (p.type === 'FunctionDeclaration' ||
            p.type === 'FunctionExpression' ||
            p.type === 'ArrowFunctionExpression' ||
            p.type === 'TSDeclareFunction' ||
            p.type === 'TSMethodSignature' ||
            p.type === 'MethodDefinition') &&
          Array.isArray(p.params) &&
          p.params.includes(node);
        if (!isParam) return;
        check(context, node, node, node.typeAnnotation);
      },
      TSParameterProperty(node) {
        const id = node.parameter?.type === 'Identifier' ? node.parameter : null;
        if (!id) return;
        check(context, node, id, id.typeAnnotation);
      },
    };
  },
};
