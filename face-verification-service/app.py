"""
Face Verification Service for SecureVoting.
Handles face encoding, liveness checks, and verification against Supabase voters table.
"""
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
import os
import socket

load_dotenv()


def resolve_lan_host() -> str:
    configured = (os.getenv("LOCAL_IP") or "").strip()
    if configured and configured not in {"localhost", "127.0.0.1", "::1"}:
        return configured
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as sock:
            sock.connect(("8.8.8.8", 80))
            return sock.getsockname()[0]
    except OSError:
        return configured or "localhost"

from database import get_voter, update_face_encoding
from io import BytesIO
from PIL import Image
import numpy as np
import cv2
import uuid

SESSION_STORE = {}
FACE_LOGIC_IMPORT_ERROR = None

try:
    from services.face_logic import encode_face, verify_face_match_with_challenge
except ModuleNotFoundError as exc:
    encode_face = None
    verify_face_match_with_challenge = None
    FACE_LOGIC_IMPORT_ERROR = exc


def require_face_logic():
    if FACE_LOGIC_IMPORT_ERROR is not None:
        raise HTTPException(
            status_code=503,
            detail=(
                "Face recognition dependencies are not installed. "
                "Run: pip install -r requirements.txt"
            ),
        )

app = FastAPI(title="SecureVoting Face Verification", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def health():
    return {"service": "face-verification", "status": "ok"}

@app.get("/create-session")
def create_session(voter_id: str = None):
    session_id = str(uuid.uuid4())
    SESSION_STORE[session_id] = {"status": "pending", "voter_id": voter_id}
    return {
        "session_id": session_id,
        "voter_id": voter_id,
        "qr_code_url": f"http://{resolve_lan_host()}:3000/mobile?session_id={session_id}"
    }

@app.get("/create-register-session")
def create_register_session(voter_id: str = None):
    session_id = str(uuid.uuid4())
    SESSION_STORE[session_id] = {"status": "pending", "voter_id": voter_id}
    return {
        "session_id": session_id,
        "voter_id": voter_id,
        "qr_code_url": f"http://{resolve_lan_host()}:3000/mobile/register?session_id={session_id}"
    }

@app.get("/session-status/{session_id}")
def session_status(session_id: str):
    if session_id not in SESSION_STORE:
        raise HTTPException(status_code=404, detail="Session not found")
    return SESSION_STORE[session_id]


@app.post("/verify/{challenge_type}")
async def verify_user(
    challenge_type: str,
    voter_id: str = Form(...),
    session_id: str = Form(None),
    file: UploadFile = File(...),
):
    """
    Verify a voter's face against stored encoding (1:1 match + liveness challenge).
    Used by the main frontend after voter lookup.
    """
    require_face_logic()

    user_data = get_voter(voter_id)
    if not user_data:
        raise HTTPException(status_code=404, detail="Invalid Voter ID")

    face_encoding = user_data.get("face_encoding")
    if not face_encoding:
        raise HTTPException(
            status_code=400,
            detail="No face registered for this voter. Complete registration first.",
        )

    if user_data.get("has_voted"):
        raise HTTPException(status_code=403, detail="This voter has already voted.")

    image_data = await file.read()
    
    is_match, message = verify_face_match_with_challenge(
        face_encoding, image_data, challenge_type
    )

    if is_match:
        if session_id and session_id in SESSION_STORE:
            SESSION_STORE[session_id] = {"status": "verified", "voter_id": voter_id}
        return {
            "verified": True,
            "message": message,
        }
    raise HTTPException(status_code=401, detail=message)


@app.post("/register-face")
async def register_face(
    voter_id: str = Form(...),
    session_id: str = Form(None),
    file: UploadFile = File(...),
):
    require_face_logic()

    user_data = get_voter(voter_id)
    if not user_data:
        raise HTTPException(status_code=404, detail="Voter not found. Add voter first.")

    image_bytes = await file.read()  # pass raw bytes, no PIL/numpy conversion

    encoding = encode_face(image_bytes)
    if not encoding:
        raise HTTPException(status_code=400, detail="No face detected in image.")

    ok = update_face_encoding(voter_id, encoding)
    if not ok:
        raise HTTPException(status_code=500, detail="Failed to save face encoding.")

    if session_id and session_id in SESSION_STORE:
        SESSION_STORE[session_id] = {"status": "registered", "voter_id": voter_id}

    return {"status": "success", "message": f"Face registered for voter {voter_id}."}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
