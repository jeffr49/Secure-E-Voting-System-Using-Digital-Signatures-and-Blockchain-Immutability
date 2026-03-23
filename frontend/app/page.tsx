"use client";

import React, { useState, useEffect } from "react";
import { ethers } from "ethers";
import { QRCodeSVG } from "qrcode.react";
import { Inter, Instrument_Serif, Manrope, Cabin } from "next/font/google";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabase = createClient(supabaseUrl, supabaseKey);

const inter = Inter({ subsets: ["latin"], weight: ["500"] });
const instrumentSerif = Instrument_Serif({ subsets: ["latin"], weight: ["400"], style: ["italic"] });
const manrope = Manrope({ subsets: ["latin"], weight: ["400", "500", "600"] });
const cabin = Cabin({ subsets: ["latin"], weight: ["500"] });

export default function Home() {
  const [screen, setScreen] = useState("idle");
  const [ephemeralWallet, setEphemeralWallet] = useState<any>(null);
  
  // Registration State
  const [regName, setRegName] = useState("");
  const [regAge, setRegAge] = useState("");
  const [regBooth, setRegBooth] = useState("");

  // QR Flow
  const [qrSessionId, setQrSessionId] = useState("");
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [voterId, setVoterId] = useState("");
  
  // Voting & Admin
  const [status, setStatus] = useState("");
  const [adminPass, setAdminPass] = useState("");
  const [counts, setCounts] = useState<number[]>([]);

  const [candidates, setCandidates] = useState<any[]>([]);

  async function fetchCandidates() {
    setScreen("candidates");
    setStatus("Loading candidates...");
    try {
      const { data, error } = await supabase.from("candidates").select("*").order("id");
      if (error) throw error;
      setCandidates(data || []);
      setStatus("");
    } catch (e: any) {
      console.error(e);
      setStatus("Error fetching candidates: " + e.message);
    }
  }

  const card: React.CSSProperties = {
    padding: 40,
    borderRadius: 24,
    backdropFilter: "blur(10px)",
    backgroundColor: "rgba(255,255,255,0.05)",
    border: "1.5px solid rgba(255,255,255,0.1)",
    maxWidth: 520,
    width: "90%",
    margin: "80px auto",
    textAlign: "center",
    color: "white",
    fontFamily: manrope.style.fontFamily
  };

  const button: React.CSSProperties = {
    padding: "14px 24px",
    margin: 8,
    borderRadius: 10,
    border: "none",
    background: "#7b39fc",
    color: "white",
    cursor: "pointer",
    fontFamily: cabin.style.fontFamily,
    fontWeight: 500,
    fontSize: "16px",
    lineHeight: "1.7",
    boxShadow: "0px 4px 16px rgba(123, 57, 252, 0.2)"
  };

  const secondaryBtn: React.CSSProperties = { ...button, background: "#2b2344", boxShadow: "none" };
  const inputStyle: React.CSSProperties = { padding: "12px", width: "80%", marginBottom: 10, borderRadius: 8, border: "1px solid rgba(255,255,255,0.2)", background: "rgba(0,0,0,0.3)", color: "white", fontFamily: manrope.style.fontFamily };

  const PageWrapper = ({ children }: { children: React.ReactNode }) => (
    <div style={{ position: "relative", minHeight: "100vh", backgroundColor: "#000000", overflow: "hidden", width: "100%" }}>
      <div style={{ position: "absolute", top: "215px", left: "50%", transform: "translateX(-50%)", width: "801px", height: "384px", backgroundColor: "#000000", borderRadius: "500px", filter: "blur(77.5px)", zIndex: 1, pointerEvents: "none" }} />
      <div style={{ position: "relative", zIndex: 2, display: "flex", flexDirection: "column", alignItems: "center", width: "100%" }}>
        <nav style={{ display: "flex", flexDirection: "row", justifyContent: "space-between", alignItems: "center", width: "100%", maxWidth: "1440px", padding: "16px 120px", height: "102px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "80px", cursor: "pointer" }} onClick={() => setScreen("idle")}>
            <div style={{ width: "134px", color: "white", fontSize: "24px", fontWeight: "bold", letterSpacing: "1px" }}>BIO-VOTE</div>
          </div>
          <button onClick={() => setScreen("idle")} style={{ backgroundColor: "rgba(255,255,255,0.1)", padding: "8px 16px", borderRadius: "8px", fontFamily: manrope.style.fontFamily, fontWeight: 600, fontSize: "14px", color: "white", border: "1px solid rgba(255,255,255,0.2)", cursor: "pointer" }}>Back to Home</button>
        </nav>
        {children}
      </div>
    </div>
  );

  async function handleLogin() {
    if (!voterId) return alert("Please enter Voter ID");
    
    // Original port 4000 was changed to 5000 in Step 3!
    const res = await fetch("http://localhost:5000/get-voter", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ voterId })
    });
    if (!res.ok) return alert("Voter not found. Please register.");
    
    const data = await res.json();
    if (data.has_voted) { alert("This voter has already voted."); return; }
    
    startVoting();
  }

  async function startVoting() {
    setScreen("qr-auth");
    setStatus("Initializing secure session...");

    try {
      const wallet = ethers.Wallet.createRandom();
      setEphemeralWallet(wallet);

      const res = await fetch(`http://localhost:8000/create-session?voter_id=${voterId}`);
      const data = await res.json();
      
      setQrSessionId(data.session_id);
      setQrDataUrl(data.qr_code_url); 
      setStatus("Please scan the QR code using your mobile phone to complete facial verification.");
    } catch (e) {
      console.error(e);
      setStatus("Failed to create session with Python backend.");
    }
  }

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (screen === "qr-auth" && qrSessionId) {
      interval = setInterval(async () => {
        try {
          const res = await fetch(`http://localhost:8000/session-status/${qrSessionId}`);
          const data = await res.json();
          if (data.status === "verified") {
            clearInterval(interval);
            setScreen("vote");
            setStatus("");
          }
        } catch (e) {
          console.error("Polling error:", e);
        }
      }, 2000);
    }
    return () => clearInterval(interval);
  }, [screen, qrSessionId]);

  async function signVote(candidateId: number) {
    if (!ephemeralWallet) return;
    try {
      setStatus("Preparing vote...");
      
      const sessionId = ethers.keccak256(ethers.toUtf8Bytes(voterId));
      const nonce = Date.now();

      const voucherRes = await fetch("http://localhost:5000/generate-voucher", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ voterAddress: ephemeralWallet.address, voterId, sessionId, nonce })
      });

      const voucherData = await voucherRes.json();
      if (!voucherRes.ok || !voucherData.voucher) throw new Error("Voucher failed");

      const { voucher, signature: adminSignature } = voucherData;

      const domain = { 
        name: "SecureVoting", 
        version: "1", 
        chainId: Number(process.env.NEXT_PUBLIC_CHAIN_ID || 11155111), 
        verifyingContract: process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || "0x2E18BffA0bcA72fa32dF254EeCd9a9e329848a41" 
      }; 
      const types = { Vote: [{ name: "candidateId", type: "uint256" }, { name: "sessionId", type: "bytes32" }, { name: "nonce", type: "uint256" }, { name: "expiry", type: "uint256" }] };

      const vote = { candidateId, sessionId, nonce, expiry: voucher.expiry };
      const voterSignature = await ephemeralWallet.signTypedData(domain, types, vote);

      const submit = await fetch("http://localhost:5000/submit-vote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vote, voucher, voterSignature, adminSignature, voterId })
      });

      const r = await submit.json();
      if (!submit.ok) throw new Error(r.error || "Failed");

      setStatus("Vote recorded ✔ Tx: " + r.txHash);
      
      setTimeout(() => {
        setEphemeralWallet(null);
        setScreen("idle");
        setStatus("");
        setVoterId("");
      }, 3000);
    } catch (e: any) {
      console.error(e);
      setStatus(e.message || "Error voting.");
    }
  }

  async function getCounts() {
    const res = await fetch("http://localhost:5000/vote-counts");
    setCounts(await res.json());
  }

  // ================= UI =================

  if (screen === "idle") return (
    <div style={{ position: "relative", minHeight: "100vh", backgroundColor: "#000000", overflow: "hidden", width: "100%" }}>
      {/* Background Video */}
      <video autoPlay loop muted playsInline style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", width: "120%", height: "120%", objectFit: "cover", transformOrigin: "bottom center", zIndex: 0, pointerEvents: "none" }}>
        <source src="https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260215_121759_424f8e9c-d8bd-4974-9567-52709dfb6842.mp4" type="video/mp4" />
      </video>

      {/* Blurred Pill */}
      <div style={{ position: "absolute", top: "215px", left: "50%", transform: "translateX(-50%)", width: "801px", height: "384px", backgroundColor: "#000000", borderRadius: "500px", filter: "blur(77.5px)", zIndex: 1, pointerEvents: "none" }} />

      {/* Content Layer */}
      <div style={{ position: "relative", zIndex: 2, display: "flex", flexDirection: "column", alignItems: "center", width: "100%" }}>
        {/* Navbar */}
        <nav style={{ display: "flex", flexDirection: "row", justifyContent: "space-between", alignItems: "center", width: "100%", maxWidth: "1440px", padding: "16px 120px", height: "102px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "80px" }}>
            <div style={{ width: "134px", color: "white", fontSize: "24px", fontWeight: "bold", letterSpacing: "1px" }}>
              BIO-VOTE
            </div>
            <div style={{ display: "flex", gap: "10px" }}>
              {["Home", "Technology", "Live Election", "Documentation"].map((item, idx) => (
                <a key={item} href="#" style={{ fontFamily: manrope.style.fontFamily, fontWeight: 500, fontSize: "14px", lineHeight: "22px", color: "white", padding: "4px 10px", textDecoration: "none", display: "flex", alignItems: "center", gap: idx === 1 ? "3px" : "0" }}>
                  {item}
                  {idx === 1 && (
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="6 9 12 15 18 9"></polyline>
                    </svg>
                  )}
                </a>
              ))}
            </div>
          </div>
          <div style={{ display: "flex", gap: "12px" }}>
            <button onClick={() => setScreen("admin-login")} style={{ backgroundColor: "white", padding: "8px 16px", borderRadius: "8px", fontFamily: manrope.style.fontFamily, fontWeight: 600, fontSize: "14px", lineHeight: "22px", color: "#171717", border: "1px solid #d4d4d4", cursor: "pointer" }}>Admin Portal</button>
            <button onClick={() => {}} style={{ backgroundColor: "#7b39fc", padding: "8px 16px", borderRadius: "8px", fontFamily: manrope.style.fontFamily, fontWeight: 600, fontSize: "14px", lineHeight: "22px", color: "#fafafa", border: "none", boxShadow: "0px 4px 16px rgba(23,23,23,0.04)", cursor: "pointer" }}>Connect Node</button>
          </div>
        </nav>

        {/* Hero Content */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", maxWidth: "871px", marginTop: "162px", gap: "24px", textAlign: "center" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "10px", alignItems: "center" }}>
            <h1 style={{ margin: 0, fontFamily: inter.style.fontFamily, fontWeight: 500, fontSize: "76px", color: "white", letterSpacing: "-2px", lineHeight: 1.15 }}>Secure your vote.</h1>
            <h1 style={{ margin: 0, fontFamily: instrumentSerif.style.fontFamily, fontWeight: 400, fontStyle: "italic", fontSize: "76px", color: "white", letterSpacing: "-2px", lineHeight: 1.15 }}>Decentralize democracy.</h1>
            <p style={{ margin: "14px 0 0 0", fontFamily: manrope.style.fontFamily, fontWeight: 400, fontSize: "18px", lineHeight: "26px", color: "#f6f7f9", opacity: 0.9, maxWidth: "613px" }}>
              A Sybil-resistant e-voting protocol powered by geometric facial liveness detection and Ethereum smart contracts. One person, one immutable vote.
            </p>
          </div>
          <div style={{ display: "flex", flexDirection: "row", gap: "16px", flexWrap: "wrap", justifyContent: "center" }}>
            <button onClick={() => setScreen("register")} style={{ backgroundColor: "#7b39fc", padding: "14px 24px", borderRadius: "10px", fontFamily: cabin.style.fontFamily, fontWeight: 500, fontSize: "16px", lineHeight: "1.7", color: "white", border: "none", cursor: "pointer" }}>Register Voter</button>
            <button onClick={() => setScreen("login")} style={{ backgroundColor: "#2b2344", padding: "14px 24px", borderRadius: "10px", fontFamily: cabin.style.fontFamily, fontWeight: 500, fontSize: "16px", lineHeight: "1.7", color: "#f6f7f9", border: "none", cursor: "pointer" }}>Verify Voter</button>
            <button onClick={fetchCandidates} style={{ backgroundColor: "transparent", padding: "14px 24px", borderRadius: "10px", fontFamily: cabin.style.fontFamily, fontWeight: 500, fontSize: "16px", lineHeight: "1.7", color: "#f6f7f9", border: "1px solid #7b39fc", cursor: "pointer" }}>See Candidates</button>
          </div>
        </div>

        {/* Dashboard Image Container */}
        <div style={{ marginTop: "80px", paddingBottom: "40px", width: "100%", display: "flex", justifyContent: "center" }}>
          <div style={{ width: "1163px", maxWidth: "90%", borderRadius: "24px", backdropFilter: "blur(10px)", backgroundColor: "rgba(255,255,255,0.05)", border: "1.5px solid rgba(255,255,255,0.1)", padding: "22.5px" }}>
            <img src="/dashboard-mock.png" alt="Biometric Dashboard" style={{ width: "100%", height: "auto", borderRadius: "8px", display: "block", objectFit: "cover", backgroundColor: "#111" }} />
          </div>
        </div>
      </div>
    </div>
  );

  if (screen === "login") return (
    <PageWrapper>
      <div style={card}>
        <h2 style={{ fontFamily: inter.style.fontFamily, fontWeight: 500, fontSize: "28px", marginBottom: "20px" }}>Enter Registration ID</h2>
        <input placeholder="Voter ID (e.g. V101)" value={voterId} onChange={(e) => setVoterId(e.target.value)} style={inputStyle} />
        <br/>
        <button style={button} onClick={handleLogin}>Continue & Verify Face</button>
      </div>
    </PageWrapper>
  );

  if (screen === "register") return (
    <PageWrapper>
      <div style={card}>
        <h2 style={{ fontFamily: inter.style.fontFamily, fontWeight: 500, fontSize: "28px", marginBottom: "20px" }}>Register New Voter</h2>
        <input placeholder="Voter ID (e.g. V101)" value={voterId} onChange={(e) => setVoterId(e.target.value)} style={inputStyle} />
        <input placeholder="Full Name" value={regName} onChange={(e) => setRegName(e.target.value)} style={inputStyle} />
        <input placeholder="Age" type="number" value={regAge} onChange={(e) => setRegAge(e.target.value)} style={inputStyle} />
        <input placeholder="Booth No" type="number" value={regBooth} onChange={(e) => setRegBooth(e.target.value)} style={inputStyle} />
        
        <button style={{...button, width: "80%", marginTop: "10px"}} onClick={async () => {
          if (!voterId || !regName) return alert("Required fields missing");
          const res = await fetch("http://localhost:5000/register-voter", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ voterId, name: regName, age: regAge, booth_no: regBooth })
          });
          if (res.ok) {
            alert("Voter saved! Now upload your reference face image.");
            setScreen("register-face");
          } else {
            alert("Database Error registering voter.");
          }
        }}>Register Details</button>
      </div>
    </PageWrapper>
  );
  
  if (screen === "register-face") return (
    <PageWrapper>
      <div style={card}>
        <h2 style={{ fontFamily: inter.style.fontFamily, fontWeight: 500, fontSize: "28px", marginBottom: "10px" }}>Face Enrollment</h2>
        <p style={{fontSize: 14, color: "#aaa", marginBottom: "20px"}}>Upload or capture your base biometric identity picture.</p>
        <div style={{ background: "rgba(0,0,0,0.3)", padding: "20px", borderRadius: "10px", border: "1px dashed rgba(255,255,255,0.2)" }}>
          <input type="file" accept="image/*" onChange={async (e) => {
            if (!e.target.files || !e.target.files.length) return;
            const file = e.target.files[0];
            const formData = new FormData();
            formData.append("voter_id", voterId);
            formData.append("file", file);
            setStatus("Uploading biometric schema...");
            const res = await fetch("http://localhost:8000/register-face", {
              method: "POST", body: formData
            });
            if (res.ok) {
              alert("Identity secured on-chain!");
              setScreen("idle");
              setStatus("");
            } else {
              setStatus("Failed to extract face encryption.");
            }
          }} style={{ color: "white" }} />
        </div>
        <p style={{color: "#ff4d4d", marginTop: "15px"}}>{status}</p>
        <button style={{...secondaryBtn, marginTop: "20px"}} onClick={() => setScreen("idle")}>Finish Later</button>
      </div>
    </PageWrapper>
  );

  if (screen === "qr-auth") return (
    <PageWrapper>
      <div style={card}>
        <h2 style={{ fontFamily: inter.style.fontFamily, fontWeight: 500, fontSize: "28px", marginBottom: "10px" }}>Authenticate to Vote</h2>
        <p style={{marginBottom: 20, color: "#ccc"}}>{status}</p>
        {qrDataUrl && (
          <div style={{ margin: "20px auto", padding: "16px", background: "white", display: "inline-block", borderRadius: "16px" }}>
            <QRCodeSVG value={qrDataUrl} size={256} />
          </div>
        )}
      </div>
    </PageWrapper>
  );

  if (screen === "vote") return (
    <PageWrapper>
      <div style={card}>
        <h2 style={{ fontFamily: inter.style.fontFamily, fontWeight: 500, fontSize: "28px", marginBottom: "10px" }}>Digital Ballot Box</h2>
        <p style={{ color: "#aaa", marginBottom: "30px" }}>Secure ID: {voterId}</p>
        <div style={{ display: "flex", flexDirection: "column", gap: "12px", width: "80%", margin: "0 auto" }}>
          {[0, 1, 2].map(c => (
            <button key={c} style={{...button, width: "100%", margin: 0}} onClick={() => signVote(c)}>Vote for Candidate {c}</button>
          ))}
        </div>
        <p style={{ marginTop: "20px", color: "#00ffcc" }}>{status}</p>
      </div>
    </PageWrapper>
  );

  if (screen === "candidates") return (
    <PageWrapper>
      <div style={{...card, maxWidth: "800px"}}>
        <h2 style={{ fontFamily: inter.style.fontFamily, fontWeight: 500, fontSize: "32px", marginBottom: "30px" }}>Live Election Candidates</h2>
        {status ? (
          <p style={{ color: "#aaa" }}>{status}</p>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px", textAlign: "left" }}>
            {candidates.map((c) => (
              <div key={c.id} style={{ background: "rgba(0,0,0,0.4)", padding: "20px", borderRadius: "16px", border: "1px solid rgba(255,255,255,0.1)" }}>
                <h3 style={{ margin: "0 0 5px 0", fontSize: "22px", fontFamily: inter.style.fontFamily, color: "white" }}>{c.name}</h3>
                <p style={{ margin: "0 0 10px 0", color: "#ae88f9", fontSize: "14px", fontWeight: "bold" }}>{c.party}</p>
                <p style={{ margin: 0, fontSize: "14px", color: "#ccc", lineHeight: "1.5" }}>{c.platform}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </PageWrapper>
  );

  if (screen === "admin-login") return (
    <PageWrapper>
      <div style={card}>
        <h2 style={{ fontFamily: inter.style.fontFamily, fontWeight: 500, fontSize: "28px", marginBottom: "20px" }}>Portal Access</h2>
        <input type="password" placeholder="Passphrase" value={adminPass} onChange={(e) => setAdminPass(e.target.value)} style={inputStyle} />
        <br />
        <button style={button} onClick={() => { if(adminPass === "admin123") setScreen("admin"); else alert("Invalid node credentials"); }}>Login Node</button>
      </div>
    </PageWrapper>
  );

  if (screen === "admin") return (
    <PageWrapper>
      <div style={card}>
        <h2 style={{ fontFamily: inter.style.fontFamily, fontWeight: 500, fontSize: "28px", marginBottom: "20px" }}>Immutable Ledger</h2>
        <button style={{...button, marginBottom: "20px"}} onClick={getCounts}>Sync Blockchain Votes</button>
        <div style={{ background: "rgba(0,0,0,0.4)", borderRadius: "10px", padding: "20px", textAlign: "left" }}>
          {counts.length === 0 ? <p style={{color: "#aaa", textAlign: "center"}}>No sync data.</p> : counts.map((c, i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderBottom: "1px solid rgba(255,255,255,0.1)", color: "white" }}>
              <span>Candidate {i}</span>
              <span style={{ fontWeight: "bold", color: "#00ffcc" }}>{c} Votes</span>
            </div>
          ))}
        </div>
      </div>
    </PageWrapper>
  );

  return null;
}