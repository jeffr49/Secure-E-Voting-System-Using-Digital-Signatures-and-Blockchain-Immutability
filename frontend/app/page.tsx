"use client";

import { useState } from "react";
import { ethers } from "ethers";
import { verifyFace } from "@/src/face-verification/mock";

export default function Home() {

  const [screen, setScreen] = useState("role");
  const [voterId, setVoterId] = useState("");
  const [voterData, setVoterData] = useState<any>(null);
  const [account, setAccount] = useState("");
  const [status, setStatus] = useState("");
  const [adminPass, setAdminPass] = useState("");
  const [counts, setCounts] = useState<number[]>([]);
  const [tries, setTries] = useState(0);

  const card: React.CSSProperties = {
    padding: 40,
    borderRadius: 14,
    boxShadow: "0 10px 30px rgba(0,0,0,0.1)",
    maxWidth: 520,
    margin: "60px auto",
    textAlign: "center",
    background: "white"
  };

  const button: React.CSSProperties = {
    padding: "14px 22px",
    margin: 8,
    borderRadius: 10,
    border: "none",
    background: "#4f46e5",
    color: "white",
    cursor: "pointer",
    fontWeight: 600
  };

  async function connectWallet() {
    const provider = new ethers.BrowserProvider(window.ethereum);
    const signer = await provider.getSigner();
    setAccount(await signer.getAddress());
  }

  async function lookupVoter() {
    const res = await fetch("http://localhost:4000/get-voter", {
      method: "POST",
      headers: {"Content-Type":"application/json"},
      body: JSON.stringify({ voterId })
    });

    if (!res.ok) return alert("Voter not found");

    const data = await res.json();
    setVoterData(data);
    setScreen("confirm");
  }

  function confirmNo() {
    const t = tries + 1;
    setTries(t);
    if (t >= 2) alert("Contact voting booth authority");
    setScreen("enter");
  }

  async function doFace() {
    setStatus("Verifying face...");
    if (await verifyFace(voterId)) {
      setStatus("");
      setScreen("vote");
    }
  }

  async function signVote(candidateId:number) {
    try {
      setStatus("Preparing vote...");

      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();

      const sessionId = ethers.keccak256(ethers.toUtf8Bytes(voterId));
      const nonce = Date.now();

      const voucherRes = await fetch("http://localhost:4000/generate-voucher",{
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({voterAddress:account,sessionId,nonce})
      });

      const voucherData = await voucherRes.json();

      if (!voucherRes.ok || !voucherData.voucher)
        throw new Error("Voucher failed");

      const {voucher,signature:adminSignature} = voucherData;

      const domain = {name:"SecureVoting",version:"1",chainId:11155111,verifyingContract: "0x2E18BffA0bcA72fa32dF254EeCd9a9e329848a41"};
      const types = {Vote:[{name:"candidateId",type:"uint256"},{name:"sessionId",type:"bytes32"},{name:"nonce",type:"uint256"},{name:"expiry",type:"uint256"}]};

      const vote = {candidateId,sessionId,nonce,expiry:voucher.expiry};

      const voterSignature = await signer.signTypedData(domain,types,vote);

      const submit = await fetch("http://localhost:4000/submit-vote",{
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({vote,voucher,voterSignature,adminSignature})
      });

      const r = await submit.json();

      if (!submit.ok) throw new Error(r.error);

      setStatus("Vote recorded ✔ Tx: "+r.txHash);

    } catch(e:any){
      setStatus(e.message);
    }
  }

  async function adminLogin(){
    if(adminPass==="admin123") setScreen("admin");
    else alert("Wrong password");
  }

  async function getCounts(){
    const res = await fetch("http://localhost:4000/vote-counts");
    setCounts(await res.json());
  }

  /* ================= UI ================= */

  if(screen==="role") return (
    <div style={card}>
      <h1>Secure Blockchain Voting</h1>
      <button style={button} onClick={()=>setScreen("enter")}>Voter</button>
      <button style={button} onClick={()=>setScreen("admin-login")}>Admin</button>
    </div>
  );

  if(screen==="enter") return (
    <div style={card}>
      <h2>Enter Registration Number</h2>
      <input value={voterId} onChange={e=>setVoterId(e.target.value)} />
      <br/>
      <button style={button} onClick={lookupVoter}>Lookup</button>
    </div>
  );

  if(screen==="confirm") return (
    <div style={card}>
      <h2>Confirm Details</h2>
      <p>{voterData.name}</p>
      <p>Age {voterData.age}</p>
      <p>Booth {voterData.booth_no}</p>
      <button style={button} onClick={()=>setScreen("face")}>Correct</button>
      <button style={button} onClick={confirmNo}>Wrong</button>
    </div>
  );

  if(screen==="face") return (
    <div style={card}>
      <h2>Face Verification</h2>
      <button style={button} onClick={doFace}>Verify</button>
      <p>{status}</p>
    </div>
  );

  if(screen==="vote") return (
    <div style={card}>
      <h2>Voting Dashboard</h2>
      {!account && <button style={button} onClick={connectWallet}>Connect Wallet</button>}
      {account && [1,2,3,4,5].map(c=>(
        <button key={c} style={button} onClick={()=>signVote(c)}>Vote Candidate {c}</button>
      ))}
      <p>{status}</p>
    </div>
  );

  if(screen==="admin-login") return (
    <div style={card}>
      <h2>Admin Login</h2>
      <input type="password" value={adminPass} onChange={e=>setAdminPass(e.target.value)} />
      <br/>
      <button style={button} onClick={adminLogin}>Login</button>
    </div>
  );

  if(screen==="admin") return (
    <div style={card}>
      <h2>Vote Counter</h2>
      <button style={button} onClick={getCounts}>Calculate Votes</button>
      {counts.map((c,i)=><p key={i}>Candidate {i+1}: {c}</p>)}
    </div>
  );

  return null;
}