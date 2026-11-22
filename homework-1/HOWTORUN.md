# ▶️ How to Run the application

## Prerequisites
- **Node.js 20+** (developed on Node 24) — check with `node -v`
- npm (bundled with Node)

## 1. Install dependencies
```bash
cd homework-1
npm install
```

## 2. Start the server
```bash
npm start            # http://localhost:3000
npm run dev          # auto-restart on file changes (node --watch)
PORT=4000 npm start  # custom port
```

Or use the demo script (installs dependencies if needed):
```bash
./demo/run.sh          # start the server
./demo/run.sh --seed   # start and load demo/sample-data.json
```

You should see:
```
Banking Transactions API listening on http://localhost:3000
```

## 3. Try it
- **PhpStorm (or any JetBrains IDE):** open `demo/sample-requests.http` and click the green ▶ next to each request, top to bottom. The built-in HTTP Client needs no plugin. Request 2 saves the new transaction id, and request 7 fetches it. You can also run `start` / `test` with the ▶ icons next to the scripts in `package.json`.
- **curl:**
  ```bash
  curl -X POST http://localhost:3000/transactions \
    -H "Content-Type: application/json" \
    -d '{"toAccount":"ACC-12345","amount":500,"currency":"USD","type":"deposit"}'

  curl -X POST http://localhost:3000/transactions \
    -H "Content-Type: application/json" \
    -d '{"fromAccount":"ACC-12345","toAccount":"ACC-67890","amount":100.50,"currency":"USD","type":"transfer"}'

  curl http://localhost:3000/transactions
  curl "http://localhost:3000/transactions?accountId=ACC-12345&type=transfer"
  curl http://localhost:3000/accounts/ACC-12345/balance
  curl http://localhost:3000/accounts/ACC-12345/summary
  ```

> ℹ️ Storage is in memory — all data is lost when the server stops. A withdrawal or transfer needs funds, so deposit first.

## 4. Demo the Task 4 features

Start with sample data so there is something to summarise:
```bash
./demo/run.sh --seed
```

### 4A. Account summary: `GET /accounts/:accountId/summary`
```bash
curl http://localhost:3000/accounts/ACC-12345/summary
```
Expected (after `--seed`; the date will differ):
```json
{
  "accountId": "ACC-12345",
  "totalDeposits":    { "USD": 1000,  "EUR": 250.75 },
  "totalWithdrawals": { "USD": 150.5, "EUR": 20 },
  "transactionCount": 5,
  "mostRecentTransactionDate": "2026-11-22T18:46:11.272Z"
}
```
- `totalDeposits` = deposits + incoming transfers, and `totalWithdrawals` = withdrawals + outgoing transfers, per currency.
- Only completed transactions count. Failed (overdraft) attempts are excluded.
- An account with no history returns zeros and `"mostRecentTransactionDate": null`.
- In PhpStorm, this is request **14** in `demo/sample-requests.http`.

### 4D. Rate limiting: 100 requests per minute per IP
Restart the server first (`Ctrl+C`, then `npm start`) so earlier requests don't count. Then send 101 requests within a minute:
```bash
for i in $(seq 1 101); do
  curl -s -o /dev/null -w '%{http_code}\n' http://localhost:3000/transactions
done | sort | uniq -c
```
Expected:
```
 100 200
   1 429
```
To see the full `429` response with its headers, send one more:
```bash
curl -i http://localhost:3000/transactions
```
```
HTTP/1.1 429 Too Many Requests
RateLimit: "100-in-1min"; r=0; t=60
Retry-After: 60
...
{"error":"Too many requests, please try again later"}
```
The limit resets after 60 seconds (see `Retry-After`).

Screenshots of both: `docs/screenshots/05-balance-summary.png` and `docs/screenshots/06-rate-limit.png`.

## 5. Run the tests
```bash
npm test
```
Runs the Jest + Supertest suite (validation, endpoints, filters, balances, summary, rate limiting).
