"use client";

import React, { useState, useEffect } from "react";

const challenges = ["smile", "angry", "surprise", "wink"];
const challengeMsgs: Record<string, string> = {
  smile: "Please Smile Wider (Show Teeth)",
  angry: "Please Frown Harder (Pinch Eyebrows)",
  surprise: "Please Open Mouth Wider (Say 'O')",
  wink: "Please Wink Harder (Close one eye tight)",
};

export default function MobileVerification() {
  const [sessionId, setSessionId] = useState("");
  const [voterId, setVoterId] = useState("");
  const [challenge, setChallenge] = useState("smile");
  const [status, setStatus] = useState("");
  const [file, setFile] = useState<File | null>(null);

  useEffect(() => {
    // Pick random expression challenge
    setChallenge(challenges[Math.floor(Math.random() * challenges.length)]);

    const params = new URLSearchParams(window.location.search);
    const sid = params.get("session_id");
    if (sid) {
      setSessionId(sid);
      // Automatically pair with corresponding voter ID
      fetch(`http://192.168.1.104:8000/session-status/${sid}`)
        .then(r => r.json())
        .then(data => {
          if (data.voter_id) setVoterId(data.voter_id);
        })
        .catch(console.error);
    }
  }, []);

  const handleImageCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0]);
    }
  };

  async function verifyIdentity() {
    if (!file) return setStatus("Please capture a selfie first");
    if (!voterId) return setStatus("Voter ID pairing failed. Session lost.");
    
    setStatus("Verifying face...");
    
    try {
      const formData = new FormData();
      formData.append("voter_id", voterId);
      if (sessionId) formData.append("session_id", sessionId);
      formData.append("file", file);

      const res = await fetch(`http://192.168.1.104:8000/verify/${challenge}`, {
        method: "POST",
        body: formData,
      });
      
      const data = await res.json();
      
      if (res.ok && data.verified) {
        setStatus("Success! You can now look at the Kiosk screen to cast your vote.");
      } else {
        setStatus("Verification failed: " + (data.detail || data.message || "Unknown error"));
      }
    } catch (err: any) {
      setStatus("Error: " + err.message);
    }
  }

  return (
    <div style={{ padding: 20, maxWidth: 400, margin: "auto", fontFamily: "sans-serif", textAlign: "center", background: "#f8fafc", minHeight: "100vh" }}>
      <h2>Biometric Challenge</h2>
      {voterId ? (
        <p style={{ color: "green", fontSize: 13, marginBottom: 20 }}>Authenticated as Voter: {voterId}</p>
      ) : (
        <p style={{ color: "red", fontSize: 13 }}>Attempting to sync session...</p>
      )}

      <div style={{ margin: "30px 0", padding: "20px", background: "white", borderRadius: 12, boxShadow: "0 4px 6px rgba(0,0,0,0.05)" }}>
        <h3 style={{ margin: "0 0 10px 0", color: "#333" }}>Action Required:</h3>
        <p style={{ fontWeight: "800", fontSize: 20, color: "#d97706", margin: 0 }}>
          {challengeMsgs[challenge]}
        </p>
      </div>

      <div style={{ margin: "20px 0" }}>
        <label style={{ display: "block", marginBottom: 10, fontWeight: "bold" }}>Take Photo with Challenge:</label>
        <input 
          type="file" 
          accept="image/*" 
          capture="user" 
          onChange={handleImageCapture}
          style={{ padding: "10px", width: "100%", boxSizing: "border-box" }}
        />
      </div>
      
      <button 
        onClick={verifyIdentity}
        style={{ marginTop: 10, padding: "14px", background: "#4f46e5", color: "white", border: "none", borderRadius: 8, width: "100%", fontSize: 16, fontWeight: 600 }}
      >
        Submit Identity Verification
      </button>

      <p style={{ marginTop: 20, fontWeight: "bold", color: "#333", background: status.includes("Success") ? "#dcfce7": "transparent", padding: 10, borderRadius: 8 }}>{status}</p>
    </div>
  );
}
