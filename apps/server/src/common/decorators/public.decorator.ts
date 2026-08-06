/**
 * M-008 · `@Public()` — the ONLY exemption from PG-1.
 *
 * A route marked public must also appear in `apps/server/src/common/openapi/public-allowlist.ts`
 * with a written reason (AC-3). Two mechanisms for one decision, deliberately: the decorator is
 * what the guard reads at runtime, the allowlist is what a human reviews. Requiring both means
 * someone cannot open a route to the internet by adding five characters to a controller — the
 * diff also touches a file whose entire purpose is to be argued about.
 */

import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC = 'gymmap:is-public';

export const Public = (): MethodDecorator => SetMetadata(IS_PUBLIC, true);
