// Dumps the current Hardhat node state to hardhat-state.json
// Run: npm run save-state   (while node is running)

import { writeFileSync } from "fs";

const res = await fetch("http://127.0.0.1:8545", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ jsonrpc: "2.0", method: "hardhat_dumpState", params: [], id: 1 }),
});

const { result, error } = await res.json();

if (error) {
  console.error("❌ Failed to save state:", error.message);
  process.exit(1);
}

writeFileSync("hardhat-state.json", result);
console.log("✅ Blockchain state saved to hardhat-state.json");
