/**
 * M-019 · `iam/` — the identity and RBAC module.
 *
 * ┌─ TABLES AND A CATALOGUE. NO PROVIDERS YET, AND THAT IS THE MILESTONE ───────────────────────┐
 * │ M-019's deliverable is the five tables with the correct tenancy class and a seeded role and │
 * │ permission catalogue. The things that USE them — Argon2id credentials (M-020), phone OTP    │
 * │ (M-021), sessions and tokens (M-022, M-023), the `PermissionsGuard` (M-024) and TOTP MFA    │
 * │ (M-025) — each arrive with their own milestone and register here.                            │
 * │                                                                                              │
 * │ The module exists now rather than with M-020 because §8.1 requires it the moment the        │
 * │ directory acquires source, and `permissions.ts` is source.                                   │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 *
 * ┌─ `iam/` IS NOT TENANT-SCOPED, AND THAT IS DELIBERATE ───────────────────────────────────────┐
 * │ Every table this module owns is IDENTITY or GLOBAL (`Schema.md` §1.3), so none carries an    │
 * │ RLS policy and none is reached through `runInTenantTransaction`. A `TenantScopedRepository`  │
 * │ here would be actively wrong: `users` has no `tenant_id` to scope by, and scoping            │
 * │ `user_roles` would hide every platform-role grant.                                           │
 * │                                                                                              │
 * │ What replaces tenancy as the control is AUTHORISATION — `user_id` on the row, and the        │
 * │ permission the endpoint declares. That is a different mechanism with different failure       │
 * │ modes, which is exactly why `Schema.md` §1.3 gives it its own class name rather than         │
 * │ treating it as RLS-with-an-exception.                                                        │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 *
 * NOT imported by `AppModule`. Per that file's standing rule, a module is wired in by the
 * milestone that gives it a consumer — here, M-020's first auth endpoint.
 */

import { Module } from '@nestjs/common';

@Module({})
export class IamModule {}
