/**
 * M-012 · The `GET /v1/tenant/ping` response.
 *
 * Four fields, and the omissions are the point. The tenant row carries PAN, GSTIN, commission
 * rates, reserve percentages and a bank hold date — none of which a ping needs, and all of
 * which would then be in the response body of the most-called endpoint in the system.
 *
 * A DTO that returns the row is not a shortcut, it is a data-exposure decision taken by
 * omission. This one is taken deliberately.
 */

import { z } from 'zod';

export const pingResponseSchema = z
  .object({
    id: z.string().uuid(),
    trading_name: z.string().nullable(),
    /** AUTHORITATIVE for every validity computation the caller will do next (TM3). */
    timezone: z.string(),
    status: z.string(),
  })
  .strict();

export type PingResponse = z.infer<typeof pingResponseSchema>;
