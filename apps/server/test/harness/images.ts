/**
 * M-005 · ONE source of truth for container image digests.
 *
 * The milestone requires the Testcontainers harness to reuse the SAME image digests as
 * `infra/compose/compose.yaml`, "so CI and local cannot diverge on Postgres minor version".
 *
 * The obvious implementation — copy the digests into a constant here — is the one that fails.
 * Two hand-maintained lists agree until someone bumps one, and the symptom is the worst kind:
 * a test that passes locally and fails in CI, or vice versa, with no diff to explain it. Weeks
 * later someone discovers the two environments were never running the same Postgres.
 *
 * So this module PARSES compose.yaml. There is exactly one place a digest is written down, and
 * it is the file that actually starts the containers.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

export interface PinnedImage {
  /** Compose service name — `postgres`, `redis`, `minio`, `mailpit`. */
  readonly service: string;
  /** Full reference including the digest, e.g. `redis:7-alpine@sha256:…`. */
  readonly reference: string;
  /** Repository and tag without the digest, for log messages. */
  readonly tag: string;
  readonly digest: string;
}

const COMPOSE_PATH = resolve('../../infra/compose/compose.yaml');

/**
 * Extracts every `service: { image: … }` pair from the compose file.
 *
 * A line-scanner rather than a YAML parser: no YAML library is an approved dependency
 * (STACK_ADDITIONS.md standing rule), and the shape being read is two well-known keys at fixed
 * indentation. A malformed file fails the assertions below rather than being half-understood.
 */
export function readPinnedImages(composePath: string = COMPOSE_PATH): PinnedImage[] {
  const lines = readFileSync(composePath, 'utf8').split('\n');
  const images: PinnedImage[] = [];
  let currentService: string | null = null;
  let inServices = false;

  for (const line of lines) {
    if (/^services:\s*$/.test(line)) {
      inServices = true;
      continue;
    }
    // A top-level key other than `services:` ends the services block — `volumes:` in particular,
    // whose children would otherwise be mistaken for services.
    if (inServices && /^[a-z]/i.test(line)) inServices = false;
    if (!inServices) continue;

    const service = /^ {2}([a-z][a-z0-9-]*):\s*$/.exec(line);
    if (service) {
      currentService = service[1]!;
      continue;
    }

    const image = /^\s+image:\s*(\S+)\s*$/.exec(line);
    if (image && currentService) {
      const reference = image[1]!;
      const at = reference.indexOf('@');
      images.push({
        service: currentService,
        reference,
        tag: at === -1 ? reference : reference.slice(0, at),
        digest: at === -1 ? '' : reference.slice(at + 1),
      });
    }
  }
  return images;
}

/** The image a Testcontainers container must use for a given compose service. */
export function imageFor(service: string, composePath: string = COMPOSE_PATH): string {
  const found = readPinnedImages(composePath).find((i) => i.service === service);
  if (!found) {
    throw new Error(
      `No image pinned for compose service "${service}". The Testcontainers harness and ` +
        `compose must run the same image; add the service to infra/compose/compose.yaml rather ` +
        `than hardcoding a tag here.`,
    );
  }
  if (!found.digest) {
    throw new Error(
      `compose service "${service}" uses the mutable tag "${found.tag}" with no digest. A tag ` +
        `is repointed by its publisher without notice, so CI and a developer's machine can run ` +
        `different builds of "the same" image (M-005 AC-6).`,
    );
  }
  return found.reference;
}

/** Services the integration harness will start. Postgres and Redis; MinIO and Mailpit as needed. */
export const REQUIRED_SERVICES = ['postgres', 'redis', 'minio', 'mailpit'] as const;
