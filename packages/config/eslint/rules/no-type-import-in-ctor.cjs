/**
 * M-002 · `no-type-import-in-ctor` — closes the gap TD-030 opened.
 *
 * apps/server disables `verbatimModuleSyntax` because NestJS is CommonJS-first and TypeScript
 * raises TS1287 otherwise. That override has a sharp edge, recorded in TD-030 and left
 * UNCONTROLLED at M-001 with this rule named as the mitigation:
 *
 *   `emitDecoratorMetadata` reads the TYPE of a constructor parameter to resolve a provider.
 *   A dependency imported via `import type { X }` is ERASED at compile time, so the emitted
 *   metadata is `undefined` and Nest fails at RUNTIME with "Cannot read properties of undefined
 *   (reading 'name')" — a message that points nowhere near the actual mistake.
 *
 * The failure is silent at compile time, confusing at runtime, and trivially avoidable. Hence a
 * lint rule rather than a wiki page.
 *
 * Rejected:  import type { UserRepository } from './user.repository';
 *            constructor(private readonly users: UserRepository) {}
 *
 * Correct:   import { UserRepository } from './user.repository';
 *            constructor(private readonly users: UserRepository) {}
 */

'use strict';

const MESSAGE =
  "TD-030: '{{name}}' is imported with `import type` but appears in a constructor signature. " +
  'A type-only import is erased, so emitDecoratorMetadata emits `undefined` and Nest fails at ' +
  'RUNTIME with an error that points nowhere near this line. Use a value import.';

module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'A constructor parameter type must be a value import, or NestJS DI metadata is erased.',
    },
    schema: [],
    messages: { typeImportInCtor: MESSAGE },
  },
  create(context) {
    /** local name -> the ImportSpecifier node that brought it in type-only */
    const typeOnly = new Map();
    /** constructor parameter type names seen, with their nodes */
    const ctorTypes = [];

    function recordTypeOnly(node) {
      const kindIsType = node.importKind === 'type';
      for (const spec of node.specifiers ?? []) {
        const isTypeSpecifier = spec.importKind === 'type' || kindIsType;
        if (!isTypeSpecifier) continue;
        if (!spec.local?.name) continue;
        typeOnly.set(spec.local.name, spec);
      }
    }

    function collectParamType(param) {
      const id =
        param.type === 'TSParameterProperty'
          ? param.parameter
          : param.type === 'Identifier'
            ? param
            : null;
      const ann = id?.typeAnnotation?.typeAnnotation;
      if (ann?.type !== 'TSTypeReference') return;
      const name = ann.typeName?.name ?? ann.typeName?.left?.name;
      if (typeof name === 'string') ctorTypes.push({ name, node: ann });
    }

    /**
     * True when Nest is told the token EXPLICITLY, so the emitted metadata is irrelevant.
     *
     * `constructor(@Inject(APP_CONFIG) private readonly config: AppConfig)` cannot fail the way
     * TD-030 describes: Nest resolves `APP_CONFIG`, never the reflected parameter type. And
     * `AppConfig` is a Zod-inferred TYPE with no runtime value, so a value import is not merely
     * unnecessary — it is impossible.
     *
     * Added in M-016, when the four custom rules ran against the codebase for the first time.
     * Without it the rule demands a value import of something that has no value.
     */
    function hasInjectDecorator(param) {
      const decorators = param.decorators ?? param.parameter?.decorators ?? [];
      return decorators.some((d) => {
        const expression = d.expression;
        if (expression?.type === 'CallExpression') {
          return expression.callee?.name === 'Inject';
        }
        return expression?.name === 'Inject';
      });
    }

    /**
     * True when the enclosing class extends `Error`.
     *
     * An exception is never a Nest provider, so Nest never reflects on its constructor and
     * TD-030 cannot apply. `DomainException`'s parameter is an `ErrorCode` — a string union with
     * no runtime value — so the rule's own remedy, "use a value import", is impossible to follow.
     *
     * Deliberately NOT "the class carries no decorator", which was the first attempt: that
     * exemption is broader than the reason for it and silently disabled the rule for the plain
     * `class S { … }` shape its own fixtures use — so the rule would have kept passing its unit
     * tests while no longer catching anything they describe.
     */
    function extendsError(ctorNode) {
      const superClass = ctorNode.parent?.parent?.superClass;
      return superClass?.type === 'Identifier' && /Error$/.test(superClass.name);
    }

    return {
      ImportDeclaration: recordTypeOnly,

      'MethodDefinition[kind="constructor"]'(node) {
        if (extendsError(node)) return;
        for (const param of node.value?.params ?? []) {
          if (hasInjectDecorator(param)) continue;
          collectParamType(param);
        }
      },

      'Program:exit'() {
        for (const { name, node } of ctorTypes) {
          if (!typeOnly.has(name)) continue;
          context.report({ node, messageId: 'typeImportInCtor', data: { name } });
        }
      },
    };
  },
};
