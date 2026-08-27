// Saves local chain history so it can be replayed after a Hardhat 3 restart.
// Hardhat 3 does not support hardhat_dumpState.

import { writeFileSync } from "fs";
import { JsonRpcProvider, Transaction } from "ethers";

const RPC = "http://127.0.0.1:8545";
const STATE_FILE = "hardhat-state.json";

function serializeTx(tx) {
  if (!tx?.signature) {
    throw new Error(`Transaction ${tx?.hash} is missing a signature and cannot be saved.`);
  }
  return Transaction.from({
    type: tx.type,
    to: tx.to,
    nonce: tx.nonce,
    gasLimit: tx.gasLimit,
    gasPrice: tx.gasPrice,
    maxPriorityFeePerGas: tx.maxPriorityFeePerGas,
    maxFeePerGas: tx.maxFeePerGas,
    data: tx.data,
    value: tx.value,
    chainId: tx.chainId,
    accessList: tx.accessList,
    signature: tx.signature,
  }).serialized;
}

try {
  const provider = new JsonRpcProvider(RPC);
  const latest = await provider.getBlockNumber();
  const rawTransactions = [];

  for (let blockNumber = 1; blockNumber <= latest; blockNumber++) {
    const block = await provider.getBlock(blockNumber, true);
    if (!block) continue;
    for (const tx of block.prefetchedTransactions) {
      rawTransactions.push(serializeTx(tx));
    }
  }

  if (rawTransactions.length === 0) {
    console.error("❌ Nothing to save. Deploy the contract before running save-state.");
    process.exit(1);
  }

  writeFileSync(
    STATE_FILE,
    JSON.stringify({ format: "tx-replay", rawTransactions }, null, 2)
  );
  console.log(`✅ Blockchain state saved to ${STATE_FILE} (${rawTransactions.length} transactions)`);
} catch (err) {
  const message = err?.message || String(err);
  if (message.includes("ECONNREFUSED") || message.includes("Failed to fetch") || message.includes("fetch failed")) {
    console.error("❌ Failed to save state: Hardhat node is not running on http://127.0.0.1:8545");
  } else {
    console.error("❌ Failed to save state:", message);
  }
  process.exit(1);
}
