#!/usr/bin/env bash
# Starts the Banking Transactions API.
#   ./demo/run.sh          start the server on $PORT (default 3000)
#   ./demo/run.sh --seed   start the server and load demo/sample-data.json
set -euo pipefail

cd "$(dirname "$0")/.."
PORT="${PORT:-3000}"
export PORT

if [ ! -d node_modules ]; then
  echo "Installing dependencies..."
  npm install
fi

if [ "${1:-}" != "--seed" ]; then
  exec npm start
fi

# Run node directly (not via npm) so the trap stops the actual server process.
node src/index.js &
SERVER_PID=$!
trap 'kill $SERVER_PID 2>/dev/null' EXIT INT TERM

echo "Waiting for server on port $PORT..."
ready=false
for _ in $(seq 1 50); do
  if curl -s -o /dev/null "http://localhost:$PORT/transactions"; then ready=true; break; fi
  kill -0 $SERVER_PID 2>/dev/null || break  # server exited (e.g. port in use)
  sleep 0.2
done
if [ "$ready" != true ]; then
  echo "Server did not start on port $PORT" >&2
  exit 1
fi

echo "Seeding sample data..."
node -e '
  const data = require("./demo/sample-data.json");
  (async () => {
    for (const tx of data) {
      const res = await fetch(`http://localhost:${process.env.PORT}/transactions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(tx),
      });
      console.log(res.status, tx.type, tx.amount, tx.currency);
    }
  })().catch((err) => { console.error("Seeding failed:", err.message); process.exit(1); });
'
echo "Seed complete. Press Ctrl+C to stop."
wait $SERVER_PID
