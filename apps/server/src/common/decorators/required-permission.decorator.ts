/**
 * M-008 · `@RequiredPermission()` — FR-RBAC-01, PG-1, PG-3.
 *
 * Every route declares the permission it needs, or is explicitly `@Public()`. There is no third
 * option, and `api-gates.mjs` fails the build on one.
 *
 * The decorator does TWO things, and both are necessary:
 *
 *   SetMetadata   → what `PermissionsGuard` reads at RUNTIME (M-023)
 *   ApiExtension  → what lands in `openapi.json`, which is what CI checks
 *
 * Only the first would leave the gate blind: it reads the generated document rather than the
 * source, because the document is what the application actually exposes and what clients are
 * generated from. Only the second would document a guard that does not exist.
 *
 * §B3.2 is explicit that hiding a menu item is NOT an authorisation control. The server decides.
 */

import { SetMetadata, applyDecorators } from '@nestjs/common';
import { ApiExtension } from '@nestjs/swagger';

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
export const RequiredPermission = (permission: string) =>
  applyDecorators(
    SetMetadata(REQUIRED_PERMISSION, permission),
    ApiExtension('x-gymmap-permission', permission),
  );
