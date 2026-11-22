const request = require('supertest');
const { createApp } = require('../src/app');

describe('app', () => {
  test('unknown route returns JSON 404', async () => {
    const res = await request(createApp({ rateLimit: false })).get('/nope');
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'Route not found' });
  });

  test('oversized body returns 413, not 500', async () => {
    const res = await request(createApp({ rateLimit: false }))
      .post('/transactions')
      .set('Content-Type', 'application/json')
      .send(JSON.stringify({ note: 'a'.repeat(200_000) }));
    expect(res.status).toBe(413);
    expect(res.body.error).toMatch(/too large/i);
  });

  test('malformed URL encoding returns 400, not 500', async () => {
    const res = await request(createApp({ rateLimit: false })).get('/transactions/%E0%A4%A');
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'Bad request' });
  });

  test('unsupported charset returns 415', async () => {
    const res = await request(createApp({ rateLimit: false }))
      .post('/transactions')
      .set('Content-Type', 'application/json; charset=latin9')
      .send('{}');
    expect(res.status).toBe(415);
  });

  test('rate limit: 100 requests per minute, then 429', async () => {
    const app = createApp(); // default limits
    for (let i = 0; i < 100; i++) {
      const res = await request(app).get('/transactions');
      expect(res.status).toBe(200);
    }
    const blocked = await request(app).get('/transactions');
    expect(blocked.status).toBe(429);
    expect(blocked.body.error).toMatch(/Too many requests/);
    expect(blocked.headers).toHaveProperty('retry-after');
  });
});
