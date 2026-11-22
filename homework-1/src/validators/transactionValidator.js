const { MAX_AMOUNT, hasMaxTwoDecimals } = require('../utils/money');
const { validationError } = require('../utils/errors');

const ACCOUNT_RE = /^ACC-[A-Za-z0-9]{5}$/;
const TYPES = ['deposit', 'withdrawal', 'transfer'];
const CURRENCIES = new Set(Intl.supportedValuesOf('currency'));
const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/;
const ISO_DATETIME_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?(Z|[+-]\d{2}:\d{2})$/;
const DAY_MS = 24 * 60 * 60 * 1000;

const ACCOUNT_MSG = 'Account must match format ACC-XXXXX (X is alphanumeric)';
const TYPE_MSG = `Type must be one of: ${TYPES.join(', ')}`;

const isPresent = (v) => v !== undefined && v !== null;
const isPlainObject = (v) => typeof v === 'object' && v !== null && !Array.isArray(v);
const isAccountId = (v) => typeof v === 'string' && ACCOUNT_RE.test(v);

/** True if "YYYY-MM-DD..." names a real calendar day (Date.parse rolls 2024-02-31 over to March). */
const isRealCalendarDate = (raw) => {
  const [y, m, d] = raw.slice(0, 10).split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
};

// Which account fields each transaction type requires (true) or forbids (false).
const ACCOUNT_RULES = {
  deposit: { toAccount: true, fromAccount: false },
  withdrawal: { toAccount: false, fromAccount: true },
  transfer: { toAccount: true, fromAccount: true },
};

/**
 * Validates a POST /transactions body. Collects every error rather than
 * stopping at the first. Returns the normalised input or throws a 400 AppError.
 */
function validateTransaction(body) {
  if (!isPlainObject(body)) {
    throw validationError([{ field: 'body', message: 'Request body must be a JSON object' }]);
  }

  const { fromAccount, toAccount, amount, currency, type } = body;
  const errors = [];

  if (typeof amount !== 'number' || !Number.isFinite(amount) || amount <= 0) {
    errors.push({ field: 'amount', message: 'Amount must be a positive number' });
  } else if (!hasMaxTwoDecimals(amount)) {
    errors.push({ field: 'amount', message: 'Amount must have at most 2 decimal places' });
  } else if (amount > MAX_AMOUNT) {
    errors.push({ field: 'amount', message: `Amount must not exceed ${MAX_AMOUNT}` });
  }

  if (typeof currency !== 'string' || !CURRENCIES.has(currency)) {
    errors.push({ field: 'currency', message: 'Invalid currency code (expected ISO 4217, e.g. USD)' });
  }

  if (!TYPES.includes(type)) {
    errors.push({ field: 'type', message: TYPE_MSG });
  } else {
    for (const [field, required] of Object.entries(ACCOUNT_RULES[type])) {
      const value = body[field];
      if (required && !isPresent(value)) {
        errors.push({ field, message: `${field} is required for ${type}` });
      } else if (!required && isPresent(value)) {
        errors.push({ field, message: `${field} must not be set for ${type}` });
      } else if (required && !isAccountId(value)) {
        // required and present: check the format
        errors.push({ field, message: ACCOUNT_MSG });
      }
    }
    if (type === 'transfer' && isPresent(fromAccount) && fromAccount === toAccount) {
      errors.push({ field: 'toAccount', message: 'Source and destination accounts must differ' });
    }
  }

  if (errors.length) throw validationError(errors);

  return {
    fromAccount: isPresent(fromAccount) ? fromAccount : null,
    toAccount: isPresent(toAccount) ? toAccount : null,
    amount,
    currency,
    type,
  };
}

/** Parses a date filter. Date-only `to` values cover the whole day (UTC). */
function parseDate(field, raw, errors, { endOfDay = false } = {}) {
  if (raw === undefined) return undefined;
  if (typeof raw !== 'string' || !(DATE_ONLY_RE.test(raw) || ISO_DATETIME_RE.test(raw))) {
    errors.push({ field, message: `${field} must be an ISO 8601 date (YYYY-MM-DD) or datetime` });
    return undefined;
  }
  const isDateOnly = DATE_ONLY_RE.test(raw);
  const ms = Date.parse(isDateOnly ? `${raw}T00:00:00.000Z` : raw);
  if (Number.isNaN(ms) || !isRealCalendarDate(raw)) {
    errors.push({ field, message: `${field} is not a valid date` });
    return undefined;
  }
  return endOfDay && isDateOnly ? ms + DAY_MS - 1 : ms;
}

/** Validates GET /transactions query filters. */
function validateFilters(query) {
  const { accountId, type, from, to } = query;
  const errors = [];

  if (accountId !== undefined && !isAccountId(accountId)) {
    errors.push({ field: 'accountId', message: ACCOUNT_MSG });
  }
  if (type !== undefined && !TYPES.includes(type)) {
    errors.push({ field: 'type', message: TYPE_MSG });
  }
  const fromMs = parseDate('from', from, errors);
  const toMs = parseDate('to', to, errors, { endOfDay: true });
  if (fromMs !== undefined && toMs !== undefined && fromMs > toMs) {
    errors.push({ field: 'from', message: 'from must be before or equal to to' });
  }

  if (errors.length) throw validationError(errors);
  return { accountId, type, fromMs, toMs };
}

function validateAccountId(accountId) {
  if (!isAccountId(accountId)) throw validationError([{ field: 'accountId', message: ACCOUNT_MSG }]);
  return accountId;
}

module.exports = { validateTransaction, validateFilters, validateAccountId };
