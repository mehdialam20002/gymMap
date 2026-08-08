/**
 * M-022 · The rotation chain — ADR-0011, `Schema.md` §4.8, deviation `D-04`.
 *
 * ┌─ ROTATION IS ONE TRANSACTION, AND THE ORDER INSIDE IT MATTERS ──────────────────────────────┐
 * │ Insert the new generation, THEN spend the old one pointing at it. The reverse leaves a      │
 * │ window in which the old generation is marked used with `superseded_by_id` still null — and  │
 * │ `decideRotation` reads exactly that state as REUSE_DETECTED, so a crash between the two     │
 * │ statements would revoke the family of whoever refreshed next.                                │
 * │                                                                                              │
 * │ One transaction removes the window entirely. The order still matters because the self-FK    │
 * │ requires the successor row to exist before anything can reference it.                        │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 *
 * ┌─ THE TOKEN IS NEVER STORED — ONLY ITS SHA-256 — `NFR-SEC-07` ───────────────────────────────┐
 * │ SHA-256 and not Argon2id, deliberately: `Security.md` §2.4.2 draws the line explicitly. A   │
 * │ refresh token is 256 bits of CSPRNG with no entropy deficit, so there is nothing to         │
 * │ brute-force, and running Argon2id on a path that executes on every session would add 250 ms │
 * │ for no gain. Argon2id is for values a HUMAN chose.                                           │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 */

import { createHash, randomBytes } from 'node:crypto';
import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../tenancy/prisma/prisma.service.js';
import {
  REFRESH_TOKEN_TTL_SECONDS,
  nextGeneration,
  type StoredGeneration,
} from '../domain/refresh-rotation.policy.js';

/** 256 bits. The value handed to the client; only its digest is kept. */
const TOKEN_BYTES = 32;

export function refreshTokenDigest(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

export interface MintedRefresh {
  /** For the httpOnly cookie. Never logged, never in a response body — `SE1`, `TK7`. */
  readonly token: string;
  readonly generation: number;
  readonly expiresAt: Date;
}

@Injectable()
export class RefreshTokenPrismaRepository {
  constructor(private readonly db: PrismaService) {}

  /** The first generation of a new family. */
  async issueFirst(sessionId: string, now: Date): Promise<MintedRefresh> {
    const token = randomBytes(TOKEN_BYTES).toString('hex');
    const expiresAt = new Date(now.getTime() + REFRESH_TOKEN_TTL_SECONDS * 1000);

    await this.db.client.refreshToken.create({
      data: {
        sessionId,
        tokenHash: refreshTokenDigest(token),
        generation: 1,
        expiresAt,
      },
    });

    return { token, generation: 1, expiresAt };
  }

  /** Looks a presented token up by its digest. `null` for anything unknown. */
  async findByToken(token: string): Promise<(StoredGeneration & { userId: string }) | null> {
    const row = await this.db.client.refreshToken.findUnique({
      where: { tokenHash: refreshTokenDigest(token) },
      select: {
        id: true,
        sessionId: true,
        generation: true,
        usedAt: true,
        supersededById: true,
        expiresAt: true,
        session: { select: { userId: true } },
      },
    });
    if (row === null) return null;

    return {
      id: row.id,
      sessionId: row.sessionId,
      generation: row.generation,
      usedAt: row.usedAt,
      supersededById: row.supersededById,
      expiresAt: row.expiresAt,
      userId: row.session.userId,
    };
  }

  /**
   * Mints the next generation and spends the current one, atomically.
   *
   * The two writes are the only two `refresh_tokens` operations `app_rw` is granted: an INSERT,
   * and an UPDATE on `(used_at, superseded_by_id)`. `refresh-token-grants.int-spec.ts` proves
   * the column scope holds at the database.
   */
  async rotate(current: StoredGeneration, now: Date): Promise<MintedRefresh> {
    const token = randomBytes(TOKEN_BYTES).toString('hex');
    const generation = nextGeneration(current.generation);
    const expiresAt = new Date(now.getTime() + REFRESH_TOKEN_TTL_SECONDS * 1000);

    await this.db.client.$transaction(async (tx) => {
      // The successor FIRST — the self-FK needs the row to exist before it can be referenced.
      const created = await tx.refreshToken.create({
        data: {
          sessionId: current.sessionId,
          tokenHash: refreshTokenDigest(token),
          generation,
          expiresAt,
        },
        select: { id: true },
      });

      // Then spend the old one, pointing at it. Both fields together: a `used_at` with a null
      // successor is the state `decideRotation` reads as reuse.
      await tx.refreshToken.update({
        where: { id: current.id },
        data: { usedAt: now, supersededById: created.id },
      });
    });

    return { token, generation, expiresAt };
  }

  /**
   * The token minted by a rotation that a concurrent request already performed — `TR-28`.
   *
   * Returns `null` if the successor row has gone. The caller then treats the replay as an
   * ordinary expiry rather than as reuse: the chain is broken, but a broken chain we caused is
   * not evidence of theft.
   *
   * NOTE what this CANNOT do: return the successor's plaintext token. Only the digest is
   * stored, by design. The caller therefore rotates AGAIN from the successor — which is safe,
   * because the successor is unspent, and it is the reason the grace path is a real rotation
   * rather than a cache lookup.
   */
  async findSuccessor(id: string): Promise<StoredGeneration | null> {
    const row = await this.db.client.refreshToken.findUnique({
      where: { id },
      select: {
        id: true,
        sessionId: true,
        generation: true,
        usedAt: true,
        supersededById: true,
        expiresAt: true,
      },
    });
    return row;
  }

  /** Every generation in one session, newest first. For the reuse investigation. */
  async chainFor(sessionId: string): Promise<StoredGeneration[]> {
    return this.db.client.refreshToken.findMany({
      where: { sessionId },
      orderBy: { generation: 'desc' },
      select: {
        id: true,
        sessionId: true,
        generation: true,
        usedAt: true,
        supersededById: true,
        expiresAt: true,
      },
    });
  }
}
