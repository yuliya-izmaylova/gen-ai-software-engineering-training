const { Router } = require('express');
const store = require('../models/store');
const { validateAccountId } = require('../validators/transactionValidator');

const router = Router();

// Accounts exist implicitly through their transactions, so an account with
// no history returns 200 with empty balances rather than 404.
router.get('/:accountId/balance', (req, res) => {
  const accountId = validateAccountId(req.params.accountId);
  res.json({ accountId, balances: store.getBalances(accountId) });
});

router.get('/:accountId/summary', (req, res) => {
  const accountId = validateAccountId(req.params.accountId);
  res.json(store.getSummary(accountId));
});

module.exports = router;
