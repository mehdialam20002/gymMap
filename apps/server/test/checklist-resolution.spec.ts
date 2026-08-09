/**
 * `M-029` `AC-1`–`AC-3` · Resolving the checklist — `FR-ONB-03`, `AC-ONB-04.1`, `AC-ONB-04.2`.
 *
 * These run against the REAL seed file, not a fixture. A fixture would prove the resolver works on
 * data shaped the way the resolver expects; the question worth answering is whether it works on the
 * checklist that will actually be published to every gym in India.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import {
  checklistCompleteness,
  resolveChecklist,
  UnknownChecklistConditionError,
  type ApplicantFacts,
  type ChecklistItem,
} from '../dist/onboarding/domain/checklist.js';
import {
  MalformedChecklistError,
  parseChecklistItems,
} from '../dist/onboarding/domain/checklist-items.parser.js';

// `import.meta.dirname` is unavailable under this CommonJS build (TS1470), so the path is resolved
// from the suite's working directory, which is `apps/server`.
const SEED = JSON.parse(
  readFileSync(resolve('prisma/reference/kyc_checklists.in.v1.json'), 'utf8'),
) as {
  countryCode: string;
  version: number;
  checklists: { entityType: string; items: Record<string, unknown>[] }[];
};

const ENTITY_TYPES = ['SOLE_PROPRIETOR', 'PARTNERSHIP', 'COMPANY', 'OTHER'];

function itemsFor(entityType: string): readonly ChecklistItem[] {
  const checklist = SEED.checklists.find((c) => c.entityType === entityType);
  assert.ok(checklist, `the seed has no checklist for ${entityType}`);
  return parseChecklistItems(checklist.items, entityType);
}

const REGISTERED: ApplicantFacts = {
  taxRegistrationStatus: 'REGISTERED',
  declarations: {
    municipality_requires_trade_licence: false,
    premises_above_fire_noc_threshold: false,
  },
};

const UNREGISTERED: ApplicantFacts = {
  taxRegistrationStatus: 'NOT_REGISTERED',
  declarations: {
    municipality_requires_trade_licence: false,
    premises_above_fire_noc_threshold: false,
  },
};

// ═══════════════════════════════════════════════════════════════════════════
// AC-1 — the seed is the India ten, four times
// ═══════════════════════════════════════════════════════════════════════════

test('AC-1 — four checklists, one per entity_type_enum value', () => {
  // SeedStrategy.md §3.5. A missing entity type is not a smaller checklist — it is an applicant who
  // reaches the wizard and gets KYC_CHECKLIST_NOT_PUBLISHED for a form of business India allows.
  assert.deepEqual(
    SEED.checklists.map((c) => c.entityType).sort((a, b) => a.localeCompare(b)),
    [...ENTITY_TYPES].sort((a, b) => a.localeCompare(b)),
  );
});

test('AC-1 — every checklist carries the ten documents of LAUNCH_MARKET_INDIA.md §6', () => {
  const expected = [
    'PAN',
    'GSTIN',
    'BUSINESS_REGISTRATION',
    'SHOP_ESTABLISHMENT',
    'BANK_PROOF',
    'OWNER_IDENTITY',
    'PREMISES_ADDRESS_PROOF',
    'TRADE_LICENCE',
    'FIRE_SAFETY_NOC',
    'MUSIC_LICENCE',
  ];

  for (const entityType of ENTITY_TYPES) {
    const items = itemsFor(entityType);
    assert.deepEqual(
      [...items].sort((a, b) => a.displayOrder - b.displayOrder).map((i) => i.documentType),
      expected,
      `${entityType} does not match §6, in order`,
    );
  }
});

test('AC-1 — the obligations match the §3.5 M / C / A legend', () => {
  const expected: Record<string, string> = {
    PAN: 'ALWAYS',
    GSTIN: 'CONDITIONAL',
    BUSINESS_REGISTRATION: 'ALWAYS',
    SHOP_ESTABLISHMENT: 'ALWAYS',
    BANK_PROOF: 'ALWAYS',
    OWNER_IDENTITY: 'ALWAYS',
    PREMISES_ADDRESS_PROOF: 'ALWAYS',
    TRADE_LICENCE: 'CONDITIONAL',
    FIRE_SAFETY_NOC: 'CONDITIONAL',
    MUSIC_LICENCE: 'ADVISORY',
  };

  for (const entityType of ENTITY_TYPES) {
    for (const item of itemsFor(entityType)) {
      assert.equal(
        item.obligation,
        expected[item.documentType],
        `${entityType}/${item.documentType} has the wrong obligation`,
      );
    }
  }
});

test('AADHAAR appears nowhere in the seed', () => {
  // ┌─ THE ONE ASSERTION THAT IS ABOUT A LEGAL POSITION RATHER THAN A SHAPE ─────────────────────┐
  // │ LAUNCH_MARKET_INDIA.md §6 and §13.6: Aadhaar carries statutory handling restrictions, so    │
  // │ the platform asks for PAN plus a non-Aadhaar ID and avoids those obligations entirely. It   │
  // │ is exactly the kind of thing somebody adds helpfully — "everyone has one" — and it is not   │
  // │ a code change, so no reviewer of code would see it.                                          │
  // └───────────────────────────────────────────────────────────────────────────────────────────┘
  const raw = readFileSync(resolve('prisma/reference/kyc_checklists.in.v1.json'), 'utf8');
  const mentions = raw.toLowerCase().split('aadhaar').length - 1;

  // The only permitted mentions are the two $comment blocks explaining the deliberate absence.
  const inAcceptedDocuments = SEED.checklists
    .flatMap((c) => c.items)
    .flatMap((i) => (Array.isArray(i['acceptedDocuments']) ? i['acceptedDocuments'] : []))
    .filter((d) => String(d).toLowerCase().includes('aadhaar'));

  assert.deepEqual(inAcceptedDocuments, [], 'Aadhaar is offered as an accepted document');
  assert.ok(mentions > 0, 'the deliberate-absence note has been deleted from the seed');
});

test('no threshold figure is stated in the seed', () => {
  // Gym.md O-TEN-4 and LAUNCH_MARKET_INDIA.md §13: the GSTIN registration threshold and the fire
  // safety floor area are tax and legal facts awaiting professional advice. A number here would
  // look exactly like a verified one, and would be shown to every gym in India.
  const conditions = SEED.checklists
    .flatMap((c) => c.items)
    .map((i) => i['condition'])
    .filter((c): c is Record<string, unknown> => typeof c === 'object' && c !== null);

  for (const condition of conditions) {
    for (const value of Object.values(condition)) {
      assert.notEqual(
        typeof value,
        'number',
        `a numeric threshold appears in ${JSON.stringify(condition)}`,
      );
    }
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// AC-2 — the conditional rules
// ═══════════════════════════════════════════════════════════════════════════

test('AC-2 — GSTIN is required of a registered applicant and not of an unregistered one', () => {
  const of = (facts: ApplicantFacts) =>
    resolveChecklist(itemsFor('COMPANY'), facts).find((i) => i.documentType === 'GSTIN')?.resolved;

  assert.equal(of(REGISTERED), 'REQUIRED');
  assert.equal(of(UNREGISTERED), 'NOT_REQUIRED');
});

test('AC-2 — PENDING and COMPOSITION also require it', () => {
  // A registration in progress still produces a certificate the reviewer needs, and a composition
  // dealer is registered. Treating either as unregistered would approve a gym whose invoices will
  // carry a GSTIN the platform never saw.
  for (const status of ['PENDING', 'COMPOSITION']) {
    const items = resolveChecklist(itemsFor('COMPANY'), {
      ...REGISTERED,
      taxRegistrationStatus: status,
    });
    assert.equal(items.find((i) => i.documentType === 'GSTIN')?.resolved, 'REQUIRED', status);
  }
});

test('AC-2 — an UNANSWERED declaration is AWAITING_DECLARATION, not NOT_REQUIRED', () => {
  // ┌─ THE ASSERTION THIS WHOLE DESIGN EXISTS FOR ───────────────────────────────────────────────┐
  // │ Defaulting an unanswered question to false drops the trade licence from the checklist. The │
  // │ gym is approved without a licence it may legally need, the platform lists it, and no error │
  // │ was raised anywhere at any point.                                                           │
  // └───────────────────────────────────────────────────────────────────────────────────────────┘
  const resolved = resolveChecklist(itemsFor('COMPANY'), {
    taxRegistrationStatus: 'NOT_REGISTERED',
    declarations: {}, // answered nothing
  });

  const trade = resolved.find((i) => i.documentType === 'TRADE_LICENCE');
  assert.equal(trade?.resolved, 'AWAITING_DECLARATION');
  assert.equal(trade?.awaiting, 'municipality_requires_trade_licence');

  assert.equal(
    resolved.find((i) => i.documentType === 'FIRE_SAFETY_NOC')?.resolved,
    'AWAITING_DECLARATION',
  );
});

test('AC-2 — an answered-yes declaration makes the document REQUIRED', () => {
  const resolved = resolveChecklist(itemsFor('COMPANY'), {
    taxRegistrationStatus: 'NOT_REGISTERED',
    declarations: {
      municipality_requires_trade_licence: true,
      premises_above_fire_noc_threshold: true,
    },
  });

  assert.equal(resolved.find((i) => i.documentType === 'TRADE_LICENCE')?.resolved, 'REQUIRED');
  assert.equal(resolved.find((i) => i.documentType === 'FIRE_SAFETY_NOC')?.resolved, 'REQUIRED');
});

test('the music licence is ADVISORY for every entity type and never becomes REQUIRED', () => {
  for (const entityType of ENTITY_TYPES) {
    const resolved = resolveChecklist(itemsFor(entityType), REGISTERED);
    assert.equal(
      resolved.find((i) => i.documentType === 'MUSIC_LICENCE')?.resolved,
      'ADVISORY',
      entityType,
    );
  }
});

test('items come back in display order even when the source array is shuffled', () => {
  // SCR-DASH-002 fixes the wizard's rendering order. A hand-edited successor version with two
  // items transposed must not silently reorder the wizard.
  const shuffled = [...itemsFor('COMPANY')].reverse();
  const resolved = resolveChecklist(shuffled, REGISTERED);

  assert.equal(resolved[0]?.documentType, 'PAN');
  assert.equal(resolved[resolved.length - 1]?.documentType, 'MUSIC_LICENCE');
});

// ═══════════════════════════════════════════════════════════════════════════
// AC-3 — what is still owed
// ═══════════════════════════════════════════════════════════════════════════

const REQUIRED_OF_EVERYBODY = [
  'PAN',
  'BUSINESS_REGISTRATION',
  'SHOP_ESTABLISHMENT',
  'BANK_PROOF',
  'OWNER_IDENTITY',
  'PREMISES_ADDRESS_PROOF',
];

test('AC-3 — an applicant who has supplied everything required is complete', () => {
  const resolved = resolveChecklist(itemsFor('COMPANY'), REGISTERED);
  const completeness = checklistCompleteness(resolved, [...REQUIRED_OF_EVERYBODY, 'GSTIN']);

  assert.deepEqual(completeness.missing, []);
  assert.deepEqual(completeness.awaiting, []);
  assert.equal(completeness.complete, true);
});

test('AC-3 — the ADVISORY item is reported outstanding and does NOT block', () => {
  // Both halves. Dropping the list means the music licence is never flagged to anybody; counting
  // it blocks an approval over a document §3.5 explicitly calls non-blocking.
  const resolved = resolveChecklist(itemsFor('COMPANY'), REGISTERED);
  const completeness = checklistCompleteness(resolved, [...REQUIRED_OF_EVERYBODY, 'GSTIN']);

  assert.deepEqual(completeness.advisoryOutstanding, ['MUSIC_LICENCE']);
  assert.equal(completeness.complete, true, 'an advisory document blocked completeness');
});

test('AC-3 — an unanswered declaration blocks completeness even with every document supplied', () => {
  const resolved = resolveChecklist(itemsFor('COMPANY'), {
    taxRegistrationStatus: 'NOT_REGISTERED',
    declarations: {},
  });
  const completeness = checklistCompleteness(resolved, [...REQUIRED_OF_EVERYBODY, 'GSTIN']);

  assert.deepEqual(completeness.missing, [], 'nothing required is actually missing');
  assert.deepEqual(completeness.awaiting, [
    'municipality_requires_trade_licence',
    'premises_above_fire_noc_threshold',
  ]);
  assert.equal(completeness.complete, false, 'an unanswered question did not block');
});

test('AC-3 — a missing required document is named, not counted', () => {
  const resolved = resolveChecklist(itemsFor('COMPANY'), REGISTERED);
  const completeness = checklistCompleteness(resolved, ['PAN', 'GSTIN']);

  assert.deepEqual(completeness.missing, [
    'BUSINESS_REGISTRATION',
    'SHOP_ESTABLISHMENT',
    'BANK_PROOF',
    'OWNER_IDENTITY',
    'PREMISES_ADDRESS_PROOF',
  ]);
  assert.equal(completeness.complete, false);
});

// ═══════════════════════════════════════════════════════════════════════════
// The refusals
// ═══════════════════════════════════════════════════════════════════════════

test('an unknown condition operator THROWS rather than evaluating false', () => {
  // A checklist version published against a newer resolver. Returning false would drop a required
  // document with no error anywhere; the gym would be approved without it.
  const items: ChecklistItem[] = [
    { documentType: 'PAN', obligation: 'ALWAYS', displayOrder: 1, label: 'PAN' },
    {
      documentType: 'TRADE_LICENCE',
      obligation: 'CONDITIONAL',
      displayOrder: 2,
      label: 'Trade licence',
      condition: { turnoverAboveMinor: 4_000_000_000 },
    },
  ];

  assert.throws(() => resolveChecklist(items, REGISTERED), UnknownChecklistConditionError);
});

test('a CONDITIONAL item with an empty condition is refused, not defaulted', () => {
  const items: ChecklistItem[] = [
    { documentType: 'PAN', obligation: 'ALWAYS', displayOrder: 1, label: 'PAN' },
    {
      documentType: 'TRADE_LICENCE',
      obligation: 'CONDITIONAL',
      displayOrder: 2,
      label: 'Trade licence',
      condition: {},
    },
  ];

  assert.throws(() => resolveChecklist(items, REGISTERED), UnknownChecklistConditionError);
});

// ═══════════════════════════════════════════════════════════════════════════
// The parser — the DB constraints check keys exist, not that types are right
// ═══════════════════════════════════════════════════════════════════════════

test('a string displayOrder is refused, because it would sort as a string', () => {
  // `exists(@.displayOrder)` is satisfied by `"1"`, so the database accepts this row. Ten items
  // ordered "1", "10", "2" is a wizard that renders the music licence third.
  assert.throws(
    () =>
      parseChecklistItems(
        [{ documentType: 'PAN', obligation: 'ALWAYS', displayOrder: '1', label: 'PAN' }],
        'fixture',
      ),
    MalformedChecklistError,
  );
});

test('an unknown obligation is refused', () => {
  assert.throws(
    () =>
      parseChecklistItems(
        [{ documentType: 'PAN', obligation: 'MANDATORY', displayOrder: 1, label: 'PAN' }],
        'fixture',
      ),
    MalformedChecklistError,
  );
});

test('the failure names the row and the item index', () => {
  // A cast would produce a TypeError three frames later with nothing pointing at which checklist
  // version is broken — and reference data is exactly what nobody thinks to look at.
  try {
    parseChecklistItems([{ documentType: 'PAN', obligation: 'ALWAYS', displayOrder: 1 }], 'IN:v1');
    assert.fail('the malformed item was accepted');
  } catch (error) {
    assert.match((error as Error).message, /IN:v1 item 0/);
  }
});

test('an empty items array is refused', () => {
  assert.throws(() => parseChecklistItems([], 'fixture'), MalformedChecklistError);
});

test('the real seed parses for every entity type', () => {
  for (const entityType of ENTITY_TYPES) {
    assert.equal(itemsFor(entityType).length, 10, entityType);
  }
});
