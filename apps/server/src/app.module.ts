/**
 * M-004 · The composition root.
 *
 * Imports `CommonModule` only. The remaining twenty-two module directories of §C1.3 are created
 * by M-007's `module-structure` gate work and wired in by their own milestones — an empty module
 * imported early is a module whose boundaries nobody has had to think about yet.
 */

import { Module } from '@nestjs/common';

import { CommonModule } from './common/common.module.js';

@Module({ imports: [CommonModule] })
export class AppModule {}
