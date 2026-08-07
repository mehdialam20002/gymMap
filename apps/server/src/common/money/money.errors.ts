/**
 * `CURRENCY_MISMATCH` — `AC-FND-06.3`.
 *
 * Adding ₹500 to $500 is not a rounding question or a conversion opportunity. It is a bug, and
 * the only safe response is to refuse: an exchange rate applied inside `add` would use *some*
 * rate at *some* moment, and neither is recorded on the resulting ledger entry — so the figure
 * could never be reproduced, audited, or explained to the gym owner it was paid to.
 *
 * A 422 rather than a 500. The request described an operation that cannot be performed on the
 * values given, which is what 422 means; and unlike `TENANT_CONTEXT_MISSING` this can be
 * provoked by a caller sending a mismatched currency, so it is not purely our defect.
 */

import { DomainException } from '../errors/domain-exception.js';

export class CurrencyMismatchError extends DomainException {
  constructor(expected: string, received: string, operation: string) {
    super(
      'CURRENCY_MISMATCH',
      `Cannot ${operation} amounts in different currencies: ${expected} and ${received}.`,
      [
        {
          field: 'currency',
          expected,
          received,
          operation,
          diagnosis:
            'There is no exchange rate in the money path, deliberately. A conversion applied ' +
            'here would use an unrecorded rate at an unrecorded moment, and the resulting ' +
            'ledger entry could never be reproduced. Convert explicitly, at a recorded rate, ' +
            'before the amounts meet.',
        },
      ],
    );
  }
}
