/**
 * Locale-parameterised currency formatting — `AC-FND-06.4`, `NFR-USE-08`.
 *
 * ┌─ INDIA IS THE DEFAULT, NOT THE ASSUMPTION ──────────────────────────────────────────────────┐
 * │ Every function here takes the currency explicitly. `formatMoney(amount)` with an implicit   │
 * │ INR would work perfectly until the second market, at which point every call site is a       │
 * │ silent bug that renders the right digits with the wrong symbol — and a customer sees ₹ on a  │
 * │ price they are paying in another currency.                                                   │
 * │                                                                                              │
 * │ Making the parameter required costs one argument per call and removes the entire class.      │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 */

import { formatIndianRupees, groupIndianDigits } from './format-indian-grouping.js';

export interface CurrencyProfile {
  readonly code: string;
  readonly symbol: string;
  /** Decimal digits in the minor unit. INR is 2 (paise); JPY would be 0. */
  readonly minorExponent: number;
  /** `indian` is last-three-then-twos; `western` is threes throughout. */
  readonly grouping: 'indian' | 'western';
}

/**
 * The currencies this platform can render.
 *
 * A closed table rather than an `Intl` lookup: `Intl` takes a `number`, which is forbidden in
 * this path, and its output varies by ICU build — the same amount rendering differently on two
 * Node versions is a support ticket nobody can reproduce.
 */
export const CURRENCIES: Readonly<Record<string, CurrencyProfile>> = {
  INR: { code: 'INR', symbol: '₹', minorExponent: 2, grouping: 'indian' },
  // Present so the parameterisation is exercised by a real second entry rather than being
  // theoretical — a "generic" function with one caller is a function shaped by that one caller.
  USD: { code: 'USD', symbol: '$', minorExponent: 2, grouping: 'western' },
};

export class UnknownCurrencyError extends RangeError {
  constructor(code: string) {
    super(
      `Unknown currency "${code}". Add it to CURRENCIES with its symbol, minor exponent and ` +
        'grouping — a currency rendered with a guessed symbol is worse than one that throws.',
    );
    this.name = 'UnknownCurrencyError';
  }
}

export function currencyProfile(code: string): CurrencyProfile {
  const profile = CURRENCIES[code];
  if (!profile) throw new UnknownCurrencyError(code);
  return profile;
}

function groupWestern(digits: string): string {
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/**
 * Formats a minor-unit amount in the given currency.
 *
 * The sign precedes the symbol — `-₹500.00`, never `₹-500.00` (§8.3). A refund line in a
 * statement is scanned by its leading character, and a minus buried after the symbol is missed.
 */
export function formatCurrency(minorUnits: bigint, currencyCode: string): string {
  const profile = currencyProfile(currencyCode);
  if (profile.grouping === 'indian' && profile.minorExponent === 2) {
    return formatIndianRupees(minorUnits);
  }

  const negative = minorUnits < 0n;
  const magnitude = negative ? -minorUnits : minorUnits;
  const divisor = 10n ** BigInt(profile.minorExponent);

  const major = (magnitude / divisor).toString();
  const grouped = profile.grouping === 'indian' ? groupIndianDigits(major) : groupWestern(major);

  const minor =
    profile.minorExponent === 0
      ? ''
      : `.${(magnitude % divisor).toString().padStart(profile.minorExponent, '0')}`;

  return `${negative ? '-' : ''}${profile.symbol}${grouped}${minor}`;
}

/**
 * The accounting form: a negative amount in parentheses, no minus sign.
 *
 * `(₹500.00)` rather than `-₹500.00`. Used ONLY on the settlement statement and the ledger
 * export, where the convention is expected — using it on a customer-facing refund confirmation
 * would leave a member unsure whether they are owed money or owe it.
 */
export function formatAccounting(minorUnits: bigint, currencyCode: string): string {
  const rendered = formatCurrency(minorUnits, currencyCode);
  return minorUnits < 0n ? `(${rendered.slice(1)})` : rendered;
}
