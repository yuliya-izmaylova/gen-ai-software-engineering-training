const request = require('supertest');
const { createApp } = require('../src/app');
const store = require('../src/models/store');

const app = createApp({ rateLimit: false });
const post = (body) => request(app).post('/transactions').send(body);

beforeEach(() => store.reset());

describe('GET /accounts/:accountId/balance', () => {
  test('per-currency balance across all transaction types', async () => {
    await post({ toAccount: 'ACC-12345', amount: 200, currency: 'USD', type: 'deposit' });
    await post({ toAccount: 'ACC-12345', amount: 50, currency: 'EUR', type: 'deposit' });
    await post({ fromAccount: 'ACC-12345', amount: 20.25, currency: 'USD', type: 'withdrawal' });
    await post({ fromAccount: 'ACC-12345', toAccount: 'ACC-67890', amount: 79.25, currency: 'USD', type: 'transfer' });

    const a = await request(app).get('/accounts/ACC-12345/balance');
    const b = await request(app).get('/accounts/ACC-67890/balance');
    expect(a.status).toBe(200);
    expect(a.body).toEqual({ accountId: 'ACC-12345', balances: { USD: 100.5, EUR: 50 } });
    expect(b.body).toEqual({ accountId: 'ACC-67890', balances: { USD: 79.25 } });
  });

  test('no float drift', async () => {
    await post({ toAccount: 'ACC-12345', amount: 0.1, currency: 'USD', type: 'deposit' });
    await post({ toAccount: 'ACC-12345', amount: 0.2, currency: 'USD', type: 'deposit' });
    expect((await request(app).get('/accounts/ACC-12345/balance')).body.balances.USD).toBe(0.3);
  });

  test('unknown account returns empty balances', async () => {
    const res = await request(app).get('/accounts/ACC-00000/balance');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ accountId: 'ACC-00000', balances: {} });
  });

  test('400 for malformed account id', async () => {
    const res = await request(app).get('/accounts/12345/balance');
    expect(res.status).toBe(400);
    expect(res.body.details[0].field).toBe('accountId');
  });
});

describe('GET /accounts/:accountId/summary', () => {
  test('aggregates completed transactions; failed attempts excluded', async () => {
    await post({ toAccount: 'ACC-12345', amount: 100, currency: 'USD', type: 'deposit' });
    await post({ fromAccount: 'ACC-67890', toAccount: 'ACC-12345', amount: 5, currency: 'USD', type: 'transfer' }); // fails (no funds)
    await post({ toAccount: 'ACC-67890', amount: 40, currency: 'USD', type: 'deposit' });
    await post({ fromAccount: 'ACC-67890', toAccount: 'ACC-12345', amount: 25.5, currency: 'USD', type: 'transfer' });
    await post({ fromAccount: 'ACC-12345', amount: 10, currency: 'USD', type: 'withdrawal' });
    const last = await post({ fromAccount: 'ACC-12345', toAccount: 'ACC-67890', amount: 15, currency: 'USD', type: 'transfer' });

    const res = await request(app).get('/accounts/ACC-12345/summary');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      accountId: 'ACC-12345',
      totalDeposits: { USD: 125.5 },
      totalWithdrawals: { USD: 25 },
      transactionCount: 4,
      mostRecentTransactionDate: last.body.timestamp,
    });
  });

  test('empty account summary', async () => {
    const res = await request(app).get('/accounts/ACC-00000/summary');
    expect(res.body).toEqual({
      accountId: 'ACC-00000',
      totalDeposits: {},
      totalWithdrawals: {},
      transactionCount: 0,
      mostRecentTransactionDate: null,
    });
  });
});
