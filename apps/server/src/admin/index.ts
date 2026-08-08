/**
 * `admin/`'s public surface — `§C1.3`, constitution §3.4.3.
 *
 * The module and its permission keys. Nothing else: the use case, the adapter and the controller
 * are internal, and a second module reaching for `PlatformOverviewUseCase` would be building a
 * second administration surface without anyone deciding to.
 */

export { AdminModule } from './admin.module.js';
export { ADMIN_PERMISSIONS, type AdminPermission } from './permissions.js';
export type { PlatformOverview, GymRow, GymStatusCounts } from './types/platform-overview.js';
