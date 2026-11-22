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
- **VS Code:** install the *REST Client* extension, open `demo/sample-requests.http`, click **Send Request** above each request (run them top to bottom).
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

## 4. Run the tests
```bash
npm test
```
Runs the Jest + Supertest suite (validation, endpoints, filters, balances, summary, rate limiting).
