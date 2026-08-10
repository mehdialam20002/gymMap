/**
 * M-003 · The error-code registry — constitution §13.2, C1.5, C3.1.
 *
 * §13.2.1 fixes this file as the registry's location and requires a single `as const` object.
 * Every error the platform can return has exactly one row here, and the `ErrorCode` union is
 * DERIVED from it (`error-code.ts`) rather than maintained beside it. That derivation is the
 * point: a hand-maintained union and a hand-maintained table drift, and the drift shows up as
 * a client that cannot branch on a code the server actually emits.
 *
 * Stability rules that make this file append-mostly (§13.2.1):
 *   · A code is never renamed. Clients branch on it and old app versions live for months.
 *   · A code is never reused for a different meaning.
 *   · A retired code stays here marked `RETIRED` with the version that stopped emitting it.
 *
 * This milestone seeds the `common`, `tenancy` and `iam` slices only. Module milestones append
 * their own rows; the CI check in §13.2.1 fails any thrown domain error whose code is absent.
 *
 * ┌─ REGISTRY DISCREPANCY, raised rather than silently resolved ───────────────────────────┐
 * │ `Milestones_000-029.md` M-003 lists `IDEMPOTENCY_KEY_REUSED`. Constitution §13.2.2 —   │
 * │ the registry's own governing clause — lists `IDEMPOTENCY_KEY_MISMATCH` for the same    │
 * │ condition (`BR-PAY-03`, `C1.5`). Two codes for one condition would breach the          │
 * │ uniqueness rule, so this file adopts the constitution's spelling, which outranks the   │
 * │ roadmap. Tracked so the roadmap wording is corrected rather than quietly diverging.    │
 * └────────────────────────────────────────────────────────────────────────────────────────┘
 */

/** §13.1 error classes. Determines the HTTP status and whether the error is the caller's fault. */
export type ErrorClass =
  | 'Validation'
  | 'Authentication'
  | 'Authorisation'
  | 'NotFound'
  | 'Conflict'
  | 'Business'
  | 'RateLimit'
  | 'Gone'
  | 'System';

/** The owning module — one of the twenty-three of §C1.3. A code belongs to exactly one. */
export type OwningModule =
  | 'common'
  | 'tenancy'
  | 'iam'
  | 'onboarding'
  | 'catalog'
  | 'plans'
  | 'discovery'
  | 'ordering'
  | 'payments'
  | 'billing'
  | 'memberships'
  | 'attendance'
  | 'crm'
  | 'staff'
  | 'reviews'
  | 'ledger'
  | 'settlements'
  | 'refunds'
  | 'notifications'
  | 'reporting'
  | 'support'
  | 'admin'
  | 'audit';

/** One registry row. Columns are fixed by §13.2.1. */
export interface ErrorRegistryRow {
  readonly module: OwningModule;
  readonly class: ErrorClass;
  readonly httpStatus: number;
  /** i18n key, `NFR-USE-08`. The wire `message` is rendered from this, never hardcoded English. */
  readonly messageKey: string;
  /** The `BR-`/`FR-`/`NFR-`/`C`-clause identifiers this code enforces. Never empty. */
  readonly enforces: readonly string[];
  /** Whether the caller may retry the identical request unchanged and expect a different result. */
  readonly retryable: boolean;
  /** Shape of the `details[]` entries, when the code carries any. */
  readonly detailsShape?: string;
  /** Set when the code is no longer emitted. The row stays forever (§13.2.1). */
  readonly retiredInVersion?: string;
}

export const ERROR_REGISTRY = {
  // --- common -------------------------------------------------------------
  VALIDATION_FAILED: {
    module: 'common',
    class: 'Validation',
    httpStatus: 400,
    messageKey: 'error.common.validation_failed',
    enforces: ['C1.5', 'C3.1', 'NFR-SEC-05'],
    retryable: false,
    detailsShape: '{ field: string; rule: string; }',
  },
  /**
   * The terminal fallback. Emitted when an unrecognised throwable reaches the global filter, and
   * when a code with no registry row would otherwise reach the wire.
   *
   * Carries no detail by design (AC-FND-09.6 / SEC-A03-005): a Prisma message contains the SQL
   * and often a parameter value, a filesystem error an absolute path, an HTTP client error the
   * upstream URL with its query string. The full error goes to the log against the correlation
   * id, so support loses nothing while an attacker gains nothing.
   */
  INTERNAL_ERROR: {
    module: 'common',
    class: 'System',
    httpStatus: 500,
    messageKey: 'error.common.internal_error',
    enforces: ['AC-FND-09.6', 'SEC-A03-005', 'C3.1'],
    retryable: false,
  },
  RESOURCE_NOT_FOUND: {
    module: 'common',
    class: 'NotFound',
    httpStatus: 404,
    messageKey: 'error.common.resource_not_found',
    enforces: ['C3.1'],
    retryable: false,
  },
  UNAUTHENTICATED: {
    module: 'common',
    class: 'Authentication',
    httpStatus: 401,
    messageKey: 'error.common.unauthenticated',
    enforces: ['C1.4', 'FR-AUTH-01'],
    retryable: false,
  },
  RATE_LIMIT_EXCEEDED: {
    module: 'common',
    class: 'RateLimit',
    httpStatus: 429,
    messageKey: 'error.common.rate_limit_exceeded',
    enforces: ['NFR-SEC-06', 'C3.1'],
    // Retryable after the window. `Retry-After` and `X-RateLimit-*` carry the wait (§C3.1).
    retryable: true,
  },
  DEPENDENCY_UNAVAILABLE: {
    module: 'common',
    class: 'System',
    httpStatus: 503,
    messageKey: 'error.common.dependency_unavailable',
    enforces: ['NFR-AVL-03', 'NFR-AVL-07'],
    retryable: true,
  },
  IDEMPOTENCY_KEY_REQUIRED: {
    module: 'common',
    class: 'Validation',
    httpStatus: 400,
    messageKey: 'error.common.idempotency_key_required',
    enforces: ['C3.1', 'BR-PAY-03'],
    retryable: false,
  },
  IDEMPOTENCY_KEY_MISMATCH: {
    module: 'common',
    class: 'Conflict',
    httpStatus: 409,
    messageKey: 'error.common.idempotency_key_mismatch',
    enforces: ['BR-PAY-03', 'C1.5'],
    // Emphatically NOT retryable. The key was already used with a DIFFERENT body; retrying the
    // same request reproduces the conflict, and retrying with a new key may double-charge.
    retryable: false,
    detailsShape: '{ idempotency_key: string; first_seen_at: string; }',
  },
  CURRENCY_MISMATCH: {
    module: 'common',
    class: 'Validation',
    httpStatus: 422,
    messageKey: 'error.common.currency_mismatch',
    enforces: ['BR-PAY-01', 'NFR-DQ-02'],
    retryable: false,
    detailsShape: '{ expected: string; received: string; }',
  },

  // --- tenancy ------------------------------------------------------------
  TENANT_HEADER_NOT_ACCEPTED: {
    module: 'tenancy',
    class: 'Validation',
    httpStatus: 400,
    messageKey: 'error.tenancy.tenant_header_not_accepted',
    enforces: ['C1.4', 'C3.1', 'BR-TEN-01', '§11.3'],
    retryable: false,
  },
  TENANT_CONTEXT_MISSING: {
    module: 'tenancy',
    class: 'System',
    httpStatus: 500,
    messageKey: 'error.tenancy.tenant_context_missing',
    enforces: ['C1.4', 'BR-TEN-01', '§11.5 BR2'],
    // A 500, never a 403 and never an empty result set (Security.md P3). An empty result set is
    // indistinguishable from a correct answer, so the isolation failure would go unnoticed.
    retryable: false,
  },
  TENANT_CONTEXT_ALREADY_SET: {
    module: 'tenancy',
    class: 'System',
    httpStatus: 500,
    messageKey: 'error.tenancy.tenant_context_already_set',
    enforces: ['BR-TEN-01', 'ADR-0005', '§11.5'],
    // Re-entrant context means one transaction spans two tenants. Fail before the query runs.
    retryable: false,
  },
  ELEVATION_REFUSED: {
    module: 'tenancy',
    class: 'System',
    httpStatus: 500,
    messageKey: 'error.tenancy.elevation_refused',
    enforces: ['AC-FND-05.1', 'AC-AUTH-03.2', 'BR-TEN-01'],
    // Distinct from TENANT_CONTEXT_ALREADY_SET on purpose. Both refusals protect the same
    // boundary, but they are provoked by different mistakes and are fixed in different places:
    // one means a use case entered a second tenant, this one means somebody tried to cross the
    // boundary DELIBERATELY and was not entitled to. Collapsing them would make the alert on a
    // refused elevation — the interesting one — indistinguishable from an ordinary context bug.
    retryable: false,
  },

  // --- iam ----------------------------------------------------------------
  PERMISSION_DENIED: {
    module: 'iam',
    class: 'Authorisation',
    httpStatus: 403,
    messageKey: 'error.iam.permission_denied',
    enforces: ['FR-RBAC-01', 'FR-RBAC-02'],
    retryable: false,
  },

  // --- iam · M-023, RBAC ---------------------------------------------------
  LAST_OWNER_PROTECTED: {
    module: 'iam',
    class: 'Business',
    // 422, not 403. The caller may well be permitted to change roles — what they asked for is a
    // STATE the domain refuses. A 403 would send them to look for a missing permission that does
    // not exist, and no permission could ever grant this.
    httpStatus: 422,
    messageKey: 'error.iam.last_owner_protected',
    enforces: ['FR-RBAC-07', 'FR-STAF-09'],
    // Not retryable in itself; retryable after a second owner is added, which is what the message
    // tells the caller to do.
    retryable: false,
    detailsShape: '{ tenant_id: string; owner_count: number; }',
  },

  // --- onboarding · M-028, the application lifecycle -----------------------

  APPLICATION_ILLEGAL_TRANSITION: {
    module: 'onboarding',
    class: 'Business',
    // 422: the caller may hold every permission the route needs. What they asked for is a state
    // the `§C4.4` machine does not offer from where the application currently is.
    httpStatus: 422,
    messageKey: 'error.onboarding.application_illegal_transition',
    enforces: ['FR-ONB-09', 'BR-GYM-01'],
    retryable: false,
  },

  APPLICATION_ALREADY_SUBMITTED: {
    module: 'onboarding',
    class: 'Business',
    // 409, not 422. This one IS about a race: the caller's request was valid when they formed it
    // and another submission landed first, which is precisely what a conflict means.
    httpStatus: 409,
    messageKey: 'error.onboarding.application_already_submitted',
    enforces: ['BR-GYM-05', 'FR-ONB-08'],
    retryable: false,
  },

  APPLICATION_SNAPSHOT_IMMUTABLE: {
    module: 'onboarding',
    class: 'Business',
    // The application-layer twin of the D-03 grant. The GRANT is the real control — it refuses the
    // statement for every connection — and this exists so a caller that tries gets an explanation
    // rather than a raw `permission denied` surfacing as a 500.
    httpStatus: 422,
    messageKey: 'error.onboarding.application_snapshot_immutable',
    enforces: ['FR-ONB-08', 'BR-GYM-05'],
    retryable: false,
  },

  // --- onboarding · M-029, the KYC checklist --------------------------------

  KYC_CHECKLIST_NOT_PUBLISHED: {
    module: 'onboarding',
    // ┌─ `System`, NOT `Business` — the applicant did nothing wrong ──────────────────────────────┐
    // │ Every other onboarding refusal here is something the caller can fix by changing their     │
    // │ request. This one cannot be: no checklist is published for their country and entity form, │
    // │ which is a gap in PLATFORM CONFIGURATION. Classing it `Business` would put a 4xx on the   │
    // │ wire and tell a gym owner in an unlaunched market that they had made a mistake.            │
    // └────────────────────────────────────────────────────────────────────────────────────────────┘
    class: 'System',
    httpStatus: 503,
    messageKey: 'error.onboarding.kyc_checklist_not_published',
    enforces: ['FR-ONB-03', 'BR-GYM-01'],
    // 503 usually invites a retry, and this one must not. Publishing a checklist is an admin
    // action (FR-ADMN-06); an automatic retry of the identical request cannot make one appear, so
    // the shared fetch wrapper would only spin against a condition it can never clear.
    retryable: false,
  },

  KYC_DOCUMENT_REJECTED: {
    module: 'onboarding',
    class: 'Validation',
    // 422, not 400. The request was well formed — a multipart body with a file in it. What failed
    // is the CONTENT, which 400 would misdescribe as a malformed request and send a developer
    // looking at their client code rather than at the file.
    httpStatus: 422,
    messageKey: 'error.onboarding.kyc_document_rejected',
    enforces: ['NFR-SEC-10', 'FR-ONB-03'],
    // The identical bytes will be refused identically, forever. A retry is only useful after the
    // applicant changes the FILE, which makes it a different request.
    retryable: false,
  },

  KYC_STORAGE_UNAVAILABLE: {
    module: 'onboarding',
    // ┌─ `System`, AND IT COVERS TWO VERY DIFFERENT CAUSES ON PURPOSE ────────────────────────────┐
    // │ "the enclave could not be verified" and "the bucket is not private" are one code because  │
    // │ the applicant can act on neither, and the distinction is exactly what should NOT be on the │
    // │ wire: telling an anonymous caller that a KYC bucket is publicly readable is telling them   │
    // │ where to look. The two are separated in the log, against the correlation id.               │
    // └────────────────────────────────────────────────────────────────────────────────────────────┘
    class: 'System',
    httpStatus: 503,
    messageKey: 'error.onboarding.kyc_storage_unavailable',
    enforces: ['BR-DAT-07', 'NFR-SEC-02'],
    // Deliberately false while BLK-16 is open. An automatic retry cannot bind an adapter, and a
    // client spinning against a permanent refusal is how a rollout becomes an outage.
    retryable: false,
  },

  // --- iam · M-025, impersonation ------------------------------------------

  IMPERSONATION_FINANCIAL_MUTATION_REFUSED: {
    module: 'iam',
    class: 'Business',
    // ┌─ 403 HERE, WHERE THE MFA REFUSALS ARE 422 ──────────────────────────────────────────────┐
    // │ The difference is real. `MFA_MANDATORY_FOR_ROLE` is an operation available to NOBODY, so │
    // │ 403 would misdescribe it as an authorisation gap. This one IS about who is asking: the   │
    // │ agent's own identity may well move this money, and the fix is to end the impersonation.  │
    // │ That is exactly what 403 means, and the message names the remedy.                         │
    // └───────────────────────────────────────────────────────────────────────────────────────────┘
    httpStatus: 403,
    messageKey: 'error.iam.impersonation_financial_mutation_refused',
    enforces: ['BR-DAT-02', 'E1.8', 'FR-AUTH-12'],
    retryable: false,
  },

  IMPERSONATION_REFUSED: {
    module: 'iam',
    class: 'Business',
    // 422: the caller may be permitted to impersonate in general — what they asked for is a state
    // the domain refuses (no reason, over the cap, or a target who can themselves impersonate).
    httpStatus: 422,
    messageKey: 'error.iam.impersonation_refused',
    enforces: ['FR-AUTH-12'],
    retryable: false,
  },

  // --- iam · M-024, the second factor -------------------------------------

  MFA_VERIFICATION_FAILED: {
    module: 'iam',
    class: 'Business',
    // ┌─ ONE CODE FOR EVERY WAY THE FACTOR CAN FAIL ───────────────────────────────────────────┐
    // │ Wrong TOTP, replayed TOTP, wrong recovery code, no enrolment at all — all of them answer │
    // │ with this. Separating them would build an enrolment oracle: submit anything for a user   │
    // │ id and the error tells you whether that account has MFA, which is to say whether it is   │
    // │ a staff account worth attacking. Same shape as M-020's deliberate lack of an             │
    // │ INVALID_CREDENTIALS/USER_NOT_FOUND split, for exactly the same reason.                    │
    // └─────────────────────────────────────────────────────────────────────────────────────────┘
    httpStatus: 401,
    messageKey: 'error.iam.mfa_verification_failed',
    enforces: ['FR-AUTH-07', 'NFR-SEC-11'],
    // NOT retryable, and the registry's own invariant is what corrected this — a retryable 4xx may
    // only be a 429. It is right: replaying the SAME rejected code is never going to work, and a
    // client that treats "wrong code" as retryable hammers the endpoint straight into the lockout
    // it is trying to avoid. The user typing a fresh code is a new request, not a retry.
    retryable: false,
  },

  MFA_ENROLMENT_REQUIRED: {
    module: 'iam',
    class: 'Business',
    // 403, and the code is the point: `Security.md` §2.8 says an account holding a platform role
    // with no enrolment "can reach ONLY /auth/mfa/enrol; every other route returns 403
    // MFA_ENROLMENT_REQUIRED with a code the client uses to start enrolment". A bare 403 would
    // leave the client with nothing to act on but a dead end.
    httpStatus: 403,
    messageKey: 'error.iam.mfa_enrolment_required',
    enforces: ['FR-AUTH-07', 'NFR-SEC-11', 'E1.3'],
    retryable: false,
  },

  MFA_MANDATORY_FOR_ROLE: {
    module: 'iam',
    class: 'Business',
    // 422, not 403 — the same distinction as LAST_OWNER_PROTECTED. A SUPER_ADMIN holds every
    // permission there is, so 403 would be a lie about authorisation. The truth is that the
    // domain offers this operation to nobody. M-024 acceptance criterion 6 requires it.
    httpStatus: 422,
    messageKey: 'error.iam.mfa_mandatory_for_role',
    enforces: ['FR-AUTH-07', 'NFR-SEC-11'],
    retryable: false,
  },

  MFA_NOT_AVAILABLE_FOR_ROLE: {
    module: 'iam',
    class: 'Business',
    // The NOT_OFFERED third case. A receptionist asking to enrol is refused because a shared
    // front-desk device makes per-staff TOTP an operational problem NFR-USE-09 does not budget
    // for (Security.md §2.8) — not because they lack a permission.
    httpStatus: 422,
    messageKey: 'error.iam.mfa_not_available_for_role',
    enforces: ['FR-AUTH-07'],
    retryable: false,
  },

  // --- iam · M-020, the password path -------------------------------------
  //
  // Note what is ABSENT: there is no INVALID_CREDENTIALS, no USER_NOT_FOUND and no
  // WRONG_PASSWORD. A failed login returns `UNAUTHENTICATED` — the code already above —
  // whether the identifier is unknown or the password is wrong.
  //
  // `Security.md` §1.6 requires the two to be indistinguishable, and a distinct code is the
  // easiest possible enumeration oracle: an attacker reads it straight out of the response body
  // and needs no timing analysis at all. Registering one "for better error messages" would undo
  // the decoy-hash work in `argon2.hasher.adapter.ts` with a single line.

  ACCOUNT_LOCKED: {
    module: 'iam',
    class: 'Authorisation',
    // 403, NOT 429 — `API_Catalog.md` §4.5. Rate limiting is about request volume and clears
    // with time; a lockout is about THIS ACCOUNT and clears with an unlock. A 429 tells the
    // victim of a credential-stuffing run to "try again in a minute", which is false and useless.
    httpStatus: 403,
    messageKey: 'error.iam.account_locked',
    enforces: ['FR-AUTH-08', 'NFR-USE-05'],
    // Not retryable as a request. The caller must unlock, or wait — `details` carries
    // `locked_until` and `unlock_channels`, which is actionable in a way a Retry-After is not.
    retryable: false,
  },
  PASSWORD_BREACHED: {
    module: 'iam',
    class: 'Validation',
    httpStatus: 422,
    messageKey: 'error.iam.password_breached',
    enforces: ['FR-AUTH-04'],
    // Retrying the SAME password will fail identically; a different one succeeds. False,
    // because `retryable` means "this request may succeed unchanged".
    retryable: false,
  },
  EMAIL_ALREADY_REGISTERED: {
    module: 'iam',
    class: 'Conflict',
    httpStatus: 409,
    messageKey: 'error.iam.email_already_registered',
    enforces: ['FR-AUTH-01'],
    retryable: false,
  },
  PHONE_ALREADY_REGISTERED: {
    module: 'iam',
    class: 'Conflict',
    httpStatus: 409,
    messageKey: 'error.iam.phone_already_registered',
    enforces: ['FR-AUTH-02'],
    retryable: false,
  },
  RESET_TOKEN_INVALID: {
    module: 'iam',
    class: 'Validation',
    // 422 rather than 404. A 404 distinguishes "no such token" from "expired token", and a
    // token is a bearer credential — the two must look identical or the response tells an
    // attacker whether a guessed value ever existed.
    httpStatus: 422,
    messageKey: 'error.iam.reset_token_invalid',
    enforces: ['FR-AUTH-10', 'NFR-SEC-07'],
    retryable: false,
  },
  // --- iam · M-021, phone OTP (FR-AUTH-05, Authentication.md §14.3) --------
  //
  // Note again what is ABSENT. There is no OTP_NUMBER_NOT_REGISTERED and no OTP_NO_ACCOUNT: a
  // LOGIN request for a number with no account returns the SAME 202 as one with an account, and
  // simply sends nothing. §8.1's future-compatibility table calls a 404 here forbidden rather
  // than merely breaking — it is an enumeration oracle over every mobile number in India.
  OTP_INVALID: {
    module: 'iam',
    class: 'Validation',
    // 400, and it carries `attempts_remaining`. AC-AUTH-01.3: a wrong guess does not consume
    // the code beyond the counter, so the member can correct a typo.
    httpStatus: 400,
    messageKey: 'error.iam.otp_invalid',
    enforces: ['FR-AUTH-05', 'AC-AUTH-01.3'],
    retryable: false,
  },
  OTP_EXPIRED: {
    module: 'iam',
    class: 'Validation',
    httpStatus: 400,
    messageKey: 'error.iam.otp_expired',
    enforces: ['FR-AUTH-05'],
    // A NEW code will work. Not the same request, so not retryable in the envelope's sense.
    retryable: false,
  },
  OTP_ATTEMPTS_EXCEEDED: {
    module: 'iam',
    class: 'RateLimit',
    httpStatus: 429,
    messageKey: 'error.iam.otp_attempts_exceeded',
    enforces: ['FR-AUTH-05'],
    retryable: true,
  },
  OTP_RESEND_LIMIT_REACHED: {
    module: 'iam',
    class: 'RateLimit',
    httpStatus: 429,
    messageKey: 'error.iam.otp_resend_limit_reached',
    // AC-AUTH-01.4 — and NO SMS IS SENT. The budget is checked before the enqueue, never after,
    // or the limit costs money on every attempt it refuses.
    enforces: ['FR-AUTH-05', 'AC-AUTH-01.4', 'CON-02'],
    retryable: true,
  },
  OTP_RESEND_TOO_SOON: {
    module: 'iam',
    class: 'RateLimit',
    httpStatus: 429,
    messageKey: 'error.iam.otp_resend_too_soon',
    enforces: ['FR-AUTH-05'],
    retryable: true,
  },
  CAPTCHA_REQUIRED: {
    module: 'iam',
    class: 'Authorisation',
    // 403 rather than 429: the caller is not rate-limited, they are being asked to prove they
    // are human. A 429 would tell them to wait, and waiting does not help.
    httpStatus: 403,
    messageKey: 'error.iam.captcha_required',
    enforces: ['FR-AUTH-05', 'CON-02'],
    retryable: false,
  },

  VERIFICATION_TOKEN_INVALID: {
    module: 'iam',
    class: 'Validation',
    httpStatus: 422,
    messageKey: 'error.iam.verification_token_invalid',
    enforces: ['FR-AUTH-01', 'NFR-SEC-07'],
    retryable: false,
  },

  // --- catalog · M-031, branch deactivation --------------------------------

  BRANCH_HAS_ACTIVE_MEMBERSHIPS: {
    module: 'catalog',
    class: 'Business',
    // 422 and not 409. `API_Catalog.md` §6.6 line 1639 fixes the status; the reason is that the
    // request is well-formed and the caller is permitted — the DOMAIN refuses the outcome. A 409
    // would suggest a concurrent edit and send an owner looking for one.
    httpStatus: 422,
    messageKey: 'error.catalog.branch_has_active_memberships',
    enforces: ['FR-GYM-07', 'BR-MEM-14', 'NFR-USE-06'],
    // Retryable once the members are moved or their memberships expire, which is exactly what the
    // message tells the owner to do. Not retryable as-is.
    retryable: false,
    /*
     * `member_count` is NOT decoration, and it is why this row has a `detailsShape` at all.
     *
     * `NFR-USE-06`: *"Every destructive action requires confirmation and states its consequence
     * specifically ('this will archive a plan held by 34 active members')."* `Gym.md` §12.4 makes
     * the same demand of this refusal and says a vague *"cannot delete"* fails review. The number
     * has to reach the client, so it has to be in the shape.
     */
    detailsShape: '{ branch_id: string; member_count: number; }',
  },

  /*
   * ┌─ THREE CODES `Gym.md` §12.3 EMITS THAT THE REGISTRY DID NOT CARRY ──────────────────────────┐
   * │ Found while writing `M-031`'s branch routes. Each has a FULL row in `API_Catalog.md`'s error │
   * │ catalogue — status, message guidance, retryability, enforcing rule — and no entry here, so   │
   * │ `PG-5` would fail the moment a handler threw one and `PATCH /tenant/branches/:id` could not  │
   * │ emit the errors its own contract promises.                                                    │
   * │                                                                                              │
   * │ Transcribed, not invented, and the distinction is the one this file already draws twenty     │
   * │ lines below: `LAST_ACTIVE_BRANCH` is REFUSED registration because it appears only in rank-4  │
   * │ documents with no status attached. These three are rank-3 catalogue rows with every column   │
   * │ filled. Same test, opposite answer.                                                            │
   * └──────────────────────────────────────────────────────────────────────────────────────────────┘
   */

  GEO_ADDRESS_MISMATCH: {
    module: 'catalog',
    class: 'Business',
    // 422 per `API_Catalog.md` §6.6 line 1629: the body is well-formed and the caller permitted;
    // the DOMAIN refuses the pin.
    httpStatus: 422,
    messageKey: 'error.catalog.geo_address_mismatch',
    enforces: ['BR-GYM-08', 'FR-ONB-12'],
    // Retryable once the pin moves, which is the whole point of naming the distance.
    retryable: false,
    /*
     * Both numbers, because the catalogue's guidance is *"state the measured distance AND the
     * tolerance"*. An owner told only "too far" has no way to know whether they are out by five
     * metres or five kilometres, and the two need different actions.
     *
     * `Gym.md` §12.3 is also explicit that this one REFUSES on PATCH where creation only warns:
     * *"an approved gym's pin moving 3 km is either an error or a relocation, and both need a
     * human"*.
     */
    detailsShape: '{ measured_metres: number; tolerance_metres: number; }',
  },

  BRANCH_NOT_ASSIGNED_TO_STAFF: {
    module: 'catalog',
    class: 'Authorisation',
    // 403 and not 404. The branch is one the caller may SEE — a `▪` role holds the tenant's list —
    // so hiding it would contradict a read they can already perform. What is refused is the WRITE.
    httpStatus: 403,
    messageKey: 'error.catalog.branch_not_assigned_to_staff',
    enforces: ['FR-RBAC-03', 'AZ8', 'BR-TEN-03'],
    retryable: false,
    /*
     * The branch id and nothing else. Naming which branches the caller IS assigned to would be
     * more helpful and would also enumerate the tenant's estate to a role scoped away from it.
     */
    detailsShape: '{ branch_id: string; }',
  },

  RESOURCE_VERSION_CONFLICT: {
    /*
     * Owned by `common` rather than `catalog`: `API_Catalog.md` §15 defines optimistic
     * concurrency for every mutable resource, and branches are the first caller rather than the
     * subject. A `catalog`-owned code would have to be duplicated by the second module to need it,
     * and `§6.1`'s uniqueness rule forbids two codes for one condition.
     */
    module: 'common',
    class: 'Conflict',
    httpStatus: 409,
    messageKey: 'error.common.resource_version_conflict',
    enforces: ['NFR-DQ-01'],
    /*
     * NOT retryable unchanged — `Fix` in the catalogue. Re-sending the same body with the same
     * stale version repeats the conflict forever; the caller has to re-read first. Marking it
     * retryable would invite exactly that loop.
     */
    retryable: false,
    detailsShape: '{ expected_version: number; actual_version: number; }',
  },

  CONFIG_VALIDATION_FAILED: {
    /*
     * Owned by `admin`, and the row is here because `catalog` needs to EMIT it.
     *
     * `API_Catalog.md` catalogues this at §6.13 line 1784 under the admin family — *"configuration
     * payload internally inconsistent"* — and `Gym.md` §12.4 reuses it for the last-active-branch
     * refusal: *"a listed gym with no location is not a listing."* One code, two emitters; the
     * registry's `module` records who OWNS the vocabulary, not who throws it.
     *
     * ┌─ `LAST_ACTIVE_BRANCH` IS NOT THIS CODE, AND IS NOT ANY CODE ────────────────────────────┐
     * │ It appears in exactly two rank-4 documents — `Epic_04.md` and                            │
     * │ `Milestones_030-059.md` — with no HTTP status attached, and has no row in                │
     * │ `API_Catalog.md`'s error catalogue at all. `Gym.md` §12.4 is rank 3 and names            │
     * │ `CONFIG_VALIDATION_FAILED`. Registering `LAST_ACTIVE_BRANCH` would be inventing a        │
     * │ contract from a plan of work, which `CLAUDE.md` §2 says the roadmap never is.            │
     * └──────────────────────────────────────────────────────────────────────────────────────────┘
     */
    module: 'admin',
    class: 'Business',
    httpStatus: 422,
    messageKey: 'error.admin.config_validation_failed',
    enforces: ['FR-ADMN-03', 'FR-GYM-07', 'NFR-USE-05'],
    retryable: false,
    // `NFR-USE-05` requires an error to say what happened, why, and what next — "name the
    // inconsistency", in API_Catalog's words. A code with no field named is the generic failure
    // that rule exists to forbid.
    detailsShape: '{ field: string; reason: string; }',
  },
} as const satisfies Record<string, ErrorRegistryRow>;
