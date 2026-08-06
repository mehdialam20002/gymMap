/**
 * M-002 · `no-tenant-id-parameter` — constitution §11.5 BR5, BR-TEN-01, NFR-SEC-09.
 *
 * A repository method must NEVER accept a tenant id as a parameter.
 *
 * Why this is a rule and not a review note. Tenant scope comes from exactly one place: the
 * request-scoped context, applied by the Prisma client extension (ADR-0005), enforced by RLS.
 * The moment a method signature reads `findMany(tenantId: string, ...)`, three things become
 * possible and none of them are detectable in review of the caller:
 *
 *   1. A caller passes the WRONG tenant id and reads another tenant's data — BR-TEN-01 breached
 *      with no exception thrown, because the query is syntactically valid.
 *   2. The parameter and the RLS session variable disagree, so the query returns nothing and the
 *      bug presents as "data missing" rather than "isolation broken" — the worse failure, because
 *      someone will "fix" it by widening the policy.
 *   3. A future refactor drops the RLS predicate on the grounds that "we already filter by tenant".
 *
 * The correct shape takes no tenant id at all. The context supplies it and the database enforces it.
 */

'use strict';

const TENANT_PARAM = /^tenant_?id$/i;

/** Files where a tenant id parameter is legitimate. */
const EXEMPT_PATH =
  /[\\/](tenancy|test|tests|__tests__|__mocks__|prisma[\\/]seed|migrations)[\\/]|\.(spec|test|e2e-spec)\.[cm]?tsx?$/;

const MESSAGE =
  "Constitution §11.5 BR5 / BR-TEN-01: '{{name}}' takes a tenant id as a parameter. Tenant scope " +
  'comes from the request context and is enforced by RLS — never from an argument. A caller that ' +
  'passes the wrong id reads another tenant, and the query is syntactically valid, so nothing ' +
  'throws. Remove the parameter; the Prisma tenant-context extension supplies it.';

module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Repository and service methods must not accept a tenant id; scope comes from context.',
    },
    schema: [],
    messages: { tenantIdParam: MESSAGE },
  },
  create(context) {
    const filename = context.filename ?? context.getFilename();
    if (EXEMPT_PATH.test(filename)) return {};

    /** Report any parameter list containing a tenant id. */
    function inspect(node, ownerName) {
      for (const param of node.params ?? []) {
        const id =
          param.type === 'Identifier'
            ? param
            : param.type === 'TSParameterProperty' && param.parameter?.type === 'Identifier'
              ? param.parameter
              : param.type === 'AssignmentPattern' && param.left?.type === 'Identifier'
                ? param.left
                : null;
        if (!id || !TENANT_PARAM.test(id.name)) continue;
        context.report({
          node: id,
          messageId: 'tenantIdParam',
          data: { name: ownerName ?? id.name },
        });
      }
    }

    return {
      MethodDefinition(node) {
        inspect(node.value, node.key?.name ?? 'method');
      },
      TSMethodSignature(node) {
        inspect(node, node.key?.name ?? 'method');
      },
      FunctionDeclaration(node) {
        inspect(node, node.id?.name ?? 'function');
      },
      TSDeclareFunction(node) {
        inspect(node, node.id?.name ?? 'function');
      },
    };
  },
};
