/**
 * Shared reading helpers for the structural specs.
 *
 * NOT a `*.spec.ts` — `test:unit` globs `test/*.spec.ts`, so this file is imported and never run
 * as a suite of its own.
 *
 * ┌─ USE `code()` FOR EVERY STRUCTURAL ASSERTION ───────────────────────────────────────────────┐
 * │ Tests in this repository have repeatedly failed on their own documentation: a scan for      │
 * │ `runElevated(` matched a doc comment, a scan for `unsafe-inline` matched the comment        │
 * │ explaining why it is forbidden, and a scan for `priority` matched the comment explaining    │
 * │ why exactly one image carries it. Same pattern, same fix — a test that asserts something    │
 * │ about CODE must not read PROSE. Well-commented code is not a hazard to work around.         │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const APP_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** A file's raw text, path relative to the app root. */
export function source(rel: string): string {
  return readFileSync(join(APP_ROOT, rel), 'utf8');
}

/** The file with every comment blanked out, newlines preserved so line numbers still line up. */
export function code(rel: string): string {
  const text = source(rel);
  let out = '';
  let i = 0;
  const blank = (s: string) => s.replace(/[^\n]/g, ' ');

  while (i < text.length) {
    const two = text.slice(i, i + 2);
    if (two === '//') {
      const end = text.indexOf('\n', i);
      const stop = end === -1 ? text.length : end;
      out += blank(text.slice(i, stop));
      i = stop;
    } else if (two === '/*') {
      const end = text.indexOf('*/', i + 2);
      const stop = end === -1 ? text.length : end + 2;
      out += blank(text.slice(i, stop));
      i = stop;
    } else if (two === '{/') {
      // A JSX comment `{/* … */}` — the brace comes first, so the block branch would leave a
      // stray `}` behind and shift every index after it.
      const end = text.indexOf('*/}', i);
      const stop = end === -1 ? text.length : end + 3;
      out += blank(text.slice(i, stop));
      i = stop;
    } else {
      out += text[i];
      i += 1;
    }
  }
  return out;
}

/** Every `.tsx` under a directory, recursively, as app-root-relative paths. */
export function tsxFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(join(APP_ROOT, dir))) {
    const rel = `${dir}/${name}`;
    if (statSync(join(APP_ROOT, rel)).isDirectory()) out.push(...tsxFiles(rel));
    else if (name.endsWith('.tsx')) out.push(rel);
  }
  return out;
}

/**
 * The `.ts` half — modules with no JSX in them.
 *
 * A scan that reads components only misses anything a plain module decides, and class names are
 * the case that bites: `gym-art.ts` holds the six ground classes as literals and hands one to
 * whichever component asks, precisely so the name is greppable rather than interpolated. Reading
 * `.tsx` alone, the dead-rule sweep called all six unused the moment they moved out of a component.
 */
export function moduleFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(join(APP_ROOT, dir))) {
    const rel = `${dir}/${name}`;
    if (statSync(join(APP_ROOT, rel)).isDirectory()) out.push(...moduleFiles(rel));
    else if (name.endsWith('.ts')) out.push(rel);
  }
  return out;
}
