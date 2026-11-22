const { validateTransaction, validateFilters, validateAccountId } = require('../src/validators/transactionValidator');
const { hasMaxTwoDecimals, toMinor } = require('../src/utils/money');

const fieldsOf = (fn) => {
  try {
    fn();
  } catch (err) {
    expect(err.status).toBe(400);
    return err.details.map((d) => d.field);
  }
  throw new Error('expected validation to fail');
};

const valid = { fromAccount: 'ACC-12345', toAccount: 'ACC-67890', amount: 100.5, currency: 'USD', type: 'transfer' };

describe('money helpers', () => {
  test.each([1, 1.5, 1.55, 0.01, 100.1, 19.99, 999999999.99])('%p has at most 2 decimals', (n) => {
    expect(hasMaxTwoDecimals(n)).toBe(true);
  });
  test.each([1.555, 0.001, 10.123, 1e-12, 10000000.004])('%p has more than 2 decimals', (n) => {
    expect(hasMaxTwoDecimals(n)).toBe(false);
  });
  test('toMinor rounds float artefacts', () => {
    expect(toMinor(0.1 + 0.2)).toBe(30);
    expect(toMinor(19.99)).toBe(1999); // 19.99 * 100 === 1998.9999999999998
  });
});

describe('validateTransaction', () => {
  test('accepts a valid transfer and normalises missing accounts to null', () => {
    expect(validateTransaction(valid)).toEqual(valid);
    expect(validateTransaction({ toAccount: 'ACC-AB12c', amount: 5, currency: 'EUR', type: 'deposit' })).toMatchObject({
      fromAccount: null,
      toAccount: 'ACC-AB12c',
    });
  });

  test.each([0, -5, '10', NaN, Infinity, null, undefined])('rejects amount %p', (amount) => {
    expect(fieldsOf(() => validateTransaction({ ...valid, amount }))).toEqual(['amount']);
  });

  test('rejects more than 2 decimal places with a specific message', () => {
    expect(() => validateTransaction({ ...valid, amount: 1.555 })).toThrow(
      expect.objectContaining({
        details: [{ field: 'amount', message: 'Amount must have at most 2 decimal places' }],
      }),
    );
  });

  test.each([1e-12, 10000000.004, 1000000000.01, 1e21])('rejects sub-cent or out-of-range amount %p', (amount) => {
    expect(fieldsOf(() => validateTransaction({ ...valid, amount }))).toEqual(['amount']);
  });

  test('accepts the maximum amount', () => {
    expect(validateTransaction({ ...valid, amount: 1_000_000_000 }).amount).toBe(1_000_000_000);
  });

  test.each(['usd', 'XYZ', 'US', '', 123])('rejects currency %p', (currency) => {
    expect(fieldsOf(() => validateTransaction({ ...valid, currency }))).toEqual(['currency']);
  });

  test.each(['ACC-1234', 'ACC-123456', 'acc-12345', 'ACC-12_45', '12345', 42])('rejects account %p', (acc) => {
    expect(fieldsOf(() => validateTransaction({ ...valid, fromAccount: acc }))).toEqual(['fromAccount']);
  });

  test('rejects unknown type', () => {
    expect(fieldsOf(() => validateTransaction({ ...valid, type: 'refund' }))).toEqual(['type']);
  });

  test('enforces account presence per type', () => {
    expect(fieldsOf(() => validateTransaction({ ...valid, type: 'deposit' }))).toEqual(['fromAccount']);
    expect(fieldsOf(() => validateTransaction({ ...valid, type: 'withdrawal' }))).toEqual(['toAccount']);
    expect(fieldsOf(() => validateTransaction({ ...valid, toAccount: undefined }))).toEqual(['toAccount']);
  });

  test('rejects transfer to the same account', () => {
    expect(fieldsOf(() => validateTransaction({ ...valid, toAccount: valid.fromAccount }))).toEqual(['toAccount']);
  });

  test('collects all errors at once', () => {
    expect(fieldsOf(() => validateTransaction({ ...valid, amount: -1, currency: 'XXX1' }))).toEqual(['amount', 'currency']);
  });

  test.each([null, [], 'text'])('rejects non-object body %p', (body) => {
    expect(fieldsOf(() => validateTransaction(body))).toEqual(['body']);
  });
});

describe('validateFilters', () => {
  test('date-only "to" covers the whole day', () => {
    const { fromMs, toMs } = validateFilters({ from: '2024-01-01', to: '2024-01-31' });
    expect(fromMs).toBe(Date.parse('2024-01-01T00:00:00.000Z'));
    expect(toMs).toBe(Date.parse('2024-01-31T23:59:59.999Z'));
  });

  test('accepts leap day and offset datetimes', () => {
    expect(validateFilters({ from: '2024-02-29' }).fromMs).toBe(Date.parse('2024-02-29T00:00:00.000Z'));
    expect(validateFilters({ from: '2024-01-01T00:30:00+02:00' }).fromMs).toBe(Date.parse('2023-12-31T22:30:00Z'));
  });

  test('accepts full ISO datetimes as-is', () => {
    expect(validateFilters({ to: '2024-01-31T12:00:00Z' }).toMs).toBe(Date.parse('2024-01-31T12:00:00Z'));
  });

  test.each([
    [{ from: 'yesterday' }, ['from']],
    [{ to: '2024-13-45' }, ['to']],
    [{ from: '2024-02-31' }, ['from']],
    [{ from: '2023-02-29' }, ['from']],
    [{ to: '2024-04-31T10:00:00Z' }, ['to']],
    [{ from: '2024-02-01', to: '2024-01-01' }, ['from']],
    [{ type: 'refund' }, ['type']],
    [{ accountId: 'bad' }, ['accountId']],
    [{ type: ['deposit', 'transfer'] }, ['type']],
  ])('rejects %p', (query, fields) => {
    expect(fieldsOf(() => validateFilters(query))).toEqual(fields);
  });
});

describe('validateAccountId', () => {
  test('passes valid and rejects invalid ids', () => {
    expect(validateAccountId('ACC-12345')).toBe('ACC-12345');
    expect(fieldsOf(() => validateAccountId('ACC-1'))).toEqual(['accountId']);
  });
});
