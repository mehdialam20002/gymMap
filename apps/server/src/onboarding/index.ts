/**
 * `onboarding/`'s public surface — `FolderStructure.md` §8.1 row 1.
 *
 * Repositories are NOT exported. They are this module's own tables, and a caller reaching one
 * directly bypasses the use cases that carry the `C4.4` state machine — which is the whole reason
 * the module boundary exists.
 */

export { OnboardingModule } from './onboarding.module.js';
export { ONBOARDING_PERMISSIONS } from './permissions.js';
export type {
  ApplicationDecision,
  ApplicationStatus,
  KycDocumentStatus,
  KycDocumentType,
} from './types/onboarding.types.js';
