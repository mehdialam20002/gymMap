/**
 * M-004 · The HTTP role — `NFR-SCAL-05`, `L2`.
 *
 * This process serves HTTP and nothing else. Queue processing is `worker.ts`, a separate role
 * that binds no port. Splitting them is what lets the two scale on different signals: the API on
 * request latency, the worker on queue depth. A combined process scales on whichever is louder
 * and starves the other.
 */

import 'reflect-metadata';

import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';

import { AppModule } from './app.module.js';
import { APP_CONFIG, type AppConfig } from './common/config/app-config.schema.js';
import { configureApp } from './common/bootstrap/configure-app.js';

async function bootstrap(): Promise<void> {
  const logger = new Logger('bootstrap');

  // Environment validation happens inside CommonModule's factory, so a malformed environment
  // throws HERE — before the port is bound. The process exits non-zero and never serves a
  // request in a half-configured state (§8.9).
  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  const config = app.get<AppConfig>(APP_CONFIG);

  // M-012 · One configuration, shared with openapi/emit.ts. Anything applied here and not
  // there produces a contract that does not describe this server.
  configureApp(app);

  // No GLOBAL validation pipe. Validation is per-route with `ZodValidationPipe`, because a Zod
  // schema is specific to one payload — there is no equivalent of class-validator's "infer the
  // rules from the DTO's decorators". Nest's own ValidationPipe is not an option: it requires
  // class-validator, which would be a substitution for Zod (A-02) and is therefore forbidden.
  //
  // Rejecting unknown properties is not lost — every schema in `packages/types` is `.strict()`,
  // so an unexpected field is a 400 rather than a silent strip. Silent stripping is how a client
  // believes it disabled a setting that never arrived.

  // SIGTERM must drain in-flight requests rather than cut them. Without this, every deploy
  // returns a handful of 502s to whoever was mid-checkout.
  app.enableShutdownHooks();

  await app.listen(config.PORT);
  logger.log(
    `HTTP role listening on :${config.PORT} · env=${config.APP_ENV} · region=${config.APP_REGION}`,
  );
}

bootstrap().catch((error: unknown) => {
  // Cannot use the Nest logger here — the failure may BE the logger's construction.
  // eslint-disable-next-line no-console
  console.error('Server failed to start:\n', error instanceof Error ? error.message : error);
  process.exit(1);
});
