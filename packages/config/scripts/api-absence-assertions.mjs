/**
 * M-008 · CI job 9 `api-absence-assertions` — API_Catalog.md §9.4.
 *
 * Four proofs that an operation does NOT exist.
 *
 * "We did not build it" is a weaker guarantee than "the contract test proves it is not there".
 * The first is a claim about intent that decays the moment someone helpful adds an endpoint;
 * the second fails the build. Every assertion below names the invariant it defends, because an
 * absence with no stated reason is an absence somebody eventually fills in.
 *
 * Each runs against the GENERATED document — the thing the application actually exposes and the
 * thing clients are generated from — not against the source.
 */

import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const HTTP_METHODS = ['get', 'post', 'put', 'patch', 'delete', 'head', 'options'];

/**
 * Invariant 5 — BR-PAY-02, §12.1 A04.
 *
 * A membership is activated by a verified provider WEBHOOK, never by the browser coming back
 * from a payment page. The client redirect is a hint that something happened; it is trivially
 * forgeable, and it also arrives when the payment failed, when the user pressed back, and not
 * at all when their connection dropped mid-redirect on a real payment.
 */
const CLIENT_ACTIVATION = [
  /\/(activate|confirm-payment|payment-success|payment-complete|mark-paid)$/i,
  /\/memberships?\/[^/]+\/activate$/i,
];

/**
 * Invariant 2 — BR-PAY-04, §14.4 CA1.
 *
 * No REQUEST schema anywhere carries a monetary field. The server computes every amount from
 * the plan, the coupon and the tax profile. A client-supplied price is a client-chosen price,
 * and the attack is a one-line change in devtools.
 */
const MONEY_FIELD =
  /^(amount|price|total|subtotal|fee|discount|tax|payable|gross|net|commission)(_?minor)?$/i;

/**
 * Invariant 1 — §C3.1, §11.3.
 *
 * The tenant is derived from the token. Accepting it from a header, path, query or body means a
 * caller can name someone else's tenant, and the resulting query is syntactically valid.
 */
const TENANT_PARAM = /^x-tenant-id$|^tenant_?id$/i;

export function runAbsenceAssertions(document) {
  const problems = [];
  const fail = (assertion, invariant, where, message) =>
    problems.push({ assertion, invariant, where, message });

  const operations = [];
  for (const [path, item] of Object.entries(document.paths ?? {})) {
    for (const method of HTTP_METHODS) {
      if (item?.[method]) {
        operations.push({ path, method: method.toUpperCase(), operation: item[method] });
      }
    }
  }

  // --- 1 · no client-signal activation --------------------------------------
  for (const { path, method, operation } of operations) {
    if (method === 'GET') continue;
    if (CLIENT_ACTIVATION.some((p) => p.test(path))) {
      fail(
        'no-client-signal-activation',
        'I5 (BR-PAY-02)',
        `${method} ${path}`,
        'looks like a client-driven activation route. A membership is activated by the verified ' +
          'provider webhook only. A client signal is forgeable, arrives on failure too, and does ' +
          'not arrive at all when the redirect is lost — which is exactly when the money moved.',
      );
    }
    const summary = `${operation.summary ?? ''} ${operation.description ?? ''}`;
    if (/activat\w* (the )?membership/i.test(summary) && !path.includes('/webhooks/')) {
      fail(
        'no-client-signal-activation',
        'I5 (BR-PAY-02)',
        `${method} ${path}`,
        'documents itself as activating a membership but is not a webhook route.',
      );
    }
  }

  // --- 2 · no monetary field in any request schema --------------------------
  const requestSchemas = collectRequestSchemas(document);
  for (const { where, schema } of requestSchemas) {
    for (const field of Object.keys(schema.properties ?? {})) {
      if (MONEY_FIELD.test(field)) {
        fail(
          'no-monetary-request-field',
          'I2 (BR-PAY-04)',
          where,
          `request schema accepts "${field}". Every amount is computed server-side from the ` +
            `plan, the coupon and the tax profile. A client-supplied price is a client-CHOSEN ` +
            `price, and the attack is one line in devtools.`,
        );
      }
    }
  }

  // --- 3 · no client-supplied tenant id -------------------------------------
  for (const { path, method, operation } of operations) {
    for (const parameter of operation.parameters ?? []) {
      if (TENANT_PARAM.test(parameter.name ?? '')) {
        fail(
          'no-client-tenant-id',
          'I1 (BR-TEN-01, §11.3)',
          `${method} ${path}`,
          `accepts "${parameter.name}" as a ${parameter.in} parameter. The tenant comes from the ` +
            `access token. A caller who can name a tenant can name someone ELSE'S tenant, and ` +
            `the query that results is syntactically valid — nothing throws.`,
        );
      }
    }
    if (TENANT_PARAM.test(path.split('/').pop() ?? '') || /\{tenant_?id\}/i.test(path)) {
      fail(
        'no-client-tenant-id',
        'I1 (BR-TEN-01, §11.3)',
        `${method} ${path}`,
        'carries a tenant id in the PATH.',
      );
    }
  }
  for (const { where, schema } of requestSchemas) {
    for (const field of Object.keys(schema.properties ?? {})) {
      if (TENANT_PARAM.test(field)) {
        fail(
          'no-client-tenant-id',
          'I1 (BR-TEN-01, §11.3)',
          where,
          `request body accepts "${field}".`,
        );
      }
    }
  }

  // --- 4 · no gym-edits-review route ----------------------------------------
  //
  // Invariant 4 — BR-GYM-03. Approval requires a HUMAN platform actor. A route under /tenant
  // that decides an application would let the applicant approve themselves, which is the one
  // thing verification-before-visibility exists to prevent.
  for (const { path, method } of operations) {
    if (method === 'GET') continue;
    const decidesApplication = /\/applications?\/[^/]*\/?(approve|reject|decide|decision)$/i.test(
      path,
    );
    if (decidesApplication && !path.includes('/admin/')) {
      fail(
        'no-gym-edits-review',
        'I4 (BR-GYM-03)',
        `${method} ${path}`,
        'decides an application from outside /admin. The applicant would be able to approve ' +
          'their own listing — verification before visibility exists precisely to stop that.',
      );
    }
  }

  return { problems, operationCount: operations.length, schemaCount: requestSchemas.length };
}

/** Every request-body schema in the document, resolved one level through `$ref`. */
function collectRequestSchemas(document) {
  const out = [];
  const components = document.components?.schemas ?? {};

  const resolve$ref = (schema) => {
    if (!schema) return null;
    if (schema.$ref) {
      const name = schema.$ref.split('/').pop();
      return components[name] ?? null;
    }
    return schema;
  };

  for (const [path, item] of Object.entries(document.paths ?? {})) {
    for (const method of HTTP_METHODS) {
      const operation = item?.[method];
      const content = operation?.requestBody?.content;
      if (!content) continue;
      for (const [mediaType, media] of Object.entries(content)) {
        const schema = resolve$ref(media.schema);
        if (schema) {
          out.push({ where: `${method.toUpperCase()} ${path} (${mediaType})`, schema });
        }
      }
    }
  }

  // Component schemas are checked too: a shared DTO with a price field is a price field on
  // every operation that references it, and checking only inline schemas would miss all of them.
  for (const [name, schema] of Object.entries(components)) {
    if (/request|input|command|body|create|update/i.test(name)) {
      out.push({ where: `components.schemas.${name}`, schema });
    }
  }

  return out;
}

// --- CLI ---------------------------------------------------------------------

const isMain = process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/'));
if (isMain) {
  const documentPath = resolve(process.cwd(), 'openapi.json');
  if (!existsSync(documentPath)) {
    console.error('api-absence-assertions: openapi.json is missing. Run openapi:emit first.');
    process.exit(1);
  }

  const document = JSON.parse(readFileSync(documentPath, 'utf8'));
  const { problems, operationCount, schemaCount } = runAbsenceAssertions(document);

  if (problems.length === 0) {
    console.log('api-absence-assertions: all four absences hold.');
    console.log(`  I5  no client-signal activation      (BR-PAY-02)`);
    console.log(`  I2  no monetary field in a request   (BR-PAY-04)`);
    console.log(`  I1  no client-supplied tenant id     (BR-TEN-01)`);
    console.log(`  I4  no gym-edits-review route        (BR-GYM-03)`);
    console.log(`  checked ${operationCount} operation(s), ${schemaCount} request schema(s)`);
    process.exit(0);
  }

  console.error(`api-absence-assertions: ${problems.length} violation(s)\n`);
  for (const p of problems) {
    console.error(`  [${p.assertion}] ${p.invariant}`);
    console.error(`      ${p.where}`);
    console.error(`      ${p.message}\n`);
  }
  process.exit(1);
}
