/**
 * M-008 · Prints the number of HTTP operations in `openapi.json`. Used by CI job 14.
 *
 * A separate file rather than an inline `node -e` in the workflow: the inline form has to be
 * escaped through YAML *and* through the shell, and the version that was written first died on
 * a bare parenthesis. A script is also testable, which an escaped one-liner is not.
 */

import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const METHODS = ['get', 'post', 'put', 'patch', 'delete', 'head', 'options'];

export function countOperations(document) {
  let total = 0;
  for (const item of Object.values(document.paths ?? {})) {
    for (const method of METHODS) if (item?.[method]) total += 1;
  }
  return total;
}

const isMain = process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/'));
if (isMain) {
  const path = resolve(process.cwd(), 'openapi.json');
  if (!existsSync(path)) {
    process.stderr.write('openapi.json is missing — run openapi:emit first\n');
    process.exit(1);
  }
  process.stdout.write(String(countOperations(JSON.parse(readFileSync(path, 'utf8')))));
}
