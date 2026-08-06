/**
 * M-008 · `@RequiredPermission()` — FR-RBAC-01, PG-1, PG-3.
 *
 * Every route declares the permission it needs, or is explicitly `@Public()`. There is no third
 * option, and `api-gates.mjs` fails the build on one.
 *
 * Why a decorator and not a guard argument: the reflection pass has to be able to answer
 * "what does this endpoint require" WITHOUT running the application. That is what makes the
 * B3.2 matrix testable as data (M-023: 43 capabilities × 12 roles = 516 generated cell tests)
 * and what lets CI prove an endpoint is gated before anyone writes an integration test for it.
 *
 * §B3.2 is explicit that hiding a menu item is NOT an authorisation control. The server decides.
 */

import { SetMetadata } from '@nestjs/common';

export const REQUIRED_PERMISSION = 'gymmap:required-permission';

/**
 * `<module>.<resource>.<action>` — three lowercase dot-separated segments, the first of which is
 * one of the 23 module folders (PG-3).
 *
 * The shape is enforced because a free-text permission string drifts within a week:
 * `gym.update`, `gyms.update`, `catalog.gym.edit` and `catalog.gym.update` all appear, three of
 * them match nothing in the matrix, and the endpoints they guard are open to anyone whose role
 * happens to carry a wildcard.
 */
export const RequiredPermission = (permission: string): MethodDecorator =>
  SetMetadata(REQUIRED_PERMISSION, permission);
