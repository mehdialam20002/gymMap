/**
 * `M-029` · Turning a JSONB blob into checklist items, or refusing — `FR-ONB-03`.
 *
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * THE DATABASE ALREADY CHECKS THIS SHAPE, AND THIS FILE STILL EXISTS
 *
 * `ck_kyc_checklists__items_have_required_keys` and its siblings refuse a malformed `items` at
 * INSERT, so in a correct deployment nothing here can fail. Two things make the parser worth having
 * anyway, and neither is defensive habit:
 *
 *   · the constraints check that keys EXIST, not that they hold the right TYPES. A `displayOrder`
 *     of `"1"` satisfies `exists(@.displayOrder)` and then sorts as a string, silently reordering
 *     the wizard against a `SCR-DASH-002` contract
 *   · a `CHECK` constraint is validated on write. A row written before a constraint was added — or
 *     restored from a dump taken before it — is never re-checked by anything
 *
 * So the failure is loud and names the row. A cast would produce a `TypeError` three frames later
 * with nothing pointing at which checklist version is broken.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

import type { ChecklistItem, Obligation } from './checklist.js';

const OBLIGATIONS: readonly Obligation[] = ['ALWAYS', 'CONDITIONAL', 'ADVISORY'];

export class MalformedChecklistError extends Error {
  constructor(source: string, detail: string) {
    super(`${source} is not a usable checklist: ${detail}`);
    this.name = 'MalformedChecklistError';
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** @param source names the row, so a failure says WHICH checklist is broken. */
export function parseChecklistItems(raw: unknown, source: string): readonly ChecklistItem[] {
  if (!Array.isArray(raw)) {
    throw new MalformedChecklistError(source, `items is ${typeof raw}, not an array`);
  }
  if (raw.length === 0) {
    throw new MalformedChecklistError(source, 'items is empty');
  }

  return raw.map((entry, index) => {
    const at = `${source} item ${String(index)}`;
    if (!isRecord(entry)) throw new MalformedChecklistError(at, 'is not an object');

    const { documentType, obligation, displayOrder, label } = entry;

    if (typeof documentType !== 'string' || documentType.length === 0) {
      throw new MalformedChecklistError(at, 'has no documentType');
    }
    if (typeof obligation !== 'string' || !OBLIGATIONS.includes(obligation as Obligation)) {
      throw new MalformedChecklistError(at, `has obligation ${String(obligation)}`);
    }
    // `Number.isInteger` as well as `typeof`: `NaN` and `1.5` are both numbers and both sort
    // unpredictably. The `typeof` is what narrows for the compiler; the rest is what matters.
    if (typeof displayOrder !== 'number' || !Number.isInteger(displayOrder)) {
      throw new MalformedChecklistError(at, `has a non-integer displayOrder`);
    }
    if (typeof label !== 'string' || label.trim().length === 0) {
      throw new MalformedChecklistError(at, 'has no label');
    }

    const condition = entry['condition'];
    if (condition !== undefined && !isRecord(condition)) {
      throw new MalformedChecklistError(at, 'has a condition that is not an object');
    }
    if (obligation === 'CONDITIONAL' && condition === undefined) {
      // The DB constraint says the same thing. Repeated here because a row that predates the
      // constraint would otherwise reach `evaluate()` and throw with a less useful message.
      throw new MalformedChecklistError(at, 'is CONDITIONAL with no condition');
    }

    const helpText = entry['helpText'];
    const accepted = entry['acceptedDocuments'];

    return {
      documentType,
      obligation: obligation as Obligation,
      displayOrder,
      label,
      ...(typeof helpText === 'string' ? { helpText } : {}),
      ...(Array.isArray(accepted) && accepted.every((d) => typeof d === 'string')
        ? { acceptedDocuments: accepted as readonly string[] }
        : {}),
      ...(condition !== undefined ? { condition } : {}),
    };
  });
}
