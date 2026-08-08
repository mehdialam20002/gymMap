/**
 * M-022 · Token lifetimes — `FR-AUTH-06`, ADR-0011.
 *
 * In `common/auth/` because BOTH sides need them and they must agree: `iam/` signs against these
 * and `common/`'s guard and denylist expire against them. A second copy in `iam/` would be two
 * numbers that can drift, and the drift is silent — a denylist TTL shorter than the access-token
 * lifetime leaves a revoked token working for the difference.
 */

/** `FR-AUTH-06`. */
export const ACCESS_TOKEN_TTL_SECONDS = 15 * 60;
export const REFRESH_TOKEN_TTL_SECONDS = 30 * 24 * 60 * 60;

/**
 * How long a revoked family stays denied — `AC-10`.
 *
 * EXACTLY the access-token TTL. Longer is pointless: the token has expired on its own and the
 * entry has nothing left to deny. Shorter is a hole of precisely that size.
 */
export const FAMILY_DENYLIST_TTL_SECONDS = ACCESS_TOKEN_TTL_SECONDS;
