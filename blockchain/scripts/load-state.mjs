// Replays a previously saved transaction history onto a fresh Hardhat 3 node.

import { readFileSync, existsSync } from "fs";

const RPC = "http://127.0.0.1:8545";
const STATE_FILE = "hardhat-state.json";

async function rpc(method, params = []) {
  const res = await fetch(RPC, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", method, params, id: 1 }),
  });
  const json = await res.json();
  if (json.error) {
    throw new Error(json.error.message);
  }
  return json.result;
}

if (!existsSync(STATE_FILE)) {
  console.log("ℹ️  No saved state found. Skipping (run 'npm run deploy' if this is first time).");
  process.exit(0);
}

const raw = readFileSync(STATE_FILE, "utf-8").trim();
let payload;
try {
  payload = JSON.parse(raw);
} catch {
  payload = null;
}

if (!payload || payload.format !== "tx-replay" || !Array.isArray(payload.rawTransactions)) {
  console.error("❌ Saved state is from an older Hardhat dump format that this node cannot load.");
  console.error("   Delete blockchain/hardhat-state.json and run npm run deploy.");
  process.exit(1);
}

if (payload.rawTransactions.length === 0) {
  console.error("❌ Saved state has no transactions. Run npm run deploy.");
  process.exit(1);
}

try {
  await rpc("eth_blockNumber");
} catch {
  console.error("❌ Failed to load state: Hardhat node is not running on http://127.0.0.1:8545");
  process.exit(1);
}

try {
  for (const signedTx of payload.rawTransactions) {
    await rpc("eth_sendRawTransaction", [signedTx]);
  }
  console.log(`✅ Blockchain state restored from ${STATE_FILE} (${payload.rawTransactions.length} transactions)`);
  console.log("   All previous votes and contract data are back.");
} catch (err) {
  console.error("❌ Failed to load state:", err.message);
  process.exit(1);
}
