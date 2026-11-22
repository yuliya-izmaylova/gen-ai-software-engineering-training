const request = require('supertest');
const { createApp } = require('../src/app');
const store = require('../src/models/store');

const app = createApp({ rateLimit: false });
const post = (body) => request(app).post('/transactions').send(body);

const deposit = (toAccount, amount, currency = 'USD') => post({ toAccount, amount, currency, type: 'deposit' });

beforeEach(() => store.reset());

describe('POST /transactions', () => {
  test('creates a deposit (201) with generated fields', async () => {
    const res = await deposit('ACC-12345', 100.5);
    expect(res.status).toBe(201);
    expect(res.body).toEqual({
      id: expect.any(String),
      fromAccount: null,
      toAccount: 'ACC-12345',
      amount: 100.5,
      currency: 'USD',
      type: 'deposit',
      timestamp: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T.*Z$/),
      status: 'completed',
    });
  });

  test('creates withdrawal and transfer when funds suffice', async () => {
    await deposit('ACC-12345', 200);
    const w = await post({ fromAccount: 'ACC-12345', amount: 50, currency: 'USD', type: 'withdrawal' });
    const t = await post({ fromAccount: 'ACC-12345', toAccount: 'ACC-67890', amount: 100.5, currency: 'USD', type: 'transfer' });
    expect(w.status).toBe(201);
    expect(t.status).toBe(201);
    expect(t.body.status).toBe('completed');
  });

  test('returns 400 with details for invalid body', async () => {
    const res = await post({ fromAccount: 'ACC-12345', toAccount: 'ACC-67890', amount: -1, currency: 'ABC', type: 'transfer' });
    expect(res.status).toBe(400);
    expect(res.body).toEqual({
      error: 'Validation failed',
      details: [
        { field: 'amount', message: 'Amount must be a positive number' },
        { field: 'currency', message: expect.stringContaining('Invalid currency code') },
      ],
    });
  });

  test('returns 400 for malformed JSON', async () => {
    const res = await request(app).post('/transactions').set('Content-Type', 'application/json').send('{"amount": ');
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Malformed JSON/);
  });

  test('returns 400 for missing body', async () => {
    const res = await request(app).post('/transactions');
    expect(res.status).toBe(400);
    expect(res.body.details[0].field).toBe('body');
  });

  test('overdraft: 422, failed attempt recorded, balance untouched', async () => {
    await deposit('ACC-12345', 30);
    const res = await post({ fromAccount: 'ACC-12345', toAccount: 'ACC-67890', amount: 50, currency: 'USD', type: 'transfer' });

    expect(res.status).toBe(422);
    expect(res.body).toEqual({
      error: 'Insufficient funds',
      code: 'INSUFFICIENT_FUNDS',
      details: { accountId: 'ACC-12345', currency: 'USD', available: 30, requested: 50, transactionId: expect.any(String) },
    });

    const audit = await request(app).get(`/transactions/${res.body.details.transactionId}`);
    expect(audit.status).toBe(200);
    expect(audit.body).toMatchObject({ status: 'failed', failureReason: 'INSUFFICIENT_FUNDS' });

    const from = await request(app).get('/accounts/ACC-12345/balance');
    const to = await request(app).get('/accounts/ACC-67890/balance');
    expect(from.body.balances).toEqual({ USD: 30 });
    expect(to.body.balances).toEqual({});
  });

  test('balance check is per currency', async () => {
    await deposit('ACC-12345', 100, 'EUR');
    const res = await post({ fromAccount: 'ACC-12345', amount: 10, currency: 'USD', type: 'withdrawal' });
    expect(res.status).toBe(422);
    expect(res.body.details.available).toBe(0);
  });

  test('withdrawing the exact balance succeeds', async () => {
    await deposit('ACC-12345', 0.1);
    await deposit('ACC-12345', 0.2);
    const res = await post({ fromAccount: 'ACC-12345', amount: 0.3, currency: 'USD', type: 'withdrawal' });
    expect(res.status).toBe(201);
  });
});

describe('GET /transactions/:id', () => {
  test('returns the transaction', async () => {
    const created = await deposit('ACC-12345', 10);
    const res = await request(app).get(`/transactions/${created.body.id}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual(created.body);
  });

  test('404 for unknown id', async () => {
    const res = await request(app).get('/transactions/does-not-exist');
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'Transaction not found' });
  });
});

describe('GET /transactions filters', () => {
  const seed = (input, iso) =>
    store.createTransaction({ fromAccount: null, toAccount: null, currency: 'USD', ...input }, new Date(iso));

  beforeEach(() => {
    seed({ toAccount: 'ACC-AAAAA', amount: 100, type: 'deposit' }, '2024-01-01T09:00:00Z');
    seed({ fromAccount: 'ACC-AAAAA', toAccount: 'ACC-BBBBB', amount: 10, type: 'transfer' }, '2024-01-15T12:00:00Z');
    seed({ fromAccount: 'ACC-AAAAA', amount: 5, type: 'withdrawal' }, '2024-01-31T23:30:00Z');
    seed({ toAccount: 'ACC-BBBBB', amount: 7, type: 'deposit' }, '2024-02-01T00:00:00Z');
  });

  const list = (qs) => request(app).get(`/transactions${qs}`);

  test('returns all without filters', async () => {
    const res = await list('');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(4);
  });

  test('accountId matches either side', async () => {
    expect((await list('?accountId=ACC-BBBBB')).body.map((t) => t.type)).toEqual(['transfer', 'deposit']);
  });

  test('type filter', async () => {
    expect((await list('?type=deposit')).body).toHaveLength(2);
  });

  test('date range includes the whole "to" day', async () => {
    expect((await list('?from=2024-01-01&to=2024-01-31')).body).toHaveLength(3);
    expect((await list('?from=2024-02-01')).body).toHaveLength(1);
  });

  test('combines filters', async () => {
    const res = await list('?accountId=ACC-AAAAA&type=transfer&from=2024-01-10&to=2024-01-20');
    expect(res.body).toHaveLength(1);
    expect(res.body[0].toAccount).toBe('ACC-BBBBB');
  });

  test('400 for invalid filters', async () => {
    const res = await list('?type=refund&from=not-a-date');
    expect(res.status).toBe(400);
    expect(res.body.details.map((d) => d.field)).toEqual(['type', 'from']);
  });
});
