"use client";

import React, { useState, useEffect } from "react";

export default function MobileRegistration() {
  const [sessionId, setSessionId] = useState("");
  const [voterId, setVoterId] = useState("");
  const [status, setStatus] = useState("");
  const [file, setFile] = useState<File | null>(null);

  useEffect(() => {
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

  async function registerIdentity() {
    if (!file) return setStatus("Please capture a selfie first");
    if (!voterId) return setStatus("Voter ID pairing failed. Session lost.");
    
    setStatus("Enrolling biometric profile...");
    
    try {
      const formData = new FormData();
      formData.append("voter_id", voterId);
      if (sessionId) formData.append("session_id", sessionId);
      formData.append("file", file);

      const res = await fetch(`http://192.168.1.104:8000/register-face`, {
        method: "POST",
        body: formData,
      });
      
      const data = await res.json();
      
      if (res.ok) {
        setStatus("Success! Your biometric identity has been securely enrolled. You can look back at the Kiosk screen.");
      } else {
        setStatus("Enrollment failed: " + (data.detail || data.message || "Unknown error"));
      }
    } catch (err: any) {
      setStatus("Error: " + err.message);
    }
  }

  return (
    <div style={{ padding: 20, maxWidth: 400, margin: "auto", fontFamily: "sans-serif", textAlign: "center", background: "#f8fafc", minHeight: "100vh" }}>
      <h2>Biometric Enrollment</h2>
      {voterId ? (
        <p style={{ color: "green", fontSize: 13, margin: "0 0 20px 0" }}>Enrolling Voter: <b>{voterId}</b></p>
      ) : (
        <p style={{ color: "red", fontSize: 13, margin: "0 0 20px 0" }}>Attempting to sync session...</p>
      )}

      <div style={{ margin: "20px 0", background: "white", padding: "20px", borderRadius: "12px", boxShadow: "0 4px 6px rgba(0,0,0,0.05)" }}>
        <p style={{ fontWeight: 600, margin: "0 0 10px 0", color: "#333" }}>Please take a clear setup selfie.</p>
        <p style={{ fontSize: 14, color: "#666", margin: "0 0 15px 0" }}>Ensure your face is well-lit and directly facing the camera. No expressions are required.</p>
        <input 
          type="file" 
          accept="image/*" 
          capture="user" 
          onChange={handleImageCapture}
          style={{ padding: "10px", width: "100%", boxSizing: "border-box" }}
        />
      </div>
      
      <button 
        onClick={registerIdentity}
        style={{ marginTop: 10, padding: "14px", background: "#7b39fc", color: "white", border: "none", borderRadius: 8, width: "100%", fontSize: 16, fontWeight: 600 }}
      >
        Submit Registration Image
      </button>

      <p style={{ marginTop: 20, fontWeight: "bold", color: "#333", background: status.includes("Success") ? "#dcfce7": "transparent", padding: 10, borderRadius: 8 }}>{status}</p>
    </div>
  );
}
