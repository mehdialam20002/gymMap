/**
 * Largest-remainder allocation — `BR-FIN-03`, `AC-FND-06.5`.
 *
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * THE PARTS SUM EXACTLY TO THE WHOLE. NOT APPROXIMATELY. EXACTLY.
 *
 * Splitting ₹10.00 three ways gives 333, 333, 333 — and one paise vanishes. Round each share
 * independently and you get 333 + 333 + 334 = 1000 only by luck; round half-even on each and you
 * get 333 + 333 + 333 = 999, losing a paise on every such split, forever.
 *
 * A vanished paise is not a rounding nicety. It is a settlement batch that does not balance, and
 * `KPI-26` sets settlement accuracy at 100% — a target that is arithmetically unreachable if a
 * split can lose or invent a unit.
 *
 * Largest-remainder: floor every share, then hand the leftover units out one at a time to the
 * shares with the largest discarded remainders. The total is the input by construction, because
 * the leftover is exactly what the flooring discarded.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

/**
 * Splits `total` across `weights` so the parts sum EXACTLY to `total`.
 *
 * Ties in the remainder are broken by the lower index. Deterministic and boring on purpose: a
 * tie broken at random makes two runs of the same settlement produce different — both correct —
 * allocations, and reconciling those against a provider statement is impossible.
 */
export function allocate(total: bigint, weights: readonly bigint[]): bigint[] {
  if (weights.length === 0) {
    throw new RangeError('allocate: no weights. There is nothing to allocate the total across.');
  }
  if (weights.some((w) => w < 0n)) {
    throw new RangeError(
      `allocate: a negative weight (${weights.find((w) => w < 0n)}) would produce a share whose ` +
        'sign is opposite to the total, which is a sign error rather than a refund.',
    );
  }

  const weightTotal = weights.reduce((a, b) => a + b, 0n);
  if (weightTotal === 0n) {
    throw new RangeError(
      'allocate: the weights sum to zero, so there is no basis for a split. Allocating equally ' +
        'would be a guess, and a guess in the money path becomes a ledger entry.',
    );
  }

  // Work in positive space so flooring behaves the same for a refund as for a charge. `bigint`
  // division truncates toward zero, so a negative total would floor "upward" and the leftover
  // would come out negative — the parts would still sum correctly, but each share would be one
  // unit different from the charge it reverses. R-11's parity suite is about exactly that.
  const negative = total < 0n;
  const magnitude = negative ? -total : total;

  const floors: bigint[] = [];
  const remainders: { index: number; remainder: bigint }[] = [];

  for (const [index, weight] of weights.entries()) {
    const scaled = magnitude * weight;
    floors.push(scaled / weightTotal);
    remainders.push({ index, remainder: scaled % weightTotal });
  }

  let leftover = magnitude - floors.reduce((a, b) => a + b, 0n);

  // Largest remainder first; ties by lower index, so the result is reproducible.
  remainders.sort((a, b) => {
    if (a.remainder > b.remainder) return -1;
    if (a.remainder < b.remainder) return 1;
    return a.index - b.index;
  });

  for (const { index } of remainders) {
    if (leftover <= 0n) break;
    floors[index] = floors[index]! + 1n;
    leftover -= 1n;
  }

  return negative ? floors.map((f) => -f) : floors;
}

/** Equal split across `parts`. The common case, so it does not need a weights array at the call site. */
export function allocateEvenly(total: bigint, parts: number): bigint[] {
  if (!Number.isInteger(parts) || parts <= 0) {
    throw new RangeError(`allocateEvenly: parts must be a positive integer, got ${parts}`);
  }
  return allocate(
    total,
    Array.from({ length: parts }, () => 1n),
  );
}
