import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { ethers } from "ethers";
import { createClient } from "@supabase/supabase-js";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

/* ================= SUPABASE ================= */

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

/* ================= ADMIN WALLET ================= */

const wallet = new ethers.Wallet(process.env.ADMIN_PRIVATE_KEY);
const provider = new ethers.JsonRpcProvider(process.env.SEPOLIA_RPC_URL);
const signer = wallet.connect(provider);

/* ================= CONTRACT ================= */

const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS;

const voteAbi = [
  "function vote((uint256 candidateId,bytes32 sessionId,uint256 nonce,uint256 expiry),(address voter,bytes32 sessionId,uint256 nonce,uint256 expiry),bytes voterSignature,bytes adminSignature)"
];

const readAbi = ["function getVotes(uint256) view returns (uint256)"];

const contract = new ethers.Contract(CONTRACT_ADDRESS, voteAbi, signer);

/* ================= EIP712 ================= */

const domain = {
  name: "SecureVoting",
  version: "1",
  chainId: Number(process.env.CHAIN_ID),
  verifyingContract: CONTRACT_ADDRESS
};

const types = {
  Voucher: [
    { name: "voter", type: "address" },
    { name: "sessionId", type: "bytes32" },
    { name: "nonce", type: "uint256" },
    { name: "expiry", type: "uint256" }
  ]
};

/* ================= ROUTES ================= */

/* ----- VOTER LOOKUP ----- */
app.post("/get-voter", async (req, res) => {
  const { voterId } = req.body;

  if (!voterId) return res.status(400).json({ error: "Missing voterId" });

  const { data, error } = await supabase
    .from("voters")
    .select("*")
    .eq("voter_id", voterId)
    .single();

  if (error || !data) return res.status(404).json({ error: "Voter not found" });

  res.json(data);
});

/* ----- VOUCHER ----- */
app.post("/generate-voucher", async (req, res) => {
  try {
    const { voterAddress, sessionId, nonce } = req.body;

    if (!voterAddress || !sessionId || nonce === undefined)
      return res.status(400).json({ error: "Missing fields" });

    const expiry = Math.floor(Date.now() / 1000) + 300;

    const voucher = { voter: voterAddress, sessionId, nonce, expiry };

    const signature = await wallet.signTypedData(domain, types, voucher);

    res.json({ voucher, signature });
  } catch (e) {
    res.status(500).json({ error: "Voucher failed" });
  }
});

/* ----- SUBMIT VOTE ----- */
app.post("/submit-vote", async (req, res) => {
  try {
    const { vote, voucher, voterSignature, adminSignature } = req.body;

    const tx = await contract.vote(vote, voucher, voterSignature, adminSignature);
    await tx.wait();

    res.json({ success: true, txHash: tx.hash });
  } catch (e) {
    res.status(400).json({ error: e.reason || "Vote failed" });
  }
});

/* ----- ADMIN COUNT ----- */
app.get("/vote-counts", async (req, res) => {
  const readContract = new ethers.Contract(CONTRACT_ADDRESS, readAbi, provider);

  const counts = [];

  for (let i = 1; i <= 5; i++) {
    counts.push(await readContract.getVotes(i));
  }

  res.json(counts.map(Number));
});

app.listen(4000, () => console.log("Server running 4000"));