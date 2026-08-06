/**
 * M-003 · Pagination schemas — §C3.1.
 *
 * Shared by client and server (A-02) so the query string a browser builds and the query string
 * the server accepts are validated by one definition rather than two that agree by inspection.
 */

import { z } from 'zod';

import { DEFAULT_PAGE_LIMIT, MAX_PAGE_LIMIT } from '../../pagination.js';

/**
 * `?limit=&cursor=`.
 *
 * `limit` is coerced because a query string is always text, and capped at `MAX_PAGE_LIMIT`
 * rather than rejected above it — a client asking for 500 gets 100, not a 400. The cap is a
 * load control (`NFR-PERF-02`), and turning a load control into a client error just moves the
 * failure somewhere less visible.
 */
export const pageRequestSchema = z
  .object({
    limit: z.coerce
      .number()
      .int()
      .min(1)
      .max(MAX_PAGE_LIMIT)
      .default(DEFAULT_PAGE_LIMIT)
      .catch(DEFAULT_PAGE_LIMIT),
    cursor: z.string().min(1).optional(),
  })
  .strict();

/** `?sort=field:asc|desc`. The field allow-list is per endpoint — an open sort field is an index scan. */
export function sortSpecSchema<const TFields extends readonly [string, ...string[]]>(
  allowedFields: TFields,
) {
  return z
    .string()
    .regex(/^[a-z_]+:(asc|desc)$/, 'sort must be "field:asc" or "field:desc"')
    .transform((raw) => {
      const [field, direction] = raw.split(':') as [string, 'asc' | 'desc'];
      return { field, direction };
    })
    .refine((spec) => (allowedFields as readonly string[]).includes(spec.field), {
      message: `sort field must be one of: ${allowedFields.join(', ')}`,
    });
}

/** The response envelope, parameterised by the item schema. */
export function pageSchema<TItem extends z.ZodTypeAny>(item: TItem) {
  return z
    .object({
      data: z.array(item),
      next_cursor: z.string().min(1).nullable(),
      has_more: z.boolean(),
    })
    .strict();
}
