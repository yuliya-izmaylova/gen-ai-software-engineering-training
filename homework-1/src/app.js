const express = require('express');
const { rateLimit } = require('express-rate-limit');
const transactionsRouter = require('./routes/transactions');
const accountsRouter = require('./routes/accounts');
const { AppError } = require('./utils/errors');

const RATE_LIMIT = { windowMs: 60 * 1000, limit: 100 };

/**
 * Builds the Express app without listening, so tests can drive it directly.
 * @param {{ rateLimit?: false | { windowMs?: number, limit?: number } }} [options]
 */
function createApp({ rateLimit: rateLimitOptions = RATE_LIMIT } = {}) {
  const app = express();
  app.disable('x-powered-by');

  if (rateLimitOptions) {
    app.use(
      rateLimit({
        ...RATE_LIMIT,
        ...rateLimitOptions,
        standardHeaders: 'draft-8',
        legacyHeaders: false,
        handler: (req, res) => res.status(429).json({ error: 'Too many requests, please try again later' }),
      }),
    );
  }

  app.use(express.json({ limit: '100kb' }));
  app.use('/transactions', transactionsRouter);
  app.use('/accounts', accountsRouter);

  app.use((req, res) => res.status(404).json({ error: 'Route not found' }));

  // Central error handler (Express 5 forwards thrown errors here).
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    if (res.headersSent) return next(err);
    if (err instanceof AppError) {
      const body = { error: err.message };
      if (err.code) body.code = err.code;
      if (err.details) body.details = err.details;
      return res.status(err.status).json(body);
    }
    if (err.type === 'entity.parse.failed') {
      return res.status(400).json({ error: 'Malformed JSON in request body' });
    }
    // Other client errors from Express/body-parser (413 too large, 415 bad charset,
    // 400 malformed URL encoding…). Only echo the message when it is marked safe.
    const status = err.status ?? err.statusCode;
    if (status >= 400 && status < 500) {
      return res.status(status).json({ error: err.expose ? err.message : 'Bad request' });
    }
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  });

  return app;
}

module.exports = { createApp };
