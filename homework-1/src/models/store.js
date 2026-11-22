const { randomUUID } = require('node:crypto');
const { toMinor, fromMinor } = require('../utils/money');

/**
 * In-memory transaction store. Balances are never stored; they are derived
 * from completed transactions, so the ledger is the single source of truth.
 * Node runs this synchronously, so the balance check + insert is atomic.
 */
const transactions = [];

/** Clears all data — used by tests to isolate cases. */
function reset() {
  transactions.length = 0;
}

/** Sum of completed movements for one account, per currency, in minor units. */
function balancesMinor(accountId) {
  const balances = {};
  for (const tx of transactions) {
    if (tx.status !== 'completed') continue;
    const minor = toMinor(tx.amount);
    if (tx.toAccount === accountId) balances[tx.currency] = (balances[tx.currency] ?? 0) + minor;
    if (tx.fromAccount === accountId) balances[tx.currency] = (balances[tx.currency] ?? 0) - minor;
  }
  return balances;
}

/**
 * Records a transaction. Withdrawals/transfers that exceed the source
 * balance are stored with status "failed" (audit trail) and do not move money.
 * Returns { transaction, available } where `available` is the pre-check
 * source balance (undefined for deposits).
 */
function createTransaction(input, now = new Date()) {
  let status = 'completed';
  let failureReason;
  let available;

  if (input.fromAccount) {
    const availableMinor = balancesMinor(input.fromAccount)[input.currency] ?? 0;
    available = fromMinor(availableMinor);
    if (availableMinor < toMinor(input.amount)) {
      status = 'failed';
      failureReason = 'INSUFFICIENT_FUNDS';
    }
  }

  const transaction = {
    id: randomUUID(),
    ...input,
    timestamp: now.toISOString(),
    status,
    ...(failureReason && { failureReason }),
  };
  transactions.push(transaction);
  return { transaction: { ...transaction }, available };
}

function getById(id) {
  const tx = transactions.find((t) => t.id === id);
  return tx && { ...tx };
}

function list({ accountId, type, fromMs, toMs } = {}) {
  return transactions
    .filter((tx) => {
      if (accountId && tx.fromAccount !== accountId && tx.toAccount !== accountId) return false;
      if (type && tx.type !== type) return false;
      const ts = Date.parse(tx.timestamp);
      if (fromMs !== undefined && ts < fromMs) return false;
      if (toMs !== undefined && ts > toMs) return false;
      return true;
    })
    .map((tx) => ({ ...tx }));
}

function getBalances(accountId) {
  const balances = {};
  for (const [currency, minor] of Object.entries(balancesMinor(accountId))) {
    balances[currency] = fromMinor(minor);
  }
  return balances;
}

/**
 * Summary over completed transactions. Incoming money (deposits + incoming
 * transfers) counts as deposits, outgoing (withdrawals + outgoing transfers)
 * as withdrawals; totals are per currency.
 */
function getSummary(accountId) {
  const totals = {};
  let transactionCount = 0;
  let mostRecentTransactionDate = null;

  for (const tx of transactions) {
    if (tx.status !== 'completed') continue;
    const incoming = tx.toAccount === accountId;
    const outgoing = tx.fromAccount === accountId;
    if (!incoming && !outgoing) continue;

    const t = (totals[tx.currency] ??= { depositsMinor: 0, withdrawalsMinor: 0 });
    if (incoming) t.depositsMinor += toMinor(tx.amount);
    if (outgoing) t.withdrawalsMinor += toMinor(tx.amount);
    transactionCount += 1;
    if (!mostRecentTransactionDate || tx.timestamp > mostRecentTransactionDate) {
      mostRecentTransactionDate = tx.timestamp;
    }
  }

  const totalDeposits = {};
  const totalWithdrawals = {};
  for (const [currency, t] of Object.entries(totals)) {
    totalDeposits[currency] = fromMinor(t.depositsMinor);
    totalWithdrawals[currency] = fromMinor(t.withdrawalsMinor);
  }

  return { accountId, totalDeposits, totalWithdrawals, transactionCount, mostRecentTransactionDate };
}

module.exports = { reset, createTransaction, getById, list, getBalances, getSummary };
