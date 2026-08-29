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
    .select("voter_id, name, age, booth_no, has_voted")
    .eq("voter_id", voterId)
    .single();

  if (error || !data) return res.status(404).json({ error: "Voter not found" });

  res.json(data);
});

function toRequiredInt(value, fieldName) {
  if (value === undefined || value === null || value === "") {
    return { error: `${fieldName} is required` };
  }
  const n = Number(value);
  if (!Number.isInteger(n)) {
    return { error: `${fieldName} must be a whole number` };
  }
  return { value: n };
}

/* ----- VOTER REGISTER ----- */
app.post("/register-voter", async (req, res) => {
  try {
    const { voterId, name, age, booth_no } = req.body;
    if (!voterId || !name) return res.status(400).json({ error: "Missing required fields" });

    const parsedAge = toRequiredInt(age, "Age");
    if (parsedAge.error) return res.status(400).json({ error: parsedAge.error });
    const parsedBooth = toRequiredInt(booth_no, "Booth number");
    if (parsedBooth.error) return res.status(400).json({ error: parsedBooth.error });

    const { error } = await supabase.from("voters").insert([{
      voter_id: String(voterId).trim(),
      name: String(name).trim(),
      age: parsedAge.value,
      booth_no: parsedBooth.value,
      has_voted: false
    }]);

    if (error) {
      if (error.code === "23505" || /duplicate key/i.test(error.message)) {
        return res.status(409).json({ error: "This voter ID is already registered." });
      }
      return res.status(400).json({ error: error.message });
    }
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message || "Database Error registering voter." });
  }
});

/* ----- GET VOTER ----- */
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
    const { voterAddress, voterId, sessionId, nonce } = req.body;

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
    const { vote, voucher, voterSignature, adminSignature, voterId } = req.body;

    const tx = await contract.vote(vote, voucher, voterSignature, adminSignature);
    await tx.wait();

    if (voterId) {
      await supabase.from("voters").update({ has_voted: true }).eq("voter_id", voterId);
    }

    res.json({ success: true, txHash: tx.hash });
  } catch (e) {
    res.status(400).json({ error: e.reason || "Vote failed" });
  }
});

/* ----- ADMIN COUNT ----- */
app.get("/vote-counts", async (req, res) => {
  try {
    const readContract = new ethers.Contract(CONTRACT_ADDRESS, readAbi, provider);

    const { data: candidates, error } = await supabase.from("candidates").select("id, name").order("id");
    if (error || !candidates) return res.status(500).json({ error: "DB Error" });

    const counts = [];
    for (const c of candidates) {
      const rawCount = await readContract.getVotes(c.id);
      counts.push({
        id: c.id,
        name: c.name,
        votes: Number(rawCount)
      });
    }

    res.json(counts);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));