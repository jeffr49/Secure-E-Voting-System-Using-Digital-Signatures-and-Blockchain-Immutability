// Restores a previously saved Hardhat state from hardhat-state.json
// Run: npm run load-state   (after starting node, before starting backend)

import { readFileSync, existsSync } from "fs";

const STATE_FILE = "hardhat-state.json";

if (!existsSync(STATE_FILE)) {
  console.log("ℹ️  No saved state found. Skipping (run 'npm run deploy' if this is first time).");
  process.exit(0);
}

const state = readFileSync(STATE_FILE, "utf-8");

const res = await fetch("http://127.0.0.1:8545", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ jsonrpc: "2.0", method: "hardhat_loadState", params: [state], id: 1 }),
});

const { result, error } = await res.json();

if (error) {
  console.error("❌ Failed to load state:", error.message);
  process.exit(1);
}

console.log("✅ Blockchain state restored from hardhat-state.json");
console.log("   All previous votes and contract data are back.");
