/**
 * M-019 · `iam/` public surface — §8.1 row 1.
 *
 * The permission CATALOGUE is exported; nothing that evaluates it is. `permissionsFor()` answers
 * "what does this role hold in the abstract", which is what the seed and `FR-RBAC-05`'s
 * effective-permissions screen need. "May THIS principal do THIS, to THIS resource" is a
 * different question — it needs the request's tenant, the resource's tenant (`FR-RBAC-03`) and
 * the `▪` row filter — and it is answered by `PermissionsGuard` at M-024, inside this module.
 *
 * A consumer that could reach the evaluator would be tempted to ask it the abstract question and
 * treat the answer as an authorisation decision. That is `FR-RBAC-03`'s failure exactly: a role
 * evaluated against the session's tenant rather than the resource's.
 */

export { IamModule } from './iam.module.js';

export {
  CAPABILITY_MATRIX,
  PERMISSION_KEYS,
  ROLE_DEFINITIONS,
  describePermission,
  parsePermissionKey,
  permissionsFor,
  rolePermissionPairs,
} from './permissions.js';

export {
  MATRIX_GRANTS,
  PLATFORM_ROLES,
  PLATFORM_SCOPES,
  ROLE_SCOPES,
  type CapabilityDefinition,
  type MatrixGrant,
  type PlatformRole,
  type RoleDefinition,
  type RoleScope,
} from './types/iam.types.js';
