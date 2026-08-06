/**
 * M-004 · The queue role — `NFR-SCAL-05`, `L2`, AC-8.
 *
 * BINDS NO HTTP LISTENER. This is asserted by `worker-no-listener.spec.ts`, not left to
 * discipline: `createApplicationContext` rather than `create` is a one-word difference that a
 * future edit could reverse without anyone noticing, and the consequence — a worker holding a
 * port, being added to the load balancer, and receiving API traffic it cannot serve — looks like
 * an intermittent 502 rather than like a misconfiguration.
 *
 * BullMQ processors are registered from M-018.
 */

import 'reflect-metadata';

import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';

import { AppModule } from './app.module.js';
import { APP_CONFIG, type AppConfig } from './common/config/app-config.schema.js';

export async function bootstrapWorker() {
  // `createApplicationContext` gives the full DI container with NO HTTP adapter.
  const app = await NestFactory.createApplicationContext(AppModule, { bufferLogs: true });
  app.enableShutdownHooks();
  return app;
}

if (process.env['NODE_ENV'] !== 'test') {
  bootstrapWorker()
    .then((app) => {
      const config = app.get<AppConfig>(APP_CONFIG);
      new Logger('worker').log(`Queue role started · env=${config.APP_ENV} (no HTTP listener)`);
    })
    .catch((error: unknown) => {
      // eslint-disable-next-line no-console
      console.error('Worker failed to start:\n', error instanceof Error ? error.message : error);
      process.exit(1);
    });
}
