/**
 * M-004 · `ZodValidationPipe` — A-02, `packages/types` schemas, §C3.1.
 *
 * ┌─ WHY THIS EXISTS RATHER THAN Nest's built-in ValidationPipe ────────────────────────────┐
 * │ `@nestjs/common`'s ValidationPipe requires `class-validator` + `class-transformer`.      │
 * │ Neither is an approved dependency, and adding them would be a SUBSTITUTION for Zod,      │
 * │ which STACK_ADDITIONS.md forbids outright (A-02 is the approved validator).              │
 * │                                                                                          │
 * │ The substantive reason the stack chose Zod: the same schema object validates on the      │
 * │ server AND in the browser via `packages/types`, so a form and the endpoint it posts to   │
 * │ cannot disagree about what is valid. class-validator's decorators live on server-side    │
 * │ classes and cannot cross to a React bundle, which means writing the rules twice.         │
 * │                                                                                          │
 * │ Discovered the honest way: registering Nest's pipe made the server fail to boot with     │
 * │ "The class-validator package is missing".                                                │
 * └──────────────────────────────────────────────────────────────────────────────────────────┘
 */

import { Injectable, type ArgumentMetadata, type PipeTransform } from '@nestjs/common';
import type { ZodSchema } from 'zod';

/**
 * Validates one argument against one schema.
 *
 * Constructed per route with the schema that argument must satisfy:
 *
 *   @Post()
 *   create(@Body(new ZodValidationPipe(createOrderSchema)) body: CreateOrder) { … }
 *
 * Returns the schema's OUTPUT, not its input, so a `z.string().transform(BigInt)` on a money
 * field hands the handler a real `bigint`. That is the whole point of validating with Zod rather
 * than merely checking shape: parsing and coercion happen once, at the boundary.
 */
@Injectable()
export class ZodValidationPipe<TSchema extends ZodSchema> implements PipeTransform {
  constructor(private readonly schema: TSchema) {}

  transform(value: unknown, _metadata: ArgumentMetadata): unknown {
    // The ZodError is thrown as-is and mapped to the §C3.1 envelope by DomainExceptionFilter.
    // Converting it to a ValidationException here would duplicate the issue-to-details mapping
    // in two places, and the two copies would drift.
    return this.schema.parse(value);
  }
}

/** Terser at the call site: `@Body(zodPipe(createOrderSchema))`. */
export function zodPipe<TSchema extends ZodSchema>(schema: TSchema): ZodValidationPipe<TSchema> {
  return new ZodValidationPipe(schema);
}
