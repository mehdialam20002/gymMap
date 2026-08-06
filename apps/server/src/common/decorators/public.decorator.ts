/**
 * M-008 · `@Public()` — the ONLY exemption from PG-1.
 *
 * A route marked public must ALSO appear in `../openapi/public-allowlist.ts` with a written
 * reason (AC-3). Two mechanisms for one decision, deliberately: the decorator is what the guard
 * reads at runtime, the allowlist is what a human reviews. Requiring both means someone cannot
 * open a route to the unauthenticated internet by adding five characters to a controller — the
 * diff also touches a file whose entire purpose is to be argued about, and a reviewer scanning
 * that file sees every public surface in the system on one screen.
 */

import { SetMetadata, applyDecorators } from '@nestjs/common';
import { ApiExtension } from '@nestjs/swagger';

export const IS_PUBLIC = 'gymmap:is-public';

export const Public = () =>
  applyDecorators(SetMetadata(IS_PUBLIC, true), ApiExtension('x-gymmap-public', true));
