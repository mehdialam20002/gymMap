/**
 * The production `Clock`. The ONE place a bare `Date` is legitimate.
 *
 * `no-bare-date` exempts this file by path, and that exemption is the design: every other call
 * site goes through the port, so "what time does this system think it is" has exactly one answer
 * and one place to change it.
 *
 * `TR-21` — a worker whose clock has drifted schedules jobs at the wrong moment and writes
 * timestamps that do not order correctly against the API's. The skew monitor is infrastructure
 * (`infra/`), not code, because a process cannot reliably detect that its own clock is wrong.
 */

import { randomUUID } from 'node:crypto';

import { Injectable } from '@nestjs/common';

import type { Clock, IdGenerator } from './clock.port.js';

@Injectable()
export class SystemClock implements Clock {
  now(): Date {
    return new Date();
  }
}

@Injectable()
export class SystemIdGenerator implements IdGenerator {
  uuid(): string {
    // v4 today. `Schema.md` §2.2 wants v7 for index locality — a random v4 primary key scatters
    // inserts across the b-tree and fragments it, which is invisible until the table is large.
    // Node's crypto does not emit v7 yet; recorded here rather than silently accepted.
    return randomUUID();
  }
}
