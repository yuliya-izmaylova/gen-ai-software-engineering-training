/**
 * Money helpers. Amounts are kept as integer minor units (cents) for all
 * arithmetic to avoid floating-point drift (e.g. 0.1 + 0.2 !== 0.3).
 * All currencies use a fixed scale of 2 decimals, as required by the spec.
 */
const SCALE = 100;

/** Upper bound keeps every cent value far below Number.MAX_SAFE_INTEGER. */
const MAX_AMOUNT = 1_000_000_000;

/**
 * Exact check: the number must be identical to itself rounded to 2 decimals.
 * JSON literals like 100.5 or 19.99 pass; 1.555, 1e-12 or 10000000.004 do not.
 */
const hasMaxTwoDecimals = (n) => Number(n.toFixed(2)) === n;

const toMinor = (amount) => Math.round(amount * SCALE);
const fromMinor = (minor) => minor / SCALE;

module.exports = { MAX_AMOUNT, hasMaxTwoDecimals, toMinor, fromMinor };
