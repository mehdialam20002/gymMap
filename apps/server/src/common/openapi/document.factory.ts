/**
 * M-008 · The OpenAPI document factory — A-16, AC-1, NFR-MNT-03.
 *
 * ┌─ WHY DETERMINISM IS THE WHOLE POINT ───────────────────────────────────────────────────────┐
 * │ Job 10 (`openapi-drift`) fails the build when the committed `openapi.json` differs from a  │
 * │ freshly generated one, and renders the diff as a mandatory review item.                     │
 * │                                                                                             │
 * │ That gate is only useful if a regeneration with NO code change produces a byte-identical    │
 * │ file. Object key order in JavaScript follows insertion order, and Nest's route scanning     │
 * │ order depends on module resolution — so an unsorted document produces a 400-line diff       │
 * │ every time someone adds a controller, and within two weeks everyone approves the drift      │
 * │ diff without reading it. At that point the gate is worse than nothing: it has trained       │
 * │ people to ignore exactly the signal it exists to raise.                                     │
 * │                                                                                             │
 * │ So every map in the document is sorted before it is written.                                │
 * └─────────────────────────────────────────────────────────────────────────────────────────────┘
 */

import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule, type OpenAPIObject } from '@nestjs/swagger';

/** Deep-sorts every object key so the emitted JSON is stable across runs. */
function sortDeep(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortDeep);
  if (value === null || typeof value !== 'object') return value;

  const entries = Object.entries(value as Record<string, unknown>);
  entries.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return Object.fromEntries(entries.map(([k, v]) => [k, sortDeep(v)]));
}

export function buildOpenApiConfig() {
  return (
    new DocumentBuilder()
      .setTitle('GymMap API')
      .setDescription(
        'Gym Marketplace & Multi-Tenant Gym Management SaaS.\n\n' +
          'Errors use the §C3.1 envelope: `{ error: { code, message, details[], correlation_id } }`.\n\n' +
          'Money crosses the wire as a STRING of integer minor units (paise for INR), never a ' +
          'JSON number — a JSON number loses integer precision above 2^53 (TR-38, BR-PAY-01).\n\n' +
          'The tenant is derived from the access token and is NEVER accepted from a client ' +
          'header, path, query or body (BR-TEN-01, §11.3).',
      )
      .setVersion('1')
      // Bearer only. The refresh cookie is httpOnly and path-scoped to /v1/auth/refresh, so it
      // is not an API-wide scheme and documenting it as one would invite a client to send it.
      .addBearerAuth(
        { type: 'http', scheme: 'bearer', bearerFormat: 'JWT', in: 'header' },
        'access-token',
      )
      .build()
  );
}

/**
 * Generates the document and sorts it.
 *
 * `operationIdFactory` is pinned rather than left to the default: Nest's default derives the
 * operationId from the controller class name, so renaming a class silently renames every
 * generated client method. Deriving it from the method alone keeps the published contract
 * stable across an internal refactor.
 */
export function createOpenApiDocument(app: INestApplication): OpenAPIObject {
  const document = SwaggerModule.createDocument(app, buildOpenApiConfig(), {
    operationIdFactory: (_controllerKey: string, methodKey: string) => methodKey,
    deepScanRoutes: true,
  });
  return sortDeep(document) as OpenAPIObject;
}

/** Byte-stable serialisation. Two spaces and a trailing newline, so `git diff` behaves. */
export function serialiseOpenApiDocument(document: OpenAPIObject): string {
  return `${JSON.stringify(document, null, 2)}\n`;
}
