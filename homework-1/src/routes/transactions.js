const { Router } = require('express');
const store = require('../models/store');
const { validateTransaction, validateFilters } = require('../validators/transactionValidator');
const { AppError, notFound } = require('../utils/errors');

const router = Router();

router.post('/', (req, res) => {
  const input = validateTransaction(req.body);
  const { transaction, available } = store.createTransaction(input);

  // Failed attempts are already stored for audit; report them as 422.
  if (transaction.status === 'failed') {
    throw new AppError(422, 'Insufficient funds', {
      code: 'INSUFFICIENT_FUNDS',
      details: {
        accountId: transaction.fromAccount,
        currency: transaction.currency,
        available,
        requested: transaction.amount,
        transactionId: transaction.id,
      },
    });
  }

  res.status(201).json(transaction);
});

router.get('/', (req, res) => {
  res.json(store.list(validateFilters(req.query)));
});

router.get('/:id', (req, res) => {
  const tx = store.getById(req.params.id);
  if (!tx) throw notFound('Transaction not found');
  res.json(tx);
});

module.exports = router;
